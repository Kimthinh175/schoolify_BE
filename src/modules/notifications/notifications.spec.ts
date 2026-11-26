import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';

describe('NotificationsModule (Unit Tests)', () => {
  let controller: NotificationsController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'n1',
            user_id: 'u1',
            type: 'success',
            title: 'Chúc mừng',
            message: 'Bạn vừa mở khóa thành tựu mới',
            link: '/student/achievements',
            is_read: false,
            created_at: new Date('2026-11-21T00:00:00Z'),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('lists notifications with unread count', async () => {
    const res = await controller.list({ id: 'u1' }, '30');
    expect(res.success).toBe(true);
    expect(res.data.unreadCount).toBe(1);
    expect(res.data.items[0].title).toBe('Chúc mừng');
  });

  it('blocks marking notification owned by another user (IDOR)', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n1', user_id: 'u2' });
    await expect(controller.markRead('n1', { id: 'u1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for nonexistent notification', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(controller.remove('missing', { id: 'u1' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
