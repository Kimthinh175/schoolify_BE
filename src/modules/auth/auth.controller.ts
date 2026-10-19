import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto, SendOtpDto, VerifyOtpDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
    description: 'Đăng ký tài khoản User và tự động gán HTTP-Only Cookie chứa access_token',
  })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, trả về thông tin user và set cookie' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.authService.register(registerDto);

    this.setTokenCookie(res, accessToken);

    return {
      message: 'Đăng ký tài khoản thành công',
      user,
      accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập hệ thống',
    description: 'Xác thực Email & Password, gán JWT token vào HTTP-Only Cookie "access_token"',
  })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về user và set cookie' })
  @ApiResponse({ status: 401, description: 'Sai email hoặc mật khẩu' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.authService.login(loginDto);

    this.setTokenCookie(res, accessToken);

    return {
      message: 'Đăng nhập thành công',
      user,
      accessToken,
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập / Đăng ký bằng Google OAuth2 (Ported từ src)',
    description: 'Xác thực Google ID Token / OAuth2, tự động tạo hoặc liên kết User + Profile và cấp JWT cookie',
  })
  @ApiResponse({ status: 200, description: 'Đăng nhập Google thành công' })
  async googleLogin(
    @Body() googleDto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, googleClientId } = await this.authService.googleLogin(googleDto);

    this.setTokenCookie(res, accessToken);

    return {
      message: 'Đăng nhập bằng Google thành công',
      user,
      accessToken,
      googleClientId,
    };
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi mã OTP qua Số điện thoại',
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác thực mã OTP và Đăng nhập / Đăng ký tự động',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.authService.verifyOtp(dto);

    this.setTokenCookie(res, accessToken);

    return {
      message: 'Xác thực OTP và đăng nhập thành công',
      user,
      accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất khỏi hệ thống',
    description: 'Xoá HTTP-Only Cookie "access_token" trên trình duyệt',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công, cookie đã được clear' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Đăng xuất thành công',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản hiện tại (Profile)',
    description: 'Đọc access_token từ HTTP-Only Cookie và trả về thông tin người dùng hiện tại',
  })
  @ApiResponse({ status: 200, description: 'Trả về profile người dùng' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token không hợp lệ' })
  async getProfile(@CurrentUser() user: any) {
    return {
      user: this.authService.sanitizeUser(user),
    };
  }

  private setTokenCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      path: '/',
    });
  }
}

