import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import {
  DailyClaimPointsDto,
  GenerateMatrixExamDto,
  SettleExamPointsDto,
  StartExamWithPointsDto,
  SubmitExamDto,
  SyncOfflineSubmissionsDto,
} from './dto/exam.dto';

@ApiTags('Exams & Practice (Khảo thí & Luyện thi)')
@Controller(['exams', 'api/v1/exams'])
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

  /**
   * A. API Nộp bài thi bảo mật (POST /api/v1/exams/submissions)
   * - Yêu cầu Authorization: Bearer <access_token> (hoặc Cookie access_token)
   * - Trả về 201 Created kèm attemptToken (CSPRNG att_[a-f0-9]{32}), điểm số, số câu đúng/sai
   */
  @Post('submissions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Nộp bài thi bảo mật (sinh attemptToken CSPRNG att_[32 hex], gắn chặt quyền sở hữu userId chống IDOR)',
  })
  @ApiResponse({ status: 201, description: 'Nộp bài thành công, trả về attemptToken, điểm số, số câu đúng/sai' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn' })
  async createExamSubmission(@Req() req: any, @Body() dto: SubmitExamDto) {
    const currentUser = await this.examsService.resolveAuthenticatedUser(req, true);
    const data = await this.examsService.submitExam(currentUser!.id, dto);
    return {
      success: true,
      message: 'Nộp bài thi và chấm điểm thành công',
      attemptToken: data.attemptToken,
      submissionId: data.submissionId,
      score: data.score,
      maxScore: data.maxScore,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      totalQuestions: data.totalQuestions,
      data,
    };
  }

  /**
   * B. API Lấy kết quả bài thi theo Token (GET /api/v1/exams/results/:attemptToken)
   * - Kiểm tra phân quyền RBAC / Ownership (Chống IDOR):
   *   1. Chưa đăng nhập / token hết hạn -> 401 Unauthorized
   *   2. Học sinh khác không phải chủ sở hữu -> 403 Forbidden
   *   3. Đúng chủ sở hữu HOẶC Giáo viên / Phụ huynh liên kết / Admin -> 200 OK
   *   4. Token không tồn tại -> 404 Not Found
   */
  @Get('results/:attemptToken')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Lấy kết quả bài thi theo attemptToken (Bắt buộc phân quyền RBAC / Ownership chống IDOR: 401 / 403 / 404 / 200)',
  })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết kết quả bài thi thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn' })
  @ApiResponse({ status: 403, description: 'Truy cập bị từ chối (IDOR Protection - Không phải chủ sở hữu bài thi)' })
  @ApiResponse({ status: 404, description: 'attemptToken không tồn tại' })
  async getExamResultByAttemptToken(
    @Req() req: any,
    @Param('attemptToken') attemptToken: string,
  ) {
    const currentUser = await this.examsService.resolveAuthenticatedUser(req, true);
    const data = await this.examsService.getResultByAttemptToken(attemptToken, currentUser);
    return {
      success: true,
      message: 'Lấy kết quả bài thi thành công',
      attemptToken: data.attemptToken,
      data,
    };
  }

  @Get('submissions/:attemptToken')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alias: Lấy kết quả bài thi theo attemptToken (Chống IDOR)' })
  async getSubmissionByAttemptToken(
    @Req() req: any,
    @Param('attemptToken') attemptToken: string,
  ) {
    const currentUser = await this.examsService.resolveAuthenticatedUser(req, true);
    const data = await this.examsService.getResultByAttemptToken(attemptToken, currentUser);
    return {
      success: true,
      message: 'Lấy kết quả bài thi thành công',
      attemptToken: data.attemptToken,
      data,
    };
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nộp bài thi, chấm điểm, lưu kết quả và tự động tính thưởng/phạt điểm làm đề' })
  @ApiResponse({ status: 201, description: 'Chấm điểm và nộp bài thành công' })
  async submitExam(@Req() req: any, @Body() dto: SubmitExamDto) {
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || dto.userId || null;
    const data = await this.examsService.submitExam(userId, dto);
    return {
      success: true,
      message: 'Nộp bài thi và chấm điểm thành công',
      attemptToken: data.attemptToken,
      submissionId: data.submissionId,
      score: data.score,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      totalQuestions: data.totalQuestions,
      data,
    };
  }

  // ==========================================================================
  // CÁC API HỆ THỐNG ĐIỂM NĂNG LƯỢNG LÀM ĐỀ THI (/exams/points/*)
  // ==========================================================================

  @Get('points/rules')
  @ApiOperation({
    summary: 'Lấy quy tắc hệ thống điểm làm đề (9đ/ngày, Cơ bản 3đ, Trung bình 4đ, Giỏi 9đ, <5đ: -1đ, 5-8.5đ: 0đ, 8.5-9.9đ: +1đ, 10đ: +2đ)',
  })
  async getExamPointsRules() {
    const data = this.examsService.getExamPointsRules();
    return {
      success: true,
      message: 'Lấy quy tắc hệ thống điểm làm đề thành công',
      data,
    };
  }

  @Get('points/balance')
  @ApiOperation({
    summary: 'Lấy số dư điểm làm đề hôm nay (tự động cấp 9 điểm nếu sang ngày mới) & số bài có thể làm theo từng cấp độ',
  })
  @ApiQuery({ name: 'userId', required: false })
  async getExamPointBalance(@Req() req: any, @Query('userId') queryUserId?: string) {
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || queryUserId || null;
    const data = await this.examsService.getExamPointBalance(userId);
    return {
      success: true,
      message: 'Lấy số dư điểm làm đề thành công',
      data,
    };
  }

  @Post('points/daily-claim')
  @ApiOperation({
    summary: 'Nhận / Reset 9 điểm làm đề hàng ngày (đủ làm 3 bài Cơ bản, hoặc 2 bài Trung bình, hoặc 1 bài Giỏi)',
  })
  async claimDailyExamPoints(@Req() req: any, @Body() dto: DailyClaimPointsDto) {
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || dto?.userId || null;
    const data = await this.examsService.claimDailyExamPoints(userId, dto || {});
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post('points/start-exam')
  @ApiOperation({
    summary: 'Kiểm tra và trừ điểm khi bắt đầu làm đề thi (Cơ bản: -3đ, Trung bình: -4đ, Giỏi: -9đ)',
  })
  async startExamWithPoints(@Req() req: any, @Body() dto: StartExamWithPointsDto) {
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || dto.userId || null;
    const data = await this.examsService.startExamWithPoints(userId, dto);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post('points/settle-submission')
  @ApiOperation({
    summary: 'Tính thưởng / phạt điểm sau khi làm đề xong (< 5đ: -1đ | 5 - 8.5đ: 0đ | 8.5 - 9.9đ: +1đ | 10đ: +2đ)',
  })
  async settleExamSubmissionPoints(@Req() req: any, @Body() dto: SettleExamPointsDto) {
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || dto.userId || null;
    const data = await this.examsService.settleExamSubmissionPoints(userId, dto);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('points/history')
  @ApiOperation({ summary: 'Lịch sử biến động điểm làm đề của học sinh (Phân trang)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'actionType', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async getExamPointHistory(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('actionType') actionType?: string,
    @Query('userId') queryUserId?: string,
  ) {
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || queryUserId || null;
    const data = await this.examsService.getExamPointHistory(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
      actionType,
    );
    return {
      success: true,
      message: 'Lấy lịch sử điểm làm đề thành công',
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
    const authUser = await this.examsService.resolveAuthenticatedUser(req, false);
    const userId = authUser?.id || req.user?.id || req.query?.userId || null;
    const data = await this.examsService.getPracticeHistory(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
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

  @Get('questions')
  @ApiOperation({ summary: 'Danh sách câu hỏi trong Ngân hàng đề (Phân trang & Lọc)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'bloomLevel', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listQuestions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
    @Query('bloomLevel') bloomLevel?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.examsService.listQuestions({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      subject,
      grade: grade ? parseInt(grade, 10) : undefined,
      bloomLevel,
      search,
    });
    return {
      success: true,
      data,
    };
  }

  @Post('questions')
  @ApiOperation({ summary: 'Thêm câu hỏi mới vào Ngân hàng đề' })
  async createQuestion(@Body() body: any) {
    const data = await this.examsService.createQuestion(body);
    return {
      success: true,
      message: 'Tạo câu hỏi mới thành công',
      data,
    };
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Cập nhật câu hỏi trong Ngân hàng đề' })
  async updateQuestion(@Param('id') id: string, @Body() body: any) {
    const data = await this.examsService.updateQuestion(id, body);
    return {
      success: true,
      message: 'Cập nhật câu hỏi thành công',
      data,
    };
  }

  @Delete('questions/:id')
  @ApiOperation({ summary: 'Xóa câu hỏi khỏi Ngân hàng đề' })
  async deleteQuestion(@Param('id') id: string) {
    const data = await this.examsService.deleteQuestion(id);
    return {
      success: true,
      message: 'Xóa câu hỏi thành công',
      data,
    };
  }

  @Get('templates')
  @ApiOperation({ summary: 'Danh sách bộ đề thi mẫu (Exam Templates)' })
  async listTemplates() {
    const data = await this.examsService.listTemplates();
    return {
      success: true,
      data,
    };
  }
}

@ApiTags('Exam Points System (Hệ thống Điểm làm đề thi)')
@Controller('points')
export class ExamPointsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get('rules')
  @ApiOperation({
    summary: 'Quy tắc điểm làm đề: 9đ/ngày (3 Cơ bản / 2 Trung bình / 1 Giỏi), <5đ: -1đ, 5-8.5đ: 0đ, 8.5-9.9đ: +1đ, 10đ: +2đ',
  })
  async getRules() {
    return {
      success: true,
      message: 'Lấy quy tắc hệ thống điểm làm đề thành công',
      data: this.examsService.getExamPointsRules(),
    };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Lấy số dư điểm làm đề hôm nay & hạn mức bài thi theo từng cấp độ' })
  @ApiQuery({ name: 'userId', required: false })
  async getBalance(@Req() req: any, @Query('userId') queryUserId?: string) {
    const userId = req.user?.id || queryUserId || null;
    const data = await this.examsService.getExamPointBalance(userId);
    return {
      success: true,
      message: 'Lấy số dư điểm làm đề thành công',
      data,
    };
  }

  @Post('daily-claim')
  @ApiOperation({ summary: 'Phát / Reset 9 điểm làm đề hàng ngày' })
  async claimDaily(@Req() req: any, @Body() dto: DailyClaimPointsDto) {
    const userId = req.user?.id || dto?.userId || null;
    const data = await this.examsService.claimDailyExamPoints(userId, dto || {});
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post('start-exam')
  @ApiOperation({ summary: 'Kiểm tra và trừ điểm khi bắt đầu làm đề (Cơ bản: -3đ, Trung bình: -4đ, Giỏi: -9đ)' })
  async startExam(@Req() req: any, @Body() dto: StartExamWithPointsDto) {
    const userId = req.user?.id || dto.userId || null;
    const data = await this.examsService.startExamWithPoints(userId, dto);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post('settle-submission')
  @ApiOperation({ summary: 'Tính thưởng / phạt điểm sau khi hoàn thành đề (< 5đ: -1đ | 5 - 8.5đ: 0đ | 8.5 - 9.9đ: +1đ | 10đ: +2đ)' })
  async settleSubmission(@Req() req: any, @Body() dto: SettleExamPointsDto) {
    const userId = req.user?.id || dto.userId || null;
    const data = await this.examsService.settleExamSubmissionPoints(userId, dto);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Lịch sử biến động điểm làm đề' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'actionType', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async getHistory(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('actionType') actionType?: string,
    @Query('userId') queryUserId?: string,
  ) {
    const userId = req.user?.id || queryUserId || null;
    const data = await this.examsService.getExamPointHistory(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
      actionType,
    );
    return {
      success: true,
      message: 'Lấy lịch sử điểm làm đề thành công',
      data,
    };
  }
}


