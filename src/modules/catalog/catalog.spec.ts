import { CatalogService } from './catalog.service';
import { SeasonStatus } from '@prisma/client';

describe('CatalogService', () => {
  let service: CatalogService;

  const mockPrisma: any = {
    studentProfile: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    leaderboardSeason: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    seasonDistributionLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    examPointLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  const mockPayOSService: any = {};
  const mockNotificationsService: any = {
    createForUser: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(mockPrisma, mockPayOSService, mockNotificationsService);
  });

  it('should filter leaderboard by grade and search term', async () => {
    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: 'sp-1',
        grade_level: 'Lớp 12',
        points: 1500,
        exam_points: 18,
        user: {
          id: 'u-1',
          fullname: 'Nguyễn Minh',
          email: 'minh@schoolify.vn',
          avatar_url: null,
        },
        submissions: [{ score: 9.5, status: 'SUBMITTED' }],
      },
      {
        id: 'sp-2',
        grade_level: 'Lớp 10',
        points: 1200,
        exam_points: 9,
        user: {
          id: 'u-2',
          fullname: 'Trần An',
          email: 'an@schoolify.vn',
          avatar_url: null,
        },
        submissions: [],
      },
    ]);

    const res = await service.getLeaderboard({ grade: 'GRADE_12', search: 'Minh' });
    expect(res).toHaveLength(1);
    expect(res[0].fullname).toBe('Nguyễn Minh');
    expect(res[0].rank).toBe(1);
  });

  it('should create and list leaderboard seasons', async () => {
    mockPrisma.leaderboardSeason.count.mockResolvedValue(1);
    mockPrisma.studentProfile.count.mockResolvedValue(42);
    mockPrisma.leaderboardSeason.findMany.mockResolvedValue([
      {
        id: 's-1',
        code: 'SS-2026-Q1',
        name: 'Mùa 1',
        description: 'Mô tả',
        status: SeasonStatus.ACTIVE,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
        freeze_date: new Date('2026-12-30'),
        total_participants: 0,
        total_gems_pool: 25000,
        is_frozen: false,
        scoring_multiplier: 1,
        rules: [],
        rewards: [],
        distribution_status: 'NOT_STARTED',
      },
    ]);

    const seasons = await service.listSeasons();
    expect(seasons).toHaveLength(1);
    expect(seasons[0].totalParticipants).toBe(42);
    expect(seasons[0].code).toBe('SS-2026-Q1');
  });

  it('should distribute season rewards and notify winners', async () => {
    mockPrisma.leaderboardSeason.findUnique.mockResolvedValue({
      id: 's-1',
      code: 'SS-2026-Q1',
      name: 'Mùa 1',
      distribution_status: 'NOT_STARTED',
      rewards: [{ minRank: 1, maxRank: 1, gemReward: 500, badgeName: 'Quán Quân' }],
    });

    mockPrisma.studentProfile.findMany.mockResolvedValue([
      {
        id: 'sp-1',
        grade_level: '12',
        points: 100,
        exam_points: 9,
        user: {
          id: 'u-1',
          fullname: 'Nguyễn Minh',
          email: 'minh@schoolify.vn',
          avatar_url: null,
        },
        submissions: [],
      },
    ]);

    mockPrisma.studentProfile.update.mockResolvedValue({});
    mockPrisma.examPointLog.create.mockResolvedValue({});
    mockPrisma.leaderboardSeason.update.mockResolvedValue({
      id: 's-1',
      code: 'SS-2026-Q1',
      name: 'Mùa 1',
      description: 'Desc',
      status: SeasonStatus.COMPLETED,
      start_date: new Date(),
      end_date: new Date(),
      is_frozen: true,
      total_participants: 1,
      total_gems_pool: 500,
      scoring_multiplier: 1,
      rules: [],
      rewards: [],
      distributed_gems: 500,
      distribution_status: 'COMPLETED',
    });
    mockPrisma.seasonDistributionLog.create.mockResolvedValue({
      id: 'log-1',
      season_id: 's-1',
      season_name: 'Mùa 1',
      season_code: 'SS-2026-Q1',
      settled_at: new Date(),
      admin_name: 'Admin',
      admin_email: 'admin@schoolify.vn',
      total_recipients: 1,
      total_gems_distributed: 500,
      status: 'SUCCESS',
      top_winners: [],
    });

    const result = await service.distributeSeasonRewards('s-1', {
      fullname: 'Admin',
      email: 'admin@schoolify.vn',
    });

    expect(result.log.totalRecipients).toBe(1);
    expect(result.log.totalGemsDistributed).toBe(500);
    expect(mockNotificationsService.createForUser).toHaveBeenCalledTimes(1);
  });
});
