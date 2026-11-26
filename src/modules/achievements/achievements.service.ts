import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const DEFAULT_ACHIEVEMENT_CATALOG = [
  {
    code: 'FIRST_EXAM',
    title: 'Bước Chân Đầu Tiên',
    description: 'Hoàn thành bài luyện thi K-12 đầu tiên trên hệ thống.',
    icon: '🚀',
    category: 'EXAM',
    rule_type: 'EXAM_COUNT',
    threshold: 1,
    reward_diamonds: 5,
  },
  {
    code: 'EXAM_VETERAN_10',
    title: 'Chiến Binh Luyện Đề',
    description: 'Hoàn thành 10 bài luyện thi bất kỳ.',
    icon: '⚔️',
    category: 'EXAM',
    rule_type: 'EXAM_COUNT',
    threshold: 10,
    reward_diamonds: 20,
  },
  {
    code: 'EXAM_MASTER_50',
    title: 'Bậc Thầy Khảo Thí',
    description: 'Hoàn thành 50 bài luyện thi trên Schoolify.',
    icon: '👑',
    category: 'EXAM',
    rule_type: 'EXAM_COUNT',
    threshold: 50,
    reward_diamonds: 60,
  },
  {
    code: 'HIGH_SCORER_5',
    title: 'Phong Độ Vững Vàng',
    description: 'Đạt từ 8.5 điểm trở lên ở 5 bài thi.',
    icon: '🌟',
    category: 'SCORE',
    rule_type: 'HIGH_SCORE_COUNT',
    threshold: 5,
    reward_diamonds: 25,
  },
  {
    code: 'PERFECT_TEN',
    title: 'Điểm 10 Tuyệt Đối',
    description: 'Chinh phục ít nhất 1 bài thi đạt 10/10 điểm.',
    icon: '💯',
    category: 'SCORE',
    rule_type: 'PERFECT_SCORE',
    threshold: 1,
    reward_diamonds: 30,
  },
  {
    code: 'DAILY_STREAK_7',
    title: 'Chuyên Cần 7 Ngày',
    description: 'Điểm danh nhận Tia Sáng đủ 7 lần.',
    icon: '🔥',
    category: 'STREAK',
    rule_type: 'DAILY_CLAIM',
    threshold: 7,
    reward_diamonds: 15,
  },
  {
    code: 'FORUM_HELPER_5',
    title: 'Người Bạn Đồng Hành',
    description: 'Đóng góp 5 lời giải hoặc bình luận học thuật trên Diễn đàn.',
    icon: '💬',
    category: 'FORUM',
    rule_type: 'FORUM_COMMENT_COUNT',
    threshold: 5,
    reward_diamonds: 15,
  },
  {
    code: 'FORUM_MENTOR_20',
    title: 'Cố Vấn Cộng Đồng',
    description: 'Đóng góp 20 lời giải hoặc bình luận học thuật trên Diễn đàn.',
    icon: '🎓',
    category: 'FORUM',
    rule_type: 'FORUM_COMMENT_COUNT',
    threshold: 20,
    reward_diamonds: 40,
  },
];

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async ensureSeedCatalog() {
    const count = await this.prisma.achievement.count();
    if (count > 0) return;

    for (const item of DEFAULT_ACHIEVEMENT_CATALOG) {
      await this.prisma.achievement.upsert({
        where: { code: item.code },
        update: {},
        create: item,
      });
    }
  }

  private async getUserMetrics(userId: string) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });

    const [examCount, highScoreCount, perfectScoreCount, dailyClaimCount, forumCommentCount] =
      await Promise.all([
        studentProfile
          ? this.prisma.examSubmission.count({ where: { student_id: studentProfile.id } })
          : Promise.resolve(0),
        studentProfile
          ? this.prisma.examSubmission.count({
              where: { student_id: studentProfile.id, score: { gte: 8.5 } },
            })
          : Promise.resolve(0),
        studentProfile
          ? this.prisma.examSubmission.count({
              where: { student_id: studentProfile.id, score: { gte: 10 } },
            })
          : Promise.resolve(0),
        studentProfile
          ? this.prisma.examPointLog.count({
              where: {
                student_id: studentProfile.id,
                action_type: { in: ['DAILY_CHECKIN', 'DAILY_GRANT'] },
              },
            })
          : Promise.resolve(0),
        this.prisma.forumComment.count({ where: { author_id: userId } }),
      ]);

    return {
      studentProfileId: studentProfile?.id || null,
      EXAM_COUNT: examCount,
      HIGH_SCORE_COUNT: highScoreCount,
      PERFECT_SCORE: perfectScoreCount,
      DAILY_CLAIM: dailyClaimCount,
      FORUM_COMMENT_COUNT: forumCommentCount,
    } as Record<string, any>;
  }

  async evaluateForUser(userId: string) {
    if (!userId) return { newlyUnlocked: [] };

    try {
      await this.ensureSeedCatalog();
      const [achievements, existingUnlocked, metrics] = await Promise.all([
        this.prisma.achievement.findMany({ where: { is_active: true } }),
        this.prisma.userAchievement.findMany({ where: { user_id: userId } }),
        this.getUserMetrics(userId),
      ]);

      const unlockedSet = new Set(existingUnlocked.map((u) => u.achievement_id));
      const newlyUnlocked: any[] = [];

      for (const ach of achievements) {
        const progress = Number(metrics[ach.rule_type] || 0);
        if (!unlockedSet.has(ach.id) && progress >= ach.threshold) {
          const created = await this.prisma.userAchievement.create({
            data: {
              user_id: userId,
              achievement_id: ach.id,
              progress,
            },
          });

          if (ach.reward_diamonds > 0 && metrics.studentProfileId) {
            await this.prisma.studentProfile.update({
              where: { id: metrics.studentProfileId },
              data: { points: { increment: ach.reward_diamonds } },
            });
          }

          await this.notificationsService
            .createForUser({
              userId,
              type: 'success',
              title: `Mở khóa thành tựu: ${ach.title} ${ach.icon}`,
              message: `Bạn đã đạt "${ach.description}" và nhận +${ach.reward_diamonds} Ngọc Tri Thức!`,
              link: '/student/achievements',
            })
            .catch(() => {});

          newlyUnlocked.push({
            ...ach,
            unlockedAt: created.unlocked_at,
          });
        }
      }

      return { newlyUnlocked };
    } catch (err: any) {
      this.logger.warn(`[evaluateForUser] Skipped due to error: ${err?.message}`);
      return { newlyUnlocked: [] };
    }
  }

  async listAchievements(userId?: string | null) {
    await this.ensureSeedCatalog();
    const achievements = await this.prisma.achievement.findMany({
      where: { is_active: true },
      orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
    });

    let unlockedMap = new Map<string, { progress: number; unlocked_at: Date }>();
    let metrics: Record<string, any> = {};

    if (userId) {
      await this.evaluateForUser(userId);
      const [userAchs, userMetrics] = await Promise.all([
        this.prisma.userAchievement.findMany({ where: { user_id: userId } }),
        this.getUserMetrics(userId),
      ]);
      metrics = userMetrics;
      unlockedMap = new Map(
        userAchs.map((ua) => [ua.achievement_id, { progress: ua.progress, unlocked_at: ua.unlocked_at }]),
      );
    }

    const items = achievements.map((ach) => {
      const unlockInfo = unlockedMap.get(ach.id);
      const currentProgress = userId
        ? Math.min(ach.threshold, Number(metrics[ach.rule_type] || unlockInfo?.progress || 0))
        : 0;
      return {
        id: ach.id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        category: ach.category,
        ruleType: ach.rule_type,
        threshold: ach.threshold,
        rewardDiamonds: ach.reward_diamonds,
        progress: unlockInfo ? ach.threshold : currentProgress,
        unlocked: Boolean(unlockInfo),
        unlockedAt: unlockInfo?.unlocked_at?.toISOString() || null,
      };
    });

    return {
      items,
      summary: {
        total: items.length,
        unlockedCount: items.filter((i) => i.unlocked).length,
        totalRewardDiamonds: items
          .filter((i) => i.unlocked)
          .reduce((sum, i) => sum + i.rewardDiamonds, 0),
      },
    };
  }

  async createAchievement(body: any) {
    const code = String(body?.code || '').trim().toUpperCase();
    const title = String(body?.title || '').trim();
    if (!code || !title) {
      throw new BadRequestException('Thiếu code hoặc title thành tựu');
    }
    return this.prisma.achievement.create({
      data: {
        code,
        title,
        description: String(body?.description || title),
        icon: String(body?.icon || '🏆'),
        category: String(body?.category || 'EXAM'),
        rule_type: String(body?.rule_type || 'EXAM_COUNT'),
        threshold: Math.max(1, Number(body?.threshold) || 1),
        reward_diamonds: Math.max(0, Number(body?.reward_diamonds) || 10),
        is_active: body?.is_active !== undefined ? Boolean(body.is_active) : true,
      },
    });
  }

  async deleteAchievement(id: string) {
    const existing = await this.prisma.achievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy thành tựu');
    await this.prisma.achievement.delete({ where: { id } });
    return { deletedId: id };
  }
}
