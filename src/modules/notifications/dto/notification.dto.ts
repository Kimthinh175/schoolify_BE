import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @ApiPropertyOptional({
    description: 'UUID của user nhận thông báo hoặc "ALL" cho toàn hệ thống',
    example: 'ALL',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case cho userId',
    example: 'ALL',
  })
  @IsOptional()
  @IsString()
  user_id?: string | null;

  @ApiPropertyOptional({
    description: 'Chế độ gửi thông báo: BROADCAST_ALL | SINGLE_USER',
    example: 'BROADCAST_ALL',
  })
  @IsOptional()
  @IsString()
  target?: 'BROADCAST_ALL' | 'SINGLE_USER';

  @ApiPropertyOptional({
    description: 'Loại thông báo (INFO | SUCCESS | WARNING | ERROR | SYSTEM)',
    example: 'INFO',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  @ApiPropertyOptional({
    description:
      'Danh mục thông báo (SYSTEM | EXAM | FORUM | REWARD | ACCOUNT)',
    example: 'SYSTEM',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiProperty({
    description: 'Tiêu đề thông báo',
    example: 'Bảo trì hệ thống định kỳ',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Nội dung thông báo',
    example: 'Hệ thống sẽ nâng cấp lúc 23:00 tối nay.',
  })
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn liên kết khi bấm vào thông báo',
    example: '/exams',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;
}
