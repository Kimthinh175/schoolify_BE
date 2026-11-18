import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ForumReportStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolveReportDto {
  @ApiProperty({
    description: 'Trạng thái xử lý báo cáo (RESOLVED: Chấp thuận & xử lý | REJECTED: Từ chối báo cáo)',
    enum: ForumReportStatus,
    example: ForumReportStatus.RESOLVED,
  })
  @IsEnum(ForumReportStatus)
  @IsNotEmpty()
  status: ForumReportStatus;

  @ApiPropertyOptional({
    description: 'Hành động kiểm duyệt (NONE | HIDE_CONTENT | DELETE_CONTENT | WARN_USER | BAN_USER)',
    example: 'HIDE_CONTENT',
  })
  @IsString()
  @IsOptional()
  moderationAction?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú của Quản trị viên khi xử lý báo cáo',
    example: 'Đã xác nhận nội dung vi phạm quy tắc cộng đồng, đã ẩn nội dung.',
  })
  @IsString()
  @IsOptional()
  adminNote?: string;
}
