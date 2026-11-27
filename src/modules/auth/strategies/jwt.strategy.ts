import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { extractTokenFromRequest, isTokenRevoked } from '../token-blacklist';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Ưu tiên trích xuất từ HTTP-Only Cookie
        (req: Request) => {
          let token = null;
          if (req && req.cookies) {
            token = req.cookies['access_token'];
          }
          return token;
        },
        // 2. Dự phòng trích xuất từ Bearer Header nếu cần
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: process.env.JWT_SECRET || 'schoolify_super_secret_key_2026_local',
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const token = extractTokenFromRequest(req as any);
    if (isTokenRevoked(token)) {
      throw new UnauthorizedException('Phiên đăng nhập đã đăng xuất, vui lòng đăng nhập lại');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.status) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }
    return user;
  }
}
