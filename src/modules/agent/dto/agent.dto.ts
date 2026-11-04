import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class EvaluateSemanticCheckpointDto {
  @ApiPropertyOptional({
    description: 'ID của câu hỏi cần chấm (nếu có)',
    example: 'db-sinh-hoc-ch1-essay-01',
  })
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiProperty({
    description: 'Đoạn văn hoặc câu trả lời tự luận của học sinh',
    example: 'Quá trình quang hợp diễn ra chủ yếu ở bào quan lục lạp của tế bào thực vật nhờ có chất diệp lục.',
  })
  @IsNotEmpty({ message: 'studentAnswer không được để trống' })
  @IsString()
  studentAnswer: string;

  @ApiProperty({
    description: 'Ý chính / Tiêu chí barem (checkpoint) cần đối soát',
    example: 'Quang hợp diễn ra tại bào quan lục lạp',
  })
  @IsNotEmpty({ message: 'rubricCheckpoint không được để trống' })
  @IsString()
  rubricCheckpoint: string;
}

export class AgentChatDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn người dùng gửi cho AI Agent',
    example: 'Em học lực khá, tạo cho em đề thi thử Toán 12 bám sát đề minh họa với',
  })
  @IsNotEmpty({ message: 'message không được để trống' })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Mã phiên trò chuyện',
    example: 'chat-sess-179204000',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn URL hiện tại học sinh đang đứng trên Frontend',
    example: '/student/practice/exam-room',
  })
  @IsOptional()
  @IsString()
  currentUrl?: string;

  @ApiPropertyOptional({
    description: 'Môn học quan tâm',
    example: 'toan-hoc',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Khối lớp',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional({
    description: 'Dữ liệu ngữ cảnh bổ sung (câu hỏi đang làm, điểm số vừa đạt...)',
  })
  @IsOptional()
  context?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Lịch sử hội thoại nhiều lượt (Multi-turn Context)',
  })
  @IsOptional()
  @IsArray()
  history?: any[];

  @ApiPropertyOptional({
    description: 'ID người dùng học sinh (để kiểm tra và trừ Điểm Xịn)',
    example: 'usr-student-01',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class DocxScanGenerateDto {
  @ApiProperty({
    description: 'Số lượng câu hỏi muốn AI sinh ra trong phạm vi kiến thức của đề',
    example: 15,
    default: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  targetCount?: number = 15;

  @ApiPropertyOptional({
    description: 'Nội dung văn bản hoặc HTML đã bóc tách từ file .docx (nếu gửi qua JSON thay vì multipart file)',
  })
  @IsOptional()
  @IsString()
  rawText?: string;

  @ApiPropertyOptional({
    description: 'Tên file đề thi .docx tải lên',
    example: 'De_Thi_Thu_Toan_12_GK1.docx',
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({
    description: 'Môn học chỉ định (nếu để trống AI sẽ tự động nhận diện từ nội dung đề)',
    example: 'toan-hoc',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Khối lớp (mặc định tự nhận diện hoặc 12)',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional({
    description: 'Tỉ lệ % hoặc cấu hình mức độ nhận thức Bloom mong muốn (JSON string hoặc Object)',
    example: { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 },
  })
  @IsOptional()
  bloomRatio?: any;

  @ApiPropertyOptional({
    description: 'Danh sách câu hỏi gốc đã parse sơ bộ từ client (nếu có)',
  })
  @IsOptional()
  seedQuestions?: any;

  @ApiPropertyOptional({
    description: 'Có tự động lưu ngay các câu hỏi sinh ra vào PostgreSQL Question Bank hay không',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  saveToBank?: boolean = false;
}

export class SaveGeneratedQuestionsDto {
  @ApiProperty({
    description: 'Danh sách câu hỏi đã được AI sinh và Admin duyệt để lưu vào Ngân hàng câu hỏi PostgreSQL',
  })
  @IsArray()
  questions: any[];

  @ApiPropertyOptional({
    description: 'Môn học mặc định cho lô câu hỏi',
    example: 'toan-hoc',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Khối lớp mặc định',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  grade?: number;
}

export class AgentChatResponseDataDto {
  @ApiProperty({ description: 'Nguồn sinh câu trả lời', example: 'ANTIGRAVITY_AGENT' })
  source: string;

  @ApiProperty({
    description: 'Nội dung phản hồi từ AI',
    example: 'Chào bạn! Tớ là Trợ lý AI Schoolify...',
  })
  message: string;

  @ApiProperty({ description: 'Danh sách thao tác điều hướng hoặc tương tác giao diện', example: [] })
  actions: any[];

  @ApiPropertyOptional({
    description: 'Biểu cảm robot kèm câu trả lời (1 trong 13 trạng thái)',
    enum: [
      'default',
      'happy',
      'excited',
      'wink',
      'thinking',
      'idea',
      'love',
      'celebrate',
      'sad',
      'angry',
      'sleeping',
      'surprised',
      'stunned',
    ],
    example: 'thinking',
  })
  emotion?: string;

  @ApiPropertyOptional({
    description: 'Thời gian duy trì biểu cảm (ms, 1000 - 15000)',
    example: 4000,
    default: 4000,
  })
  emotionDurationMs?: number;

  @ApiPropertyOptional({ description: 'Chi tiết điểm và token tiêu thụ' })
  pointUsage?: any;

  @ApiPropertyOptional({
    description: 'Danh sách 2-3 gợi ý hành động ngữ cảnh tiếp theo (Dynamic Suggestions)',
    example: ['Tạo đề Toán 12 mức độ khó', 'Gợi ý giải bài tập Socratic'],
  })
  suggestions?: string[];
}

export class AgentChatResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional()
  pointUsage?: any;

  @ApiProperty({ type: () => AgentChatResponseDataDto })
  data: AgentChatResponseDataDto;
}

