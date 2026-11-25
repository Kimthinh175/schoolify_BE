import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExamPointsService } from './exam-points.service';

describe('ExamPointsService', () => {
  let service: ExamPointsService;
  let prisma: {
    studentProfile: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    examPointLog: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    examSubmission: {
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      studentProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      examPointLog: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      examSubmission: {
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new ExamPointsService(prisma as any);
  });

  it('should grant +9 exam_points on first daily claim and block duplicate', async () => {
    const today = service.getTodayDateStringVN();
    prisma.studentProfile.findUnique.mockResolvedValue({
      id: 'sp1',
      user_id: 'u1',
      exam_points: 9,
      points: 20,
      active_package: 'FREE',
      last_daily_grant_date: today,
    });
    prisma.examPointLog.findFirst.mockResolvedValueOnce(null);
    prisma.studentProfile.update.mockResolvedValueOnce({
      id: 'sp1',
      exam_points: 18,
      points: 20,
    });
    prisma.examPointLog.create.mockResolvedValueOnce({ id: 'log1' });

    const first = await service.claimDailyExamPoints('u1', {});
    expect(first.claimed).toBe(true);
    expect(first.currentPoints).toBe(18);

    prisma.examPointLog.findFirst.mockResolvedValueOnce({ id: 'log1' });
    const second = await service.claimDailyExamPoints('u1', {});
    expect(second.claimed).toBe(false);
    expect(second.alreadyClaimedToday).toBe(true);
  });

  it('should enforce SUPER_ADMIN and note >= 5 chars in adminAdjustPoints', async () => {
    await expect(
      service.adminAdjustPoints('u1', 'STUDENT', {
        examPoints: 30,
        note: 'Valid note',
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.adminAdjustPoints('admin-1', 'SUPER_ADMIN', {
        examPoints: 30,
        note: 'abc',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should log ADMIN_CSKH_ADJUST when SUPER_ADMIN adjusts points', async () => {
    const today = service.getTodayDateStringVN();
    prisma.studentProfile.findUnique.mockResolvedValueOnce({
      id: 'sp1',
      user_id: 'u1',
      exam_points: 9,
      points: 10,
      active_package: 'FREE',
      last_daily_grant_date: today,
    });
    prisma.studentProfile.update.mockResolvedValueOnce({
      id: 'sp1',
      exam_points: 25,
      points: 50,
    });
    prisma.examPointLog.create.mockResolvedValueOnce({ id: 'log-adj' });

    const res = await service.adminAdjustPoints('admin-1', 'SUPER_ADMIN', {
      userId: 'u1',
      examPoints: 25,
      diamonds: 50,
      note: 'Hoàn điểm lỗi mạng cho học sinh',
    });

    expect(res.currentPoints).toBe(25);
    expect(res.diamonds).toBe(50);
    expect(prisma.examPointLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'ADMIN_CSKH_ADJUST',
          points_delta: 16,
        }),
      }),
    );
  });
});
