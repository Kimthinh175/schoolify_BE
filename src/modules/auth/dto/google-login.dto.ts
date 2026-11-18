import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiPropertyOptional({
    description: 'Google ID Token (JWT credential từ Google Identity Services)',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({
    description: 'Google OAuth2 Access Token (nếu dùng popup OAuth2 tokenClient)',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({
    description: 'Email Google (hỗ trợ chế độ local dev / E2E test)',
    example: 'nam.le.student@gmail.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Họ tên từ tài khoản Google',
    example: 'Lê Bảo Nam',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Google Subject ID (sub)',
    example: '109876543210123456789',
  })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiPropertyOptional({
    description: 'Ảnh đại diện từ Google',
    example: 'https://lh3.googleusercontent.com/a/default-user',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Vai trò đăng nhập (STUDENT, TEACHER, PARENT)',
    example: 'STUDENT',
    default: 'STUDENT',
  })
  @IsOptional()
  @IsString()
  profile_type?: 'STUDENT' | 'TEACHER' | 'PARENT';
}

export class SendOtpDto {
  @ApiProperty({
    description: 'Số điện thoại hoặc Email nhận mã OTP',
    example: '0987654321',
  })
  @IsNotEmpty({ message: 'Vui lòng cung cấp số điện thoại hoặc email' })
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Số điện thoại hoặc Email',
    example: '0987654321',
  })
  @IsNotEmpty({ message: 'Thiếu số điện thoại hoặc email' })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Mã OTP 6 chữ số',
    example: '123456',
  })
  @IsNotEmpty({ message: 'Thiếu mã OTP' })
  @IsString()
  otp: string;
}
