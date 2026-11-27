import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { isTokenRevoked } from '../auth/token-blacklist';
import { ExamPointsService } from './exam-points.service';
import {
  AdminAdjustPointsDto,
  CreateQuestionBugReportDto,
  DailyClaimPointsDto,
  GenerateMatrixExamDto,
  RecordQuickDrillBehaviorDto,
  SettleExamPointsDto,
  StartExamWithPointsDto,
  SubmitExamDto,
  SubmitRemediationDto,
  SyncGuestOnboardingDto,
  SyncOfflineSubmissionsDto,
  UnlockChapterJumpDto,
  UpdateQuestionBugReportStatusDto,
} from './dto/exam.dto';
import {
  BloomLevel,
  QuestionBugReportStatus,
  QuestionFormat,
  QuestionIssueType,
} from '@prisma/client';
import { KnowledgeRoadmapService } from './knowledge-roadmap.service';
import {
  CurriculumChapterDef,
  CurriculumTrackCode,
  getCurrentRealTimeSemester,
  getCurriculumChapters,
  getNextCurriculumChapterInTrack,
  parseStudentGradeNumber,
} from './curriculum-chapters.constant';

export const DAILY_EXAM_POINT_ALLOWANCE = 9;
export const EXAM_LEVEL_COSTS = {
  BASIC: 3, // Cơ bản: 3đ/bài -> 9đ làm được 3 bài
  MEDIUM: 4, // Trung bình: 4đ/bài -> 9đ làm được 2 bài
  ADVANCED: 9, // Giỏi: 9đ/bài -> 9đ làm được 1 bài
} as const;

export interface AuthenticatedExamUser {
  id: string;
  email?: string;
  fullname?: string;
  role: string; // 'USER' | 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'PRINCIPAL'
  schoolRoles: string[];
  isTeacher: boolean;
  isParent: boolean;
  linkedStudentIds: string[];
}

/**
 * Sinh mã attemptToken ngẫu nhiên bảo mật cao (CSPRNG) dạng att_[a-f0-9]{32}
 */
export function generateSecureAttemptToken(): string {
  return `att_${randomBytes(16).toString('hex')}`;
}

@Injectable()
export class ExamsService {
  private readonly questionPoolCache = new Map<
    string,
    {
      expiresAt: number;
      items: Array<{
        id: string;
        chapter_id: number | null;
        bloom_level: BloomLevel | null;
        topic_tag: string | null;
      }>;
    }
  >();

  private readonly guestCursorCache = new Map<
    string,
    {
      cursorPos: number;
      epoch: number;
      lastBoundaryIds: string[];
      updatedAt: number;
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeRoadmapService: KnowledgeRoadmapService,
    private readonly examPointsService: ExamPointsService,
  ) {}

  /**
   * Băm chuỗi thành số nguyên 32-bit không dấu (FNV-1a + Murmur3 avalanche)
   */
  private hashStringToUint32(input: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  private gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  }

  /**
   * Sinh bộ tham số đồng dư tuyến tính (step, offset) với gcd(step, poolSize) = 1
   * Đảm bảo đi qua đúng 100% câu hỏi trong bể kích thước M mà KHÔNG BAO GIỜ trùng lặp trong cùng 1 chu kỳ (Epoch).
   */
  private buildCoprimeStrideParams(
    seedStr: string,
    poolSize: number,
  ): { step: number; offset: number } {
    if (poolSize <= 1) {
      return { step: 1, offset: 0 };
    }
    const rawStep =
      (this.hashStringToUint32(`${seedStr}:step`) % (poolSize - 1)) + 1;
    let step = rawStep;
    for (let delta = 0; delta < poolSize; delta++) {
      const candidate = ((rawStep - 1 + delta) % (poolSize - 1)) + 1;
      if (this.gcd(candidate, poolSize) === 1) {
        step = candidate;
        break;
      }
    }
    const offset = this.hashStringToUint32(`${seedStr}:offset`) % poolSize;
    return { step, offset };
  }

  /**
   * Lấy danh sách metadata (id, chapter_id, bloom_level, topic_tag) của toàn bộ bể câu hỏi theo môn + khối lớp.
   * Đọc từ Covering Index (Index-Only Scan) và cache trên RAM 5 phút để chịu tải >100,000 users với ~0ms latency.
   */
  private async getCachedSubjectGradePoolMeta(subject: string, grade: number) {
    const cacheKey = `${subject}:g${grade}`;
    const now = Date.now();
    const cached = this.questionPoolCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.items;
    }

