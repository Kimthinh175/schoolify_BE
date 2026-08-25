import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SystemRole } from '@prisma/client';

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
        },
      });

      // Tạo Profile tương ứng nếu có chọn
      if (data.profile_type === 'TEACHER') {
        await tx.teacherProfile.create({
          data: { user_id: user.id },
        });
      } else if (data.profile_type === 'STUDENT') {
        await tx.studentProfile.create({
          data: { user_id: user.id },
        });
      } else if (data.profile_type === 'PARENT') {
        await tx.parentProfile.create({
          data: { user_id: user.id },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          teacher_profile: true,
          student_profile: true,
          parent_profile: true,
        },
      });
    });
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { last_login_at: new Date() },
    });
  }
}
