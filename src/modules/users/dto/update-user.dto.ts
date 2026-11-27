import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  exam_points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  examPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  date_of_birth?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  dateOfBirth?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  grade_level?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  gradeLevel?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  school_name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipped_frame?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equippedFrame?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  active_package?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activePackage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  package_expires_at?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  packageExpiresAt?: string | null;

  @ApiPropertyOptional({ enum: ['SUPER_ADMIN', 'STUDENT'] })
  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'STUDENT'])
  role?: 'SUPER_ADMIN' | 'STUDENT';
}
