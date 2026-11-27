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
        student_profile: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        student_profile: true,
      },
    });
  }

  async create(data: {
    fullname: string;
    email: string;
    phone?: string;
    password_hash: string;
    role?: SystemRole;
    profile_type?: 'STUDENT';
    google_id?: string;
    avatar_url?: string;
    grade_level?: string | null;
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

      await tx.studentProfile.create({
        data: { user_id: user.id, grade_level: data.grade_level || null, points: 100 },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          student_profile: true,
        },
      });
    });
  }

  async createAdminUser(data: {
    fullname: string;
    email: string;
    phone?: string;
    password?: string;
    role?: 'SUPER_ADMIN' | 'STUDENT';
  }) {
    const hashedPassword = await bcrypt.hash(data.password || '123456', 10);
    const isSuperAdmin = data.role === 'SUPER_ADMIN';

    const created = await this.create({
      fullname: data.fullname,
      email: data.email,
      phone: data.phone,
      password_hash: hashedPassword,
      role: isSuperAdmin ? SystemRole.SUPER_ADMIN : SystemRole.USER,
      profile_type: 'STUDENT',
    });

    if (!created) return null;
    const { password_hash, ...rest } = created;
    return this.formatUserItem(rest);
  }

  /**
   * Tìm hoặc tự động khởi tạo tài khoản khi người dùng đăng nhập bằng Google OAuth
   */
  async loginWithGoogle(data: {
    email: string;
    name: string;
    googleId: string;
    avatarUrl?: string;
    profile_type?: 'STUDENT';
  }) {
    const normalizedEmail = data.email.toLowerCase().trim();

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ google_id: data.googleId }, { email: normalizedEmail }],
      },
      include: {
        student_profile: true,
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
        profile_type: 'STUDENT',
      });
    } else {
      // Quy tắc nghiệp vụ: Chỉ lấy avatar của Google khi login lần đầu nếu người dùng chưa có avatar.
      // Nếu người dùng đã có avatar (từ lần login đầu hoặc đã tự đổi avatar sau đó trong profile),
      // TUYỆT ĐỐI KHÔNG ghi đè bằng avatar Google nữa.
      const isFirstTimeGoogle = !user.google_id;
      const hasNoAvatar = !user.avatar_url || user.avatar_url.trim() === '';
      const shouldTakeGoogleAvatar = isFirstTimeGoogle && hasNoAvatar && Boolean(data.avatarUrl);

      const needUpdate = isFirstTimeGoogle || shouldTakeGoogleAvatar;

      if (needUpdate) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            google_id: user.google_id || data.googleId,
            ...(shouldTakeGoogleAvatar ? { avatar_url: data.avatarUrl } : {}),
            last_login_at: new Date(),
          },
          include: {
            student_profile: true,
          },
        });
      } else {
        await this.updateLastLogin(user.id);
      }
    }

    return user!;
  }

  async loginWithOtp(phoneOrEmail: string) {
    const clean = phoneOrEmail.trim().toLowerCase();
    const isEmail = clean.includes('@');
    const lookupEmail = isEmail ? clean : `${clean}@otp.schoolify.local`;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: lookupEmail }, { phone: phoneOrEmail.trim() }],
      },
      include: {
        student_profile: true,
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

  formatUserItem(u: any) {
    const appRole: 'SUPER_ADMIN' | 'STUDENT' =
      u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'STUDENT';

    const sp = u.student_profile || null;
    const schoolName =
      sp?.school_name ||
      (appRole === 'SUPER_ADMIN'
        ? 'Nền Tảng Gốc Schoolify'
        : 'Học Sinh Toàn Quốc');

    return {
      ...u,
      name: u.fullname,
      avatarUrl: u.avatar_url,
      avatar: u.avatar_url,
      appRole,
      date_of_birth: sp?.date_of_birth ?? null,
      dateOfBirth: sp?.date_of_birth ?? null,
      grade_level: sp?.grade_level || null,
      gradeLevel: sp?.grade_level || null,
      school_name: sp?.school_name || null,
      schoolName,
      province: sp?.province || null,
      bio: sp?.bio || null,
      equipped_frame: sp?.equipped_frame || null,
      equippedFrame: sp?.equipped_frame || null,
      points: sp?.points ?? 0,
      exam_points: sp?.exam_points ?? 9,
      examPoints: sp?.exam_points ?? 9,
      last_daily_grant_date: sp?.last_daily_grant_date || null,
      lastDailyGrantDate: sp?.last_daily_grant_date || null,
      active_package: sp?.active_package || 'FREE',
      activePackage: sp?.active_package || 'FREE',
      package_expires_at: sp?.package_expires_at ?? null,
      packageExpiresAt: sp?.package_expires_at ?? null,
    };
  }

  /**
   * Danh sách người dùng phân trang cho Admin (/users)
   */
  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { fullname: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role === 'SUPER_ADMIN') {
      where.role = 'SUPER_ADMIN';
    } else if (query.role === 'STUDENT') {
      where.role = 'USER';
    }

    if (
      query.status !== undefined &&
      query.status !== '' &&
      query.status.toUpperCase() !== 'ALL'
    ) {
      const normalizedStatus = query.status.trim().toLowerCase();
      if (
        normalizedStatus === 'true' ||
        normalizedStatus === 'active' ||
        normalizedStatus === '1'
      ) {
        where.status = true;
      } else if (
        normalizedStatus === 'false' ||
        normalizedStatus === 'locked' ||
        normalizedStatus === 'inactive' ||
        normalizedStatus === '0'
      ) {
        where.status = false;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          student_profile: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(({ password_hash, ...rest }) => this.formatUserItem(rest)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private normalizeGradeLevel(
    raw?: string | number | null,
  ): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;
    const str = String(raw).trim();
    if (/^(10|11|12)$/.test(str)) return `Lớp ${str}`;
    return str;
  }

  private parseOptionalDate(
    raw?: string | Date | null,
  ): Date | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  async updateUser(
    id: string,
    data: {
      fullname?: string;
      phone?: string;
      avatar_url?: string;
      avatarUrl?: string;
      status?: boolean;
      points?: number;
      exam_points?: number;
      examPoints?: number;
      date_of_birth?: string | Date | null;
      dateOfBirth?: string | Date | null;
      grade_level?: string | number | null;
      gradeLevel?: string | number | null;
      school_name?: string | null;
      schoolName?: string | null;
      province?: string | null;
      bio?: string | null;
      equipped_frame?: string | null;
      equippedFrame?: string | null;
      active_package?: string | null;
      activePackage?: string | null;
      package_expires_at?: string | Date | null;
      packageExpiresAt?: string | Date | null;
      role?: 'SUPER_ADMIN' | 'STUDENT';
    },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { student_profile: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    let systemRoleUpdate: SystemRole | undefined = undefined;
    if (data.role === 'SUPER_ADMIN') {
      systemRoleUpdate = SystemRole.SUPER_ADMIN;
    } else if (data.role === 'STUDENT') {
      systemRoleUpdate = SystemRole.USER;
    }

    const avatarUrl =
      data.avatar_url !== undefined ? data.avatar_url : data.avatarUrl;
    const examPoints =
      data.exam_points !== undefined ? data.exam_points : data.examPoints;
    const dateOfBirth = this.parseOptionalDate(
      data.date_of_birth !== undefined ? data.date_of_birth : data.dateOfBirth,
    );
    const gradeLevel = this.normalizeGradeLevel(
      data.grade_level !== undefined ? data.grade_level : data.gradeLevel,
    );
    const schoolName =
      data.school_name !== undefined ? data.school_name : data.schoolName;
    const equippedFrame =
      data.equipped_frame !== undefined
        ? data.equipped_frame
        : data.equippedFrame;
    const activePackage =
      data.active_package !== undefined
        ? data.active_package
        : data.activePackage;
    const packageExpiresAt = this.parseOptionalDate(
      data.package_expires_at !== undefined
        ? data.package_expires_at
        : data.packageExpiresAt,
    );

    const studentProfilePatch: any = {
      ...(data.points !== undefined ? { points: Number(data.points) } : {}),
      ...(examPoints !== undefined ? { exam_points: Number(examPoints) } : {}),
      ...(dateOfBirth !== undefined ? { date_of_birth: dateOfBirth } : {}),
      ...(gradeLevel !== undefined ? { grade_level: gradeLevel } : {}),
      ...(schoolName !== undefined ? { school_name: schoolName } : {}),
      ...(data.province !== undefined ? { province: data.province } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(equippedFrame !== undefined ? { equipped_frame: equippedFrame } : {}),
      ...(activePackage !== undefined ? { active_package: activePackage } : {}),
      ...(packageExpiresAt !== undefined
        ? { package_expires_at: packageExpiresAt }
        : {}),
    };

    const hasProfilePatch = Object.keys(studentProfilePatch).length > 0;
    if (existing.student_profile && hasProfilePatch) {
      await this.prisma.studentProfile.update({
        where: { id: existing.student_profile.id },
        data: studentProfilePatch,
      });
    } else if (
      !existing.student_profile &&
      existing.role !== 'SUPER_ADMIN' &&
      hasProfilePatch
    ) {
      await this.prisma.studentProfile.create({
        data: {
          user_id: id,
          points: 10,
          exam_points: 9,
          ...studentProfilePatch,
        },
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullname !== undefined ? { fullname: data.fullname } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(systemRoleUpdate !== undefined ? { role: systemRoleUpdate } : {}),
      },
      include: {
        student_profile: true,
      },
    });

    const { password_hash, ...sanitized } = updated;
    return this.formatUserItem(sanitized);
  }

  async deleteUser(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    await this.prisma.user.delete({ where: { id } });
    return { deletedId: id };
  }

  async updatePasswordHash(id: string, password_hash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password_hash },
    });
  }
}
