import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SemanticCacheService implements OnModuleInit {
  private readonly logger = new Logger(SemanticCacheService.name);
  private extractorPipeline: any = null;
  private isModelLoading = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Tải mô hình embedding ở chế độ nền khi module khởi động
    this.initModel().catch((err) => {
      this.logger.warn(`Chưa tải được mô hình embedding khởi đầu: ${err.message}`);
    });
  }

  private async initModel() {
    if (this.extractorPipeline) return this.extractorPipeline;
    if (this.isModelLoading) {
      while (this.isModelLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.extractorPipeline;
    }

    try {
      this.isModelLoading = true;
      this.logger.log('Đang tải mô hình nhúng cục bộ Xenova/all-MiniLM-L6-v2 (ONNX)...');
      const { pipeline } = await import('@xenova/transformers');
      this.extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.logger.log('✅ Mô hình nhúng cục bộ đã sẵn sàng!');
      return this.extractorPipeline;
    } catch (err: any) {
      this.logger.error('Lỗi khi nạp mô hình nhúng:', err);
      throw err;
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Tính vector embedding chuẩn hóa cho chuỗi văn bản (384 chiều)
   */
  async getEmbedding(text: string): Promise<number[]> {
    const extractor = await this.initModel();
    const cleanText = text.trim().replace(/\s+/g, ' ');
    const output = await extractor(cleanText, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
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

      // Lọc các bản ghi cache gần nhất theo môn/khối (nếu có)
      const where: any = {};
      if (subject) where.subject = subject;
      if (grade) where.grade = grade;

      const cachedRecords = await this.prisma.semanticCache.findMany({
        where,
        take: 100, // Lấy 100 mẫu gần nhất để so sánh
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
        // Tăng số lượt hit
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
