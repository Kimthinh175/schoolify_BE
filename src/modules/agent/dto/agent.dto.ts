import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

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
}
