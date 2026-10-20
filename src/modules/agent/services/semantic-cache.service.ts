import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SemanticCacheService implements OnModuleInit {
  private readonly logger = new Logger(SemanticCacheService.name);
  private extractorPipeline: any = null;
  private isModelLoading = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.USE_ONNX_EMBEDDING === 'true') {
      this.initModel().catch((err) => {
        this.logger.warn(`Chưa tải được mô hình embedding khởi đầu: ${err.message}`);
      });
    } else {
      this.logger.log(
        '⚡ SemanticCacheService khởi động chế độ Lightweight Vector Embedding (1024 chiều) — sẵn sàng tức thì!',
      );
    }
  }

  private async initModel() {
    if (process.env.USE_ONNX_EMBEDDING !== 'true') {
      return null;
    }
    if (this.extractorPipeline) return this.extractorPipeline;
    if (this.isModelLoading) {
      while (this.isModelLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.extractorPipeline;
    }

    try {
      this.isModelLoading = true;
      this.logger.log(
        'Đang tải mô hình nhúng đa ngôn ngữ SOTA Xenova/multilingual-e5-large (1024 chiều - ONNX)...',
      );
      const { pipeline } = await import('@xenova/transformers');
      this.extractorPipeline = await pipeline(
        'feature-extraction',
        'Xenova/multilingual-e5-large',
      );
      this.logger.log(
        '✅ Mô hình nhúng đa ngôn ngữ Xenova/multilingual-e5-large (1024 chiều) đã sẵn sàng!',
      );
      return this.extractorPipeline;
    } catch (err: any) {
      this.logger.error('Lỗi khi nạp mô hình nhúng:', err);
      return null;
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Tạo vector embedding chuẩn hóa 1024 chiều (dùng ONNX nếu bật USE_ONNX_EMBEDDING=true,
   * mặc định dùng thuật toán N-gram/Token Hashing 1024 chiều siêu nhẹ chống tràn RAM Node.js trên Windows)
   */
  private computeLightweightEmbedding(text: string): number[] {
    const dim = 1024;
    const vec = new Float64Array(dim);
    const normalized = text
      .toLowerCase()
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = normalized.split(' ').filter(Boolean);
    // Base bias so cosine similarity stays in a realistic [0.65, 1.0] range like multilingual-e5-large
    for (let i = 0; i < 64; i++) {
      vec[i] = 0.25;
    }

    const addFeature = (feature: string, weight: number) => {
      let h1 = 2166136261;
      let h2 = 16777619;
      for (let i = 0; i < feature.length; i++) {
        const c = feature.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 16777619);
        h2 ^= c;
        h2 = Math.imul(h2, 1099511628211 & 0xffffffff);
      }
      const idx = (Math.abs(h1) % (dim - 64)) + 64;
      const sign = (h2 & 1) === 0 ? 1 : -1;
      vec[idx] += sign * weight;
    };

    for (let i = 0; i < tokens.length; i++) {
      addFeature(`w:${tokens[i]}`, 2.0);
      if (i + 1 < tokens.length) {
        addFeature(`b:${tokens[i]}_${tokens[i + 1]}`, 1.5);
      }
      const w = tokens[i];
      for (let c = 0; c <= w.length - 3; c++) {
        addFeature(`g:${w.slice(c, c + 3)}`, 0.75);
      }
    }

    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm) || 1;
    const result = new Array<number>(dim);
    for (let i = 0; i < dim; i++) {
      result[i] = Number((vec[i] / norm).toFixed(6));
    }
    return result;
  }

  /**
   * Tính vector embedding chuẩn hóa cho chuỗi văn bản (1024 chiều)
   */
  async getEmbedding(text: string): Promise<number[]> {
    const extractor = await this.initModel();
    if (extractor) {
      const cleanText = text.trim().replace(/\s+/g, ' ');
      const prefixedText = cleanText.startsWith('query:') ? cleanText : `query: ${cleanText}`;
      const output = await extractor(prefixedText, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    }
    return this.computeLightweightEmbedding(text);
  }

  /**
   * Tính Cosine Similarity giữa 2 vector đã chuẩn hóa (tích vô hướng)
   */
  cosineSimilarity(v1: number[], v2: number[]): number {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dot = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
    }
    return dot;
  }

  /**
   * Tra cứu câu trả lời trong Semantic Cache theo độ tương đồng ngữ nghĩa
   * Ngưỡng mặc định: threshold = 0.92
   */
  async findInCache(
    queryText: string,
    subject?: string,
    grade?: number,
    threshold = 0.92,
  ): Promise<{
    hit: boolean;
    similarity?: number;
    responseText?: string;
    clientActions?: any;
    cachedQuery?: string;
  }> {
    try {
      const queryVector = await this.getEmbedding(queryText);

      const where: any = {};
      if (subject) where.subject = subject;
      if (grade) where.grade = grade;

      const cachedRecords = await this.prisma.semanticCache.findMany({
        where,
        take: 100,
        orderBy: { last_accessed_at: 'desc' },
      });

      if (!cachedRecords.length) {
        return { hit: false };
      }

      let bestMatch: (typeof cachedRecords)[0] | null = null;
      let maxSim = -1;

      for (const record of cachedRecords) {
        const recordVec = record.query_vector as number[];
        const sim = this.cosineSimilarity(queryVector, recordVec);
        if (sim > maxSim) {
          maxSim = sim;
          bestMatch = record;
        }
      }

      if (bestMatch && maxSim >= threshold) {
        await this.prisma.semanticCache.update({
          where: { id: bestMatch.id },
          data: {
            hit_count: { increment: 1 },
            last_accessed_at: new Date(),
          },
        });

        this.logger.log(
          `⚡ [Semantic Cache HIT] Tương đồng: ${(maxSim * 100).toFixed(1)}% với câu: "${bestMatch.query_text}"`,
        );

        return {
          hit: true,
          similarity: Number(maxSim.toFixed(4)),
          responseText: bestMatch.response_text,
          clientActions: bestMatch.client_actions,
          cachedQuery: bestMatch.query_text,
        };
      }

      return { hit: false, similarity: Number(maxSim.toFixed(4)) };
    } catch (err: any) {
      this.logger.error('Lỗi khi tra cứu Semantic Cache:', err);
      return { hit: false };
    }
  }

  /**
   * Lưu một cặp query-response mới vào Semantic Cache
   */
  async saveToCache(
    queryText: string,
    responseText: string,
    clientActions?: any,
    subject?: string,
    grade?: number,
  ): Promise<void> {
    try {
      const queryVector = await this.getEmbedding(queryText);
      await this.prisma.semanticCache.create({
        data: {
          query_text: queryText,
          query_vector: queryVector,
          response_text: responseText,
          client_actions: clientActions || null,
          subject: subject || null,
          grade: grade || null,
          hit_count: 1,
        },
      });
      this.logger.log(`💾 Đã lưu vào Semantic Cache: "${queryText.slice(0, 50)}..."`);
    } catch (err: any) {
      this.logger.warn('Không thể lưu vào Semantic Cache:', err);
    }
  }

  /**
   * Thống kê cache
   */
  async getStats() {
    const totalEntries = await this.prisma.semanticCache.count();
    const topHits = await this.prisma.semanticCache.findMany({
      orderBy: { hit_count: 'desc' },
      take: 5,
      select: {
        id: true,
        query_text: true,
        hit_count: true,
        last_accessed_at: true,
      },
    });

    return {
      totalEntries,
      topHits,
    };
  }
}
