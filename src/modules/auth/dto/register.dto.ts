import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Họ và tên đầy đủ của người dùng',
    example: 'Nguyễn Văn Thịnh',
  })
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  fullname: string;

  @ApiProperty({
    description: 'Địa chỉ Email duy nhất',
    example: 'thinh@schoolify.edu.vn',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    description: 'Mật khẩu tài khoản (tối thiểu 6 ký tự)',
    example: 'Password@123',
    minLength: 6,
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại liên hệ',
    example: '0912345678',
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Loại tài khoản muốn tạo profile mặc định',
    enum: ['TEACHER', 'STUDENT', 'PARENT'],
    example: 'TEACHER',
  })
  @IsOptional()
  @IsIn(['TEACHER', 'STUDENT', 'PARENT'], {
    message: 'Profile type phải là TEACHER, STUDENT hoặc PARENT',
  })
  profile_type?: 'TEACHER' | 'STUDENT' | 'PARENT';
}
