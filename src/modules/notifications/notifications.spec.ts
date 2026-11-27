import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    service = new NotificationsService(
      prisma as any,
      new JwtService({ secret: 'test-secret' }),
    );
  });

  it('should list notifications for user including ALL and calculate unreadCount', async () => {
    const now = new Date();
    prisma.notification.findMany.mockResolvedValueOnce([
      {
        id: 'n1',
        user_id: 'u1',
        type: 'INFO',
        category: 'SYSTEM',
        title: 'T1',
        message: 'M1',
        link: null,
        is_read: false,
        created_at: now,
      },
      {
        id: 'n2',
        user_id: 'u1',
        type: 'SUCCESS',
        category: 'EXAM',
        title: 'T2',
        message: 'M2',
        link: '/exams',
        is_read: true,
        created_at: now,
      },
    ]);

    const res = await service.listForUser('u1', 40);
    expect(res.total).toBe(2);
    expect(res.unreadCount).toBe(1);
    expect(res.items[0].id).toBe('n1');
  });

  it('should forbid non-SUPER_ADMIN from creating notifications', async () => {
    await expect(
      service.createNotification(
        { id: 'u1', role: 'STUDENT' },
        { target: 'BROADCAST_ALL', title: 'Hi', message: 'Test' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should broadcast notifications to all active users in chunks', async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]);
    prisma.notification.createMany.mockResolvedValueOnce({ count: 2 });

    const res: any = await service.createNotification(
      { id: 'admin-1', role: 'SUPER_ADMIN' },
      {
        target: 'BROADCAST_ALL',
        user_id: null,
        type: 'SYSTEM',
        title: 'Bảo trì',
        message: 'Lúc 23h',
      },
    );

    expect(res.broadcast).toBe(true);
    expect(res.recipientCount).toBe(2);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('should forbid marking another user notification as read', async () => {
    prisma.notification.findUnique.mockResolvedValueOnce({
      id: 'n1',
      user_id: 'other-user',
      is_read: false,
    });

    await expect(
      service.markAsRead('n1', { id: 'u1', role: 'STUDENT' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
