import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { GenerateMatrixExamDto, SubmitExamDto, SyncOfflineSubmissionsDto } from './dto/exam.dto';

@ApiTags('Exams & Practice (Khảo thí & Luyện thi)')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('matrix-generate')
  @ApiOperation({ summary: 'Sinh đề thi ngẫu nhiên theo ma trận Bloom & Chương' })
  @ApiResponse({ status: 200, description: 'Tạo đề thi thành công' })
  async generateMatrixExam(@Body() dto: GenerateMatrixExamDto) {
    const data = await this.examsService.generateMatrixExam(dto);
    return {
      success: true,
      message: 'Sinh đề thi ma trận thành công',
      data,
    };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Nộp bài thi, chấm điểm và lưu kết quả' })
  @ApiResponse({ status: 201, description: 'Chấm điểm và nộp bài thành công' })
  async submitExam(@Req() req: any, @Body() dto: SubmitExamDto) {
    const userId = req.user?.id || null;
    const data = await this.examsService.submitExam(userId, dto);
    return {
      success: true,
      message: 'Nộp bài thi và chấm điểm thành công',
      data,
    };
  }

  @Get('snapshots/:id')
  @ApiOperation({ summary: 'Lấy chi tiết bài thi đã làm (Snapshot) để xem lại bài' })
  @ApiResponse({ status: 200, description: 'Chi tiết bài thi snapshot' })
  async getSnapshotById(@Param('id') id: string) {
    const data = await this.examsService.getSnapshotById(id);
    return {
      success: true,
      message: 'Lấy snapshot bài thi thành công',
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Lấy danh sách lịch sử luyện đề' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Danh sách bài thi đã làm' })
  async getPracticeHistory(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const userId = req.user?.id || null;
    const data = await this.examsService.getPracticeHistory(userId, parseInt(page, 10), parseInt(limit, 10));
    return {
      success: true,
      data,
    };
  }

  @Post('sync-offline')
  @ApiOperation({ summary: 'Đồng bộ hàng đợi các bài thi làm khi mất mạng (Offline Sync)' })
  @ApiResponse({ status: 200, description: 'Đồng bộ thành công' })
  async syncOfflineSubmissions(@Body() dto: SyncOfflineSubmissionsDto) {
    const data = await this.examsService.syncOfflineSubmissions(dto);
    return {
      success: true,
      ...data,
    };
  }
}
