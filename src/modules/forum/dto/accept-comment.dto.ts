import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AcceptCommentDto {
  @ApiPropertyOptional({
    description: 'ID của lời giải Cấp 1 cần công nhận là Lời giải chuẩn nhất',
    example: 'mock-comment-01',
  })
  @IsOptional()
  @IsString({ message: 'commentId phải là chuỗi ký tự' })
  commentId?: string;

  @ApiPropertyOptional({
    description: 'ID người thao tác (phải là chủ bài viết hoặc Admin/Teacher)',
    example: 'seed-student-01',
  })
  @IsOptional()
  @IsString({ message: 'userId phải là chuỗi ký tự' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Số lượng Ngọc Tri Thức (Knowledge Gems) thưởng cho người giải bài (mặc định 15 ngọc)',
    default: 15,
    example: 15,
  })
  @IsOptional()
  @IsNumber({}, { message: 'rewardGems phải là số nguyên' })
  @Min(1, { message: 'rewardGems tối thiểu là 1' })
  rewardGems?: number;
}
