import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthModule (Unit Tests)', () => {
  let controller: AuthController;
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  const mockUser = {
    id: 'user-uuid-123',
    fullname: 'Nguyen Van A',
    email: 'nguyenvana@gmail.com',
    phone: '0987654321',
    password_hash: '',
    role: SystemRole.USER,
    status: true,
    last_login_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeAll(async () => {
    mockUser.password_hash = await bcrypt.hash('secret123', 10);
  });

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token-12345'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('Register Flow', () => {
    const registerDto = {
      fullname: 'Nguyen Van A',
      email: 'nguyenvana@gmail.com',
      password: 'secret123',
      phone: '0987654321',
      profile_type: 'TEACHER' as const,
    };

    it('should successfully register user and return sanitized user with cookie set', async () => {
      usersService.create.mockResolvedValueOnce(mockUser as any);

      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const result = await controller.register(registerDto, mockRes);

      expect(result.message).toBe('Đăng ký tài khoản thành công');
      expect(result.user.email).toBe(registerDto.email);
      expect((result.user as any).password_hash).toBeUndefined();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-jwt-token-12345',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('should throw ConflictException if email is already taken', async () => {
      usersService.create.mockRejectedValueOnce(
        new ConflictException('Email này đã được sử dụng'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('Login Flow', () => {
    const loginDto = {
      email: 'nguyenvana@gmail.com',
      password: 'secret123',
    };

    it('should successfully login and set HTTP-Only cookie', async () => {
      usersService.findByEmail.mockResolvedValueOnce(mockUser as any);

      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const result = await controller.login(loginDto, mockRes);

      expect(result.message).toBe('Đăng nhập thành công');
      expect(result.user.id).toBe(mockUser.id);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-jwt-token-12345',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      usersService.findByEmail.mockResolvedValueOnce(mockUser as any);

      await expect(
        service.login({ email: 'nguyenvana@gmail.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nonexistent@gmail.com', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is inactive/locked', async () => {
      const lockedUser = { ...mockUser, status: false };
      usersService.findByEmail.mockResolvedValueOnce(lockedUser as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Logout Flow', () => {
    it('should clear access_token cookie on logout', async () => {
      const mockRes = {
        clearCookie: jest.fn(),
      } as any;

      const result = await controller.logout(mockRes);

      expect(result.message).toBe('Đăng xuất thành công');
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });
  });

  describe('Get Profile Flow (GET /auth/me)', () => {
    it('should return sanitized user profile', async () => {
      const result = await controller.getProfile(mockUser);

      expect(result.user.email).toBe(mockUser.email);
      expect((result.user as any).password_hash).toBeUndefined();
    });
  });
});
