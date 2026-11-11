import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsObject, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ChapterRatioDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  chapterId: number;

  @ApiProperty({ example: 70 })
  @IsNumber()
  ratioPercent: number;
}

export class BloomRatioDto {
  @ApiProperty({ example: 40 })
  @IsNumber()
  nhanBiet: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  thongHieu: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  vanDung: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  vanDungCao: number;
}

export class GenerateMatrixExamDto {
  @ApiProperty({ example: 'toan-hoc' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  grade: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  totalQuestions: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional({ type: [ChapterRatioDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChapterRatioDto)
  chapters?: ChapterRatioDto[];

  @ApiPropertyOptional({ type: BloomRatioDto })
  @IsOptional()
  bloomRatio?: any;

  @ApiPropertyOptional()
  @IsOptional()
  bloomPercentages?: any;

  @ApiPropertyOptional({ example: 'Cực trị của hàm số' })
  @IsOptional()
  @IsString()
  topicTag?: string;

  @ApiPropertyOptional({ example: 'EASY' })
  @IsOptional()
  @IsString()
  targetDifficulty?: string;

  @ApiPropertyOptional({ example: 'TOPIC' })
  @IsOptional()
  @IsString()
  practiceMode?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @ApiPropertyOptional({ example: 'BASIC', description: 'Cấp độ đề thi: BASIC (3đ) | MEDIUM (4đ) | ADVANCED (9đ)' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'ID người dùng (nếu không truyền qua JWT)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Bỏ qua kiểm tra điểm (chỉ dành cho giáo viên, admin)' })
  @IsOptional()
  skipPointCheck?: boolean;

  @ApiPropertyOptional({ description: 'Có trừ điểm luôn khi sinh đề hay không (mặc định false - chỉ validate số dư)' })
  @IsOptional()
  deductPoints?: boolean;
}

export class SubmitExamDto {
  @ApiPropertyOptional({ example: 'SES-1791982545377' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    example: 'att_8f7b3c2e1a4d90e2b4f5a6c7d8e9f012',
    description: 'Mã phiên nộp bài bảo mật CSPRNG dạng att_[a-f0-9]{32} (nếu không gửi, Backend sẽ tự sinh CSPRNG)',
  })
  @IsOptional()
  @IsString()
  attemptToken?: string;

  @ApiPropertyOptional({ example: 'exam-toan-hoc-g12' })
  @IsOptional()
  @IsString()
  examId?: string;

  @ApiPropertyOptional({ example: 'Đề Luyện Trắc Nghiệm Toán 12' })
  @IsOptional()
  @IsString()
  examTitle?: string;

  @ApiPropertyOptional({ example: 'toan-hoc' })
  @IsOptional()
  @IsString()
  subjectSlug?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @ApiProperty({ example: 1200 })
  @IsOptional()
  @IsNumber()
  timeSpentSeconds?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isAutoSubmit?: boolean;

  @ApiPropertyOptional({ example: 'fp_chrome_linux_89412' })
  @IsOptional()
  @IsString()
  guestFingerprint?: string;

  @ApiProperty({
    example: {
      multipleChoices: { "q-101": "ans-1" },
      trueFalseAnswers: { "q-102": { "a": true, "b": false, "c": true, "d": false } },
      shortAnswers: { "q-103": "62" },
      essayAnswers: {}
    }
  })
  @IsOptional()
  answers?: {
    multipleChoices?: Record<string, string>;
    trueFalseAnswers?: Record<string, Record<string, boolean>>;
    shortAnswers?: Record<string, string>;
    essayAnswers?: Record<string, string>;
    flaggedIds?: Record<string, boolean>;
  } | Array<{
    questionId: string;
    selectedAnswerId?: string;
    textAnswer?: string;
    studentTextAnswer?: string;
    subAnswers?: Record<string, boolean>;
  }>;

  @ApiPropertyOptional({ description: 'Toàn bộ snapshot dữ liệu đề để lưu snapshot_data' })
  @IsOptional()
  snapshotData?: any;

  @ApiPropertyOptional({ example: 'BASIC', description: 'Cấp độ đề thi: BASIC (3đ) | MEDIUM (4đ) | ADVANCED (9đ)' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 8.8, description: 'Điểm số đã chấm từ đề thi (thang điểm 10)' })
  @IsOptional()
  @IsNumber()
  scoreOverride?: number;

  @ApiPropertyOptional({ example: false, description: 'Có trừ luôn phí vào phòng thi khi nộp bài hay không (nếu chưa trừ lúc bắt đầu)' })
  @IsOptional()
  deductEntryCost?: boolean;

  @ApiPropertyOptional({ description: 'ID người dùng (nếu không truyền qua JWT)' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class SyncOfflineSubmissionsDto {
  @ApiProperty({
    example: [
      {
        id: "sub-offline-1791982571254",
        sessionId: "SES-1791982545377",
        examId: "exam-toan-hoc-01",
        answers: {},
        timeSpentSeconds: 1200,
        submittedAt: "2026-10-14T12:00:00Z"
      }
    ]
  })
  @IsArray()
  submissions: any[];
}

export class DailyClaimPointsDto {
  @ApiPropertyOptional({ description: 'ID người dùng (tùy chọn nếu đã có JWT)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Cưỡng bức reset về 9 điểm để test' })
  @IsOptional()
  forceReset?: boolean;
}

export class StartExamWithPointsDto {
  @ApiProperty({
    example: 'BASIC',
    description: 'Cấp độ bài thi: BASIC / CO_BAN (3đ - làm được 3 bài/ngày), MEDIUM / TRUNG_BINH (4đ - làm được 2 bài/ngày), ADVANCED / GIOI (9đ - làm được 1 bài/ngày)',
  })
  @IsString()
  @IsNotEmpty()
  level: string;

  @ApiPropertyOptional({ example: 'exam-toan-12-co-ban-01' })
  @IsOptional()
  @IsString()
  examId?: string;

  @ApiPropertyOptional({ example: 'Đề luyện tập Toán 12 - Cấp độ Cơ bản' })
  @IsOptional()
  @IsString()
  examTitle?: string;

  @ApiPropertyOptional({ example: 'toan-hoc' })
  @IsOptional()
  @IsString()
  subjectSlug?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional({ description: 'ID người dùng (tùy chọn nếu đã có JWT)' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class SettleExamPointsDto {
  @ApiProperty({
    example: 9.2,
    description: 'Điểm bài thi trên thang điểm 10 (< 5đ: -1đ | 5 - 8.5đ: 0đ | 8.5 - 9.9đ: +1đ | 10đ: +2đ)',
  })
  @IsNumber()
  score: number;

  @ApiPropertyOptional({ example: 'BASIC', description: 'Cấp độ đề thi: BASIC (3đ) | MEDIUM (4đ) | ADVANCED (9đ)' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 'Đề luyện tập Toán 12 - Cấp độ Cơ bản' })
  @IsOptional()
  @IsString()
  examTitle?: string;

  @ApiPropertyOptional({ example: 'sub-123456' })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional({ example: 'SES-1791982545377' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Nếu true thì trừ cả phí mở đề (3đ/4đ/9đ) trước rồi mới cộng/trừ điểm kết quả bài thi',
  })
  @IsOptional()
  deductEntryCost?: boolean;

  @ApiPropertyOptional({ description: 'ID người dùng (tùy chọn nếu đã có JWT)' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class AdminAdjustPointsDto {
  @ApiPropertyOptional({ example: 9, description: 'Số điểm Tia Sáng làm đề (exam_points)' })
  @IsOptional()
  @IsNumber()
  examPoints?: number;

  @ApiPropertyOptional({ example: 100, description: 'Số điểm Ngọc Tri Thức / Kim Cương (points)' })
  @IsOptional()
  @IsNumber()
  diamonds?: number;

  @ApiPropertyOptional({ description: 'ID người dùng (mặc định là chính admin đang đăng nhập)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Ghi chú lý do điều chỉnh' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateQuestionBugReportDto {
  @ApiProperty({ example: 'q-toan-12-001', description: 'ID câu hỏi bị báo cáo' })
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({ example: 'Câu 12: Cực trị hàm số bậc ba', description: 'Tiêu đề hoặc mã hiển thị của câu hỏi' })
  @IsString()
  @IsNotEmpty()
  questionTitle: string;

  @ApiPropertyOptional({ example: 'Toán Học' })
  @IsOptional()
  @IsString()
  subjectName?: string;

  @ApiPropertyOptional({ description: 'Đoạn nội dung câu hỏi trích dẫn' })
  @IsOptional()
  @IsString()
  questionContentSnippet?: string;

  @ApiProperty({
    example: 'WRONG_ANSWER',
    enum: ['WRONG_ANSWER', 'KATEX_ERROR', 'TYPO_CONTENT', 'MATRIX_MISMATCH', 'OTHER'],
  })
  @IsString()
  @IsIn(['WRONG_ANSWER', 'KATEX_ERROR', 'TYPO_CONTENT', 'MATRIX_MISMATCH', 'OTHER'])
  issueType: 'WRONG_ANSWER' | 'KATEX_ERROR' | 'TYPO_CONTENT' | 'MATRIX_MISMATCH' | 'OTHER';

  @ApiPropertyOptional({ example: 'Sai đáp án chuẩn' })
  @IsOptional()
  @IsString()
  issueTypeLabel?: string;

  @ApiPropertyOptional({ example: 'Đáp án đúng phải là C thay vì A' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  studentName?: string;
}

export class UpdateQuestionBugReportStatusDto {
  @ApiProperty({ example: 'RESOLVED', enum: ['PENDING', 'RESOLVED'] })
  @IsString()
  @IsIn(['PENDING', 'RESOLVED'])
  status: 'PENDING' | 'RESOLVED';

  @ApiPropertyOptional({ example: 'Đã kiểm tra và cập nhật lại đáp án C.' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}


