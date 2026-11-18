import { ApiPropertyOptional } from '@nestjs/swagger';
import { ForumReportStatus, ForumTargetType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class GetReportsQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái báo cáo',
    enum: ForumReportStatus,
    example: ForumReportStatus.PENDING,
  })
  @IsEnum(ForumReportStatus)
  @IsOptional()
  status?: ForumReportStatus;

  @ApiPropertyOptional({
    description: 'Lọc theo loại đối tượng (POST | COMMENT)',
    enum: ForumTargetType,
    example: ForumTargetType.POST,
  })
  @IsEnum(ForumTargetType)
  @IsOptional()
  targetType?: ForumTargetType;

  @ApiPropertyOptional({
    description: 'Trang cần lấy dữ liệu',
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng mục trên mỗi trang',
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
