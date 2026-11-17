import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type CommentSortOption = 'best' | 'newest' | 'oldest' | 'most_liked';

export class GetPostCommentsQueryDto {
  @ApiPropertyOptional({
    description: 'Trang hiện tại (phân trang theo bình luận gốc cấp 1)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng bình luận gốc (cấp 1) trên mỗi trang',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Tiêu chí sắp xếp các bình luận còn lại (lời giải được chấp nhận is_accepted = true luôn được ghim lên đầu tiên)',
    enum: ['best', 'newest', 'oldest', 'most_liked'],
    default: 'best',
  })
  @IsOptional()
  @IsString()
  @IsIn(['best', 'newest', 'oldest', 'most_liked'])
  sort?: CommentSortOption = 'best';

  @ApiPropertyOptional({
    description:
      'ID người dùng hiện tại (tùy chọn) để kiểm tra trạng thái đã thả cảm xúc/vote trên từng lời giải',
    example: 'student-user-id',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
