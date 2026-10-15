import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EvaluateSemanticCheckpointDto, AgentChatDto } from './dto/agent.dto';
import { SemanticCheckpointService } from './services/semantic-checkpoint.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { AntigravityIpcBridgeService } from './services/antigravity-ipc-bridge.service';

@ApiTags('AI Agent & Semantic Intelligence (Trợ lý Tác nhân & Đối soát Ngữ nghĩa)')
@Controller('agent')
export class AgentController {
  constructor(
    private readonly checkpointService: SemanticCheckpointService,
    private readonly cacheService: SemanticCacheService,
    private readonly ipcBridgeService: AntigravityIpcBridgeService,
  ) {}

  @Post('semantic-checkpoint')
  @ApiOperation({
    summary: 'Chấm điểm đối soát ngữ nghĩa bán tự động (Tự luận / Điền từ ngắn)',
    description:
      'Quy trình Hybrid: Dùng Vector lọc câu tương đồng của học sinh. Nếu phát hiện thì chuyển câu đó + Checkpoint sang AI IPC Bridge đối soát logic True/False.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả chấm điểm đối soát thành công' })
  async evaluateSemanticCheckpoint(@Body() dto: EvaluateSemanticCheckpointDto) {
    const data = await this.checkpointService.evaluate(dto);
    return {
      success: true,
      message: data.isCorrect ? 'Ý trả lời chính xác và thỏa mãn tiêu chí' : 'Ý trả lời chưa đạt tiêu chí',
      data,
    };
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Trò chuyện với AI Agentic Assistant (kèm Client Tool Actions)',
    description:
      'Kiểm tra Semantic Cache trước (<15ms). Nếu cache miss, gọi qua Antigravity Headless IPC Bridge và lưu vào Semantic Cache.',
  })
  @ApiResponse({ status: 200, description: 'Phản hồi từ AI Agent kèm danh sách Tool Actions' })
  async chatWithAgent(@Body() dto: AgentChatDto) {
    // 1. Kiểm tra Semantic Cache trước
    const cacheResult = await this.cacheService.findInCache(dto.message, dto.subject, dto.grade);

    if (cacheResult.hit && cacheResult.responseText) {
      return {
        success: true,
        fromCache: true,
        cacheSimilarity: cacheResult.similarity,
        data: {
          message: cacheResult.responseText,
          actions: cacheResult.clientActions || [],
        },
      };
    }

    // 2. Nếu Cache Miss -> Gọi qua Antigravity IPC Bridge
    const bridgeResult = await this.ipcBridgeService.generateAgentResponse(dto);

    // 3. Bất đồng bộ lưu vào Semantic Cache để tái sử dụng
    this.cacheService.saveToCache(
      dto.message,
      bridgeResult.message,
      bridgeResult.actions,
      dto.subject,
      dto.grade,
    );

    return {
      success: true,
      fromCache: false,
      data: bridgeResult,
    };
  }

  @Get('cache-stats')
  @ApiOperation({ summary: 'Xem thống kê hiệu suất của Semantic Cache' })
  async getCacheStats() {
    const data = await this.cacheService.getStats();
    return {
      success: true,
      data,
    };
  }
}
