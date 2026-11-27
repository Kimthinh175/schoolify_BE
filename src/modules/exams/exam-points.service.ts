import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AdminAdjustPointsDto,
  DailyClaimPointsDto,
  SettleExamPointsDto,
  StartExamWithPointsDto,
} from './dto/exam.dto';

export const DAILY_EXAM_POINT_ALLOWANCE = 9;
export const EXAM_LEVEL_COSTS = {
  BASIC: 3, // Cơ bản: 3đ/bài -> 9đ làm được 3 bài
  MEDIUM: 4, // Trung bình: 4đ/bài -> 9đ làm được 2 bài
  ADVANCED: 9, // Giỏi: 9đ/bài -> 9đ làm được 1 bài
} as const;

@Injectable()
export class ExamPointsService {
  constructor(private readonly prisma: PrismaService) {}

  getTodayDateStringVN(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  normalizeExamLevel(rawLevel?: string): {
    code:
      | 'ASSESSMENT'
      | 'BASIC'
      | 'MEDIUM'
      | 'ADVANCED'
      | 'PROVINCIAL'
      | 'NATIONAL';
    label: string;
    costPoints: number;
    rewardPoints: number;
    maxDailyExams: number;
  } {
    const norm = String(rawLevel || 'BASIC')
      .trim()
      .toUpperCase();

    if (
      norm.includes('ASSESSMENT') ||
      norm.includes('DIAGNOSTIC') ||
      norm.includes('DANH_GIA') ||
      norm.includes('ĐÁNH GIÁ')
    ) {
      return {
        code: 'ASSESSMENT',
        label: 'Đánh giá năng lực',
        costPoints: 0,
        rewardPoints: 1,
        maxDailyExams: 99,
      };
    }

    if (
      norm.includes('NATIONAL') ||
      norm.includes('QUOC_GIA') ||
      norm.includes('QUỐC GIA') ||
      norm.includes('OLYMPIAD') ||
      norm.includes('HSG_QUOC_GIA')
    ) {
      return {
        code: 'NATIONAL',
        label: 'Cấp Quốc Gia / HSG',
        costPoints: EXAM_LEVEL_COSTS.ADVANCED,
        rewardPoints: 20,
        maxDailyExams: 1,
      };
    }

    if (
      norm.includes('PROVINCIAL') ||
      norm.includes('TINH') ||
      norm.includes('TỈNH') ||
      norm.includes('DGNL') ||
      norm.includes('ĐGNL') ||
      norm.includes('DGTD') ||
      norm.includes('ĐGTD') ||
      norm.includes('HSG_TINH')
    ) {
      return {
        code: 'PROVINCIAL',
        label: 'Cấp Tỉnh / ĐGNL',
        costPoints: EXAM_LEVEL_COSTS.ADVANCED,
        rewardPoints: 10,
        maxDailyExams: 1,
      };
    }

    if (
      norm.includes('ADVANCED') ||
      norm.includes('HARD') ||
      norm.includes('VERY_HARD') ||
      norm.includes('GIOI') ||
      norm.includes('GIỎI') ||
      norm.includes('EXCELLENT') ||
      norm.includes('VAN_DUNG') ||
      norm.includes('VAN_DUNG_CAO')
    ) {
      return {
        code: 'ADVANCED',
        label: 'Giỏi',
        costPoints: EXAM_LEVEL_COSTS.ADVANCED,
        rewardPoints: 5,
        maxDailyExams: 1,
      };
    }

    if (
      norm.includes('MEDIUM') ||
      norm.includes('INTERMEDIATE') ||
      norm.includes('TRUNG_BINH') ||
      norm.includes('TRUNG BÌNH') ||
      norm.includes('THONG_HIEU')
    ) {
      return {
        code: 'MEDIUM',
        label: 'Trung bình',
        costPoints: EXAM_LEVEL_COSTS.MEDIUM,
        rewardPoints: 3,
        maxDailyExams: 2,
      };
    }

    return {
      code: 'BASIC',
      label: 'Cơ bản',
      costPoints: EXAM_LEVEL_COSTS.BASIC,
      rewardPoints: 2,
      maxDailyExams: 3,
    };
  }

  computeQuotaByLevel(currentPoints: number, currentDiamonds = 0) {
    const basicMax =
      Math.floor(currentPoints / EXAM_LEVEL_COSTS.BASIC) +
      Math.floor(currentDiamonds / EXAM_LEVEL_COSTS.BASIC);
    const mediumMax =
      Math.floor(currentPoints / EXAM_LEVEL_COSTS.MEDIUM) +
      Math.floor(currentDiamonds / EXAM_LEVEL_COSTS.MEDIUM);
    const advancedMax =
      Math.floor(currentPoints / EXAM_LEVEL_COSTS.ADVANCED) +
      Math.floor(currentDiamonds / EXAM_LEVEL_COSTS.ADVANCED);
    return {
      BASIC: {
        code: 'BASIC',
        label: 'Cơ bản',
        costPoints: EXAM_LEVEL_COSTS.BASIC,
        dailyBaseAllowanceExams: 3,
        remainingExamsPossible: basicMax,
        maxExamsAvailable: basicMax,
        canStart:
          currentPoints >= EXAM_LEVEL_COSTS.BASIC ||
          currentDiamonds >= EXAM_LEVEL_COSTS.BASIC,
        canStartWithPoints: currentPoints >= EXAM_LEVEL_COSTS.BASIC,
        canStartWithDiamonds: currentDiamonds >= EXAM_LEVEL_COSTS.BASIC,
      },
      MEDIUM: {
        code: 'MEDIUM',
        label: 'Trung bình',
        costPoints: EXAM_LEVEL_COSTS.MEDIUM,
        dailyBaseAllowanceExams: 2,
        remainingExamsPossible: mediumMax,
        maxExamsAvailable: mediumMax,
        canStart:
          currentPoints >= EXAM_LEVEL_COSTS.MEDIUM ||
          currentDiamonds >= EXAM_LEVEL_COSTS.MEDIUM,
        canStartWithPoints: currentPoints >= EXAM_LEVEL_COSTS.MEDIUM,
        canStartWithDiamonds: currentDiamonds >= EXAM_LEVEL_COSTS.MEDIUM,
      },
      ADVANCED: {
        code: 'ADVANCED',
        label: 'Giỏi',
        costPoints: EXAM_LEVEL_COSTS.ADVANCED,
        dailyBaseAllowanceExams: 1,
        remainingExamsPossible: advancedMax,
        maxExamsAvailable: advancedMax,
        canStart:
          currentPoints >= EXAM_LEVEL_COSTS.ADVANCED ||
          currentDiamonds >= EXAM_LEVEL_COSTS.ADVANCED,
        canStartWithPoints: currentPoints >= EXAM_LEVEL_COSTS.ADVANCED,
        canStartWithDiamonds: currentDiamonds >= EXAM_LEVEL_COSTS.ADVANCED,
      },
    };
  }

  getExamPointsRules() {
    return {
      dailyAllowance: DAILY_EXAM_POINT_ALLOWANCE,
      resetPolicy: 'FIXED_DAILY_RESET_TO_9',
      timezone: 'Asia/Ho_Chi_Minh',
      description:
        'Mỗi ngày hệ thống phát 9 điểm năng lượng làm đề (reset cố định về 9 điểm vào đầu ngày mới), đủ để làm 3 bài Cơ bản (3đ/bài), hoặc 2 bài Trung bình (4đ/bài), hoặc 1 bài Giỏi (9đ/bài).',
      examLevelCosts: {
        BASIC: {
          code: 'BASIC',
          label: 'Cơ bản',
          costPoints: EXAM_LEVEL_COSTS.BASIC,
          maxExamsWithDaily9Points: 3,
        },
        MEDIUM: {
          code: 'MEDIUM',
          label: 'Trung bình',
          costPoints: EXAM_LEVEL_COSTS.MEDIUM,
          maxExamsWithDaily9Points: 2,
        },
        ADVANCED: {
          code: 'ADVANCED',
          label: 'Giỏi',
          costPoints: EXAM_LEVEL_COSTS.ADVANCED,
          maxExamsWithDaily9Points: 1,
        },
      },
      scoreOutcomeRules: [
        {
          code: 'SCORE_PENALTY_UNDER_5',
          rangeLabel: 'Dưới 5.0 điểm (< 5.0)',
          minScore: 0,
          maxScoreExclusive: 5.0,
          pointDelta: -1,
          description: 'Kết quả dưới 5 điểm bị trừ 1 điểm (-1đ)',
        },
        {
          code: 'SCORE_NEUTRAL_5_TO_8_5',
          rangeLabel: 'Từ 5.0 đến dưới 8.5 điểm (5.0 ≤ Điểm < 8.5)',
          minScore: 5.0,
          maxScoreExclusive: 8.5,
          pointDelta: 0,
          description:
            'Kết quả từ 5 đến 8.5 điểm giữ nguyên không thay đổi (0đ)',
        },
        {
          code: 'SCORE_REWARD_8_5_TO_9_9',
          rangeLabel: 'Từ 8.5 đến 9.9 điểm (8.5 ≤ Điểm < 10.0)',
          minScore: 8.5,
          maxScoreExclusive: 10.0,
          pointDelta: 1,
          description:
            'Kết quả đạt từ 8.5 đến 9.9 điểm được thưởng thêm 1 điểm (+1đ)',
        },
        {
          code: 'SCORE_REWARD_10',
          rangeLabel: 'Đạt 10 điểm tuyệt đối (Điểm = 10)',
          minScore: 10.0,
          maxScoreInclusive: 10.0,
          pointDelta: 2,
          description:
            'Kết quả đạt 10 điểm tuyệt đối được thưởng thêm 2 điểm (+2đ)',
        },
      ],
    };
  }

  getPackageQuota(profile: any): {
    dailyFreeAllowance: number;
    dailyXinPoints: number;
    activePackage: string;
    hasAi50PercentDiscount: boolean;
  } {
    let pkg = String(profile?.active_package || 'FREE').toUpperCase();
    if (
      profile?.package_expires_at &&
      new Date(profile.package_expires_at).getTime() < Date.now()
    ) {
      pkg = 'FREE';
    }
    if (pkg === 'STUDENT_100K') {
      return {
        dailyFreeAllowance: 29,
        dailyXinPoints: 10,
        activePackage: 'STUDENT_100K',
        hasAi50PercentDiscount: true,
      };
    }
    if (pkg === 'STUDENT_50K') {
      return {
        dailyFreeAllowance: 18,
        dailyXinPoints: 5,
        activePackage: 'STUDENT_50K',
        hasAi50PercentDiscount: false,
      };
    }
    return {
      dailyFreeAllowance: 9,
      dailyXinPoints: 0,
      activePackage: 'FREE',
      hasAi50PercentDiscount: false,
    };
  }

  async getOrInitStudentProfile(userId: string | null, grade?: number) {
    const today = this.getTodayDateStringVN();
    let profile: any = null;

    if (userId && userId !== 'guest') {
      profile = await this.prisma.studentProfile.findUnique({
        where: { user_id: userId },
      });

      if (!profile) {
        const userExists = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (userExists && userExists.role !== 'SUPER_ADMIN') {
          const pkgInfo = this.getPackageQuota(null);
          profile = await this.prisma.studentProfile.create({
            data: {
              user_id: userId,
              grade_level: grade ? `Lớp ${grade}` : null,
              points: 10,
              exam_points: pkgInfo.dailyFreeAllowance,
              active_package: 'FREE',
              last_daily_grant_date: today,
            },
          });
          await this.prisma.examPointLog.create({
            data: {
              student_id: profile.id,
              action_type: 'DAILY_GRANT_FREE',
              points_before: 0,
              points_delta: pkgInfo.dailyFreeAllowance,
              points_after: pkgInfo.dailyFreeAllowance,
              note: `Phát ${pkgInfo.dailyFreeAllowance} điểm làm đề Free hàng ngày (${today})`,
            },
          });
          return profile;
        }
      }
    }

    if (!profile) {
      const pkgInfo = this.getPackageQuota(null);
      return {
        id: 'virtual-guest',
        user_id: userId || 'guest',
        grade_level: null,
        points: 0,
        exam_points: pkgInfo.dailyFreeAllowance,
        active_package: 'FREE',
        last_daily_grant_date: today,
        isVirtual: true,
      };
    }

    if (
      profile &&
      !profile.isVirtual &&
      profile.last_daily_grant_date !== today
    ) {
      const pkgInfo = this.getPackageQuota(profile);
      const freeBefore = Number(profile.exam_points ?? 0);
      const xinBefore = Number(profile.points ?? 0);
      const newXinPoints = Number(
        (xinBefore + pkgInfo.dailyXinPoints).toFixed(2),
      );

      profile = await this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: {
          exam_points: pkgInfo.dailyFreeAllowance,
          points: newXinPoints,
          last_daily_grant_date: today,
        },
      });

      await this.prisma.examPointLog.create({
        data: {
          student_id: profile.id,
          action_type: 'DAILY_GRANT_FREE',
          points_before: freeBefore,
          points_delta: pkgInfo.dailyFreeAllowance - freeBefore,
          points_after: pkgInfo.dailyFreeAllowance,
          note: `Reset & phát ${pkgInfo.dailyFreeAllowance} điểm làm đề Free hàng ngày (${today}) cho gói ${pkgInfo.activePackage}`,
        },
      });

      if (pkgInfo.dailyXinPoints > 0) {
        await this.prisma.examPointLog.create({
          data: {
            student_id: profile.id,
            action_type: 'DAILY_GRANT_XIN',
            points_before: xinBefore,
            points_delta: pkgInfo.dailyXinPoints,
            points_after: newXinPoints,
            note: `Cấp +${pkgInfo.dailyXinPoints} Điểm Xịn (💎) tích lũy mỗi ngày từ gói ${pkgInfo.activePackage} (${today})`,
          },
        });
      }
    }

