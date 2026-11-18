import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ToggleReactionDto {
  @ApiProperty({
    description: 'Đối tượng thả phản ứng (POST: Bài hỏi, COMMENT: Bình luận/Lời giải)',
    enum: ['POST', 'COMMENT'],
    example: 'POST',
  })
  @IsNotEmpty({ message: 'targetType không được để trống' })
  @IsIn(['POST', 'COMMENT'], { message: 'targetType phải là POST hoặc COMMENT' })
  targetType: 'POST' | 'COMMENT';

  @ApiProperty({
    description: 'ID hoặc Slug của bài viết (nếu targetType là POST) hoặc ID của bình luận (nếu targetType là COMMENT)',
    example: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @IsNotEmpty({ message: 'targetId không được để trống' })
  @IsString({ message: 'targetId phải là chuỗi ký tự' })
  targetId: string;

  @ApiPropertyOptional({
    description: 'Loại phản ứng (mặc định LIKE - Thích/Hữu ích)',
    enum: ['LIKE', 'HELPFUL', 'UPVOTE', 'LOVE', 'HAHA'],
    default: 'LIKE',
    example: 'LIKE',
  })
  @IsOptional()
  @IsIn(['LIKE', 'HELPFUL', 'UPVOTE', 'LOVE', 'HAHA'], {
    message: 'reactionType không hợp lệ',
  })
  reactionType?: 'LIKE' | 'HELPFUL' | 'UPVOTE' | 'LOVE' | 'HAHA';

  @ApiPropertyOptional({
    description: 'ID người thả tim / like (nếu không dùng Bearer token)',
    example: 'seed-student-01',
  })
  @IsOptional()
  @IsString({ message: 'userId phải là chuỗi ký tự hợp lệ' })
  userId?: string;
}
