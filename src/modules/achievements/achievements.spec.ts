import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../database/prisma.service';

describe('AchievementsModule (Unit Tests)', () => {
  let controller: AchievementsController;
  let service: AchievementsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      achievement: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ach-1',
            code: 'FIRST_EXAM',
            title: 'Bước Chân Đầu Tiên',
            description: 'Hoàn thành 1 đề',
            icon: '🚀',
            category: 'EXAM',
            rule_type: 'EXAM_COUNT',
            threshold: 1,
            reward_diamonds: 5,
            is_active: true,
          },
        ]),
        upsert: jest.fn(),
      },
      userAchievement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'ua-1',
          user_id: 'u1',
          achievement_id: 'ach-1',
          progress: 1,
          unlocked_at: new Date(),
        }),
      },
      studentProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sp-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      examSubmission: {
        count: jest.fn().mockResolvedValue(1),
      },
      examPointLog: {
        count: jest.fn().mockResolvedValue(0),
      },
      forumComment: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AchievementsController],
      providers: [
        AchievementsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { createForUser: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    controller = module.get<AchievementsController>(AchievementsController);
    service = module.get<AchievementsService>(AchievementsService);
  });

  it('auto-unlocks achievement and rewards diamonds when threshold is met', async () => {
    const res = await service.evaluateForUser('u1');
    expect(res.newlyUnlocked).toHaveLength(1);
    expect(res.newlyUnlocked[0].code).toBe('FIRST_EXAM');
    expect(prisma.studentProfile.update).toHaveBeenCalledWith({
      where: { id: 'sp-1' },
      data: { points: { increment: 5 } },
    });
  });

  it('lists achievements for authenticated user', async () => {
    const res = await controller.myAchievements({ id: 'u1' });
    expect(res.success).toBe(true);
    expect(res.data.items).toHaveLength(1);
  });
});
