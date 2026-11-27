import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Notification } from '@prisma/client';
import { Observable, Subject, filter, map } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { isTokenRevoked } from '../auth/token-blacklist';

const BROADCAST_CHUNK_SIZE = 500;

export interface NotificationStreamEvent {
  userId: string;
  notification: {
    id: string;
    user_id: string;
    type: string;
    category: string;
    title: string;
    message: string;
    link: string | null;
    is_read: boolean;
    created_at: Date;
  };
}

export interface NotificationRequester {
  id: string;
  role: string;
}

export interface RequestWithAuthHeaders {
  user?: { id?: string; role?: string };
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}

interface NotificationJwtPayload {
  sub?: string;
  id?: string;
  role?: string;
}

@Injectable()
export class NotificationsService {
  private readonly stream$ = new Subject<NotificationStreamEvent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  subscribeForUser(userId: string): Observable<{ data: unknown }> {
    return this.stream$.asObservable().pipe(
      filter((evt) => evt.userId === userId || evt.userId === 'ALL'),
      map((evt) => ({ data: evt.notification })),
    );
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined> | undefined,
    name: string,
  ): string | undefined {
    const raw = headers?.[name];
    if (Array.isArray(raw)) return raw[0]?.trim();
    return typeof raw === 'string' ? raw.trim() : undefined;
  }

  resolveRequester(
    req: RequestWithAuthHeaders,
    requireAuth = true,
  ): NotificationRequester | null {
    if (req?.user?.id) {
      return {
        id: String(req.user.id),
        role: String(req.user.role || 'STUDENT').toUpperCase(),
      };
    }

    const authHeader =
      this.readHeader(req?.headers, 'authorization') ||
      this.readHeader(req?.headers, 'Authorization');
    let token: string | null = null;
    if (authHeader) {
      token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : authHeader;
    }
    if (!token && req?.cookies?.access_token) {
      token = String(req.cookies.access_token);
    }

    const headerUserId = this.readHeader(req?.headers, 'x-user-id');
    const headerUserRole = this.readHeader(
      req?.headers,
      'x-user-role',
    )?.toUpperCase();

    if (token && !isTokenRevoked(token)) {
      try {
        const payload = this.jwtService.verify<NotificationJwtPayload>(token, {
          secret:
            process.env.JWT_SECRET || 'schoolify_super_secret_key_2026_local',
        });
        const uid = String(payload?.sub || payload?.id || headerUserId || '');
        if (uid) {
          return {
            id: uid,
            role: String(
              payload?.role || headerUserRole || 'STUDENT',
            ).toUpperCase(),
          };
        }
      } catch {
        // Fallback to BFF headers if present
      }
    }

    if (headerUserId) {
      return {
        id: headerUserId,
        role: headerUserRole || 'STUDENT',
      };
    }

    if (requireAuth) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để truy cập thông báo',
      );
    }
    return null;
  }

  private formatNotification(n: Notification) {
    return {
      id: n.id,
      user_id: n.user_id,
      type: n.type || 'INFO',
      category: n.category || 'SYSTEM',
      title: n.title,
      message: n.message,
      link: n.link ?? null,
      is_read: Boolean(n.is_read),
      created_at: n.created_at,
    };
  }

  async listForUser(userId: string, limit = 40) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 40));
    const rows = await this.prisma.notification.findMany({
      where: {
        OR: [{ user_id: userId }, { user_id: 'ALL' }],
      },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
    });

    const unreadCount = rows.filter((r) => !r.is_read).length;
    return {
      items: rows.map((r) => this.formatNotification(r)),
      unreadCount,
      total: rows.length,
    };
  }

  async createNotification(
    requester: NotificationRequester,
    dto: CreateNotificationDto,
  ) {
    if (requester.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Chỉ SUPER_ADMIN mới có quyền phát thông báo hệ thống',
      );
    }

    const rawTargetId = (dto.userId || dto.user_id || '').trim();
    const isBroadcast =
      dto.target === 'BROADCAST_ALL' ||
      !rawTargetId ||
      rawTargetId.toUpperCase() === 'ALL';

    const type = (dto.type || 'INFO').toUpperCase();
    const category = (dto.category || 'SYSTEM').toUpperCase();
    const title = dto.title.trim();
    const message = dto.message.trim();
    const link = dto.link?.trim() || null;

    if (isBroadcast) {
      const activeUsers = await this.prisma.user.findMany({
        where: { status: true },
        select: { id: true },
      });

      if (activeUsers.length === 0) {
        return {
          broadcast: true,
          recipientCount: 0,
          type,
          category,
          title,
          message,
          link,
        };
      }

      const rows = activeUsers.map((u) => ({
        user_id: u.id,
        type,
        category,
        title,
        message,
        link,
        is_read: false,
      }));

      for (let i = 0; i < rows.length; i += BROADCAST_CHUNK_SIZE) {
        await this.prisma.notification.createMany({
          data: rows.slice(i, i + BROADCAST_CHUNK_SIZE),
        });
      }

      const now = new Date();
      for (const u of activeUsers) {
        this.stream$.next({
          userId: u.id,
          notification: {
            id: `broadcast-${now.getTime()}`,
            user_id: u.id,
            type,
            category,
            title,
            message,
            link,
            is_read: false,
            created_at: now,
          },
        });
      }

      return {
        broadcast: true,
        recipientCount: activeUsers.length,
        type,
        category,
        title,
        message,
        link,
      };
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: rawTargetId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException('Không tìm thấy người dùng nhận thông báo');
    }

    const created = await this.prisma.notification.create({
      data: {
        user_id: rawTargetId,
        type,
        category,
        title,
        message,
        link,
        is_read: false,
      },
    });

    const formatted = this.formatNotification(created);
    this.stream$.next({ userId: rawTargetId, notification: formatted });
    return formatted;
  }

  async markAsRead(id: string, requester: NotificationRequester) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    if (
      existing.user_id !== requester.id &&
      existing.user_id !== 'ALL' &&
      requester.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException('Bạn không có quyền thao tác thông báo này');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });

    return this.formatNotification(updated);
  }

  async markAllAsRead(requester: NotificationRequester) {
    const result = await this.prisma.notification.updateMany({
      where: {
        OR: [{ user_id: requester.id }, { user_id: 'ALL' }],
        is_read: false,
      },
      data: { is_read: true },
    });

    return { updatedCount: result.count };
  }

  async deleteOne(id: string, requester: NotificationRequester) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    const isAdmin = requester.role === 'SUPER_ADMIN';
    if (
      existing.user_id !== requester.id &&
      !(existing.user_id === 'ALL' && isAdmin)
    ) {
      throw new ForbiddenException('Bạn không có quyền xóa thông báo này');
    }

    await this.prisma.notification.delete({ where: { id } });
    return { deletedId: id };
  }

  async clearAll(requester: NotificationRequester) {
    const result = await this.prisma.notification.deleteMany({
      where: { user_id: requester.id },
    });
    return { deletedCount: result.count };
  }
}
