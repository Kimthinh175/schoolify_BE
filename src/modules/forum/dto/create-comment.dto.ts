import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateForumCommentDto {
  @ApiProperty({
    description:
      'Nội dung lời giải hoặc bình luận thảo luận (hỗ trợ định dạng KaTeX/LaTeX trong cặp dấu $...$ hoặc $$...$$)',
    example:
      "Ta có đạo hàm $y' = 3x^2 - 6mx + 3(2m - 1) = 3(x - 1)(x - 2m + 1)$. Để hàm số đồng biến thì...",
    minLength: 2,
  })
  @IsNotEmpty({ message: 'Nội dung lời giải hoặc bình luận không được để trống' })
  @IsString({ message: 'Nội dung phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Nội dung bình luận tối thiểu 2 ký tự' })
  content: string;

  @ApiPropertyOptional({
    description:
      'ID của bình luận cha nếu đây là phản hồi lồng Cấp 2. Để trống nếu đây là lời giải chính Cấp 1.',
    example: 'forum-seed-post-01-comment-accepted-01',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'parentId phải là chuỗi ID hợp lệ' })
  parentId?: string | null;

  @ApiPropertyOptional({
    description:
      'ID của người dùng được phản hồi trực tiếp (@mention) trong luồng thảo luận Cấp 2.',
    example: 'seed-teacher-01',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'replyToUserId phải là chuỗi ID hợp lệ' })
  replyToUserId?: string | null;

  @ApiPropertyOptional({
    description: 'Danh sách URL ảnh đính kèm (ảnh chụp bài giải hoặc tài liệu)',
    example: ['https://storage.schoolify.edu.vn/solutions/bai-giai-1.jpg'],
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @IsArray({ message: 'attachments phải là một mảng chuỗi URL' })
  @IsString({ each: true, message: 'Mỗi đường dẫn đính kèm phải là chuỗi ký tự' })
  attachments?: string[] | null;

  @ApiPropertyOptional({
    description:
      'ID của người đăng bình luận (dùng khi test trực tiếp trên Swagger UI không kèm Bearer Token)',
    example: 'seed-student-01',
  })
  @IsOptional()
  @IsString()
  authorId?: string;
}

