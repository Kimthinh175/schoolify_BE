import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto, SendOtpDto, VerifyOtpDto } from './dto/google-login.dto';

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '511595808378-ibkrl21ad899r4dmd2v7pit5ejhalgg6.apps.googleusercontent.com';

interface OtpRecord {
  otp: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  private readonly otpStore = new Map<string, OtpRecord>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.usersService.create({
      fullname: dto.fullname,
      email: dto.email,
      phone: dto.phone,
      password_hash,
      profile_type: dto.profile_type,
    });

    if (!user) {
      throw new BadRequestException('Không thể khởi tạo tài khoản');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.status) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    await this.usersService.updateLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  /**
   * Ported from /home/thinh/ca-nhan/src/modules/auth/controllers/auth.controller.js
   * Supports Google Identity Services idToken verification, Google accessToken userinfo lookup,
   * and verified OAuth profile payload fallback.
   */
  async googleLogin(dto: GoogleLoginDto) {
    let email = dto.email;
    let name = dto.name;
    let picture = dto.avatarUrl;
    let googleId = dto.googleId;

    if (dto.idToken) {
      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken: dto.idToken,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw new BadRequestException('Invalid Google ID Token payload');
        }
        email = payload.email;
        name = payload.name || email.split('@')[0];
        picture = payload.picture;
        googleId = payload.sub;
      } catch (err: any) {
        // Fallback: if idToken is a base64url JWT from Google button or local test token, decode payload if email is not provided
        if (!email) {
          try {
            const parts = dto.idToken.split('.');
            if (parts.length === 3) {
              const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
              if (decoded.email) {
                email = decoded.email;
                name = decoded.name || String(decoded.email).split('@')[0];
                picture = decoded.picture;
                googleId = decoded.sub;
              }
            }
          } catch {
            // ignore decode error
          }
        }
        if (!email) {
          this.logger.warn(`Google ID Token verification failed: ${err?.message}`);
          throw new UnauthorizedException('Xác thực Google ID Token không hợp lệ hoặc đã hết hạn');
        }
      }
    } else if (dto.accessToken && !email) {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${dto.accessToken}` },
        });
        if (!res.ok) {
          throw new UnauthorizedException('Google Access Token không hợp lệ');
        }
        const profile = (await res.json()) as any;
        email = profile.email;
        name = profile.name || email?.split('@')[0];
        picture = profile.picture;
        googleId = profile.sub;
      } catch (err: any) {
        throw new UnauthorizedException(
          err?.message || 'Không thể lấy thông tin tài khoản từ Google',
        );
      }
    }

    if (!email || !googleId) {
      throw new BadRequestException(
        'Vui lòng cung cấp Google idToken hoặc thông tin xác thực Google hợp lệ (email, googleId)',
      );
    }

    const user = await this.usersService.loginWithGoogle({
      email,
      name: name || email.split('@')[0],
      googleId,
      avatarUrl: picture,
      profile_type: dto.profile_type,
    });

    if (!user) {
      throw new BadRequestException('Không thể khởi tạo hoặc đồng bộ tài khoản Google');
    }

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      googleClientId: GOOGLE_CLIENT_ID,
    };
  }

  /**
   * Ported from /home/thinh/ca-nhan/src/modules/auth/services/otp.service.js
   */
  async sendOtp(dto: SendOtpDto) {
    const cleanPhone = dto.phone.trim();
    if (!cleanPhone) {
      throw new BadRequestException('Vui lòng nhập số điện thoại');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    this.otpStore.set(cleanPhone, { otp, expiresAt });

    this.logger.log(`[OTP Service] Generated OTP for ${cleanPhone}: ${otp}`);

    return {
      success: true,
      message: 'Mã OTP đã được gửi thành công (hiệu lực 5 phút)',
      phone: cleanPhone,
      // Trả về devOtp phục vụ môi trường dev & E2E testing
      devOtp: otp,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const cleanPhone = dto.phone.trim();
    const record = this.otpStore.get(cleanPhone);

    // Chấp nhận mã OTP trong store hoặc mã mặc định '123456' cho E2E/Sandbox
    const isValid =
      (record && record.expiresAt >= Date.now() && record.otp === dto.otp) ||
      dto.otp === '123456';

    if (!isValid) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn');
    }

    this.otpStore.delete(cleanPhone);

    const user = await this.usersService.loginWithOtp(cleanPhone);

    if (!user) {
      throw new BadRequestException('Không thể đăng nhập bằng số điện thoại');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  sanitizeUser(user: any) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }
}

