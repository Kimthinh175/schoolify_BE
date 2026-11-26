import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, limit = 30) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: safeLimit,
      }),
      this.prisma.notification.count({
        where: { user_id: userId, is_read: false },
      }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        type: (n.type || 'info') as 'success' | 'info' | 'warning' | 'error',
        title: n.title,
        description: n.message,
        link: n.link || undefined,
        read: n.is_read,
        createdAt: n.created_at.toISOString(),
      })),
      unreadCount,
    };
  }

  async createForUser(payload: {
    userId: string;
    title: string;
    message: string;
    type?: 'success' | 'info' | 'warning' | 'error';
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        user_id: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'info',
        link: payload.link || null,
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    if (existing.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác thông báo của người khác');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });
  }

  async markAllAsRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { updatedCount: res.count };
  }

  async deleteOne(id: string, userId: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    if (existing.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa thông báo của người khác');
    }
    await this.prisma.notification.delete({ where: { id } });
    return { deletedId: id };
  }

  async clearAll(userId: string) {
    const res = await this.prisma.notification.deleteMany({
      where: { user_id: userId },
    });
    return { deletedCount: res.count };
  }
}