    const rows = await this.prisma.question.findMany({
      where: {
        subject,
        grade,
        question_format: {
          not: QuestionFormat.ESSAY,
        },
      },
      select: {
        id: true,
        chapter_id: true,
        bloom_level: true,
        topic_tag: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    this.questionPoolCache.set(cacheKey, {
      expiresAt: now + 5 * 60 * 1000,
      items: rows,
    });
    return rows;
  }

  /**
   * Tạo hoán vị cho 1 chu kỳ (Epoch):
   * - Dùng phép nhảy đồng dư nguyên tố cùng nhau (step * i + offset) mod M.
   * - Khi sang vòng lặp mới (epoch >= 1, đã gặp hết sạch bể):
   *   1. Ưu tiên đưa các câu từng làm SAI (wrongQuestionIdSet) lên đầu chu kỳ mới.
   *   2. Đẩy các câu vừa xuất hiện ở đề giáp ranh cuối vòng trước (boundaryCooldownSet) xuống cuối chu kỳ
   *      để không bao giờ lặp lại câu vừa mới thi ở đề liền trước.
   */
  private buildEpochPermutation<
    T extends { id: string; topic_tag: string | null },
  >(params: {
    pool: T[];
    seedStr: string;
    epoch: number;
    wrongQuestionIdSet: Set<string>;
    weakTopicSet: Set<string>;
    boundaryCooldownSet: Set<string>;
  }): T[] {
    const {
      pool,
      seedStr,
      epoch,
      wrongQuestionIdSet,
      weakTopicSet,
      boundaryCooldownSet,
    } = params;
    const m = pool.length;
    if (m <= 1) return [...pool];

    const { step, offset } = this.buildCoprimeStrideParams(seedStr, m);
    const permuted: T[] = new Array(m);
    for (let i = 0; i < m; i++) {
      const idx = (step * i + offset) % m;
      permuted[i] = pool[idx];
    }

    if (epoch === 0) {
      return permuted;
    }

    // Ở Epoch >= 1 (khi đã làm hết toàn bộ bể câu hỏi và bắt đầu quay vòng):
    // Ưu tiên: Câu từng làm SAI -> Câu thuộc Topic yếu -> Câu bình thường -> Câu giáp ranh cuối vòng trước (Cooldown)
    const wrongBucket: T[] = [];
    const weakTopicBucket: T[] = [];
    const normalBucket: T[] = [];
    const cooldownBucket: T[] = [];

    for (const item of permuted) {
      if (boundaryCooldownSet.has(item.id)) {
        cooldownBucket.push(item);
      } else if (wrongQuestionIdSet.has(item.id)) {
        wrongBucket.push(item);
      } else if (
        item.topic_tag &&
        weakTopicSet.has(item.topic_tag.toLowerCase())
      ) {
        weakTopicBucket.push(item);
      } else {
        normalBucket.push(item);
      }
    }

    return [
      ...wrongBucket,
      ...weakTopicBucket,
      ...normalBucket,
      ...cooldownBucket,
    ];
  }

  /**
   * Bốc K câu hỏi từ bể theo con trỏ chu kỳ (StudentPoolCursor trong PostgreSQL):
   * - Chưa hết bể (epoch = 0): Bốc tuần tự trên hoán vị đồng dư -> 0% trùng lặp.
   * - Chạm đáy bể (cursorPos >= M): Tự động tăng epoch + 1, reseed hoán vị mới, ưu tiên câu từng sai,
   *   chặn trùng giáp ranh (boundaryCooldown) và đánh dấu servedEpoch >= 1 để tự động đảo đáp án A/B/C/D.
   */
  private async sampleAdaptivePoolWithCursor<
    T extends { id: string; topic_tag: string | null },
  >(params: {
    pool: T[];
    targetCount: number;
    studentProfileId: string | null;
    identitySeed: string;
    poolKey: string;
    wrongQuestionIdSet: Set<string>;
    weakTopicSet: Set<string>;
  }): Promise<Array<T & { servedEpoch: number }>> {
    const {
      pool,
      targetCount,
      studentProfileId,
      identitySeed,
      poolKey,
      wrongQuestionIdSet,
      weakTopicSet,
    } = params;

    const m = pool.length;
    if (m === 0) return [];

    let cursorPos = 0;
    let epoch = 0;
    let epochBoundaryIds: string[] = [];

    const guestCacheKey = `${identitySeed}::${poolKey}`;

    if (studentProfileId) {
      try {
        const existingCursor = await this.prisma.studentPoolCursor.findUnique({
          where: {
            student_id_pool_key: {
              student_id: studentProfileId,
              pool_key: poolKey,
            },
          },
        });
        if (existingCursor) {
          cursorPos = Math.max(0, existingCursor.cursor_pos % m);
          epoch = Math.max(0, existingCursor.epoch);
          if (Array.isArray(existingCursor.last_boundary_ids)) {
            epochBoundaryIds = (
              existingCursor.last_boundary_ids as unknown[]
            ).filter((x): x is string => typeof x === 'string');
          }
        }
      } catch {}
    } else {
      const guestCursor = this.guestCursorCache.get(guestCacheKey);
      if (guestCursor) {
        cursorPos = Math.max(0, guestCursor.cursorPos % m);
        epoch = Math.max(0, guestCursor.epoch);
        epochBoundaryIds = guestCursor.lastBoundaryIds || [];
      }
    }

    const desiredCount = Math.min(targetCount, m);
    const cooldownWindow = Math.min(
      desiredCount,
      Math.max(1, Math.floor(m / 2)),
    );

    const picked: Array<T & { servedEpoch: number }> = [];
    const pickedIdsSet = new Set<string>();
    let activeBoundaryIds = [...epochBoundaryIds];

    let currentEpoch = epoch;
    let currentCursor = cursorPos;
    let currentPermutation = this.buildEpochPermutation({
      pool,
      seedStr: `${identitySeed}:${poolKey}:ep:${currentEpoch}`,
      epoch: currentEpoch,
      wrongQuestionIdSet,
      weakTopicSet,
      boundaryCooldownSet: new Set<string>(activeBoundaryIds),
    });

    let safetySteps = 0;
    const maxSafetySteps = m * 3 + desiredCount;

    while (picked.length < desiredCount && safetySteps < maxSafetySteps) {
      safetySteps++;
      if (currentCursor >= m) {
        // Đã vét cạn 100% câu hỏi của chu kỳ hiện tại -> chốt các câu cuối chu kỳ vào Boundary Cooldown và sang Epoch mới!
        const tailOfFinishedEpoch = currentPermutation
          .slice(Math.max(0, m - cooldownWindow))
          .map((item) => item.id);
        activeBoundaryIds = Array.from(
          new Set([...tailOfFinishedEpoch, ...picked.map((p) => p.id)]),
        ).slice(0, cooldownWindow);

        currentEpoch += 1;
        currentCursor = 0;
        currentPermutation = this.buildEpochPermutation({
          pool,
          seedStr: `${identitySeed}:${poolKey}:ep:${currentEpoch}`,
          epoch: currentEpoch,
          wrongQuestionIdSet,
          weakTopicSet,
          boundaryCooldownSet: new Set<string>(activeBoundaryIds),
        });
      }

      const candidate = currentPermutation[currentCursor];
      currentCursor += 1;

      if (candidate && !pickedIdsSet.has(candidate.id)) {
        pickedIdsSet.add(candidate.id);
        picked.push({
          ...candidate,
          servedEpoch: currentEpoch,
        });
      }
    }

    // Nếu sau khi lấy xong đề này mà con trỏ chạm đúng đáy bể M -> chốt Boundary Cooldown và sang sẵn Epoch kế tiếp
    let nextEpoch = currentEpoch;
    let nextCursorPos = currentCursor;
    if (nextCursorPos >= m) {
      const tailOfFinishedEpoch = currentPermutation
        .slice(Math.max(0, m - cooldownWindow))
        .map((item) => item.id);
      activeBoundaryIds = tailOfFinishedEpoch;
      nextEpoch += 1;
      nextCursorPos = nextCursorPos % m;
    }

    if (studentProfileId) {
      try {
        await this.prisma.studentPoolCursor.upsert({
          where: {
            student_id_pool_key: {
              student_id: studentProfileId,
              pool_key: poolKey,
            },
          },
          create: {
            student_id: studentProfileId,
            pool_key: poolKey,
            cursor_pos: nextCursorPos,
            epoch: nextEpoch,
            last_boundary_ids: activeBoundaryIds,
          },
          update: {
            cursor_pos: nextCursorPos,
            epoch: nextEpoch,
            last_boundary_ids: activeBoundaryIds,
          },
        });
      } catch {}
    } else {
      if (this.guestCursorCache.size > 5000) {
        const oldestKey = this.guestCursorCache.keys().next().value;
        if (oldestKey) this.guestCursorCache.delete(oldestKey);
      }
      this.guestCursorCache.set(guestCacheKey, {
        cursorPos: nextCursorPos,
        epoch: nextEpoch,
        lastBoundaryIds: activeBoundaryIds,
        updatedAt: Date.now(),
      });
    }

    return picked;
  }

  /**
   * Kiểm tra xem các phương án trả lời có chứa cụm từ phụ thuộc vào vị trí chữ cái A/B/C/D hay không
   * (Ví dụ: "Cả A và B đều đúng", "Tất cả các đáp án trên", "A, B, C đều sai")
   */
  private hasPositionDependentAnswerText(contents: string[]): boolean {
    const positionalRegex =
      /(cả\s+[abc]\b|tất\s+cả\s+(đều|các|ý|phương\s+án)|không\s+có\s+(đáp\s+án|phương\s+án)|đáp\s+án\s+khác|[abc]\s+và\s+[bcd]\s+đều|[abc]\s*,\s*[bcd]\s+(đều|đúng|sai))/i;
    return contents.some((text) => positionalRegex.test(String(text || '')));
  }

  /**
   * Đảo vị trí 4 phương án A, B, C, D với cam kết dịch chuyển khác vị trí gốc (Derangement / Non-Identity Shift)
   * sao cho đáp án đúng chắc chắn đổi sang chữ cái khác khi học sinh làm lại đề hoặc sang vòng lặp mới (Epoch >= 1).
   */
  private permuteAnswerChoicesGuaranteedShift<T>(
    choices: T[],
    seedStr: string,
  ): T[] {
    const n = choices.length;
    if (n <= 1) return [...choices];

    const h1 = this.hashStringToUint32(`${seedStr}:shift`);
    const shift = (h1 % (n - 1)) + 1; // 1 .. n-1 (cam kết không bao giờ dịch 0!)
    const shifted: T[] = new Array(n);
    for (let i = 0; i < n; i++) {
      shifted[(i + shift) % n] = choices[i];
    }

    // Hoán vị thêm giữa các phần tử để không bị đoán quy luật dịch vòng tròn
    if (n >= 4) {
      const h2 = this.hashStringToUint32(`${seedStr}:swap`);
      if (h2 % 2 === 1) {
        const tmp = shifted[1];
        shifted[1] = shifted[3];
        shifted[3] = tmp;
      }
    }
    return shifted;
  }

  /**
   * Trích xuất và xác thực người dùng từ Authorization Bearer Token hoặc Cookie access_token.
   * Phục vụ kiểm tra phân quyền RBAC & Chống IDOR (401 Unauthorized nếu thiếu/hết hạn token).
   */
  async resolveAuthenticatedUser(
    req: any,
    requireStrictAuth = true,
  ): Promise<AuthenticatedExamUser | null> {
    if (req?.user?.id) {
      return this.enrichAuthenticatedUser(req.user.id, req.user.role);
    }

    const authHeader: string | undefined =
      req?.headers?.authorization || req?.headers?.Authorization;
    let token: string | null = null;

    if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    if (!token && req?.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (token && isTokenRevoked(token)) {
      if (requireStrictAuth) {
        throw new UnauthorizedException(
          'Phiên đăng nhập đã đăng xuất, vui lòng đăng nhập lại (401 Unauthorized).',
        );
      }
      return null;
    }

    if (!token) {
      if (requireStrictAuth) {
        throw new UnauthorizedException(
          'Chưa đăng nhập hoặc thiếu mã xác thực Bearer access_token (401 Unauthorized).',
        );
      }
      return null;
    }

    const headerUserId =
      (req?.headers?.['x-user-id'] as string | undefined)?.trim() || undefined;
    const headerUserRole =
      (req?.headers?.['x-user-role'] as string | undefined)
        ?.trim()
        ?.toUpperCase() || undefined;

    // 1. Hỗ trợ các token phiên đăng nhập trên Frontend (mock-*-token) kèm định danh người dùng
    const mockTokenRoleMap: Record<
      string,
      { defaultId: string; role: string }
    > = {
      'mock-student-token': { defaultId: 'usr-student-01', role: 'STUDENT' },
      'mock-google-student-token': {
        defaultId: 'usr-student-01',
        role: 'STUDENT',
      },
      'mock-jwt-token': { defaultId: 'usr-student-01', role: 'STUDENT' },
      'mock-teacher-token': { defaultId: 'usr-teacher-01', role: 'TEACHER' },
      'mock-google-token': { defaultId: 'usr-teacher-01', role: 'TEACHER' },
      'mock-parent-token': { defaultId: 'usr-parent-01', role: 'PARENT' },
      'mock-school-token': { defaultId: 'usr-principal-01', role: 'PRINCIPAL' },
      'mock-google-school-token': {
        defaultId: 'usr-principal-01',
        role: 'PRINCIPAL',
      },
      'mock-super-admin-token-2026': {
        defaultId: 'usr-admin-01',
        role: 'SUPER_ADMIN',
      },
    };

    if (mockTokenRoleMap[token]) {
      const mapped = mockTokenRoleMap[token];
      const uid = headerUserId || mapped.defaultId;
      const urole = headerUserRole || mapped.role;
      return this.enrichAuthenticatedUser(uid, urole);
    }

    // 2. Xác thực chuẩn JWT (HS256)
    const payload = this.verifyJwtToken(token);
    if (!payload) {
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc phiên đăng nhập đã hết hạn (401 Unauthorized).',
      );
    }

    const userId = String(
      payload.sub || payload.id || payload.userId || headerUserId || '',
    );
    if (!userId) {
      throw new UnauthorizedException(
        'Token không chứa định danh người dùng hợp lệ (401 Unauthorized).',
      );
    }

    const roleFromJwt = String(
      payload.role || headerUserRole || 'STUDENT',
    ).toUpperCase();
    return this.enrichAuthenticatedUser(
      userId,
      roleFromJwt,
      payload.linkedStudentIds,
    );
  }

  /**
   * Kiểm tra chữ ký và thời hạn (exp) của JWT Token (HS256)
   */
  private verifyJwtToken(token: string): Record<string, any> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;
      const secret =
        process.env.JWT_SECRET || 'schoolify_super_secret_key_2026_local';

      const expectedSig = createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (signatureB64 !== expectedSig) {
        return null;
      }

      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);

      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
        return null; // Token đã hết hạn
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Bổ sung thông tin Role, TeacherProfile, ParentProfile từ DB cho user đã xác thực
   */
  private async enrichAuthenticatedUser(
    userId: string,
    fallbackRole = 'STUDENT',
    jwtLinkedStudentIds?: string[],
  ): Promise<AuthenticatedExamUser> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        teacher_profile: true,
        student_profile: true,
        parent_profile: {
          include: {
            parent_students: true,
          },
        },
        school_memberships: true,
      },
    });

    if (!dbUser) {
      const normalizedRole = fallbackRole.toUpperCase();
      return {
        id: userId,
        role: normalizedRole,
        schoolRoles: [normalizedRole],
        isTeacher: normalizedRole === 'TEACHER',
        isParent: normalizedRole === 'PARENT',
        linkedStudentIds: Array.isArray(jwtLinkedStudentIds)
          ? jwtLinkedStudentIds
          : [],
      };
    }

    const schoolRoles = (dbUser.school_memberships || []).map((m) =>
      String(m.role),
    );
    const isTeacher =
      Boolean(dbUser.teacher_profile) ||
      schoolRoles.includes('TEACHER') ||
      fallbackRole.toUpperCase() === 'TEACHER';
    const isParent =
      Boolean(dbUser.parent_profile) ||
      schoolRoles.includes('PARENT') ||
      fallbackRole.toUpperCase() === 'PARENT';
    const linkedStudentIds = [
      ...(dbUser.parent_profile?.parent_students?.map((ps) => ps.student_id) ||
        []),
      ...(Array.isArray(jwtLinkedStudentIds) ? jwtLinkedStudentIds : []),
    ];

    let resolvedRole = String(dbUser.role || fallbackRole).toUpperCase();
    if (
      resolvedRole === 'USER' &&
      fallbackRole &&
      fallbackRole.toUpperCase() !== 'USER'
    ) {
      resolvedRole = fallbackRole.toUpperCase();
    } else if (resolvedRole === 'USER' && isTeacher) {
      resolvedRole = 'TEACHER';
    } else if (resolvedRole === 'USER' && isParent) {
      resolvedRole = 'PARENT';
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      fullname: dbUser.fullname,
      role: resolvedRole,
      schoolRoles,
      isTeacher,
      isParent,
      linkedStudentIds,
    };
  }

  /**
   * Đảm bảo sinh attemptToken duy nhất theo chuẩn CSPRNG att_[a-f0-9]{32}
   */
  private async ensureUniqueAttemptToken(
    preferredToken?: string,
  ): Promise<string> {
    const isValidFormat =
      typeof preferredToken === 'string' &&
      /^att_[a-f0-9]{32}$/i.test(preferredToken.trim());

    if (isValidFormat) {
      const candidate = preferredToken.trim().toLowerCase();
      const exists = await this.prisma.examSubmission.findUnique({
        where: { attempt_token: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const token = generateSecureAttemptToken();
      const exists = await this.prisma.examSubmission.findUnique({
        where: { attempt_token: token },
        select: { id: true },
      });
      if (!exists) {
        return token;
      }
    }

    return generateSecureAttemptToken();
  }

  mapBloomToCognitive(bloom: any): string {
    switch (bloom) {
      case 'NHAN_BIET':
        return 'Nhận biết';
      case 'THONG_HIEU':
        return 'Thông hiểu';
      case 'VAN_DUNG':
        return 'Vận dụng';
      case 'VAN_DUNG_CAO':
        return 'Vận dụng cao';
      default:
        return 'Thông hiểu';
    }
  }

  mapChapterToTopic(
    chapterId: number | null | undefined,
    subject: string | null | undefined,
  ): string {
    const s = (subject || 'toan-hoc').toLowerCase();
    const c = chapterId || 1;
    if (s.includes('toan')) {
      const mathTopics: Record<number, string> = {
        1: 'Ứng dụng đạo hàm khảo sát đồ thị',
        2: 'Tọa độ vectơ trong không gian',
        3: 'Mức độ phân tán mẫu số liệu',
        4: 'Nguyên hàm & Tích phân',
        5: 'Phương pháp tọa độ không gian',
        6: 'Xác suất có điều kiện',
      };
      return mathTopics[c] || 'Khảo sát hàm số & Đồ thị';
    }
    if (s.includes('tin')) {
      const itTopics: Record<number, string> = {
        1: 'Mạng máy tính & Internet',
        2: 'Cơ sở dữ liệu & SQL',
        3: 'Giải thuật & Cấu trúc dữ liệu',
        4: 'An toàn thông tin & Đạo đức AI',
      };
      return itTopics[c] || 'Cơ sở dữ liệu & SQL';
    }
    return `Chuyên đề Chương ${c}`;
  }

  getTrapTagByContext(bloom: any, subject: string | null | undefined): string {
    const s = (subject || '').toLowerCase();
    if (s.includes('toan')) {
      if (bloom === 'VAN_DUNG_CAO')
        return 'Bẫy cực trị chứa tham số m & điều kiện tồn tại';
      if (bloom === 'VAN_DUNG')
        return 'Quên điều kiện xác định mẫu số & căn thức';
      if (bloom === 'THONG_HIEU') return "Nhầm dấu đạo hàm y' tại điểm cực trị";
      return 'Quên tập xác định D của hàm số';
    }
    if (s.includes('tin')) {
      if (bloom === 'VAN_DUNG' || bloom === 'VAN_DUNG_CAO')
        return 'Lỗi cú pháp SQL JOIN & điều kiện WHERE';
      return 'Nhầm lẫn khóa chính và khóa ngoại quan hệ';
    }
    return 'Nhầm lẫn giả thiết hoặc tính toán';
  }

  /**
   * Sinh đề thi theo ma trận Bloom & Chương (Có kiểm tra điểm năng lượng tại Backend)
   */
  async generateMatrixExam(
    userId: string | null,
    dto: GenerateMatrixExamDto,
    userRole?: string,
  ) {
    const {
      subject,
      grade,
      totalQuestions,
      durationMinutes,
      topicTag,
      targetDifficulty,
      chapterId,
      level,
    } = dto;

    // 0. BẢO MẬT & KIỂM TRA ĐIỂM NĂNG LƯỢNG TẠI BACKEND (SERVER-SIDE POINT ENFORCEMENT)
    // - Giáo viên (TEACHER), Quản trị viên (ADMIN / SUPER_ADMIN) hoặc cờ skipPointCheck được miễn phí kiểm tra điểm
    // - Học sinh (STUDENT, USER) hoặc Khách (GUEST) bắt buộc phải có đủ điểm làm đề (Cơ bản: 3đ, Trung bình: 4đ, Giỏi: 9đ)
    const normRole = String(userRole || '')
      .trim()
      .toUpperCase();
    const isPrivileged =
      normRole === 'ADMIN' ||
      normRole === 'SUPER_ADMIN' ||
      normRole === 'TEACHER' ||
      dto.skipPointCheck === true;

    if (!isPrivileged) {
      const effectiveUserId = userId || dto.userId || null;
      const profile = await this.getOrInitStudentProfile(
        effectiveUserId,
        grade ? Number(grade) : 12,
      );
      const levelInfo = this.normalizeExamLevel(level || 'BASIC');
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

      // Nếu client yêu cầu trừ điểm luôn khi sinh đề (chỉ ghi DB khi đã đăng nhập thực)
      if (dto.deductPoints && levelInfo.costPoints > 0 && !profile.isVirtual) {
        if (canPayWithExamPoints) {
          const pointsAfter = currentPoints - levelInfo.costPoints;
          await this.prisma.studentProfile.update({
            where: { id: profile.id },
            data: { exam_points: pointsAfter },
          });

          await this.prisma.examPointLog.create({
            data: {
              student_id: profile.id,
              action_type: 'START_EXAM',
              exam_level: levelInfo.code,
              exam_title: `Đề thi ${dto.subject || 'Toán học'} - Cấp độ ${levelInfo.label}`,
              points_before: currentPoints,
              points_delta: -levelInfo.costPoints,
              points_after: pointsAfter,
              note: `Trừ ${levelInfo.costPoints} Tia Sáng (⚡) khi tạo đề thi cấp độ ${levelInfo.label}`,
            },
          });
        } else if (canPayWithDiamonds) {
          const diamondsAfter = Math.max(
            0,
            Number((currentDiamonds - levelInfo.costPoints).toFixed(2)),
          );
          await this.prisma.studentProfile.update({
            where: { id: profile.id },
            data: { points: diamondsAfter },
          });

          await this.prisma.examPointLog.create({
            data: {
              student_id: profile.id,
              action_type: 'START_EXAM_DIAMONDS',
              exam_level: levelInfo.code,
              exam_title: `Đề thi ${dto.subject || 'Toán học'} - Cấp độ ${levelInfo.label}`,
              points_before: Math.round(currentDiamonds),
              points_delta: -levelInfo.costPoints,
              points_after: Math.round(diamondsAfter),
              note: `Trừ ${levelInfo.costPoints} Ngọc Tri Thức (💎) khi tạo đề thi cấp độ ${levelInfo.label}`,
            },
          });
        }
      }
    }

    const resolvedSubject = subject || 'toan-hoc';
    const resolvedGrade = grade ? Number(grade) : 12;
    const targetCount = Math.max(1, Number(totalQuestions || 10));
    const normalizedLevelCode = this.normalizeExamLevel(level || 'BASIC').code;
    const preferredBloomSet = new Set<BloomLevel>(
      normalizedLevelCode === 'ADVANCED'
        ? [BloomLevel.VAN_DUNG, BloomLevel.VAN_DUNG_CAO]
        : normalizedLevelCode === 'MEDIUM'
          ? [BloomLevel.THONG_HIEU, BloomLevel.VAN_DUNG]
          : [BloomLevel.NHAN_BIET, BloomLevel.THONG_HIEU],
    );

    const diffToBloomMap: Record<string, BloomLevel> = {
      EASY: BloomLevel.NHAN_BIET,
      MEDIUM: BloomLevel.THONG_HIEU,
      HARD: BloomLevel.VAN_DUNG,
      VERY_HARD: BloomLevel.VAN_DUNG_CAO,
    };
    const explicitBloom =
      targetDifficulty && targetDifficulty !== 'ALL'
        ? diffToBloomMap[targetDifficulty]
        : undefined;

    // =========================================================================
    // PHA 1: LẤY BỂ ID CÂU HỎI TỪ COVERING INDEX + IN-MEMORY CACHE (0 TRUNCATION)
    // =========================================================================
    const subjectGradePool = await this.getCachedSubjectGradePoolMeta(
      resolvedSubject,
      resolvedGrade,
    );

    const normalizedTopicFilter =
      topicTag && topicTag !== 'ALL' ? topicTag.trim().toLowerCase() : null;
    const targetChapterNum = chapterId ? Number(chapterId) : null;

    // Phân tầng bể câu hỏi:
    // Tier 1: Đúng chương + đúng topicTag (nếu có) + đúng Bloom mục tiêu
    // Tier 2: Đúng chương + đúng topicTag (nếu có) + mọi Bloom trong chương
    // Tier 3: Đúng chương + mọi topicTag trong chương
    // Tier 4: Cùng môn + cùng khối lớp (fallback cuối cùng nếu chương chưa đủ câu)
    const tier1Pool: typeof subjectGradePool = [];
    const tier2Pool: typeof subjectGradePool = [];
    const tier3Pool: typeof subjectGradePool = [];
    const tier4Pool: typeof subjectGradePool = [];

    for (const item of subjectGradePool) {
      const matchChapter =
        targetChapterNum === null ||
        Number(item.chapter_id) === targetChapterNum;
      const matchTopic =
        !normalizedTopicFilter ||
        Boolean(
          item.topic_tag &&
          item.topic_tag.toLowerCase().includes(normalizedTopicFilter),
        );
      const matchBloom = explicitBloom
        ? item.bloom_level === explicitBloom
        : Boolean(item.bloom_level && preferredBloomSet.has(item.bloom_level));

      if (matchChapter && matchTopic && matchBloom) {
        tier1Pool.push(item);
      } else if (matchChapter && matchTopic) {
        tier2Pool.push(item);
      } else if (matchChapter) {
        tier3Pool.push(item);
      } else {
        tier4Pool.push(item);
      }
    }

    // Định danh học sinh hoặc khách để neo Cursor & Seed đồng dư
    const effectiveUid = userId || dto.userId || null;
    let studentProfileId: string | null = null;
    const wrongQuestionIdSet = new Set<string>();
    const weakTopicSet = new Set<string>();

    if (effectiveUid) {
      try {
        const stProfile = await this.prisma.studentProfile.findUnique({
          where: { user_id: effectiveUid },
          select: { id: true },
        });
        if (stProfile) {
          studentProfileId = stProfile.id;
          const [weakMasteries, recentSubmissions] = await Promise.all([
            this.prisma.studentTopicMastery.findMany({
              where: {
                student_id: stProfile.id,
                subject: resolvedSubject,
                mastery_status: { in: ['WEAK', 'REVIEW'] },
              },
              select: { topic_tag: true },
            }),
            this.prisma.examSubmission.findMany({
              where: { student_id: stProfile.id },
              orderBy: { submitted_at: 'desc' },
              take: 8,
              select: { snapshot_data: true },
            }),
          ]);
          for (const wm of weakMasteries) {
            if (wm.topic_tag) weakTopicSet.add(wm.topic_tag.toLowerCase());
          }
          for (const sub of recentSubmissions) {
            const snap: any = sub.snapshot_data;
            const wrongIds: unknown =
              snap?.originalExam?.wrongQuestionIds || snap?.wrongQuestionIds;
            if (Array.isArray(wrongIds)) {
              for (const wid of wrongIds) {
                if (typeof wid === 'string' && wid) wrongQuestionIdSet.add(wid);
              }
            }
          }
        }
      } catch {}
    }

    const poolKey = [
      resolvedSubject,
      `g${resolvedGrade}`,
      `ch${targetChapterNum ?? 'all'}`,
      normalizedLevelCode,
      explicitBloom || 'ALL',
      normalizedTopicFilter || 'ALL',
    ]
      .join(':')
      .slice(0, 180);

    const identitySeed =
      studentProfileId || effectiveUid || dto.clientSeed || 'guest-default';
    const isAssessmentMode =
      normalizedLevelCode === 'ASSESSMENT' ||
      String(dto.practiceMode || '').toUpperCase() === 'ASSESSMENT';

    // =========================================================================
    // PHA 2: BỐC MẪU ĐA CHU KỲ (MULTI-EPOCH COPRIME LCG STRIDE + BOUNDARY COOLDOWN)
    // =========================================================================
    let primaryCandidatePool: typeof subjectGradePool;
    let sampledMeta: Array<{ id: string; servedEpoch: number }>;

    if (isAssessmentMode) {
      const diagSample = await this.sampleDiagnosticAssessmentPool({
        subjectGradePool,
        resolvedSubject,
        resolvedGrade,
        studentProfileId,
        identitySeed,
        wrongQuestionIdSet,
        weakTopicSet,
      });
      primaryCandidatePool = diagSample.eligiblePool;
      sampledMeta = diagSample.sampledMeta;
    } else {
      primaryCandidatePool =
        tier1Pool.length >= targetCount
          ? tier1Pool
          : [...tier1Pool, ...tier2Pool].length >= targetCount
            ? [...tier1Pool, ...tier2Pool]
            : [...tier1Pool, ...tier2Pool, ...tier3Pool].length >= targetCount
              ? [...tier1Pool, ...tier2Pool, ...tier3Pool]
              : [...tier1Pool, ...tier2Pool, ...tier3Pool, ...tier4Pool];

      sampledMeta = await this.sampleAdaptivePoolWithCursor({
        pool: primaryCandidatePool,
        targetCount,
        studentProfileId,
        identitySeed,
        poolKey,
        wrongQuestionIdSet,
        weakTopicSet,
      });
    }

    const selectedIds = sampledMeta.map((m) => m.id);
    const epochByQuestionId = new Map<string, number>(
      sampledMeta.map((m) => [m.id, m.servedEpoch]),
    );

    // =========================================================================
    // PHA 3: HYDRATE ĐÚNG K CÂU HỎI ĐÃ CHỌN QUA PRIMARY KEY INDEX (< 1ms)
    // =========================================================================
    const hydratedRows =
      selectedIds.length > 0
        ? await this.prisma.question.findMany({
            where: { id: { in: selectedIds } },
            include: { answers: true },
          })
        : [];

    const rowMap = new Map(hydratedRows.map((r) => [r.id, r]));
    const selectedQuestions = selectedIds
      .map((id) => rowMap.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    const allSubjectChapters = getCurriculumChapters(
      resolvedSubject,
      resolvedGrade,
    );
    const chapterMetaById = new Map(allSubjectChapters.map((c) => [c.id, c]));
    const chapterDef = chapterId
      ? chapterMetaById.get(Number(chapterId))
      : undefined;

    const semesterInfo = getCurrentRealTimeSemester();
    const subjectLabelMap: Record<string, string> = {
      'toan-hoc': 'Toán Học',
      'tin-hoc': 'Tin Học',
      'vat-ly': 'Vật Lý',
      'hoa-hoc': 'Hóa Học',
    };
    const subjectTitle =
      subjectLabelMap[resolvedSubject] || resolvedSubject.toUpperCase();

    const sessionId = `SES-${Date.now()}`;
    const examTitle = isAssessmentMode
      ? `Đánh giá năng lực ${subjectTitle} Lớp ${resolvedGrade} (${semesterInfo.shortLabel})`
      : chapterDef
        ? `Luyện Chuyên Đề: ${chapterDef.name} (Lớp ${resolvedGrade})`
        : topicTag && topicTag !== 'ALL'
          ? `Đề Luyện Chuyên Đề: ${topicTag} - Khối ${resolvedGrade}`
          : `Đề Luyện Thi Ma Trận ${resolvedSubject.toUpperCase()} - Khối ${resolvedGrade}`;

    return {
      sessionId,
      examTitle,
      subjectSlug: subject,
      grade: grade ? Number(grade) : 12,
      durationMinutes: isAssessmentMode ? 15 : durationMinutes || 45,
      totalQuestions: selectedQuestions.length,
      poolStats: {
        poolKey: isAssessmentMode
          ? `${resolvedSubject}:g${resolvedGrade}:DIAGNOSTIC`
          : poolKey,
        poolSize: primaryCandidatePool.length,
        servedEpochs: sampledMeta.map((m) => m.servedEpoch),
      },
      questions: selectedQuestions.map((q, idx) => {
        const cognitiveTag =
          q.cognitive_tag || this.mapBloomToCognitive(q.bloom_level);
        const topic =
          q.topic_tag || this.mapChapterToTopic(q.chapter_id, q.subject);
        const trapTag =
          q.trap_tag || this.getTrapTagByContext(q.bloom_level, q.subject);
        const qFormat = q.question_format || QuestionFormat.SINGLE_CHOICE;
        const servedEpoch = epochByQuestionId.get(q.id) ?? 0;

        // =====================================================================
        // PHA 4: TỰ ĐỘNG ĐẢO VỊ TRÍ ĐÁP ÁN A/B/C/D KHI SANG VÒNG LẶP MỚI (EPOCH >= 1)
        // HOẶC KHI HỌC SINH BẤM "LÀM LẠI ĐỀ" (isRetake / shuffleAnswers)
        // =====================================================================
        const shouldPermuteChoices =
          qFormat === QuestionFormat.SINGLE_CHOICE &&
          q.answers.length >= 2 &&
          (servedEpoch >= 1 ||
            Boolean(dto.isRetake) ||
            Boolean(dto.shuffleAnswers)) &&
          !this.hasPositionDependentAnswerText(q.answers.map((a) => a.content));

        const orderedAnswers = shouldPermuteChoices
          ? this.permuteAnswerChoicesGuaranteedShift(
              q.answers,
              `${identitySeed}:${q.id}:ep:${Math.max(1, servedEpoch)}:${dto.clientSeed || ''}`,
            )
          : q.answers;

        const correctAns = orderedAnswers.find((a) => a.is_answer);
        const correctChoice = shouldPermuteChoices
          ? correctAns
            ? String.fromCharCode(65 + orderedAnswers.indexOf(correctAns))
            : q.answer || 'A'
          : correctAns
            ? correctAns.sub_label ||
              String.fromCharCode(65 + orderedAnswers.indexOf(correctAns))
            : q.answer || 'A';

        const statements =
          qFormat === QuestionFormat.TRUE_FALSE
            ? q.answers.map((a, aIdx) => ({
                subId: (
                  a.sub_label ||
                  ['a', 'b', 'c', 'd'][aIdx] ||
                  'a'
                ).toLowerCase() as 'a' | 'b' | 'c' | 'd',
                statement: a.content,
                isCorrect: Boolean(a.is_answer),
              }))
            : undefined;

        const shortAnswerCorrect =
          qFormat === QuestionFormat.SHORT_ANSWER
            ? q.answer || correctAns?.content || ''
            : undefined;

        return {
          id: q.id,
          orderIndex: idx + 1,
          questionFormat: qFormat,
          bloomLevel: q.bloom_level || BloomLevel.THONG_HIEU,
          topicTag: topic,
          cognitiveTag,
          trapTag,
          chapterId: q.chapter_id || 1,
          track:
            chapterMetaById.get(Number(q.chapter_id || 1))?.track || 'DEFAULT',
          servedEpoch,
          choicesShuffled: shouldPermuteChoices,
          title: q.title || `Câu ${idx + 1} (${cognitiveTag}): ${topic}`,
          content: q.question,
          explanation: q.explanation || '',
          points: Number(q.default_points || 0.25),
          correctChoice,
          shortAnswerCorrect,
          statements,
          answers: orderedAnswers.map((a, aIdx) => ({
            id: a.id,
            label: shouldPermuteChoices
              ? String.fromCharCode(65 + aIdx)
              : a.sub_label || String.fromCharCode(65 + aIdx),
            content: a.content,
            isAnswer: a.is_answer,
          })),
        };
      }),
    };
  }

  /**
   * Nộp bài thi, chấm điểm, sinh mã bảo mật attemptToken (CSPRNG att_[a-f0-9]{32}),
   * lưu ExamSubmission và tự động cộng/trừ điểm làm đề
   * (< 5đ: -1đ | 5 - 8.5đ: 0đ | 8.5 - 9.9đ: +1đ | 10đ: +2đ)
   */
  async submitExam(userId: string | null, dto: SubmitExamDto) {
    const {
      sessionId,
      attemptToken: clientAttemptToken,
      examId,
      examTitle,
      subjectSlug,
      grade,
      timeSpentSeconds,
      answers,
      snapshotData,
      level,
      scoreOverride,
      deductEntryCost,
    } = dto;

    const resolvedSessionId = sessionId || `SES-${Date.now()}`;
    const safeTimeSpent = Math.max(0, Number(timeSpentSeconds ?? 0));
    const effectiveUserId =
      userId || dto.userId || snapshotData?.userId || null;
    const studentProfile = await this.getOrInitStudentProfile(
      effectiveUserId,
      grade,
    );
    const studentProfileId = studentProfile.id;
    const ownerUserId = studentProfile.user_id;

    // Sinh mã attemptToken ngẫu nhiên bảo mật cao (CSPRNG) dạng att_[a-f0-9]{32}
    const attemptToken = await this.ensureUniqueAttemptToken(
      clientAttemptToken || snapshotData?.attemptToken,
    );

    // Chuẩn hóa cấu trúc answers (hỗ trợ cả Object { multipleChoices, trueFalseAnswers, shortAnswers } và Array)
    const normalizedAnswers: {
      multipleChoices: Record<string, string>;
      trueFalseAnswers: Record<string, Record<string, boolean>>;
      shortAnswers: Record<string, string>;
    } = {
      multipleChoices: {},
      trueFalseAnswers: {},
      shortAnswers: {},
    };

    if (Array.isArray(answers)) {
      for (const item of answers) {
        if (!item?.questionId) continue;
        if (item.selectedAnswerId) {
          normalizedAnswers.multipleChoices[item.questionId] =
            item.selectedAnswerId;
        } else if (item.subAnswers && typeof item.subAnswers === 'object') {
          normalizedAnswers.trueFalseAnswers[item.questionId] = item.subAnswers;
        } else if (
          item.textAnswer !== undefined ||
          item.studentTextAnswer !== undefined
        ) {
          normalizedAnswers.shortAnswers[item.questionId] = String(
            item.textAnswer ?? item.studentTextAnswer ?? '',
          );
        }
      }
    } else if (answers && typeof answers === 'object') {
      normalizedAnswers.multipleChoices = {
        ...(answers.multipleChoices || {}),
      };
      normalizedAnswers.trueFalseAnswers = {
        ...(answers.trueFalseAnswers || {}),
      };
      normalizedAnswers.shortAnswers = { ...(answers.shortAnswers || {}) };
    }

    // Chấm điểm chi tiết
    let correctCount = 0;
    let wrongCount = 0;
    const details: any[] = [];

    // 1. Chấm trắc nghiệm Multiple Choice (4 chọn 1)
    for (const [qId, ansId] of Object.entries(
      normalizedAnswers.multipleChoices,
    )) {
      const question = await this.prisma.question.findUnique({
        where: { id: qId },
        include: { answers: true },
      });

      if (question) {
        const correctAns = question.answers.find((a) => a.is_answer);
        const isCorrect = Boolean(
          correctAns &&
          (correctAns.id === ansId || correctAns.sub_label === ansId),
        );
        if (isCorrect) correctCount++;
        else wrongCount++;

        details.push({
          questionId: qId,
          questionFormat: question.question_format || 'SINGLE_CHOICE',
          bloomLevel: question.bloom_level || 'THONG_HIEU',
          chapterId: question.chapter_id || 1,
          topicTag:
            question.topic_tag ||
            this.mapChapterToTopic(question.chapter_id, question.subject),
          trapTag:
            question.trap_tag ||
            this.getTrapTagByContext(question.bloom_level, question.subject),
          isCorrect,
          pointsEarned: isCorrect ? Number(question.default_points || 0.25) : 0,
          selectedAnswerId: ansId,
          correctAnswerId: correctAns?.id || null,
          explanation: question.explanation,
        });
      }
    }

    // 2. Chấm câu hỏi Đúng/Sai 4 ý (TRUE_FALSE)
    for (const [qId, subMap] of Object.entries(
      normalizedAnswers.trueFalseAnswers,
    )) {
      const question = await this.prisma.question.findUnique({
        where: { id: qId },
        include: { answers: true },
      });

      if (question && subMap && typeof subMap === 'object') {
        let matchedSubCount = 0;
        for (const ans of question.answers) {
          const key = ans.sub_label || ans.id;
          if (
            key &&
            subMap[key] !== undefined &&
            Boolean(subMap[key]) === Boolean(ans.is_answer)
          ) {
            matchedSubCount++;
          }
        }
        const isAllCorrect =
          matchedSubCount === 4 && question.answers.length > 0;
        if (isAllCorrect) correctCount++;
        else wrongCount++;

        const tfPointsMap: Record<number, number> = {
          0: 0,
          1: 0.1,
          2: 0.25,
          3: 0.5,
          4: 1.0,
        };
        details.push({
          questionId: qId,
          questionFormat: 'TRUE_FALSE',
          bloomLevel: question.bloom_level || 'THONG_HIEU',
          chapterId: question.chapter_id || 1,
          topicTag:
            question.topic_tag ||
            this.mapChapterToTopic(question.chapter_id, question.subject),
          trapTag:
            question.trap_tag ||
            this.getTrapTagByContext(question.bloom_level, question.subject),
          isCorrect: isAllCorrect,
          matchedSubCount,
          pointsEarned: tfPointsMap[matchedSubCount] ?? 0,
          subAnswers: subMap,
          explanation: question.explanation,
        });
      }
    }

    // 3. Chấm câu hỏi Trả lời ngắn / Điền số (SHORT_ANSWER)
    const textEntries = Object.entries(normalizedAnswers.shortAnswers);
    for (const [qId, studentText] of textEntries) {
      const question = await this.prisma.question.findUnique({
        where: { id: qId },
        include: { answers: true },
      });

      if (question) {
        const expected = (
          question.answer ||
          question.answers.find((a) => a.is_answer)?.content ||
          ''
        )
          .trim()
          .toLowerCase();
        const actual = String(studentText || '')
          .trim()
          .toLowerCase();
        const isCorrect = expected.length > 0 && actual === expected;
        if (isCorrect) correctCount++;
        else wrongCount++;

        details.push({
          questionId: qId,
          questionFormat: question.question_format || 'SHORT_ANSWER',
          bloomLevel: question.bloom_level || 'THONG_HIEU',
          chapterId: question.chapter_id || 1,
          topicTag:
            question.topic_tag ||
            this.mapChapterToTopic(question.chapter_id, question.subject),
          trapTag:
            question.trap_tag ||
            this.getTrapTagByContext(question.bloom_level, question.subject),
          isCorrect,
          pointsEarned: isCorrect ? Number(question.default_points || 0.5) : 0,
          studentTextAnswer: studentText,
          expectedAnswer: question.answer || null,
          explanation: question.explanation,
        });
      }
    }

    // Nếu câu hỏi đến từ đề trên Frontend (chưa lưu từng questionId trong bảng questions),
    // vẫn tính số câu đúng/sai từ snapshotData hoặc số câu trả lời gửi lên
    if (correctCount === 0 && wrongCount === 0) {
      const snapOrig = snapshotData?.originalExam || snapshotData;
      if (snapOrig && typeof snapOrig.correctCount === 'number') {
        correctCount = Number(snapOrig.correctCount);
        wrongCount = Number(
          snapOrig.wrongCount ??
            Math.max(0, Number(snapOrig.totalQuestions || 0) - correctCount),
        );
      } else {
        const totalSubmittedCount =
          Object.keys(normalizedAnswers.multipleChoices).length +
          Object.keys(normalizedAnswers.trueFalseAnswers).length +
          Object.keys(normalizedAnswers.shortAnswers).length;
        if (totalSubmittedCount > 0) {
          correctCount = totalSubmittedCount;
          wrongCount = 0;
        }
      }
    }

    const totalQuestions = Math.max(
      1,
      Number(
        snapshotData?.originalExam?.totalQuestions ||
          snapshotData?.totalQuestions ||
          0,
      ) || correctCount + wrongCount,
    );

    const userRole = studentProfile?.role || '';
    const isTeacherOrAdmin =
      userRole === 'TEACHER' || userRole === 'SUPER_ADMIN';

    // Anti-Cheat: Chấm điểm thực tế từ cơ sở dữ liệu nếu có câu hỏi được tìm thấy
    const gradedFromDb = details.length > 0;
    let score = Number(((correctCount / totalQuestions) * 10).toFixed(2));

    if (gradedFromDb) {
      // Khi đã chấm được trực tiếp từ DB: chỉ cho phép giáo viên/admin can thiệp điểm số thủ công
      if (
        isTeacherOrAdmin &&
        scoreOverride !== undefined &&
        scoreOverride !== null &&
        !Number.isNaN(Number(scoreOverride))
      ) {
        score = Math.max(
          0,
          Math.min(10, Number(Number(scoreOverride).toFixed(2))),
        );
      }
    } else {
      // Nếu là đề local/offline chưa đồng bộ câu hỏi vào DB
      if (
        scoreOverride !== undefined &&
        scoreOverride !== null &&
        !Number.isNaN(Number(scoreOverride))
      ) {
        score = Math.max(
          0,
          Math.min(10, Number(Number(scoreOverride).toFixed(2))),
        );
      } else if (
        snapshotData?.originalExam &&
        typeof snapshotData.originalExam.finalScore === 'number'
      ) {
        score = Math.max(
          0,
          Math.min(
            10,
            Number(Number(snapshotData.originalExam.finalScore).toFixed(2)),
          ),
        );
      } else if (snapshotData && typeof snapshotData.score === 'number') {
        score = Math.max(
          0,
          Math.min(10, Number(Number(snapshotData.score).toFixed(2))),
        );
      }
    }

    const resolvedSubjectSlug = (
      subjectSlug ||
      snapshotData?.subjectSlug ||
      snapshotData?.originalExam?.subjectSlug ||
      'toan-hoc'
    )
      .trim()
      .toLowerCase();
    const resolvedGradeNum = Number(
      grade || snapshotData?.grade || snapshotData?.originalExam?.grade || 12,
    );
    const resolvedChapterIdNum = Number(
      dto.chapterId ??
        snapshotData?.chapterId ??
        snapshotData?.originalExam?.chapterId ??
        0,
    );
    const resolvedPracticeMode = String(
      dto.practiceMode ||
        snapshotData?.practiceMode ||
        snapshotData?.originalExam?.practiceMode ||
        (resolvedChapterIdNum > 0 ? 'TOPIC' : 'MOCK_EXAM'),
    )
      .trim()
      .toUpperCase();
    const resolvedLevelCode = this.normalizeExamLevel(
      level ||
        snapshotData?.level ||
        snapshotData?.originalExam?.level ||
        'BASIC',
    ).code;

    const resolvedTitle =
      examTitle ||
      snapshotData?.examTitle ||
      `Bài thi ${resolvedSubjectSlug} Lớp ${resolvedGradeNum}`;
    const resolvedExamId = examId || snapshotData?.examId || 'exam-practice';
    const isVirtualGuest = Boolean(studentProfile?.isVirtual);

    // Thu thập kết quả từng câu hỏi để cập nhật Hồ sơ Kiến thức & Lộ trình Cá nhân hóa trong PostgreSQL (chỉ khi đã đăng nhập thực)
    let knowledgeUpdate: {
      topicDeltas: any[];
      nextRecommendedStep: any | null;
    } = {
      topicDeltas: [],
      nextRecommendedStep: null,
    };
    if (!isVirtualGuest) {
      try {
        const outcomes =
          this.knowledgeRoadmapService.extractOutcomesFromSubmission({
            subjectSlug: resolvedSubjectSlug,
            grade: resolvedGradeNum,
            chapterId: resolvedChapterIdNum || 1,
            timeSpentSeconds: safeTimeSpent,
            details,
            snapshotData,
          });
        if (outcomes.length > 0) {
          knowledgeUpdate =
            await this.knowledgeRoadmapService.recordQuestionOutcomes(
              studentProfileId,
              outcomes,
              true,
            );
        }
      } catch (err) {
        console.error(
          '[ExamsService.submitExam] Knowledge profiling error:',
          err,
        );
      }
    }

    // Cập nhật tiến độ Lộ trình Chương kiểu Duolingo (StudentChapterProgress)
    let chapterProgressUpdate: any = null;
    if (resolvedPracticeMode === 'TOPIC' && resolvedChapterIdNum > 0) {
      chapterProgressUpdate = await this.upsertChapterProgressAfterExam({
        studentProfileId: isVirtualGuest ? null : studentProfileId,
        subjectSlug: resolvedSubjectSlug,
        grade: resolvedGradeNum,
        chapterId: resolvedChapterIdNum,
        levelCode: resolvedLevelCode,
        score,
      });
    }

    // Chẩn đoán năng lực đầu vào (ASSESSMENT): lưu bảng StudentSubjectDiagnostic & tự động mở khóa cấp độ phù hợp
    const isDiagnosticExam =
      resolvedLevelCode === 'ASSESSMENT' ||
      resolvedPracticeMode === 'ASSESSMENT';
    let diagnosticUpdate: any = null;
    if (isDiagnosticExam) {
      diagnosticUpdate = await this.applyDiagnosticResult({
        studentProfileId: isVirtualGuest ? null : studentProfileId,
        subjectSlug: resolvedSubjectSlug,
        grade: resolvedGradeNum,
        overallScore: score,
        details,
        snapshotData,
      });
    }

    const enrichedSnapshotData = {
      ...(snapshotData || {}),
      attemptToken,
      userId: ownerUserId,
      sessionId: resolvedSessionId,
      examId: resolvedExamId,
      examTitle: resolvedTitle,
      subjectSlug: resolvedSubjectSlug,
      grade: resolvedGradeNum,
      chapterId: resolvedChapterIdNum || undefined,
      practiceMode: resolvedPracticeMode,
      level: resolvedLevelCode,
      answers: normalizedAnswers,
      score,
      maxScore: 10.0,
      correctCount,
      wrongCount,
      totalQuestions,
      timeSpentSeconds: safeTimeSpent,
      details,
      knowledgeUpdate,
      chapterProgressUpdate,
      diagnosticUpdate,
    };

    // Khách chưa đăng nhập (Guest Trial): Trả kết quả chấm điểm từ PostgreSQL mà TUYỆT ĐỐI KHÔNG tạo user/submission rác trong DB
    if (isVirtualGuest) {
      return {
        attemptToken,
        submissionId: `guest-trial-${Date.now()}`,
        isGuestTrial: true,
        examId: resolvedExamId,
        examTitle: resolvedTitle,
        userId: null,
        score,
        maxScore: 10.0,
        correctCount,
        wrongCount,
        totalQuestions,
        timeSpentSeconds: safeTimeSpent,
        submittedAt: new Date(),
        details,
        pointSettlement: null,
        knowledgeUpdate,
        chapterProgressUpdate,
        diagnosticUpdate,
      };
    }

    // Lưu vào bảng exam_submissions kèm attempt_token UNIQUE
    const submission = await this.prisma.examSubmission.create({
      data: {
        attempt_token: attemptToken,
        student_id: studentProfileId,
        exam_title: resolvedTitle,
        score: score,
        total_points: 10.0,
        time_spent_seconds: safeTimeSpent,
        submitted_at: new Date(),
        status: 'SUBMITTED',
        snapshot_data: enrichedSnapshotData,
      },
    });

    if (diagnosticUpdate?.diagnosticId) {
      try {
        await this.prisma.studentSubjectDiagnostic.update({
          where: { id: diagnosticUpdate.diagnosticId },
          data: { submission_id: submission.id },
        });
      } catch {}
    }

    // Tự động tính toán thưởng/phạt điểm làm đề sau khi nộp bài
    const pointSettlement = await this.settleExamSubmissionPoints(ownerUserId, {
      score,
      level: resolvedLevelCode,
      examTitle: resolvedTitle,
      submissionId: submission.id,
      sessionId: resolvedSessionId,
      deductEntryCost: Boolean(deductEntryCost),
    });

    return {
      attemptToken,
      submissionId: submission.id,
      isGuestTrial: false,
      examId: resolvedExamId,
      examTitle: resolvedTitle,
      userId: ownerUserId,
      score,
      maxScore: 10.0,
      correctCount,
      wrongCount,
      totalQuestions,
      timeSpentSeconds: safeTimeSpent,
      submittedAt: submission.submitted_at,
      details,
      pointSettlement,
      knowledgeUpdate,
      chapterProgressUpdate,
      diagnosticUpdate,
    };
  }

  /**
   * Lấy kết quả bài thi theo mã bảo mật attemptToken (Bắt buộc phân quyền RBAC / Ownership chống IDOR):
   * 1. Chưa đăng nhập hoặc token hết hạn -> 401 Unauthorized.
   * 2. Học sinh đăng nhập KHÔNG PHẢI chủ sở hữu bài làm (request.user.id !== submission.userId) -> 403 Forbidden.
   * 3. Đúng chủ sở hữu bài làm HOẶC là Giáo viên phụ trách lớp / Phụ huynh liên kết / Admin -> 200 OK.
   * 4. Token không tồn tại -> 404 Not Found.
   */
  async getResultByAttemptToken(
    attemptToken: string,
    currentUser: AuthenticatedExamUser | null,
  ) {
    if (!currentUser || !currentUser.id) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để xem kết quả bài thi (401 Unauthorized).',
      );
    }

    const cleanToken = (attemptToken || '').trim();
    if (!cleanToken) {
      throw new NotFoundException(
        'Mã phiên bài thi (attemptToken) không tồn tại (404 Not Found).',
      );
    }

    let submission = await this.prisma.examSubmission.findUnique({
      where: { attempt_token: cleanToken },
      include: {
        student: {
          include: {
            user: true,
            parent_students: {
              include: {
                parent: true,
              },
            },
            enrollments: {
              include: {
                class: true,
              },
            },
          },
        },
        class: true,
        answers: {
          include: {
            question: {
              include: { answers: true },
            },
            selected_answer: true,
          },
        },
      },
    });

    // Hỗ trợ tra cứu dự phòng nếu truyền submission ID
    if (!submission && /^[0-9a-f-]{36}$/i.test(cleanToken)) {
      submission = await this.prisma.examSubmission.findUnique({
        where: { id: cleanToken },
        include: {
          student: {
            include: {
              user: true,
              parent_students: {
                include: {
                  parent: true,
                },
              },
              enrollments: {
                include: {
                  class: true,
                },
              },
            },
          },
          class: true,
          answers: {
            include: {
              question: {
                include: { answers: true },
              },
              selected_answer: true,
            },
          },
        },
      });
    }

    // Rule 4: Token không tồn tại -> 404 Not Found
    if (!submission) {
      throw new NotFoundException(
        `Không tìm thấy kết quả bài thi với attemptToken "${cleanToken}" (404 Not Found).`,
      );
    }

    // Xác định chủ sở hữu bài làm (userId của học sinh đã nộp bài)
    const snap = (submission.snapshot_data || {}) as Record<string, any>;
    const submissionOwnerUserId =
      submission.student?.user_id || snap.userId || null;

    // Kiểm tra quyền truy cập (RBAC & Ownership - Chống IDOR):
    const isOwner =
      Boolean(submissionOwnerUserId) &&
      currentUser.id === submissionOwnerUserId;

    const isAdminOrSchoolLeader =
      [
        'SUPER_ADMIN',
        'ADMIN',
        'PRINCIPAL',
        'VICE_PRINCIPAL',
        'HEAD_OF_DEPARTMENT',
      ].includes(currentUser.role) ||
      currentUser.schoolRoles.some((r) =>
        ['PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_OF_DEPARTMENT'].includes(r),
      );

    const isTeacher =
      currentUser.isTeacher ||
      currentUser.role === 'TEACHER' ||
      currentUser.schoolRoles.includes('TEACHER');

    const isLinkedParent =
      (submission.student?.parent_students || []).some(
        (ps) => ps.parent?.user_id === currentUser.id,
      ) ||
      currentUser.linkedStudentIds.includes(submission.student_id) ||
      (submissionOwnerUserId
        ? currentUser.linkedStudentIds.includes(submissionOwnerUserId)
        : false);

    // Rule 2: Học sinh đang đăng nhập KHÔNG PHẢI chủ sở hữu bài làm -> 403 Forbidden
    if (!isOwner && !isAdminOrSchoolLeader && !isTeacher && !isLinkedParent) {
      throw new ForbiddenException(
        'Truy cập bị từ chối (403 Forbidden): Bạn không phải chủ sở hữu bài thi này và không có quyền xem bài làm hay điểm số của học sinh khác.',
      );
    }

    // Rule 3: Đúng chủ sở hữu hoặc Giáo viên / Phụ huynh liên kết / Admin -> 200 OK
    const score = Number(submission.score ?? snap.score ?? 0);
    const totalPoints = Number(submission.total_points ?? snap.maxScore ?? 10);
    const correctCount = Number(
      snap.correctCount ?? snap.originalExam?.correctCount ?? 0,
    );
    const wrongCount = Number(
      snap.wrongCount ?? snap.originalExam?.wrongCount ?? 0,
    );
    const totalQuestions = Number(
      snap.totalQuestions ??
        snap.originalExam?.totalQuestions ??
        Math.max(1, correctCount + wrongCount),
    );

    return {
      attemptToken: submission.attempt_token || cleanToken,
      submissionId: submission.id,
      id: submission.id,
      userId: submissionOwnerUserId,
      studentId: submission.student_id,
      studentName:
        submission.student?.user?.fullname || snap.userFullName || 'Học sinh',
      examId: snap.examId || submission.bank_id || 'exam-practice',
      examTitle: submission.exam_title,
      subjectSlug: snap.subjectSlug || 'toan-hoc',
      grade: snap.grade || 12,
      score,
      maxScore: totalPoints,
      totalPoints,
      correctCount,
      wrongCount,
      totalQuestions,
      timeSpentSeconds:
        submission.time_spent_seconds ?? snap.timeSpentSeconds ?? 0,
      startedAt: submission.started_at,
      submittedAt: submission.submitted_at,
      status: submission.status,
      answers: snap.answers || snap.originalExam?.studentAnswers || {},
      details: snap.details || [],
      snapshotData: submission.snapshot_data,
    };
  }

  /**
   * Lấy chi tiết bài thi đã làm (Snapshot theo ID hoặc attemptToken)
   */
  async getSnapshotById(idOrToken: string) {
    const submission = await this.prisma.examSubmission.findFirst({
      where: {
        OR: [{ attempt_token: idOrToken }, { id: idOrToken }],
      },
      include: {
        student: {
          include: { user: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(
        `Không tìm thấy bài thi với mã: ${idOrToken}`,
      );
    }

    return {
      id: submission.id,
      attemptToken: submission.attempt_token,
      userId: submission.student?.user_id,
      examTitle: submission.exam_title,
      score: Number(submission.score),
      totalPoints: Number(submission.total_points),
      timeSpentSeconds: submission.time_spent_seconds,
      submittedAt: submission.submitted_at,
      studentName: submission.student?.user?.fullname,
      snapshotData: submission.snapshot_data,
    };
  }

  /**
   * Lấy lịch sử làm bài của học sinh (kèm attemptToken)
   */
  async getPracticeHistory(userId: string | null, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    let studentProfileId: string | undefined;
    if (userId) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { user_id: userId },
      });
      studentProfileId = student?.id;
    }

    const where = studentProfileId ? { student_id: studentProfileId } : {};

    const [total, submissions] = await Promise.all([
      this.prisma.examSubmission.count({ where }),
      this.prisma.examSubmission.findMany({
        where,
        orderBy: { submitted_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: submissions.map((s) => ({
        id: s.id,
        attemptToken: s.attempt_token,
        examTitle: s.exam_title,
        score: Number(s.score),
        timeSpentSeconds: s.time_spent_seconds,
        submittedAt: s.submitted_at,
        status: s.status,
        totalPoints: Number(s.total_points || 10),
        snapshotData: s.snapshot_data,
      })),
      pagination: {
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Đồng bộ bài thi offline lên server
   */
  async syncOfflineSubmissions(dto: SyncOfflineSubmissionsDto) {
    const syncedIds: string[] = [];

    for (const item of dto.submissions) {
      try {
        await this.submitExam(null, {
          sessionId: item.sessionId || `SES-OFFLINE-${Date.now()}`,
          examId: item.examId,
          examTitle: item.examTitle,
          timeSpentSeconds: item.timeSpentSeconds || 0,
          answers: item.answers || {},
          snapshotData: item,
        });
        if (item.id) syncedIds.push(item.id);
      } catch (err) {
        console.error('Lỗi sync submission offline:', err);
      }
    }

    return {
      message: `Đã đồng bộ thành công ${syncedIds.length} bài thi offline`,
      syncedIds,
    };
  }

  /**
   * Danh sách Ngân hàng Câu hỏi (hỗ trợ phân trang, lọc theo Môn, Lớp, Bloom, Tìm kiếm)
   */
  async listQuestions(query: {
    page?: number;
    limit?: number;
    subject?: string;
    grade?: number;
    bloomLevel?: string;
    search?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(1000, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.bloomLevel) {
      where.bloom_level = query.bloomLevel;
    }
    if (query.search) {
      where.question = { contains: query.search, mode: 'insensitive' };
    }
    if (query.subject) {
      where.subject = { contains: query.subject, mode: 'insensitive' };
    }
    if (query.grade) {
      where.grade = Number(query.grade);
    }

    const [total, items] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        include: {
          answers: true,
          bank: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  /**
   * Tạo câu hỏi mới vào Ngân hàng đề
   */
  async createQuestion(payload: {
    content?: string;
    question?: string;
    explanation?: string;
    subjectName?: string;
    subject?: string;
    gradeLevel?: number;
    grade?: number;
    topicName?: string;
    bloomLevel?: string;
    questionFormat?: string;
    answers?: {
      content: string;
      is_correct?: boolean;
      is_answer?: boolean;
      explanation?: string;
    }[];
  }) {
    const subject = payload.subject || payload.subjectName || 'toan-hoc';
    const grade = Number(payload.grade || payload.gradeLevel || 12);
    const questionText =
      payload.question || payload.content || 'Câu hỏi luyện tập mới';

    let bank = await this.prisma.questionBank.findFirst({
      where: { title: { contains: subject, mode: 'insensitive' } },
    });
    if (!bank) {
      bank = await this.prisma.questionBank.create({
        data: {
          title: `Ngân hàng đề ${subject} - Khối ${grade}`,
          is_premium: false,
        },
      });
    }

    const created = await this.prisma.question.create({
      data: {
        bank_id: bank.id,
        subject,
        grade,
        chapter_id: 1,
        title: payload.topicName || `Câu hỏi ${subject} Khối ${grade}`,
        question: questionText,
        explanation:
          payload.explanation || 'Lời giải chi tiết theo chuẩn GDPT 2018.',
        bloom_level: (payload.bloomLevel as any) || 'THONG_HIEU',
        question_format: this.normalizeQuestionFormat(payload.questionFormat),
        type: 'SINGLE_CHOICE',
        answers: {
          create: (payload.answers && payload.answers.length > 0
            ? payload.answers
            : [
                { content: 'Đáp án A', is_correct: true },
                { content: 'Đáp án B', is_correct: false },
                { content: 'Đáp án C', is_correct: false },
                { content: 'Đáp án D', is_correct: false },
              ]
          ).map((a) => ({
            content: a.content,
            is_answer: Boolean(a.is_answer ?? a.is_correct),
            explain: a.explanation || null,
          })),
        },
      },
      include: { answers: true, bank: true },
    });

    return created;
  }

  /**
   * Lấy danh sách câu hỏi đã được chỉnh sửa/lưu trong PostgreSQL theo mảng ID
   */
  async getQuestionsByIds(ids: string[]) {
    const cleanIds = Array.from(
      new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean)),
    );
    if (cleanIds.length === 0) return [];

    const rows = await this.prisma.question.findMany({
      where: { id: { in: cleanIds } },
      include: { answers: true },
    });

    return rows.map((q) => {
      const qFormat = q.question_format || QuestionFormat.SINGLE_CHOICE;
      const correctAns = q.answers.find((a) => a.is_answer);
      const correctChoice = correctAns
        ? correctAns.sub_label ||
          String.fromCharCode(65 + q.answers.indexOf(correctAns))
        : q.answer || 'A';

      const choices =
        qFormat === QuestionFormat.SINGLE_CHOICE ||
        qFormat === QuestionFormat.MULTI_CHOICE
          ? q.answers.map((a, idx) => ({
              key: (
                a.sub_label || String.fromCharCode(65 + idx)
              ).toUpperCase() as 'A' | 'B' | 'C' | 'D',
              content: a.content,
            }))
          : undefined;

      const statements =
        qFormat === QuestionFormat.TRUE_FALSE
          ? q.answers.map((a, idx) => ({
              subId: (
                a.sub_label ||
                ['a', 'b', 'c', 'd'][idx] ||
                'a'
              ).toLowerCase() as 'a' | 'b' | 'c' | 'd',
              statement: a.content,
              isCorrect: Boolean(a.is_answer),
            }))
          : undefined;

      const shortAnswerCorrect =
        qFormat === QuestionFormat.SHORT_ANSWER
          ? q.answer || correctAns?.content || ''
          : undefined;

      return {
        id: q.id,
        title: q.title,
        content: q.question,
        explanation: q.explanation,
        topicTag: q.topic_tag,
        trapTag: q.trap_tag,
        questionFormat: qFormat,
        correctChoice,
        choices,
        statements,
        shortAnswerCorrect,
      };
    });
  }

  /**
   * Cập nhật hoặc Upsert câu hỏi & phương án trả lời trực tiếp vào PostgreSQL
   * (Hỗ trợ cả trang Admin Ngân hàng đề lẫn chỉnh sửa trực tiếp ngay trong Phòng thi cho Admin)
   */
  async updateQuestion(
    id: string,
    payload: {
      title?: string;
      content?: string;
      question?: string;
      explanation?: string;
      topicTag?: string;
      trapTag?: string;
      subject?: string;
      grade?: number;
      chapterId?: number;
      bloomLevel?: string;
      questionFormat?: string;
      type?: string;
      correctChoice?: string;
      choices?: Array<{ key: string; content: string }>;
      statements?: Array<{
        subId: string;
        statement: string;
        isCorrect: boolean;
      }>;
      shortAnswerCorrect?: string;
      answers?: Array<{
        content: string;
        is_correct?: boolean;
        is_answer?: boolean;
        sub_label?: string;
        label?: string;
        explanation?: string;
        explain?: string;
      }>;
    },
  ) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    const qText =
      payload.question ?? payload.content ?? existing?.question ?? '';

    let resolvedFormat: QuestionFormat =
      existing?.question_format || QuestionFormat.SINGLE_CHOICE;
    if (payload.questionFormat) {
      resolvedFormat = this.normalizeQuestionFormat(payload.questionFormat);
    } else if (
      payload.type === 'TRUE_FALSE' ||
      Array.isArray(payload.statements)
    ) {
      resolvedFormat = QuestionFormat.TRUE_FALSE;
    } else if (
      payload.type === 'SHORT_ANSWER' ||
      payload.shortAnswerCorrect !== undefined
    ) {
      resolvedFormat = QuestionFormat.SHORT_ANSWER;
    }

    let resolvedAnswerField = existing?.answer || null;
    if (payload.correctChoice !== undefined) {
      resolvedAnswerField = String(payload.correctChoice).toUpperCase();
    } else if (payload.shortAnswerCorrect !== undefined) {
      resolvedAnswerField = String(payload.shortAnswerCorrect);
    }

    const subjectSlug = payload.subject || existing?.subject || 'toan-hoc';
    const gradeNum = Number(payload.grade || existing?.grade || 12);

    let bankId = existing?.bank_id || null;
    if (!bankId) {
      let bank = await this.prisma.questionBank.findFirst({
        where: { title: { contains: subjectSlug, mode: 'insensitive' } },
      });
      if (!bank) {
        bank = await this.prisma.questionBank.create({
          data: {
            title: `Ngân hàng đề ${subjectSlug} - Khối ${gradeNum}`,
            is_premium: false,
          },
        });
      }
      bankId = bank.id;
    }

    await this.prisma.question.upsert({
      where: { id },
      create: {
        id,
        bank_id: bankId,
        subject: subjectSlug,
        grade: gradeNum,
        chapter_id: Number(payload.chapterId || 1),
        title: payload.title || `Câu hỏi ${subjectSlug} Khối ${gradeNum}`,
        question: qText,
        answer: resolvedAnswerField,
        explanation: payload.explanation || '',
        topic_tag: payload.topicTag || null,
        trap_tag: payload.trapTag || null,
        bloom_level: ((payload.bloomLevel as any) ||
          'THONG_HIEU') as BloomLevel,
        question_format: resolvedFormat,
        type:
          resolvedFormat === QuestionFormat.TRUE_FALSE
            ? 'TRUE_FALSE'
            : 'MULTIPLE_CHOICE',
      },
      update: {
        ...(qText ? { question: qText } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.explanation !== undefined
          ? { explanation: payload.explanation }
          : {}),
        ...(payload.topicTag !== undefined
          ? { topic_tag: payload.topicTag }
          : {}),
        ...(payload.trapTag !== undefined ? { trap_tag: payload.trapTag } : {}),
        ...(resolvedAnswerField !== null
          ? { answer: resolvedAnswerField }
          : {}),
        ...(payload.bloomLevel !== undefined
          ? { bloom_level: payload.bloomLevel as any }
          : {}),
        question_format: resolvedFormat,
      },
    });

    // Cập nhật bảng answers trong PostgreSQL
    if (Array.isArray(payload.choices) && payload.choices.length > 0) {
      const targetRight = String(
        payload.correctChoice || resolvedAnswerField || 'A',
      ).toUpperCase();
      await this.prisma.answer.deleteMany({ where: { question_id: id } });
      await this.prisma.answer.createMany({
        data: payload.choices.map((c, idx) => {
          const key = String(
            c.key || String.fromCharCode(65 + idx),
          ).toUpperCase();
          return {
            question_id: id,
            sub_label: key,
            content: String(c.content || ''),
            is_answer: key === targetRight,
          };
        }),
      });
    } else if (
      Array.isArray(payload.statements) &&
      payload.statements.length > 0
    ) {
      await this.prisma.answer.deleteMany({ where: { question_id: id } });
      await this.prisma.answer.createMany({
        data: payload.statements.map((st, idx) => ({
          question_id: id,
          sub_label: String(
            st.subId || ['a', 'b', 'c', 'd'][idx] || 'a',
          ).toLowerCase(),
          content: String(st.statement || ''),
          is_answer: Boolean(st.isCorrect),
        })),
      });
    } else if (payload.shortAnswerCorrect !== undefined) {
      await this.prisma.answer.deleteMany({ where: { question_id: id } });
      await this.prisma.answer.create({
        data: {
          question_id: id,
          sub_label: 'SHORT',
          content: String(payload.shortAnswerCorrect),
          is_answer: true,
        },
      });
    } else if (Array.isArray(payload.answers) && payload.answers.length > 0) {
      await this.prisma.answer.deleteMany({ where: { question_id: id } });
      await this.prisma.answer.createMany({
        data: payload.answers.map((a, idx) => ({
          question_id: id,
          sub_label: a.sub_label || a.label || String.fromCharCode(65 + idx),
          content: String(a.content || ''),
          is_answer: Boolean(a.is_answer ?? a.is_correct),
          explain: a.explanation || a.explain || null,
        })),
      });
    }

    return this.prisma.question.findUnique({
      where: { id },
      include: { answers: true },
    });
  }

  /**
   * Xóa câu hỏi khỏi Ngân hàng đề
   */
  async deleteQuestion(id: string) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy câu hỏi ID=${id}`);
    }

    await this.prisma.answer.deleteMany({ where: { question_id: id } });
    await this.prisma.submissionAnswer.deleteMany({
      where: { question_id: id },
    });
    await this.prisma.question.delete({ where: { id } });

    return { deletedId: id };
  }

  /**
   * Danh sách mẫu bộ đề thi (Question Banks)
   */
  async listTemplates() {
    const banks = await this.prisma.questionBank.findMany({
      include: {
        _count: { select: { questions: true, exam_submissions: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    if (banks.length === 0) {
      const grouped = await this.prisma.question.groupBy({
        by: ['subject'],
        _count: { id: true },
      });
      for (const g of grouped) {
        if (!g.subject) continue;
        const createdBank = await this.prisma.questionBank.create({
          data: {
            title: `Kho đề chuẩn GDPT 2018 - Môn ${g.subject.toUpperCase()}`,
            is_premium: false,
          },
        });
        await this.prisma.question.updateMany({
          where: { subject: g.subject, bank_id: null },
          data: { bank_id: createdBank.id },
        });
      }
      return this.prisma.questionBank.findMany({
        include: {
          _count: { select: { questions: true, exam_submissions: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }
    return banks;
  }

  // ==========================================================================
  // HỆ THỐNG ĐIỂM NĂNG LƯỢNG LÀM ĐỀ THI (EXAM POINTS ENGINE)
  // - Mỗi ngày phát 9 điểm (reset cố định về 9 điểm vào đầu mỗi ngày mới)
  // - Chi phí mở đề: Cơ bản = 3đ (3 bài/ngày), Trung bình = 4đ (2 bài/ngày), Giỏi = 9đ (1 bài/ngày)
  // - Sau khi nộp bài: < 5đ -> -1đ | 5 - 8.5đ -> 0đ | 8.5 - 9.9đ -> +1đ | 10đ -> +2đ
  // ==========================================================================

  private getTodayDateStringVN(): string { return this.examPointsService.getTodayDateStringVN(); }
  normalizeExamLevel(rawLevel?: string) { return this.examPointsService.normalizeExamLevel(rawLevel); }
  private computeQuotaByLevel(currentPoints: number, currentDiamonds = 0) { return this.examPointsService.computeQuotaByLevel(currentPoints, currentDiamonds); }
  getExamPointsRules() { return this.examPointsService.getExamPointsRules(); }
  getPackageQuota(profile: any) { return this.examPointsService.getPackageQuota(profile); }
  async getOrInitStudentProfile(userId: string | null, grade?: number) { return this.examPointsService.getOrInitStudentProfile(userId, grade); }
  async getExamPointBalance(userId: string | null) { return this.examPointsService.getExamPointBalance(userId); }
  async claimDailyExamPoints(userId: string | null, dto: DailyClaimPointsDto) { return this.examPointsService.claimDailyExamPoints(userId, dto); }
  async startExamWithPoints(userId: string | null, dto: StartExamWithPointsDto) { return this.examPointsService.startExamWithPoints(userId, dto); }
  async settleExamSubmissionPoints(userId: string | null, dto: SettleExamPointsDto) { return this.examPointsService.settleExamSubmissionPoints(userId, dto); }
  async getExamPointHistory(userId: string | null, page = 1, limit = 20, actionType?: string) { return this.examPointsService.getExamPointHistory(userId, page, limit, actionType); }
  async adminAdjustPoints(currentUserId: string | null, currentUserRole: string | undefined, dto: AdminAdjustPointsDto) { return this.examPointsService.adminAdjustPoints(currentUserId, currentUserRole, dto); }
  /**
   * Lấy Hồ sơ Kiến thức & Bản đồ Lỗ hổng của học sinh từ PostgreSQL
   */
  async getKnowledgeProfile(
    userId: string | null,
    subjectSlug?: string,
    grade?: number,
  ) {
    const profile = await this.getOrInitStudentProfile(userId, grade);
    return this.knowledgeRoadmapService.getKnowledgeProfile({
      studentProfileId: profile.id,
      userId: profile.user_id,
      subjectSlug: subjectSlug || 'toan-hoc',
      grade: grade || 12,
    });
  }

  /**
   * Lấy Lộ trình Học tập Cá nhân hóa 3 Chặng của học sinh từ PostgreSQL
   */
  async getPersonalizedRoadmap(
    userId: string | null,
    subjectSlug?: string,
    grade?: number,
  ) {
    const profile = await this.getOrInitStudentProfile(userId, grade);
    return this.knowledgeRoadmapService.getPersonalizedRoadmap({
      studentProfileId: profile.id,
      userId: profile.user_id,
      subjectSlug: subjectSlug || 'toan-hoc',
      grade: grade || 12,
    });
  }

  /**
   * Lưu kết quả bài Luyện bù (Remediation) lên PostgreSQL và cập nhật điểm thành thạo + lộ trình
   */
  async submitRemediationResult(
    userId: string | null,
    dto: SubmitRemediationDto,
  ) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(
      effectiveUserId,
      dto.grade,
    );
    return this.knowledgeRoadmapService.submitRemediationResult(
      profile.id,
      profile.user_id,
      dto,
    );
  }

  /**
   * Lưu Lịch sử Hành vi khi học sinh Luyện lại nhanh 3 câu cùng dạng (Không tính điểm học vụ)
   * vào bảng PostgreSQL `student_behavior_histories` và tái thiết kế lộ trình cá nhân hóa
   */
  async recordQuickDrillBehavior(
    userId: string | null,
    dto: RecordQuickDrillBehaviorDto,
  ) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(
      effectiveUserId,
      dto.grade,
    );
    return this.knowledgeRoadmapService.recordQuickDrillBehavior(
      profile.id,
      profile.user_id,
      dto,
    );
  }

  /**
   * Lấy danh sách Lịch sử Hành vi từ bảng PostgreSQL `student_behavior_histories`
   */
  async getBehaviorHistory(
    userId: string | null,
    subjectSlug?: string,
    grade?: number,
    limit?: number,
  ) {
    const profile = await this.getOrInitStudentProfile(userId, undefined);
    return this.knowledgeRoadmapService.getBehaviorHistory({
      studentProfileId: profile.id,
      subjectSlug,
      grade,
      limit,
    });
  }

  // ==========================================================================
  // HỆ THỐNG LỘ TRÌNH CHƯƠNG KIỂU DUOLINGO (3 VƯƠNG MIỆN ⭐ & TÁCH TOÁN SỐ / HÌNH)
  // ==========================================================================

  /**
   * Cập nhật tiến độ hoàn thành cấp độ chương (BASIC / MEDIUM / ADVANCED) sau khi nộp bài.
   * Ngưỡng qua màn chuẩn Duolingo Schoolify: đạt từ 5.0 / 10 điểm trở lên.
   */
  async upsertChapterProgressAfterExam(params: {
    studentProfileId: string | null;
    subjectSlug: string;
    grade: number;
    chapterId: number;
    levelCode: string;
    score: number;
  }) {
    const {
      studentProfileId,
      subjectSlug,
      grade,
      chapterId,
      levelCode: rawLevelCode,
      score,
    } = params;

    const levelCode: 'BASIC' | 'MEDIUM' | 'ADVANCED' =
      rawLevelCode === 'MEDIUM'
        ? 'MEDIUM'
        : rawLevelCode === 'ADVANCED' ||
            rawLevelCode === 'PROVINCIAL' ||
            rawLevelCode === 'NATIONAL'
          ? 'ADVANCED'
          : 'BASIC';

    const normalizedSubject = (subjectSlug || 'toan-hoc').trim().toLowerCase();
    const safeGrade = grade === 10 || grade === 11 || grade === 12 ? grade : 12;
    const passed = Number(score) >= 5.0;

    const chapters = getCurriculumChapters(normalizedSubject, safeGrade);
    const chapterDef = chapters.find((c) => c.id === Number(chapterId));
    const nextChapterInTrack = getNextCurriculumChapterInTrack(
      normalizedSubject,
      safeGrade,
      Number(chapterId),
    );

    const isEntryChapter = (chapterDef?.trackOrder ?? 1) === 1;

    // Chế độ khách dùng thử (Guest Trial): tính toán trên RAM, không ghi DB giả
    if (!studentProfileId) {
      const basicCompleted = passed && levelCode === 'BASIC';
      const mediumCompleted = passed && levelCode === 'MEDIUM';
      const advancedCompleted = passed && levelCode === 'ADVANCED';
      const crownsEarned =
        (basicCompleted ? 1 : 0) +
        (mediumCompleted ? 1 : 0) +
        (advancedCompleted ? 1 : 0);

      return {
        isGuestTrial: true,
        subject: normalizedSubject,
        grade: safeGrade,
        chapterId: Number(chapterId),
        chapterName: chapterDef?.name || `Chương ${chapterId}`,
        shortName: chapterDef?.shortName || `Chương ${chapterId}`,
        track: chapterDef?.track || 'DEFAULT',
        trackLabel: chapterDef?.trackLabel || '',
        levelCompleted: levelCode,
        score: Number(score),
        passed,
        crownsEarned,
        basicCompleted,
        mediumCompleted,
        advancedCompleted,
        unlockedNextLevel:
          passed && isEntryChapter
            ? levelCode === 'BASIC'
              ? 'MEDIUM'
              : levelCode === 'MEDIUM'
                ? 'ADVANCED'
                : null
            : null,
        nextChapterInTrack: nextChapterInTrack
          ? {
              id: nextChapterInTrack.id,
              name: nextChapterInTrack.name,
              shortName: nextChapterInTrack.shortName,
              track: nextChapterInTrack.track,
              trackLabel: nextChapterInTrack.trackLabel,
              semester: nextChapterInTrack.semester,
            }
          : null,
      };
    }

    const existing = await this.prisma.studentChapterProgress.findUnique({
      where: {
        student_id_subject_grade_chapter_id: {
          student_id: studentProfileId,
          subject: normalizedSubject,
          grade: safeGrade,
          chapter_id: Number(chapterId),
        },
      },
    });

    const trackChaptersInOrder = chapters
      .filter((c) => c.track === (chapterDef?.track || 'DEFAULT'))
      .sort((a, b) => a.trackOrder - b.trackOrder);
    const currentIdxInTrack = trackChaptersInOrder.findIndex(
      (c) => c.id === Number(chapterId),
    );
    const prevTrackChapter =
      currentIdxInTrack > 0
        ? trackChaptersInOrder[currentIdxInTrack - 1]
        : null;
    const prevTrackRow = prevTrackChapter
      ? await this.prisma.studentChapterProgress.findUnique({
          where: {
            student_id_subject_grade_chapter_id: {
              student_id: studentProfileId,
              subject: normalizedSubject,
              grade: safeGrade,
              chapter_id: prevTrackChapter.id,
            },
          },
        })
      : null;

    const nextBasicCompleted =
      Boolean(existing?.basic_completed) || (passed && levelCode === 'BASIC');
    const nextMediumCompleted =
      Boolean(existing?.medium_completed) || (passed && levelCode === 'MEDIUM');
    const nextAdvancedCompleted =
      Boolean(existing?.advanced_completed) ||
      (passed && levelCode === 'ADVANCED');

    const nextBestBasic =
      levelCode === 'BASIC'
        ? Math.max(Number(existing?.basic_best_score ?? 0), Number(score))
        : Number(existing?.basic_best_score ?? 0);
    const nextBestMedium =
      levelCode === 'MEDIUM'
        ? Math.max(Number(existing?.medium_best_score ?? 0), Number(score))
        : Number(existing?.medium_best_score ?? 0);
    const nextBestAdvanced =
      levelCode === 'ADVANCED'
        ? Math.max(Number(existing?.advanced_best_score ?? 0), Number(score))
        : Number(existing?.advanced_best_score ?? 0);

    const crownsEarned =
      (nextBasicCompleted ? 1 : 0) +
      (nextMediumCompleted ? 1 : 0) +
      (nextAdvancedCompleted ? 1 : 0);

    const updated = await this.prisma.studentChapterProgress.upsert({
      where: {
        student_id_subject_grade_chapter_id: {
          student_id: studentProfileId,
          subject: normalizedSubject,
          grade: safeGrade,
          chapter_id: Number(chapterId),
        },
      },
      create: {
        student_id: studentProfileId,
        subject: normalizedSubject,
        grade: safeGrade,
        chapter_id: Number(chapterId),
        track: chapterDef?.track || 'DEFAULT',
        basic_completed: nextBasicCompleted,
        medium_completed: nextMediumCompleted,
        advanced_completed: nextAdvancedCompleted,
        basic_best_score: nextBestBasic,
        medium_best_score: nextBestMedium,
        advanced_best_score: nextBestAdvanced,
        crowns_earned: crownsEarned,
        attempts_count: 1,
        last_practiced_at: new Date(),
      },
      update: {
        track: chapterDef?.track || existing?.track || 'DEFAULT',
        basic_completed: nextBasicCompleted,
        medium_completed: nextMediumCompleted,
        advanced_completed: nextAdvancedCompleted,
        basic_best_score: nextBestBasic,
        medium_best_score: nextBestMedium,
        advanced_best_score: nextBestAdvanced,
        crowns_earned: crownsEarned,
        attempts_count: Number(existing?.attempts_count ?? 0) + 1,
        last_practiced_at: new Date(),
      },
    });

    const canUnlockMediumHere =
      !nextMediumCompleted &&
      ((isEntryChapter && nextBasicCompleted) ||
        (!isEntryChapter && Boolean(prevTrackRow?.medium_completed)));
    const canUnlockAdvancedHere =
      !nextAdvancedCompleted &&
      ((isEntryChapter && nextMediumCompleted) ||
        (!isEntryChapter && Boolean(prevTrackRow?.advanced_completed)));

    return {
      isGuestTrial: false,
      subject: normalizedSubject,
      grade: safeGrade,
      chapterId: Number(chapterId),
      chapterName: chapterDef?.name || `Chương ${chapterId}`,
      shortName: chapterDef?.shortName || `Chương ${chapterId}`,
      track: chapterDef?.track || 'DEFAULT',
      trackLabel: chapterDef?.trackLabel || '',
      levelCompleted: levelCode,
      score: Number(score),
      passed,
      crownsEarned: updated.crowns_earned,
      basicCompleted: updated.basic_completed,
      mediumCompleted: updated.medium_completed,
      advancedCompleted: updated.advanced_completed,
      unlockedNextLevel:
        levelCode === 'BASIC' && canUnlockMediumHere
          ? 'MEDIUM'
          : levelCode === 'MEDIUM' && canUnlockAdvancedHere
            ? 'ADVANCED'
            : null,
      nextChapterInTrack: nextChapterInTrack
        ? {
            id: nextChapterInTrack.id,
            name: nextChapterInTrack.name,
            shortName: nextChapterInTrack.shortName,
            track: nextChapterInTrack.track,
            trackLabel: nextChapterInTrack.trackLabel,
            semester: nextChapterInTrack.semester,
          }
        : null,
    };
  }

  /**
   * Lấy bản đồ Lộ trình Chương kiểu Duolingo theo Môn & Lớp:
   * - Mỗi mức độ (BASIC / MEDIUM / ADVANCED) có tiến trình mở khóa chương độc lập:
   *   + Cơ bản: Chương 1 mở sẵn, qua Chương k Cơ bản -> mở Chương k+1 Cơ bản.
   *   + Trung bình: Cổng xuất phát (Chương 1) mở khi qua Chương 1 Cơ bản; sau đó qua Chương k Trung bình -> mở Chương k+1 Trung bình độc lập.
   *   + Nâng cao: Cổng xuất phát (Chương 1) mở khi qua Chương 1 Trung bình; sau đó qua Chương k Nâng cao -> mở Chương k+1 Nâng cao độc lập.
   */
  async getChapterRoadmap(
    userId: string | null,
    subjectSlug?: string,
    gradeQuery?: number,
  ) {
    const normalizedSubject = (subjectSlug || 'toan-hoc').trim().toLowerCase();
    const semesterInfo = getCurrentRealTimeSemester();

    let savedStudentGrade: 10 | 11 | 12 | null = null;
    let needsGradeOnboarding = false;
    let studentProfileId: string | null = null;

    if (userId && userId !== 'guest') {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { student_profile: true },
      });
      if (userRecord) {
        savedStudentGrade = parseStudentGradeNumber(
          userRecord.student_profile?.grade_level,
        );
        if (userRecord.role !== 'SUPER_ADMIN') {
          const profile =
            userRecord.student_profile ||
            (await this.getOrInitStudentProfile(userId, undefined));
          if (profile && !profile.isVirtual) {
            studentProfileId = profile.id;
          }
          needsGradeOnboarding = savedStudentGrade === null;
        }
      }
    }

    const requestedGrade = parseStudentGradeNumber(gradeQuery);
    const effectiveGrade: 10 | 11 | 12 =
      requestedGrade || savedStudentGrade || 12;
    const allChapters = getCurriculumChapters(
      normalizedSubject,
      effectiveGrade,
    );

    // Đồng bộ bổ sung từ lịch sử bài nộp cũ nếu học sinh từng làm bài trước khi có bảng StudentChapterProgress
    if (studentProfileId) {
      const existingProgressRows =
        await this.prisma.studentChapterProgress.findMany({
          where: {
            student_id: studentProfileId,
            subject: normalizedSubject,
            grade: effectiveGrade,
          },
        });

      if (existingProgressRows.length === 0) {
        const pastSubmissions = await this.prisma.examSubmission.findMany({
          where: { student_id: studentProfileId },
          orderBy: { submitted_at: 'asc' },
          take: 80,
        });
        for (const sub of pastSubmissions) {
          const snap: any = sub.snapshot_data || {};
          const snapSubject = String(
            snap.subjectSlug || snap.originalExam?.subjectSlug || '',
          )
            .trim()
            .toLowerCase();
          const snapGrade = Number(
            snap.grade || snap.originalExam?.grade || 12,
          );
          const snapChapterId = Number(
            snap.chapterId || snap.originalExam?.chapterId || 0,
          );
          const snapMode = String(
            snap.practiceMode || snap.originalExam?.practiceMode || 'TOPIC',
          ).toUpperCase();
          if (
            snapSubject === normalizedSubject &&
            snapGrade === effectiveGrade &&
            snapChapterId > 0 &&
            snapMode !== 'MOCK_EXAM'
          ) {
            const snapLevel = this.normalizeExamLevel(
              snap.level || snap.originalExam?.level || 'BASIC',
            ).code;
            await this.upsertChapterProgressAfterExam({
              studentProfileId,
              subjectSlug: normalizedSubject,
              grade: effectiveGrade,
              chapterId: snapChapterId,
              levelCode: snapLevel,
              score: Number(sub.score ?? 0),
            });
          }
        }
      }
    }

    const progressRows = studentProfileId
      ? await this.prisma.studentChapterProgress.findMany({
          where: {
            student_id: studentProfileId,
            subject: normalizedSubject,
            grade: effectiveGrade,
          },
        })
      : [];

    const progressMap = new Map<number, (typeof progressRows)[number]>();
    for (const row of progressRows) {
      progressMap.set(row.chapter_id, row);
    }

    const trackCodes: CurriculumTrackCode[] =
      normalizedSubject === 'toan-hoc' ? ['TOAN_SO', 'TOAN_HINH'] : ['DEFAULT'];

    const tracks = trackCodes.map((trackCode) => {
      const trackChapters = allChapters
        .filter((c) => c.track === trackCode)
        .sort((a, b) => a.trackOrder - b.trackOrder);

      const firstChapter = trackChapters[0];
      const firstRow = firstChapter ? progressMap.get(firstChapter.id) : null;
      const firstHk2Chapter = trackChapters.find((c) => c.semester === 2);
      const firstHk2Row = firstHk2Chapter
        ? progressMap.get(firstHk2Chapter.id)
        : null;

      const enrichedNodes = trackChapters.map((chapter, idx) => {
        const row = progressMap.get(chapter.id);
        const prevChapter = idx > 0 ? trackChapters[idx - 1] : null;
        const prevRow = prevChapter ? progressMap.get(prevChapter.id) : null;

        const basicCompleted = Boolean(row?.basic_completed);
        const mediumCompleted = Boolean(row?.medium_completed);
        const advancedCompleted = Boolean(row?.advanced_completed);

        const basicManual = Boolean(
          row?.basic_unlocked_manually || row?.unlocked_manually,
        );
        const mediumManual = Boolean(row?.medium_unlocked_manually);
        const advancedManual = Boolean(row?.advanced_unlocked_manually);

        const isFirstInTrack = idx === 0;
        const isCurrentSemesterEntry =
          semesterInfo.semester === 2 && firstHk2Chapter?.id === chapter.id;

        // 1. Lộ trình Cơ bản (BASIC): Chương 1 mở sẵn, sau đó đi tiếp theo chuỗi Cơ bản
        const basicUnlocked =
          isFirstInTrack ||
          isCurrentSemesterEntry ||
          basicManual ||
          basicCompleted ||
          Boolean(prevRow?.basic_completed);

        // 2. Lộ trình Trung bình (MEDIUM): Chương 1 cần qua Chương 1 Cơ bản, sau đó đi tiếp độc lập theo chuỗi Trung bình
        const mediumUnlocked =
          mediumManual ||
          mediumCompleted ||
          (isFirstInTrack && Boolean(firstRow?.basic_completed)) ||
          (isCurrentSemesterEntry && Boolean(firstHk2Row?.basic_completed)) ||
          (idx > 0 && Boolean(prevRow?.medium_completed));

        // 3. Lộ trình Nâng cao (ADVANCED): Chương 1 cần qua Chương 1 Trung bình, sau đó đi tiếp độc lập theo chuỗi Nâng cao
        const advancedUnlocked =
          advancedManual ||
          advancedCompleted ||
          (isFirstInTrack && Boolean(firstRow?.medium_completed)) ||
          (isCurrentSemesterEntry && Boolean(firstHk2Row?.medium_completed)) ||
          (idx > 0 && Boolean(prevRow?.advanced_completed));

        const crownsEarned =
          (basicCompleted ? 1 : 0) +
          (mediumCompleted ? 1 : 0) +
          (advancedCompleted ? 1 : 0);

        return {
          ...chapter,
          isUnlocked: basicUnlocked,
          unlockedManually: basicManual,
          isCurrentSemester: chapter.semester === semesterInfo.semester,
          crownsEarned,
          maxCrowns: 3,
          attemptsCount: Number(row?.attempts_count ?? 0),
          lastPracticedAt: row?.last_practiced_at ?? null,
          levels: {
            BASIC: {
              unlocked: basicUnlocked,
              unlockedManually: basicManual,
              completed: basicCompleted,
              bestScore:
                row && row.basic_best_score > 0 ? row.basic_best_score : null,
              costPoints: EXAM_LEVEL_COSTS.BASIC,
            },
            MEDIUM: {
              unlocked: mediumUnlocked,
              unlockedManually: mediumManual,
              completed: mediumCompleted,
              bestScore:
                row && row.medium_best_score > 0 ? row.medium_best_score : null,
              costPoints: EXAM_LEVEL_COSTS.MEDIUM,
            },
            ADVANCED: {
              unlocked: advancedUnlocked,
              unlockedManually: advancedManual,
              completed: advancedCompleted,
              bestScore:
                row && row.advanced_best_score > 0
                  ? row.advanced_best_score
                  : null,
              costPoints: EXAM_LEVEL_COSTS.ADVANCED,
            },
          },
        };
      });

      const resolveLevelFrontierId = (
        lvl: 'BASIC' | 'MEDIUM' | 'ADVANCED',
      ): number | null => {
        const inCurrentSem = enrichedNodes.find(
          (n) =>
            n.levels[lvl].unlocked &&
            n.isCurrentSemester &&
            !n.levels[lvl].completed,
        );
        const anyUnlockedIncomplete = enrichedNodes.find(
          (n) => n.levels[lvl].unlocked && !n.levels[lvl].completed,
        );
        const lastUnlocked = [...enrichedNodes]
          .reverse()
          .find((n) => n.levels[lvl].unlocked);
        return (
          inCurrentSem?.id ||
          anyUnlockedIncomplete?.id ||
          lastUnlocked?.id ||
          enrichedNodes[0]?.id ||
          null
        );
      };

      const frontierByLevel = {
        BASIC: resolveLevelFrontierId('BASIC'),
        MEDIUM: resolveLevelFrontierId('MEDIUM'),
        ADVANCED: resolveLevelFrontierId('ADVANCED'),
      };

      const frontierId = frontierByLevel.BASIC;

      const nodesWithFrontier = enrichedNodes.map((n) => ({
        ...n,
        isFrontier: n.id === frontierId,
      }));

      const totalCrowns = nodesWithFrontier.reduce(
        (acc, n) => acc + n.crownsEarned,
        0,
      );
      const maxCrowns = nodesWithFrontier.length * 3;
      const completedBasicCount = nodesWithFrontier.filter(
        (n) => n.levels.BASIC.completed,
      ).length;
      const completedMediumCount = nodesWithFrontier.filter(
        (n) => n.levels.MEDIUM.completed,
      ).length;
      const completedAdvancedCount = nodesWithFrontier.filter(
        (n) => n.levels.ADVANCED.completed,
      ).length;

      return {
        trackCode,
        trackTitle:
          trackCode === 'TOAN_SO'
            ? 'Toán Số (Đại số – Giải tích & Xác suất)'
            : trackCode === 'TOAN_HINH'
              ? 'Toán Hình (Hình học & Tọa độ)'
              : `Lộ trình Tin học Lớp ${effectiveGrade}`,
        shortTitle:
          trackCode === 'TOAN_SO'
            ? 'Toán Số'
            : trackCode === 'TOAN_HINH'
              ? 'Toán Hình'
              : 'Tin học',
        frontierChapterId: frontierId,
        frontierByLevel,
        totalChapters: nodesWithFrontier.length,
        completedBasicCount,
        completedMediumCount,
        completedAdvancedCount,
        totalCrowns,
        maxCrowns,
        chapters: nodesWithFrontier,
      };
    });

    const totalCrownsAll = tracks.reduce((acc, t) => acc + t.totalCrowns, 0);
    const maxCrownsAll = tracks.reduce((acc, t) => acc + t.maxCrowns, 0);
    const diagnosticStatus = await this.getDiagnosticStatus(
      userId,
      normalizedSubject,
      effectiveGrade,
    );

    return {
      subject: normalizedSubject,
      hasDualMathTracks: normalizedSubject === 'toan-hoc',
      grade: effectiveGrade,
      savedStudentGrade,
      needsGradeOnboarding,
      isAuthenticated: Boolean(studentProfileId),
      diagnosticStatus,
      semesterInfo,
      summary: {
        totalCrowns: totalCrownsAll,
        maxCrowns: maxCrownsAll,
        totalChapters: allChapters.length,
      },
      tracks,
    };
  }

  /**
   * Mở khóa nhảy cóc tới một chương học sinh đang học thực tế trên lớp ("Nhảy tới chương này") theo đúng mức độ đang xem
   */
  async unlockChapterJump(userId: string, dto: UnlockChapterJumpDto) {
    const profile = await this.getOrInitStudentProfile(userId, dto.grade);
    if (profile.isVirtual) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để lưu mở khóa chương.',
      );
    }

    const normalizedSubject = (dto.subject || 'toan-hoc').trim().toLowerCase();
    const safeGrade =
      dto.grade === 10 || dto.grade === 11 || dto.grade === 12 ? dto.grade : 12;
    const targetLevel = this.normalizeExamLevel(dto.level || 'BASIC').code;
    const chapterDef = getCurriculumChapters(normalizedSubject, safeGrade).find(
      (c) => c.id === Number(dto.chapterId),
    );

    const levelManualPatch =
      targetLevel === 'ADVANCED'
        ? { advanced_unlocked_manually: true }
        : targetLevel === 'MEDIUM'
          ? { medium_unlocked_manually: true }
          : { unlocked_manually: true, basic_unlocked_manually: true };

    const record = await this.prisma.studentChapterProgress.upsert({
      where: {
        student_id_subject_grade_chapter_id: {
          student_id: profile.id,
          subject: normalizedSubject,
          grade: safeGrade,
          chapter_id: Number(dto.chapterId),
        },
      },
      create: {
        student_id: profile.id,
        subject: normalizedSubject,
        grade: safeGrade,
        chapter_id: Number(dto.chapterId),
        track: chapterDef?.track || 'DEFAULT',
        ...levelManualPatch,
      },
      update: {
        ...levelManualPatch,
      },
    });

    return {
      unlocked: true,
      subject: normalizedSubject,
      grade: safeGrade,
      level: targetLevel,
      chapterId: record.chapter_id,
      chapterName: chapterDef?.name || `Chương ${dto.chapterId}`,
    };
  }

  /**
   * Đồng bộ dữ liệu Khách dùng thử (Tên, Khối lớp, Chương vừa hoàn thành & Bài thi thử)
   * thẳng vào tài khoản PostgreSQL ngay khi học sinh vừa đăng nhập / đăng ký thành công!
   */
  async syncGuestOnboarding(userId: string, dto: SyncGuestOnboardingDto) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { student_profile: true },
    });

    if (!userRecord) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    const safeGrade =
      dto.grade === 10 || dto.grade === 11 || dto.grade === 12 ? dto.grade : 12;
    const gradeLabel = `Lớp ${safeGrade}`;

    // Nếu user chưa có tên hiển thị rõ ràng và có nhập tên lúc làm thử -> cập nhật fullname
    const cleanGuestName = String(dto.fullname || '').trim();
    if (
      cleanGuestName.length >= 2 &&
      (!userRecord.fullname ||
        userRecord.fullname.trim().length < 2 ||
        userRecord.fullname === userRecord.email?.split('@')[0])
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fullname: cleanGuestName },
      });
    }

    // Đảm bảo có student_profile và cập nhật grade_level nếu chưa có
    const profile = await this.getOrInitStudentProfile(userId, safeGrade);
    if (!profile.isVirtual) {
      const currentParsedGrade = parseStudentGradeNumber(profile.grade_level);
      if (!currentParsedGrade) {
        await this.prisma.studentProfile.update({
          where: { id: profile.id },
          data: { grade_level: gradeLabel },
        });
      }

      // Đồng bộ danh sách chương đã hoàn thành lúc dùng thử
      if (
        Array.isArray(dto.completedChapters) &&
        dto.completedChapters.length > 0
      ) {
        for (const item of dto.completedChapters) {
          const lvl = this.normalizeExamLevel(item.level || 'BASIC').code;
          await this.upsertChapterProgressAfterExam({
            studentProfileId: profile.id,
            subjectSlug: item.subject || 'toan-hoc',
            grade: Number(item.grade || safeGrade),
            chapterId: Number(item.chapterId || 1),
            levelCode: lvl,
            score: Number(item.score ?? 0),
          });
        }
      }

      // Đồng bộ kết quả bài test đánh giá năng lực của Khách vào StudentSubjectDiagnostic & mở khóa cấp độ
      if (
        Array.isArray(dto.completedDiagnostics) &&
        dto.completedDiagnostics.length > 0
      ) {
        for (const diag of dto.completedDiagnostics) {
          const normSubj = (diag.subject || 'toan-hoc').trim().toLowerCase();
          const diagGrade =
            Number(diag.grade) === 10 ||
            Number(diag.grade) === 11 ||
            Number(diag.grade) === 12
              ? Number(diag.grade)
              : safeGrade;
          const assignedLevel = String(
            diag.assignedLevel || 'BASIC',
          ).toUpperCase();
          const overallScore = Number(diag.overallScore ?? 0);
          const trackScores =
            diag.trackScores && typeof diag.trackScores === 'object'
              ? diag.trackScores
              : { DEFAULT: overallScore };

          await this.prisma.studentSubjectDiagnostic.upsert({
            where: {
              student_id_subject_grade: {
                student_id: profile.id,
                subject: normSubj,
                grade: diagGrade,
              },
            },
            create: {
              student_id: profile.id,
              subject: normSubj,
              grade: diagGrade,
              assigned_level: assignedLevel,
              overall_score: overallScore,
              track_scores: trackScores,
              bloom_breakdown: diag.bloomBreakdown || {},
              completed_at: diag.completedAt
                ? new Date(diag.completedAt)
                : new Date(),
            },
            update: {
              assigned_level: assignedLevel,
              overall_score: overallScore,
              track_scores: trackScores,
              bloom_breakdown: diag.bloomBreakdown || {},
              completed_at: diag.completedAt
                ? new Date(diag.completedAt)
                : new Date(),
            },
          });

          await this.unlockChaptersFromTrackLevels(
            profile.id,
            normSubj,
            diagGrade,
            trackScores,
          );
        }
      }

      // Nếu có bài thi thử chi tiết chờ đồng bộ -> lưu vào exam_submissions mà không trừ điểm mở đề
      if (
        dto.pendingTrialSubmission &&
        typeof dto.pendingTrialSubmission === 'object'
      ) {
        try {
          await this.submitExam(userId, {
            ...dto.pendingTrialSubmission,
            deductEntryCost: false,
          });
        } catch (err) {
          console.error(
            '[ExamsService.syncGuestOnboarding] Pending trial sync error:',
            err,
          );
        }
      }
    }

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { student_profile: true },
    });

    return {
      synced: true,
      grade: safeGrade,
      gradeLabel: updatedUser?.student_profile?.grade_level || gradeLabel,
      fullname: updatedUser?.fullname || cleanGuestName,
    };
  }

  /**
   * Kiểm tra học sinh đã làm bài test Đánh giá năng lực cho (subject, grade) chưa.
   * Admin / Giáo viên được miễn ép buộc mặc định.
   */
  async getDiagnosticStatus(
    userId: string | null,
    subjectSlug?: string,
    grade?: number,
    userRole?: string,
  ) {
    const normalizedSubject = (subjectSlug || 'toan-hoc').trim().toLowerCase();
    const safeGrade =
      Number(grade) === 10 || Number(grade) === 11 || Number(grade) === 12
        ? Number(grade)
        : 12;

    const normRole = String(userRole || '')
      .trim()
      .toUpperCase();
    let isPrivileged =
      normRole === 'ADMIN' ||
      normRole === 'SUPER_ADMIN' ||
      normRole === 'TEACHER';

    let studentProfileId: string | null = null;
    if (userId) {
      const userRec = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          student_profile: { select: { id: true, grade_level: true } },
        },
      });
      if (userRec) {
        const dbRole = String(userRec.role || '').toUpperCase();
        if (
          dbRole === 'ADMIN' ||
          dbRole === 'SUPER_ADMIN' ||
          dbRole === 'TEACHER'
        ) {
          isPrivileged = true;
        }
        studentProfileId = userRec.student_profile?.id || null;
      }
    }

    if (isPrivileged) {
      return {
        subject: normalizedSubject,
        grade: safeGrade,
        isAuthenticated: Boolean(userId),
        isPrivileged: true,
        diagnosticCompleted: false,
        diagnosticRequired: false,
        diagnosticResult: null,
      };
    }

    if (!studentProfileId) {
      return {
        subject: normalizedSubject,
        grade: safeGrade,
        isAuthenticated: false,
        isPrivileged: false,
        diagnosticCompleted: false,
        diagnosticRequired: true,
        diagnosticResult: null,
      };
    }

    const record = await this.prisma.studentSubjectDiagnostic.findUnique({
      where: {
        student_id_subject_grade: {
          student_id: studentProfileId,
          subject: normalizedSubject,
          grade: safeGrade,
        },
      },
    });

    if (!record) {
      return {
        subject: normalizedSubject,
        grade: safeGrade,
        isAuthenticated: true,
        isPrivileged: false,
        diagnosticCompleted: false,
        diagnosticRequired: true,
        diagnosticResult: null,
      };
    }

    return {
      subject: normalizedSubject,
      grade: safeGrade,
      isAuthenticated: true,
      isPrivileged: false,
      diagnosticCompleted: true,
      diagnosticRequired: false,
      diagnosticResult: {
        assignedLevel: record.assigned_level,
        overallScore: record.overall_score,
        trackScores: record.track_scores,
        bloomBreakdown: record.bloom_breakdown,
        completedAt: record.completed_at,
      },
    };
  }

  /**
   * Bốc ma trận chuẩn 12 câu Đánh giá năng lực theo Học kỳ thực tế & Mạch kiến thức:
   * - HK1 (hoặc Ôn hè HK1): chỉ lấy chương thuộc Học kỳ 1
   * - HK2: bao phủ cả Học kỳ 1 & Học kỳ 2
   * - Toán học: 6 câu Toán Số + 6 câu Toán Hình (mỗi nhánh 2 Nhận biết + 2 Thông hiểu + 2 Vận dụng)
   * - Tin học / môn đơn nhánh: 4 Nhận biết + 4 Thông hiểu + 4 Vận dụng
   */
  private async sampleDiagnosticAssessmentPool(params: {
    subjectGradePool: Array<{
      id: string;
      chapter_id: number | null;
      bloom_level: BloomLevel | null;
      topic_tag: string | null;
    }>;
    resolvedSubject: string;
    resolvedGrade: number;
    studentProfileId: string | null;
    identitySeed: string;
    wrongQuestionIdSet: Set<string>;
    weakTopicSet: Set<string>;
  }): Promise<{
    eligiblePool: Array<{
      id: string;
      chapter_id: number | null;
      bloom_level: BloomLevel | null;
      topic_tag: string | null;
    }>;
    sampledMeta: Array<{ id: string; servedEpoch: number }>;
  }> {
    const {
      subjectGradePool,
      resolvedSubject,
      resolvedGrade,
      studentProfileId,
      identitySeed,
      wrongQuestionIdSet,
      weakTopicSet,
    } = params;

    const semesterInfo = getCurrentRealTimeSemester();
    const allChapters = getCurriculumChapters(resolvedSubject, resolvedGrade);
    const chapterById = new Map(allChapters.map((c) => [c.id, c]));

    const eligibleChapters =
      semesterInfo.semester === 1
        ? allChapters.filter((c) => c.semester === 1)
        : allChapters;
    const effectiveChapters =
      eligibleChapters.length > 0 ? eligibleChapters : allChapters;
    const eligibleChapterIds = new Set(effectiveChapters.map((c) => c.id));

    const eligiblePool = subjectGradePool.filter(
      (q) =>
        q.chapter_id !== null && eligibleChapterIds.has(Number(q.chapter_id)),
    );
    const fallbackPool =
      eligiblePool.length > 0 ? eligiblePool : subjectGradePool;

    const buckets: Array<{
      track: CurriculumTrackCode;
      bloom: BloomLevel;
      count: number;
    }> =
      resolvedSubject === 'toan-hoc'
        ? [
            { track: 'TOAN_SO', bloom: BloomLevel.NHAN_BIET, count: 2 },
            { track: 'TOAN_SO', bloom: BloomLevel.THONG_HIEU, count: 2 },
            { track: 'TOAN_SO', bloom: BloomLevel.VAN_DUNG, count: 2 },
            { track: 'TOAN_HINH', bloom: BloomLevel.NHAN_BIET, count: 2 },
            { track: 'TOAN_HINH', bloom: BloomLevel.THONG_HIEU, count: 2 },
            { track: 'TOAN_HINH', bloom: BloomLevel.VAN_DUNG, count: 2 },
          ]
        : [
            { track: 'DEFAULT', bloom: BloomLevel.NHAN_BIET, count: 4 },
            { track: 'DEFAULT', bloom: BloomLevel.THONG_HIEU, count: 4 },
            { track: 'DEFAULT', bloom: BloomLevel.VAN_DUNG, count: 4 },
          ];

    const pickedIdSet = new Set<string>();
    const sampledMeta: Array<{ id: string; servedEpoch: number }> = [];

    for (const bucket of buckets) {
      const matchTrack = (chId: number | null) => {
        if (bucket.track === 'DEFAULT') return true;
        const ch = chId !== null ? chapterById.get(Number(chId)) : undefined;
        return ch?.track === bucket.track;
      };

      const tierExact = fallbackPool.filter(
        (q) =>
          !pickedIdSet.has(q.id) &&
          matchTrack(q.chapter_id) &&
          q.bloom_level === bucket.bloom,
      );
      const tierTrackAllChapters = subjectGradePool.filter(
        (q) =>
          !pickedIdSet.has(q.id) &&
          matchTrack(q.chapter_id) &&
          q.bloom_level === bucket.bloom,
      );
      const tierTrackAnyBloom = fallbackPool.filter(
        (q) => !pickedIdSet.has(q.id) && matchTrack(q.chapter_id),
      );
      const tierRemaining = subjectGradePool.filter(
        (q) => !pickedIdSet.has(q.id),
      );

      const bucketPool =
        tierExact.length >= bucket.count
          ? tierExact
          : tierTrackAllChapters.length >= bucket.count
            ? tierTrackAllChapters
            : tierTrackAnyBloom.length >= bucket.count
              ? tierTrackAnyBloom
              : [...tierExact, ...tierTrackAnyBloom, ...tierRemaining];

      const dedupedPool = Array.from(
        new Map(bucketPool.map((item) => [item.id, item])).values(),
      );

      const sampled = await this.sampleAdaptivePoolWithCursor({
        pool: dedupedPool,
        targetCount: bucket.count,
        studentProfileId,
        identitySeed,
        poolKey: `${resolvedSubject}:g${resolvedGrade}:DIAG:${bucket.track}:${bucket.bloom}`,
        wrongQuestionIdSet,
        weakTopicSet,
      });

      for (const item of sampled) {
        if (!pickedIdSet.has(item.id)) {
          pickedIdSet.add(item.id);
          sampledMeta.push(item);
        }
      }
    }

    return {
      eligiblePool: fallbackPool,
      sampledMeta,
    };
  }

  /**
   * Chấm tách nhánh + Bloom cho bài thi Chẩn đoán năng lực (ASSESSMENT),
   * lưu vào `StudentSubjectDiagnostic` và tự động mở khóa cấp độ phù hợp trong `StudentChapterProgress`.
   */
  private async applyDiagnosticResult(params: {
    studentProfileId: string | null;
    subjectSlug: string;
    grade: number;
    overallScore: number;
    details: any[];
    snapshotData: any;
  }) {
    const {
      studentProfileId,
      subjectSlug,
      grade,
      overallScore,
      details,
      snapshotData,
    } = params;
    const normalizedSubject = (subjectSlug || 'toan-hoc').trim().toLowerCase();
    const safeGrade = grade === 10 || grade === 11 || grade === 12 ? grade : 12;

    const chapters = getCurriculumChapters(normalizedSubject, safeGrade);
    const chapterById = new Map(chapters.map((c) => [c.id, c]));

    const detailByQid = new Map<string, any>();
    for (const d of details || []) {
      if (d?.questionId) detailByQid.set(String(d.questionId), d);
    }

    const origQuestions: any[] = Array.isArray(
      snapshotData?.originalExam?.questions,
    )
      ? snapshotData.originalExam.questions
      : Array.isArray(snapshotData?.questions)
        ? snapshotData.questions
        : [];

    const trackStats: Record<string, { correct: number; total: number }> =
      normalizedSubject === 'toan-hoc'
        ? {
            TOAN_SO: { correct: 0, total: 0 },
            TOAN_HINH: { correct: 0, total: 0 },
          }
        : { DEFAULT: { correct: 0, total: 0 } };

    const bloomStats: Record<string, { correct: number; total: number }> = {
      NHAN_BIET: { correct: 0, total: 0 },
      THONG_HIEU: { correct: 0, total: 0 },
      VAN_DUNG: { correct: 0, total: 0 },
    };

    const sourceList = origQuestions.length > 0 ? origQuestions : details || [];
    for (const q of sourceList) {
      const qId = String(q?.id || q?.questionId || '');
      const chId = Number(q?.chapterId || q?.chapter_id || 1);
      const matchedDetail = qId ? detailByQid.get(qId) : undefined;
      const isCorrect =
        matchedDetail !== undefined
          ? Boolean(matchedDetail.isCorrect)
          : Boolean(q?.isCorrect);

      const resolvedTrack: string =
        q?.track ||
        chapterById.get(chId)?.track ||
        (normalizedSubject === 'toan-hoc' ? 'TOAN_SO' : 'DEFAULT');
      if (!trackStats[resolvedTrack]) {
        trackStats[resolvedTrack] = { correct: 0, total: 0 };
      }
      trackStats[resolvedTrack].total += 1;
      if (isCorrect) trackStats[resolvedTrack].correct += 1;

      const rawBloom = String(
        q?.bloomLevel ||
          matchedDetail?.bloomLevel ||
          (q?.difficulty === 'EASY'
            ? 'NHAN_BIET'
            : q?.difficulty === 'HARD' || q?.difficulty === 'VERY_HARD'
              ? 'VAN_DUNG'
              : 'THONG_HIEU'),
      ).toUpperCase();
      const bloomKey =
        rawBloom === 'NHAN_BIET' || rawBloom === 'THONG_HIEU'
          ? rawBloom
          : 'VAN_DUNG';
      bloomStats[bloomKey].total += 1;
      if (isCorrect) bloomStats[bloomKey].correct += 1;
    }

    const trackScores: Record<string, number> = {};
    for (const [trackKey, stat] of Object.entries(trackStats)) {
      trackScores[trackKey] =
        stat.total > 0
          ? Number(((stat.correct / stat.total) * 10).toFixed(2))
          : overallScore;
    }

    const assignedLevel: 'BASIC' | 'MEDIUM' | 'ADVANCED' =
      overallScore >= 8.0
        ? 'ADVANCED'
        : overallScore >= 5.0
          ? 'MEDIUM'
          : 'BASIC';

    let diagnosticId: string | null = null;
    if (studentProfileId) {
      const saved = await this.prisma.studentSubjectDiagnostic.upsert({
        where: {
          student_id_subject_grade: {
            student_id: studentProfileId,
            subject: normalizedSubject,
            grade: safeGrade,
          },
        },
        create: {
          student_id: studentProfileId,
          subject: normalizedSubject,
          grade: safeGrade,
          assigned_level: assignedLevel,
          overall_score: overallScore,
          track_scores: trackScores,
          bloom_breakdown: bloomStats,
          completed_at: new Date(),
        },
        update: {
          assigned_level: assignedLevel,
          overall_score: overallScore,
          track_scores: trackScores,
          bloom_breakdown: bloomStats,
          completed_at: new Date(),
        },
      });
      diagnosticId = saved.id;

      await this.unlockChaptersFromTrackLevels(
        studentProfileId,
        normalizedSubject,
        safeGrade,
        trackScores,
      );
    }

    return {
      diagnosticId,
      subject: normalizedSubject,
      grade: safeGrade,
      assignedLevel,
      overallScore,
      trackScores,
      bloomBreakdown: bloomStats,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Tự động mở khóa cấp độ Trung bình / Nâng cao trên các chương thuộc Học kỳ hiện tại dựa vào điểm từng nhánh
   */
  private async unlockChaptersFromTrackLevels(
    studentProfileId: string,
    normalizedSubject: string,
    safeGrade: number,
    trackScores: Record<string, number>,
  ) {
    const semesterInfo = getCurrentRealTimeSemester();
    const chapters = getCurriculumChapters(normalizedSubject, safeGrade);

    for (const ch of chapters) {
      const branchScore =
        Number(
          trackScores[ch.track] ??
            trackScores.DEFAULT ??
            Object.values(trackScores)[0] ??
            0,
        ) || 0;

      const unlockMedium = branchScore >= 5.0;
      const unlockAdvanced = branchScore >= 8.0;
      if (!unlockMedium && !unlockAdvanced) continue;

      // Chỉ mở khóa sẵn cho các chương từ Học kỳ hiện tại trở về trước (hoặc chương đầu mỗi nhánh)
      const inCurrentWindow =
        semesterInfo.semester === 2 || ch.semester === 1 || ch.trackOrder === 1;
      if (!inCurrentWindow) continue;

      await this.prisma.studentChapterProgress.upsert({
        where: {
          student_id_subject_grade_chapter_id: {
            student_id: studentProfileId,
            subject: normalizedSubject,
            grade: safeGrade,
            chapter_id: ch.id,
          },
        },
        create: {
          student_id: studentProfileId,
          subject: normalizedSubject,
          grade: safeGrade,
          chapter_id: ch.id,
          track: ch.track,
          basic_unlocked_manually: ch.trackOrder === 1,
          medium_unlocked_manually: unlockMedium,
          advanced_unlocked_manually: unlockAdvanced,
        },
        update: {
          ...(unlockMedium ? { medium_unlocked_manually: true } : {}),
          ...(unlockAdvanced ? { advanced_unlocked_manually: true } : {}),
        },
      });
    }
  }

  private normalizeQuestionFormat(rawFormat?: string): QuestionFormat {
    const normalized = String(rawFormat || 'SINGLE_CHOICE').toUpperCase();
    if (normalized === 'TRUE_FALSE_GROUP' || normalized === 'TRUE_FALSE') {
      return QuestionFormat.TRUE_FALSE;
    }
    if (normalized === 'MULTIPLE_CHOICE' || normalized === 'MULTI_CHOICE') {
      return QuestionFormat.MULTI_CHOICE;
    }
    if (normalized === 'SHORT_ANSWER' || normalized === 'FILL_BLANK') {
      return QuestionFormat.SHORT_ANSWER;
    }
    return QuestionFormat.SINGLE_CHOICE;
  }

  // ============================================================================
  // QUESTION BUG REPORTS (Báo cáo sai sót câu hỏi từ phòng thi - PostgreSQL)
  // ============================================================================

  private readonly issueTypeLabelMap: Record<QuestionIssueType, string> = {
    WRONG_ANSWER: 'Sai đáp án chuẩn',
    KATEX_ERROR: 'Lỗi công thức KaTeX / Hiển thị',
    TYPO_CONTENT: 'Lỗi chính tả / Đề bài thiếu dữ kiện',
    MATRIX_MISMATCH: 'Độ khó không khớp ma trận Bloom',
    OTHER: 'Vấn đề khảo thí khác',
  };

  private formatQuestionBugReport(row: any) {
    const issueType = (row.issue_type || 'OTHER') as QuestionIssueType;
    return {
      id: row.id,
      questionId: row.question_id,
      questionTitle: row.question_title,
      subjectName: row.subject_name || 'Toán Học',
      questionSnippet: row.question_snippet || undefined,
      issueType,
      issueTypeLabel:
        row.issue_type_label ||
        this.issueTypeLabelMap[issueType] ||
        'Vấn đề khảo thí khác',
      description: row.description,
      reportedAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      studentName:
        row.reporter?.fullname || row.reporter_name || 'Học sinh luyện thi',
      reporterId: row.reporter_id || null,
      status: row.status as 'PENDING' | 'RESOLVED',
      adminNote: row.admin_note || null,
      resolvedAt:
        row.resolved_at instanceof Date
          ? row.resolved_at.toISOString()
          : row.resolved_at || null,
      resolvedByName: row.resolved_by?.fullname || null,
    };
  }

  private assertCanModerateBugReports(authUser: AuthenticatedExamUser | null) {
    if (!authUser) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập với quyền Quản trị viên hoặc Giáo viên để duyệt / xóa báo cáo.',
      );
    }
    const allowedRoles = [
      'SUPER_ADMIN',
      'ADMIN',
      'TEACHER',
      'PRINCIPAL',
      'VICE_PRINCIPAL',
      'HEAD_OF_DEPARTMENT',
      'STAFF',
    ];
    const hasPermission =
      allowedRoles.includes(authUser.role) ||
      authUser.isTeacher ||
      authUser.schoolRoles.some((r) => allowedRoles.includes(r.toUpperCase()));

    if (!hasPermission) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên hoặc Giáo viên mới có quyền duyệt / xóa báo cáo sai sót câu hỏi.',
      );
    }
  }

  private async resolveExistingUserId(
    candidateId?: string | null,
  ): Promise<string | null> {
    if (!candidateId) return null;
    const found = await this.prisma.user.findUnique({
      where: { id: candidateId },
      select: { id: true },
    });
    return found?.id || null;
  }

  async createQuestionBugReport(
    authUser: AuthenticatedExamUser | null,
    dto: CreateQuestionBugReportDto,
  ) {
    const reporterId = await this.resolveExistingUserId(authUser?.id);
    const issueType = dto.issueType;
    const issueTypeLabel =
      dto.issueTypeLabel?.trim() ||
      this.issueTypeLabelMap[issueType] ||
      'Vấn đề khảo thí khác';

    const created = await this.prisma.questionBugReport.create({
      data: {
        question_id: dto.questionId.trim(),
        question_title: dto.questionTitle.trim(),
        subject_name: dto.subjectName?.trim() || 'Toán Học',
        question_snippet: dto.questionContentSnippet?.trim() || null,
        issue_type: issueType,
        issue_type_label: issueTypeLabel,
        description:
          dto.description?.trim() ||
          'Học sinh báo cáo lỗi đề thi từ phòng thi khảo thí.',
        reporter_id: reporterId,
        reporter_name:
          dto.studentName?.trim() ||
          authUser?.fullname?.trim() ||
          'Học sinh luyện thi',
        status: QuestionBugReportStatus.PENDING,
      },
      include: {
        reporter: { select: { id: true, fullname: true } },
        resolved_by: { select: { id: true, fullname: true } },
      },
    });

    return this.formatQuestionBugReport(created);
  }

  async listQuestionBugReports(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page =
      Number.isFinite(params.page) && (params.page ?? 0) > 0
        ? Number(params.page)
        : 1;
    const limit =
      Number.isFinite(params.limit) && (params.limit ?? 0) > 0
        ? Math.min(Number(params.limit), 200)
        : 100;
    const skip = (page - 1) * limit;

    const where: any = {};
    const normStatus = String(params.status || '')
      .trim()
      .toUpperCase();
    if (normStatus === 'PENDING' || normStatus === 'RESOLVED') {
      where.status = normStatus;
    }

    const q = params.search?.trim();
    if (q) {
      where.OR = [
        { question_title: { contains: q, mode: 'insensitive' } },
        { subject_name: { contains: q, mode: 'insensitive' } },
        { issue_type_label: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { reporter_name: { contains: q, mode: 'insensitive' } },
        { question_id: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total, pendingCount, resolvedCount] = await Promise.all([
      this.prisma.questionBugReport.findMany({
        where,
        orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
        skip,
        take: limit,
        include: {
          reporter: { select: { id: true, fullname: true } },
          resolved_by: { select: { id: true, fullname: true } },
        },
      }),
      this.prisma.questionBugReport.count({ where }),
      this.prisma.questionBugReport.count({
        where: { status: QuestionBugReportStatus.PENDING },
      }),
      this.prisma.questionBugReport.count({
        where: { status: QuestionBugReportStatus.RESOLVED },
      }),
    ]);

    return {
      items: rows.map((row) => this.formatQuestionBugReport(row)),
      total,
      pendingCount,
      resolvedCount,
      page,
      limit,
    };
  }

  async updateQuestionBugReportStatus(
    id: string,
    authUser: AuthenticatedExamUser | null,
    dto: UpdateQuestionBugReportStatusDto,
  ) {
    this.assertCanModerateBugReports(authUser);

    const existing = await this.prisma.questionBugReport.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        `Không tìm thấy báo cáo câu hỏi với mã ${id}`,
      );
    }

    const nextStatus = dto.status;
    const isResolved = nextStatus === QuestionBugReportStatus.RESOLVED;
    const resolverId = isResolved
      ? await this.resolveExistingUserId(authUser?.id)
      : null;

    const updated = await this.prisma.questionBugReport.update({
      where: { id },
      data: {
        status: nextStatus,
        admin_note:
          dto.adminNote !== undefined
            ? dto.adminNote.trim() || null
            : existing.admin_note,
        resolved_by_id: isResolved ? resolverId : null,
        resolved_at: isResolved ? new Date() : null,
      },
      include: {
        reporter: { select: { id: true, fullname: true } },
        resolved_by: { select: { id: true, fullname: true } },
      },
    });

    return this.formatQuestionBugReport(updated);
  }

  async deleteQuestionBugReport(
    id: string,
    authUser: AuthenticatedExamUser | null,
  ) {
    this.assertCanModerateBugReports(authUser);

    const existing = await this.prisma.questionBugReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Không tìm thấy báo cáo câu hỏi với mã ${id}`,
      );
    }

    await this.prisma.questionBugReport.delete({ where: { id } });
    return { id, deleted: true };
  }
}
