import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateForumCommentDto {
  @ApiPropertyOptional({
    description:
      'Nội dung mới của lời giải hoặc bình luận cần chỉnh sửa (hỗ trợ KaTeX $...$)',
    example:
      "Cập nhật lời giải: Ta có đạo hàm $y' = 3(x - 1)^2 \\ge 0, \\forall x \\in \\mathbb{R}$. Do đó $m = 1$.",
    minLength: 2,
  })
  @IsOptional()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Nội dung bình luận tối thiểu 2 ký tự' })
  content?: string;

  @ApiPropertyOptional({
    description: 'Danh sách URL ảnh đính kèm mới',
    example: ['https://storage.schoolify.edu.vn/solutions/bai-giai-edited.jpg'],
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @IsArray({ message: 'attachments phải là một mảng chuỗi URL' })
  @IsString({ each: true, message: 'Mỗi đường dẫn đính kèm phải là chuỗi ký tự' })
  attachments?: string[] | null;

  @ApiPropertyOptional({
    description:
      'ID người gửi yêu cầu chỉnh sửa (dùng khi test trên Swagger không có Bearer token)',
    example: 'seed-teacher-01',
  })
  @IsOptional()
  @IsString()
  authorId?: string;
}

