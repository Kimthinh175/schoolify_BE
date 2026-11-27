import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';

describe('NotificationsModule (Unit Tests)', () => {
  let controller: NotificationsController;
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'n1',
            user_id: 'u1',
            type: 'SUCCESS',
            category: 'REWARD',
            title: 'Chúc mừng',
            message: 'Bạn vừa mở khóa thành tựu mới',
            link: '/student/achievements',
            is_read: false,
            created_at: new Date('2026-11-21T00:00:00Z'),
          },
        ]),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'n1',
          user_id: 'u1',
          type: 'INFO',
          category: 'SYSTEM',
          title: 'Test',
          message: 'Msg',
          link: null,
          is_read: true,
          created_at: new Date('2026-11-21T00:00:00Z'),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: new JwtService({ secret: 'test-secret' }) },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('lists notifications with unread count', async () => {
    const res = await controller.list({ id: 'u1' }, '30');
    expect(res.success).toBe(true);
    expect(res.data.unreadCount).toBe(1);
    expect(res.data.items[0].title).toBe('Chúc mừng');
  });

  it('blocks marking notification owned by another user (IDOR)', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n1', user_id: 'u2' });
    await expect(controller.markRead('n1', { id: 'u1', role: 'STUDENT' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for nonexistent notification', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(controller.remove('missing', { id: 'u1', role: 'STUDENT' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('forbids non-SUPER_ADMIN from creating notifications', async () => {
    await expect(
      service.createNotification(
        { id: 'u1', role: 'STUDENT' },
        { target: 'BROADCAST_ALL', title: 'Hi', message: 'Test' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('broadcasts notifications to all active users when SUPER_ADMIN', async () => {
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
});
