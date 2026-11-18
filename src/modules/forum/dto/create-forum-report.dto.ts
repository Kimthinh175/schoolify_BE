import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ForumReportReason, ForumTargetType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateForumReportDto {
  @ApiProperty({
    description: 'Đối tượng bị báo cáo (POST: Bài viết | COMMENT: Bình luận lời giải)',
    enum: ForumTargetType,
    example: ForumTargetType.POST,
  })
  @IsEnum(ForumTargetType)
  @IsNotEmpty()
  targetType: ForumTargetType;

  @ApiProperty({
    description: 'ID của bài viết hoặc bình luận bị báo cáo',
    example: 'demo-post-1',
  })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({
    description: 'Lý do báo cáo vi phạm quy tắc cộng đồng',
    enum: ForumReportReason,
    example: ForumReportReason.SPAM,
  })
  @IsEnum(ForumReportReason)
  @IsNotEmpty()
  reason: ForumReportReason;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết hành vi vi phạm',
    example: 'Bài viết chứa liên kết spam quảng cáo cờ bạc, không liên quan đến học tập.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Mảng URL ảnh chụp bằng chứng vi phạm',
    example: ['https://example.com/evidence1.png'],
  })
  @IsOptional()
  evidenceUrls?: string[];

  @ApiPropertyOptional({
    description: 'ID người báo cáo (fallback nếu chưa có JWT)',
    example: 'seed-student-01',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