    return profile;
  }

  async getExamPointBalance(userId: string | null) {
    const today = this.getTodayDateStringVN();
    const profile = await this.getOrInitStudentProfile(userId);
    const pkgInfo = this.getPackageQuota(profile);
    const currentPoints = Number(
      profile.exam_points ?? pkgInfo.dailyFreeAllowance,
    );
    const currentDiamonds = Number(profile.points ?? 0);

    const startOfToday = new Date(`${today}T00:00:00+07:00`);
    const todayLogs = profile.isVirtual
      ? []
      : await this.prisma.examPointLog.findMany({
          where: {
            student_id: profile.id,
            created_at: { gte: startOfToday },
          },
          orderBy: { created_at: 'desc' },
          take: 20,
        });

    const INACTIVITY_THRESHOLD_DAYS = 30;
    let totalSubmissionsCount = 0;
    let lastSubmittedAt: Date | null = null;
    let daysSinceLastPractice: number | null = null;
    let diagnosticPrompt: {
      shouldPrompt: boolean;
      reason: 'FIRST_TIME' | 'INACTIVE_30_DAYS' | null;
      daysSinceLastPractice: number | null;
      thresholdDays: number;
    } = {
      shouldPrompt: true,
      reason: 'FIRST_TIME',
      daysSinceLastPractice: null,
      thresholdDays: INACTIVITY_THRESHOLD_DAYS,
    };

    if (!profile.isVirtual) {
      const [subCount, latestSub] = await Promise.all([
        this.prisma.examSubmission.count({
          where: { student_id: profile.id },
        }),
        this.prisma.examSubmission.findFirst({
          where: { student_id: profile.id },
          orderBy: { submitted_at: 'desc' },
          select: { id: true, submitted_at: true },
        }),
      ]);

      totalSubmissionsCount = subCount;
      lastSubmittedAt = latestSub?.submitted_at || null;
      if (lastSubmittedAt) {
        const diffMs = Math.max(
          0,
          Date.now() - new Date(lastSubmittedAt).getTime(),
        );
        daysSinceLastPractice = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      if (totalSubmissionsCount === 0) {
        diagnosticPrompt = {
          shouldPrompt: true,
          reason: 'FIRST_TIME',
          daysSinceLastPractice: null,
          thresholdDays: INACTIVITY_THRESHOLD_DAYS,
        };
      } else if (
        daysSinceLastPractice !== null &&
        daysSinceLastPractice >= INACTIVITY_THRESHOLD_DAYS
      ) {
        diagnosticPrompt = {
          shouldPrompt: true,
          reason: 'INACTIVE_30_DAYS',
          daysSinceLastPractice,
          thresholdDays: INACTIVITY_THRESHOLD_DAYS,
        };
      } else {
        diagnosticPrompt = {
          shouldPrompt: false,
          reason: null,
          daysSinceLastPractice,
          thresholdDays: INACTIVITY_THRESHOLD_DAYS,
        };
      }
    }

    const examsStartedToday = todayLogs.filter(
      (l) =>
        l.action_type === 'START_EXAM' ||
        l.action_type === 'START_EXAM_DIAMONDS',
    ).length;
    const pointsSpentToday = todayLogs
      .filter((l) => l.action_type === 'START_EXAM')
      .reduce((sum, l) => sum + Math.abs(l.points_delta), 0);
    const pointsRewardedToday = todayLogs
      .filter((l) => l.action_type.startsWith('SCORE_REWARD'))
      .reduce((sum, l) => sum + Math.max(0, l.points_delta), 0);
    const pointsPenalizedToday = todayLogs
      .filter((l) => l.action_type === 'SCORE_PENALTY_UNDER_5')
      .reduce((sum, l) => sum + Math.abs(l.points_delta), 0);

    const alreadyClaimedToday = todayLogs.some(
      (l) =>
        l.action_type === 'DAILY_CHECKIN' || l.action_type === 'DAILY_GRANT',
    );

    return {
      studentProfileId: profile.id,
      currentPoints,
      diamonds: currentDiamonds,
      activePackage: pkgInfo.activePackage,
      dailyAllowance: pkgInfo.dailyFreeAllowance,
      dailyXinAllowance: pkgInfo.dailyXinPoints,
      hasAi50PercentDiscount: pkgInfo.hasAi50PercentDiscount,
      lastDailyGrantDate: profile.last_daily_grant_date || today,
      alreadyClaimedToday,
      totalSubmissionsCount,
      lastSubmittedAt,
      daysSinceLastPractice,
      diagnosticPrompt,
      quotaByLevel: this.computeQuotaByLevel(currentPoints, currentDiamonds),
      todaySummary: {
        date: today,
        examsStartedToday,
        pointsSpentToday,
        pointsRewardedToday,
        pointsPenalizedToday,
      },
      recentLogs: todayLogs.slice(0, 10).map((l) => ({
        id: l.id,
        actionType: l.action_type,
        examLevel: l.exam_level,
        examTitle: l.exam_title,
        examScore: l.exam_score !== null ? Number(l.exam_score) : null,
        pointsBefore: l.points_before,
        pointsDelta: l.points_delta,
        pointsAfter: l.points_after,
        note: l.note,
        createdAt: l.created_at,
      })),
      rules: this.getExamPointsRules(),
    };
  }

  async claimDailyExamPoints(userId: string | null, dto: DailyClaimPointsDto) {
    const today = this.getTodayDateStringVN();
    const effectiveUserId = userId || dto?.userId || null;
    const profile = await this.getOrInitStudentProfile(effectiveUserId);
    const pkgInfo = this.getPackageQuota(profile);
    const allowance = Number(
      pkgInfo.dailyFreeAllowance || DAILY_EXAM_POINT_ALLOWANCE,
    );
    const before = Number(profile.exam_points ?? allowance);

    const startOfToday = new Date(`${today}T00:00:00+07:00`);
    const existingClaimToday = Boolean(
      await this.prisma.examPointLog.findFirst({
        where: {
          student_id: profile.id,
          action_type: { in: ['DAILY_GRANT', 'DAILY_CHECKIN'] },
          created_at: { gte: startOfToday },
        },
        select: { id: true },
      }),
    );

    if (existingClaimToday) {
      return {
        claimed: false,
        alreadyClaimedToday: true,
        grantDate: today,
        dailyAllowance: allowance,
        previousPoints: before,
        currentPoints: before,
        diamonds: Number(profile.points ?? 0),
        quotaByLevel: this.computeQuotaByLevel(
          before,
          Number(profile.points ?? 0),
        ),
        message: `Hôm nay (${today}) bạn đã điểm danh nhận Tia Sáng rồi nhé! Mỗi ngày chỉ được nhận 1 lần, vui lòng quay lại vào ngày mai nhé.`,
      };
    }

    const updated = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        exam_points: { increment: allowance },
        last_daily_grant_date: today,
      },
    });

    await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'DAILY_GRANT',
        points_before: before,
        points_delta: allowance,
        points_after: Number(updated.exam_points ?? before + allowance),
        note: `Điểm danh hàng ngày (${today}): Nhận +${allowance} Tia Sáng (⚡)`,
      },
    });

    return {
      claimed: true,
      alreadyClaimedToday: true,
      grantDate: today,
      dailyAllowance: allowance,
      pointsDelta: allowance,
      previousPoints: before,
      currentPoints: updated.exam_points,
      diamonds: Number(updated.points ?? 0),
      quotaByLevel: this.computeQuotaByLevel(
        updated.exam_points,
        Number(updated.points ?? 0),
      ),
      message: `Điểm danh thành công ngày ${today}! Bạn đã nhận +${allowance} Tia Sáng (⚡) hôm nay.`,
    };
  }

  async startExamWithPoints(
    userId: string | null,
    dto: StartExamWithPointsDto,
  ) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(
      effectiveUserId,
      dto.grade,
    );
    const levelInfo = this.normalizeExamLevel(dto.level);
    const currentPoints = Number(profile.exam_points ?? 0);
    const currentDiamonds = Number(profile.points ?? 0);

    const canPayWithExamPoints =
      currentPoints >= levelInfo.costPoints && !dto.useDiamonds;
    const canPayWithDiamonds = currentDiamonds >= levelInfo.costPoints;

    if (
      levelInfo.costPoints > 0 &&
      !canPayWithExamPoints &&
      !canPayWithDiamonds
    ) {
      throw new BadRequestException({
        success: false,
        errorCode: 'INSUFFICIENT_EXAM_POINTS',
        message: `Không đủ điểm làm đề! Đề cấp độ ${levelInfo.label} cần ${levelInfo.costPoints} Tia Sáng (⚡) hoặc ${levelInfo.costPoints} Ngọc Tri Thức (💎), nhưng bạn hiện chỉ còn ${currentPoints} ⚡ và ${currentDiamonds} 💎.`,
        data: {
          level: levelInfo.code,
          levelLabel: levelInfo.label,
          requiredPoints: levelInfo.costPoints,
          currentPoints,
          currentDiamonds,
          shortfallPoints: Math.max(0, levelInfo.costPoints - currentPoints),
          shortfallDiamonds: Math.max(
            0,
            levelInfo.costPoints - currentDiamonds,
          ),
          quotaByLevel: this.computeQuotaByLevel(
            currentPoints,
            currentDiamonds,
          ),
        },
      });
    }

    const resolvedTitle =
      dto.examTitle ||
      `Đề thi ${dto.subjectSlug || 'Toán học'} - Cấp độ ${levelInfo.label}`;

    if (profile.isVirtual || levelInfo.costPoints === 0) {
      return {
        allowed: true,
        isGuestTrial: Boolean(profile.isVirtual),
        paidWithDiamonds: false,
        sessionId: `SES-${Date.now()}`,
        logId: null,
        examLevel: levelInfo.code,
        examLevelLabel: levelInfo.label,
        examTitle: resolvedTitle,
        costDeducted: 0,
        pointsBefore: currentPoints,
        currentPoints,
        diamondsBefore: currentDiamonds,
        diamonds: currentDiamonds,
        quotaByLevel: this.computeQuotaByLevel(currentPoints, currentDiamonds),
        message:
          levelInfo.costPoints === 0
            ? `Bắt đầu bài ${levelInfo.label} miễn phí.`
            : `Bắt đầu bài làm thử miễn phí cấp độ ${levelInfo.label}.`,
      };
    }

    if (canPayWithExamPoints) {
      const pointsAfter = currentPoints - levelInfo.costPoints;
      const updatedProfile = await this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: {
          exam_points: pointsAfter,
        },
      });

      const log = await this.prisma.examPointLog.create({
        data: {
          student_id: profile.id,
          action_type: 'START_EXAM',
          exam_level: levelInfo.code,
          exam_title: resolvedTitle,
          points_before: currentPoints,
          points_delta: -levelInfo.costPoints,
          points_after: pointsAfter,
          note: `Trừ ${levelInfo.costPoints} Tia Sáng (⚡) khi bắt đầu làm đề cấp độ ${levelInfo.label} ("${resolvedTitle}")`,
        },
      });

      return {
        allowed: true,
        paidWithDiamonds: false,
        sessionId: `SES-${Date.now()}`,
        logId: log.id,
        examLevel: levelInfo.code,
        examLevelLabel: levelInfo.label,
        examTitle: resolvedTitle,
        costDeducted: levelInfo.costPoints,
        pointsBefore: currentPoints,
        currentPoints: updatedProfile.exam_points,
        diamondsBefore: currentDiamonds,
        diamonds: Number(updatedProfile.points ?? currentDiamonds),
        quotaByLevel: this.computeQuotaByLevel(
          updatedProfile.exam_points,
          Number(updatedProfile.points ?? currentDiamonds),
        ),
        message: `Đã trừ ${levelInfo.costPoints} Tia Sáng (⚡) để mở đề cấp độ ${levelInfo.label}. Số dư còn lại: ${updatedProfile.exam_points} ⚡.`,
      };
    }

    const diamondsAfter = Math.max(
      0,
      Number((currentDiamonds - levelInfo.costPoints).toFixed(2)),
    );
    const updatedProfile = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        points: diamondsAfter,
      },
    });

    const log = await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'START_EXAM_DIAMONDS',
        exam_level: levelInfo.code,
        exam_title: resolvedTitle,
        points_before: Math.round(currentDiamonds),
        points_delta: -levelInfo.costPoints,
        points_after: Math.round(diamondsAfter),
        note: `Trừ ${levelInfo.costPoints} Ngọc Tri Thức (💎) khi bắt đầu làm đề cấp độ ${levelInfo.label} ("${resolvedTitle}")`,
      },
    });

    return {
      allowed: true,
      paidWithDiamonds: true,
      sessionId: `SES-${Date.now()}`,
      logId: log.id,
      examLevel: levelInfo.code,
      examLevelLabel: levelInfo.label,
      examTitle: resolvedTitle,
      costDeducted: levelInfo.costPoints,
      pointsBefore: currentPoints,
      currentPoints: updatedProfile.exam_points,
      diamondsBefore: currentDiamonds,
      diamonds: Number(updatedProfile.points ?? diamondsAfter),
      quotaByLevel: this.computeQuotaByLevel(
        updatedProfile.exam_points,
        Number(updatedProfile.points ?? diamondsAfter),
      ),
      message: `Đã dùng ${levelInfo.costPoints} Ngọc Tri Thức (💎) để mở đề cấp độ ${levelInfo.label}. Số Ngọc còn lại: ${updatedProfile.points} 💎.`,
    };
  }

  async settleExamSubmissionPoints(
    userId: string | null,
    dto: SettleExamPointsDto,
  ) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(effectiveUserId);
    const rawScore = Math.max(0, Math.min(10, Number(dto.score ?? 0)));
    const score = Number(rawScore.toFixed(2));
    const levelInfo = this.normalizeExamLevel(dto.level);

    if (profile.isVirtual) {
      return {
        logId: null,
        submissionId: dto.submissionId || null,
        isGuestTrial: true,
        examLevel: levelInfo.code,
        examLevelLabel: levelInfo.label,
        score,
        tierCode: 'GUEST_TRIAL',
        tierLabel: 'Bài làm thử miễn phí',
        pointsBefore: 9,
        entryCostDeducted: 0,
        scorePointDelta: 0,
        rewardXinPoints: score >= 8.5 ? levelInfo.rewardPoints : 0,
        netPointDelta: 0,
        currentPoints: 9,
        diamonds: 0,
        currentXinPoints: 0,
        quotaByLevel: this.computeQuotaByLevel(9, 0),
        message:
          'Hoàn thành bài làm thử! Đăng nhập để lưu kết quả và nhận thưởng Điểm Xịn.',
      };
    }

    let workingFreePoints = Number(profile.exam_points ?? 0);
    let workingDiamonds = Number(profile.points ?? 0);
    const initialFreePoints = workingFreePoints;
    let entryCostDeducted = 0;

    if (dto.deductEntryCost && levelInfo.costPoints > 0) {
      entryCostDeducted = levelInfo.costPoints;
      if (workingFreePoints >= entryCostDeducted) {
        const afterEntry = Math.max(0, workingFreePoints - entryCostDeducted);
        await this.prisma.examPointLog.create({
          data: {
            student_id: profile.id,
            action_type: 'START_EXAM',
            exam_level: levelInfo.code,
            exam_title: dto.examTitle || `Đề thi cấp độ ${levelInfo.label}`,
            submission_id: dto.submissionId || null,
            points_before: workingFreePoints,
            points_delta: -(workingFreePoints - afterEntry),
            points_after: afterEntry,
            note: `Trừ ${entryCostDeducted} Tia Sáng (⚡) phí làm đề cấp độ ${levelInfo.label}`,
          },
        });
        workingFreePoints = afterEntry;
      } else if (workingDiamonds >= entryCostDeducted) {
        const afterDiamonds = Math.max(
          0,
          Number((workingDiamonds - entryCostDeducted).toFixed(2)),
        );
        await this.prisma.examPointLog.create({
          data: {
            student_id: profile.id,
            action_type: 'START_EXAM_DIAMONDS',
            exam_level: levelInfo.code,
            exam_title: dto.examTitle || `Đề thi cấp độ ${levelInfo.label}`,
            submission_id: dto.submissionId || null,
            points_before: Math.round(workingDiamonds),
            points_delta: -entryCostDeducted,
            points_after: Math.round(afterDiamonds),
            note: `Trừ ${entryCostDeducted} Ngọc Tri Thức (💎) phí làm đề cấp độ ${levelInfo.label}`,
          },
        });
        workingDiamonds = afterDiamonds;
      }
    }

    let rewardXinPoints = 0;
    if (score >= 8.5) {
      rewardXinPoints = levelInfo.rewardPoints;
    }

    let scoreFreeDelta = 0;
    let actionType = 'SCORE_NEUTRAL_5_TO_8_5';
    let tierLabel = 'Từ 5.0 - 8.5 điểm (Không thay đổi)';
    let explanation = `Bạn đạt ${score}/10 điểm. Điểm làm đề Free giữ nguyên.`;

    if (score < 5.0) {
      scoreFreeDelta = -1;
      actionType = 'SCORE_PENALTY_UNDER_5';
      tierLabel = 'Dưới 5.0 điểm (-1đ Free)';
      explanation = `Bài thi đạt ${score}/10 điểm (dưới 5.0đ) nên bị trừ 1 điểm Free (-1đ). Hãy ôn kỹ lại lời giải để gỡ điểm ở bài sau nhé!`;
    } else if (score >= 8.5) {
      actionType =
        score >= 10.0 ? 'SCORE_REWARD_10_XIN' : 'SCORE_REWARD_8_5_XIN';
      tierLabel = `Đạt ${score}/10đ (+${rewardXinPoints} 💎 Điểm Xịn)`;
      explanation = `Xuất sắc! Bạn đạt ${score}/10 điểm cấp độ ${levelInfo.label} và được thưởng nóng +${rewardXinPoints} Điểm Xịn (💎 tích lũy vĩnh viễn)!`;
    }

    const finalFreePoints = Math.max(0, workingFreePoints + scoreFreeDelta);
    const xinBefore = workingDiamonds;
    const finalXinPoints = Number((xinBefore + rewardXinPoints).toFixed(2));

    const updatedProfile = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        exam_points: finalFreePoints,
        points: finalXinPoints,
      },
    });

    if (rewardXinPoints > 0) {
      await this.prisma.examPointLog.create({
        data: {
          student_id: profile.id,
          action_type: actionType,
          exam_level: levelInfo.code,
          exam_title: dto.examTitle || `Thưởng Điểm Xịn bài thi (${score}/10)`,
          submission_id: dto.submissionId || null,
          exam_score: score,
          points_before: xinBefore,
          points_delta: rewardXinPoints,
          points_after: finalXinPoints,
          note: explanation,
        },
      });
    } else if (scoreFreeDelta !== 0) {
      await this.prisma.examPointLog.create({
        data: {
          student_id: profile.id,
          action_type: actionType,
          exam_level: levelInfo.code,
          exam_title: dto.examTitle || `Kết quả bài thi (${score}/10)`,
          submission_id: dto.submissionId || null,
          exam_score: score,
          points_before: workingFreePoints,
          points_delta: scoreFreeDelta,
          points_after: finalFreePoints,
          note: explanation,
        },
      });
    }

    return {
      logId: dto.submissionId || null,
      submissionId: dto.submissionId || null,
      examLevel: levelInfo.code,
      examLevelLabel: levelInfo.label,
      score,
      tierCode: actionType,
      tierLabel,
      pointsBefore: initialFreePoints,
      entryCostDeducted,
      scorePointDelta: scoreFreeDelta,
      rewardXinPoints,
      netPointDelta: finalFreePoints - initialFreePoints,
      currentPoints: updatedProfile.exam_points,
      diamonds: updatedProfile.points,
      currentXinPoints: updatedProfile.points,
      quotaByLevel: this.computeQuotaByLevel(updatedProfile.exam_points),
      message: explanation,
    };
  }

  async getExamPointHistory(
    userId: string | null,
    page = 1,
    limit = 20,
    actionType?: string,
  ) {
    const profile = await this.getOrInitStudentProfile(userId);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const where: any = {
      student_id: profile.id,
      ...(actionType ? { action_type: actionType } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.examPointLog.count({ where }),
      this.prisma.examPointLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: safeLimit,
      }),
    ]);

    return {
      currentPoints: profile.exam_points,
      dailyAllowance: DAILY_EXAM_POINT_ALLOWANCE,
      lastDailyGrantDate: profile.last_daily_grant_date,
      quotaByLevel: this.computeQuotaByLevel(profile.exam_points),
      items: items.map((item) => ({
        id: item.id,
        actionType: item.action_type,
        examLevel: item.exam_level,
        examTitle: item.exam_title,
        submissionId: item.submission_id,
        examScore: item.exam_score !== null ? Number(item.exam_score) : null,
        pointsBefore: item.points_before,
        pointsDelta: item.points_delta,
        pointsAfter: item.points_after,
        note: item.note,
        createdAt: item.created_at,
      })),
      pagination: {
        totalItems: total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async adminAdjustPoints(
    currentUserId: string | null,
    currentUserRole: string | undefined,
    dto: AdminAdjustPointsDto,
  ) {
    const normRole = String(currentUserRole || '')
      .trim()
      .toUpperCase();

    if (normRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Từ chối truy cập! Chỉ người dùng có vai trò SUPER_ADMIN mới có quyền điều chỉnh điểm trực tiếp.',
      );
    }

    const trimmedNote = String(dto.note || '').trim();
    if (trimmedNote.length < 5) {
      throw new BadRequestException(
        'Vui lòng nhập lý do điều chỉnh (note) tối thiểu 5 ký tự để lưu kiểm toán.',
      );
    }

    const targetUserId = dto.userId || currentUserId || null;
    const profile = await this.getOrInitStudentProfile(targetUserId);

    const updateData: any = {};
    if (dto.examPoints !== undefined && dto.examPoints !== null) {
      updateData.exam_points = Math.max(0, Number(dto.examPoints));
    }
    if (dto.diamonds !== undefined && dto.diamonds !== null) {
      updateData.points = Math.max(0, Number(dto.diamonds));
    }

    const updatedProfile = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    const deltaPoints =
      dto.examPoints !== undefined && dto.examPoints !== null
        ? Number(updatedProfile.exam_points) - Number(profile.exam_points ?? 0)
        : 0;

    await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'ADMIN_CSKH_ADJUST',
        points_before: Number(profile.exam_points ?? 0),
        points_delta: deltaPoints,
        points_after: Number(updatedProfile.exam_points),
        note: trimmedNote,
      },
    });

    return {
      studentProfileId: updatedProfile.id,
      userId: targetUserId,
      currentPoints: Number(updatedProfile.exam_points),
      diamonds: Number(updatedProfile.points ?? 0),
      quotaByLevel: this.computeQuotaByLevel(
        Number(updatedProfile.exam_points),
      ),
      message: `Đã cập nhật: ${updatedProfile.exam_points} Tia Sáng ✨ | ${updatedProfile.points} Ngọc Tri Thức 💎`,
    };
  }
}
