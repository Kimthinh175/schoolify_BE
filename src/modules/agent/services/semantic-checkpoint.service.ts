import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SemanticCacheService } from './semantic-cache.service';
import { AntigravityIpcBridgeService } from './antigravity-ipc-bridge.service';
import { EvaluateSemanticCheckpointDto } from '../dto/agent.dto';

export interface SemanticCheckpointResponse {
  isCorrect: boolean;
  questionId?: string;
  matchedSentence: string | null;
  vectorSimilarity: number;
  explanation: string;
  evaluationSource: 'VECTOR_FILTER_EARLY_EXIT' | 'AI_IPC_BRIDGE_EVALUATION';
}

@Injectable()
export class SemanticCheckpointService {
  private readonly logger = new Logger(SemanticCheckpointService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly semanticCacheService: SemanticCacheService,
    private readonly ipcBridgeService: AntigravityIpcBridgeService,
  ) {}

  /**
   * Chấm điểm đối soát ngữ nghĩa bán tự động cho câu hỏi Tự luận / Điền từ ngắn:
   * 1. Vector Search chia tách câu của học sinh, tính cosine similarity với rubricCheckpoint.
   * 2. Nếu không phát hiện câu nào có độ tương đồng đủ ngưỡng (< 0.65) -> Kết luận SAI ngay (Early Exit, 0 tốn AI).
   * 3. Nếu phát hiện câu tương đồng -> Bốc tách câu đó + Checkpoint gửi qua AI (Antigravity IPC Bridge) để phán định TRUE / FALSE.
   */
  async evaluate(dto: EvaluateSemanticCheckpointDto): Promise<SemanticCheckpointResponse> {
    const { questionId, studentAnswer, rubricCheckpoint } = dto;

    this.logger.log(`🔍 Bắt đầu chấm Semantic Checkpoint cho tiêu chí: "${rubricCheckpoint}"`);

    // 1. Chia tách đoạn văn của học sinh thành các câu/mệnh đề riêng biệt
    const sentences = studentAnswer
      .split(/[.!?;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3); // Lọc bỏ các mảnh quá ngắn

    if (sentences.length === 0) {
      return {
        isCorrect: false,
        questionId,
        matchedSentence: null,
        vectorSimilarity: 0,
        explanation: 'Học sinh chưa nhập câu trả lời hoặc câu trả lời không có nội dung.',
        evaluationSource: 'VECTOR_FILTER_EARLY_EXIT',
      };
    }

    // 2. Tính vector embedding cho Rubric Checkpoint
    const checkpointVector = await this.semanticCacheService.getEmbedding(rubricCheckpoint);

    // 3. Tính độ tương đồng cho từng câu trong bài làm của học sinh
    let maxSim = -1;
    let candidateSentence: string | null = null;

    for (const sentence of sentences) {
      const sentenceVector = await this.semanticCacheService.getEmbedding(sentence);
      const sim = this.semanticCacheService.cosineSimilarity(sentenceVector, checkpointVector);

      if (sim > maxSim) {
        maxSim = sim;
        candidateSentence = sentence;
      }
    }

    const similarityScore = Number(Math.max(0, maxSim).toFixed(4));
    this.logger.log(
      `📊 Vector Match cao nhất: ${(similarityScore * 100).toFixed(1)}% | Câu: "${candidateSentence}"`,
    );

    // 4. KIỂM TRA BỘ LỌC VECTOR (Calibrated cho 1024 chiều Xenova/multilingual-e5-large):
    // Chỉ cho đi tiếp sang AI nếu phát hiện câu tương đồng > 0.85 (85%)
    const VECTOR_FILTER_THRESHOLD = 0.85;
    if (similarityScore <= VECTOR_FILTER_THRESHOLD || !candidateSentence) {
      this.logger.log(`❌ [Vector Filter] Không phát hiện câu tương đồng -> Early Exit (False)`);

      // Ghi log vào database
      await this.logEvaluation(questionId, studentAnswer, rubricCheckpoint, null, similarityScore, false, 'Bài làm chưa đề cập đến nội dung của tiêu chí này.');

      return {
        isCorrect: false,
        questionId,
        matchedSentence: null,
        vectorSimilarity: similarityScore,
        explanation: 'Bài làm chưa đề cập đến nội dung của tiêu chí này.',
        evaluationSource: 'VECTOR_FILTER_EARLY_EXIT',
      };
    }

    // 5. NẾU PHÁT HIỆN CÂU TƯƠNG ĐỒNG -> Bắt buộc gửi câu đó + Checkpoint sang AI để phân xử TRUE hay FALSE
    this.logger.log(
      `🤖 [AI Bridge Evaluation] Gửi câu tương đồng sang AI IPC Bridge để đối soát logic True/False...`,
    );

    const aiEvalResult = await this.ipcBridgeService.evaluateSemanticLogic(
      candidateSentence,
      rubricCheckpoint,
      similarityScore,
    );

    // 6. Ghi log kết quả chấm vào PostgreSQL
    await this.logEvaluation(
      questionId,
      studentAnswer,
      rubricCheckpoint,
      candidateSentence,
      similarityScore,
      aiEvalResult.isCorrect,
      aiEvalResult.explanation,
    );

    return {
      isCorrect: aiEvalResult.isCorrect,
      questionId,
      matchedSentence: candidateSentence,
      vectorSimilarity: similarityScore,
      explanation: aiEvalResult.explanation,
      evaluationSource: 'AI_IPC_BRIDGE_EVALUATION',
    };
  }

  private async logEvaluation(
    questionId: string | undefined,
    studentAnswer: string,
    rubricCheckpoint: string,
    matchedSentence: string | null,
    vectorSimilarity: number,
    isCorrect: boolean,
    explanation: string,
  ) {
    try {
      await this.prisma.semanticCheckpointLog.create({
        data: {
          question_id: questionId || null,
          student_answer: studentAnswer,
          rubric_checkpoint: rubricCheckpoint,
          matched_sentence: matchedSentence,
          vector_similarity: vectorSimilarity,
          is_correct: isCorrect,
          explanation,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Không thể ghi log Semantic Checkpoint: ${err.message}`);
    }
  }
}
