import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        teacher_profile: true,
        student_profile: true,
        parent_profile: true,
        school_memberships: {
          include: {
            school: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        teacher_profile: true,
        student_profile: true,
        parent_profile: true,
        school_memberships: {
          include: {
            school: true,
          },
        },
      },
    });
  }

  async create(data: {
    fullname: string;
    email: string;
    phone?: string;
    password_hash: string;
    role?: SystemRole;
    profile_type?: 'TEACHER' | 'STUDENT' | 'PARENT';
    google_id?: string;
    avatar_url?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullname: data.fullname,
          email: data.email.toLowerCase(),
          phone: data.phone,
          password_hash: data.password_hash,
          role: data.role || SystemRole.USER,
          google_id: data.google_id || null,
          avatar_url: data.avatar_url || null,
        },
      });

      const profileType = data.profile_type || 'STUDENT';
      if (profileType === 'TEACHER') {
        await tx.teacherProfile.create({
          data: { user_id: user.id },
        });
      } else if (profileType === 'PARENT') {
        await tx.parentProfile.create({
          data: { user_id: user.id },
        });
      } else {
        await tx.studentProfile.create({
          data: { user_id: user.id, grade_level: 'Lớp 12', points: 100 },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          teacher_profile: true,
          student_profile: true,
          parent_profile: true,
          school_memberships: {
            include: { school: true },
          },
        },
      });
    });
  }

  /**
   * Ported từ /home/thinh/ca-nhan/src/modules/users/services/userAccount.service.js -> loginWithGoogle
   * Tìm hoặc tự động khởi tạo tài khoản khi người dùng đăng nhập bằng Google OAuth
   */
  async loginWithGoogle(data: {
    email: string;
    name: string;
    googleId: string;
    avatarUrl?: string;
    profile_type?: 'STUDENT' | 'TEACHER' | 'PARENT';
  }) {
    const normalizedEmail = data.email.toLowerCase().trim();

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { google_id: data.googleId },
          { email: normalizedEmail },
        ],
      },
      include: {
        teacher_profile: true,
        student_profile: true,
        parent_profile: true,
        school_memberships: {
          include: { school: true },
        },
      },
    });

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPass, 10);

      user = await this.create({
        fullname: data.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: 'GG_' + data.googleId.slice(-8),
        password_hash: hashedPassword,
        google_id: data.googleId,
        avatar_url: data.avatarUrl,
        profile_type: data.profile_type || 'STUDENT',
      });
    } else {
      // Cập nhật google_id hoặc avatar_url nếu tài khoản cũ chưa có
      const needUpdate = !user.google_id || (!user.avatar_url && data.avatarUrl);
      if (needUpdate) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            google_id: user.google_id || data.googleId,
            avatar_url: user.avatar_url || data.avatarUrl || null,
            last_login_at: new Date(),
          },
          include: {
            teacher_profile: true,
            student_profile: true,
            parent_profile: true,
            school_memberships: {
              include: { school: true },
            },
          },
        });
      } else {
        await this.updateLastLogin(user.id);
      }
    }

    return user!;
  }

  /**
   * Ported từ /home/thinh/ca-nhan/src/modules/users/services/userAccount.service.js -> loginWithOtp
   */
  async loginWithOtp(phoneOrEmail: string) {
    const clean = phoneOrEmail.trim().toLowerCase();
    const isEmail = clean.includes('@');
    const lookupEmail = isEmail ? clean : `${clean}@otp.schoolify.local`;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: lookupEmail }, { phone: phoneOrEmail.trim() }],
      },
      include: {
        teacher_profile: true,
        student_profile: true,
        parent_profile: true,
        school_memberships: {
          include: { school: true },
        },
      },
    });

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      user = await this.create({
        fullname: isEmail ? clean.split('@')[0] : `Học sinh ${clean.slice(-4)}`,
        email: lookupEmail,
        phone: isEmail ? undefined : phoneOrEmail.trim(),
        password_hash: hashedPassword,
        profile_type: 'STUDENT',
      });
    } else {
      await this.updateLastLogin(user.id);
    }

    return user!;
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { last_login_at: new Date() },
    });
  }

  /**
   * Danh sách người dùng phân trang cho Admin (/users)
   */
  async findAll(query: { page?: number; limit?: number; search?: string; role?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { fullname: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role && (query.role === 'SUPER_ADMIN' || query.role === 'USER')) {
      where.role = query.role;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          teacher_profile: true,
          student_profile: true,
          parent_profile: true,
          school_memberships: {
            include: { school: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(({ password_hash, ...rest }) => rest),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(
    id: string,
    data: { fullname?: string; phone?: string; avatar_url?: string; status?: boolean; points?: number; grade_level?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { student_profile: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullname !== undefined ? { fullname: data.fullname } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: {
        teacher_profile: true,
        student_profile: true,
        parent_profile: true,
      },
    });

    if (existing.student_profile && (data.points !== undefined || data.grade_level !== undefined)) {
      await this.prisma.studentProfile.update({
        where: { id: existing.student_profile.id },
        data: {
          ...(data.points !== undefined ? { points: Number(data.points) } : {}),
          ...(data.grade_level !== undefined ? { grade_level: data.grade_level } : {}),
        },
      });
    }

    const { password_hash, ...sanitized } = updated;
    return sanitized;
  }
}
