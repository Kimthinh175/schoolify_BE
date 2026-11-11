import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  AdminAdjustPointsDto,
  CreateQuestionBugReportDto,
  DailyClaimPointsDto,
  GenerateMatrixExamDto,
  SettleExamPointsDto,
  StartExamWithPointsDto,
  SubmitExamDto,
  SyncOfflineSubmissionsDto,
  UpdateQuestionBugReportStatusDto,
} from './dto/exam.dto';
import {
  BloomLevel,
  QuestionBugReportStatus,
  QuestionFormat,
  QuestionIssueType,
} from '@prisma/client';

export const DAILY_EXAM_POINT_ALLOWANCE = 9;
export const EXAM_LEVEL_COSTS = {
  BASIC: 3,    // Cơ bản: 3đ/bài -> 9đ làm được 3 bài
  MEDIUM: 4,   // Trung bình: 4đ/bài -> 9đ làm được 2 bài
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trích xuất và xác thực người dùng từ Authorization Bearer Token hoặc Cookie access_token.
   * Phục vụ kiểm tra phân quyền RBAC & Chống IDOR (401 Unauthorized nếu thiếu/hết hạn token).
   */
  async resolveAuthenticatedUser(req: any, requireStrictAuth = true): Promise<AuthenticatedExamUser | null> {
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
      (req?.headers?.['x-user-role'] as string | undefined)?.trim()?.toUpperCase() || undefined;

    // 1. Hỗ trợ các token phiên đăng nhập trên Frontend (mock-*-token) kèm định danh người dùng
    const mockTokenRoleMap: Record<string, { defaultId: string; role: string }> = {
      'mock-student-token': { defaultId: 'usr-student-01', role: 'STUDENT' },
      'mock-google-student-token': { defaultId: 'usr-student-01', role: 'STUDENT' },
      'mock-jwt-token': { defaultId: 'usr-student-01', role: 'STUDENT' },
      'mock-teacher-token': { defaultId: 'usr-teacher-01', role: 'TEACHER' },
      'mock-google-token': { defaultId: 'usr-teacher-01', role: 'TEACHER' },
      'mock-parent-token': { defaultId: 'usr-parent-01', role: 'PARENT' },
      'mock-school-token': { defaultId: 'usr-principal-01', role: 'PRINCIPAL' },
      'mock-google-school-token': { defaultId: 'usr-principal-01', role: 'PRINCIPAL' },
      'mock-super-admin-token-2026': { defaultId: 'usr-admin-01', role: 'SUPER_ADMIN' },
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

    const userId = String(payload.sub || payload.id || payload.userId || headerUserId || '');
    if (!userId) {
      throw new UnauthorizedException('Token không chứa định danh người dùng hợp lệ (401 Unauthorized).');
    }

    const roleFromJwt = String(payload.role || headerUserRole || 'STUDENT').toUpperCase();
    return this.enrichAuthenticatedUser(userId, roleFromJwt, payload.linkedStudentIds);
  }

  /**
   * Kiểm tra chữ ký và thời hạn (exp) của JWT Token (HS256)
   */
  private verifyJwtToken(token: string): Record<string, any> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;
      const secret = process.env.JWT_SECRET || 'schoolify_super_secret_key_2026_local';

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
        linkedStudentIds: Array.isArray(jwtLinkedStudentIds) ? jwtLinkedStudentIds : [],
      };
    }

    const schoolRoles = (dbUser.school_memberships || []).map((m) => String(m.role));
    const isTeacher =
      Boolean(dbUser.teacher_profile) ||
      schoolRoles.includes('TEACHER') ||
      fallbackRole.toUpperCase() === 'TEACHER';
    const isParent =
      Boolean(dbUser.parent_profile) ||
      schoolRoles.includes('PARENT') ||
      fallbackRole.toUpperCase() === 'PARENT';
    const linkedStudentIds = [
      ...(dbUser.parent_profile?.parent_students?.map((ps) => ps.student_id) || []),
      ...(Array.isArray(jwtLinkedStudentIds) ? jwtLinkedStudentIds : []),
    ];

    let resolvedRole = String(dbUser.role || fallbackRole).toUpperCase();
    if (resolvedRole === 'USER' && fallbackRole && fallbackRole.toUpperCase() !== 'USER') {
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
  private async ensureUniqueAttemptToken(preferredToken?: string): Promise<string> {
    const isValidFormat =
      typeof preferredToken === 'string' && /^att_[a-f0-9]{32}$/i.test(preferredToken.trim());

    if (isValidFormat) {
      const candidate = preferredToken!.trim().toLowerCase();
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

  mapChapterToTopic(chapterId: number | null | undefined, subject: string | null | undefined): string {
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
      if (bloom === 'VAN_DUNG_CAO') return 'Bẫy cực trị chứa tham số m & điều kiện tồn tại';
      if (bloom === 'VAN_DUNG') return 'Quên điều kiện xác định mẫu số & căn thức';
      if (bloom === 'THONG_HIEU') return 'Nhầm dấu đạo hàm y\' tại điểm cực trị';
      return 'Quên tập xác định D của hàm số';
    }
    if (s.includes('tin')) {
      if (bloom === 'VAN_DUNG' || bloom === 'VAN_DUNG_CAO') return 'Lỗi cú pháp SQL JOIN & điều kiện WHERE';
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
    const normRole = String(userRole || '').trim().toUpperCase();
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

      if (currentPoints < levelInfo.costPoints) {
        throw new BadRequestException({
          success: false,
          errorCode: 'INSUFFICIENT_EXAM_POINTS',
          message: `Không đủ điểm làm đề! Đề cấp độ ${levelInfo.label} cần ${levelInfo.costPoints} điểm, nhưng bạn hiện chỉ còn ${currentPoints} điểm. Hãy quay lại vào ngày mai để nhận điểm mới hoặc nâng cấp gói học sinh!`,
          data: {
            level: levelInfo.code,
            levelLabel: levelInfo.label,
            requiredPoints: levelInfo.costPoints,
            currentPoints,
            shortfallPoints: levelInfo.costPoints - currentPoints,
            quotaByLevel: this.computeQuotaByLevel(currentPoints),
          },
        });
      }

      // Nếu client yêu cầu trừ điểm luôn khi sinh đề
      if (dto.deductPoints) {
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
            note: `Trừ ${levelInfo.costPoints} điểm khi tạo đề thi cấp độ ${levelInfo.label}`,
          },
        });
      }
    }

    const whereClause: any = {
      subject: subject || 'toan-hoc',
      grade: grade ? Number(grade) : 12,
    };

    if (chapterId) {
      whereClause.chapter_id = Number(chapterId);
    }

    if (topicTag && topicTag !== 'ALL') {
      whereClause.topic_tag = { contains: topicTag, mode: 'insensitive' };
    }

    if (targetDifficulty && targetDifficulty !== 'ALL') {
      const diffToBloomMap: Record<string, BloomLevel> = {
        EASY: BloomLevel.NHAN_BIET,
        MEDIUM: BloomLevel.THONG_HIEU,
        HARD: BloomLevel.VAN_DUNG,
        VERY_HARD: BloomLevel.VAN_DUNG_CAO,
      };
      if (diffToBloomMap[targetDifficulty]) {
        whereClause.bloom_level = diffToBloomMap[targetDifficulty];
      }
    }

    // 1. Tìm câu hỏi từ DB theo tiêu chí lọc
    let questions = await this.prisma.question.findMany({
      where: whereClause,
      include: {
        answers: true,
      },
      take: Math.max(10, (totalQuestions || 10) * 3),
    });

    // Fallback: nếu bộ lọc quá hẹp dẫn đến không đủ số câu, mở rộng lấy thêm cùng môn và khối lớp
    const targetCount = Math.max(1, Number(totalQuestions || 10));
    if (questions.length < targetCount) {
      const fallbackQuestions = await this.prisma.question.findMany({
        where: {
          subject: subject || 'toan-hoc',
          grade: grade ? Number(grade) : 12,
        },
        include: {
          answers: true,
        },
        take: targetCount * 2,
      });
      const existingIds = new Set(questions.map((q) => q.id));
      for (const q of fallbackQuestions) {
        if (!existingIds.has(q.id)) {
          questions.push(q);
          existingIds.add(q.id);
        }
      }
    }

    let selectedQuestions = questions;
    if (questions.length > targetCount) {
      selectedQuestions = [...questions].sort(() => 0.5 - Math.random()).slice(0, targetCount);
    }

    const sessionId = `SES-${Date.now()}`;
    const examTitle = `Đề Luyện Thi Ma Trận ${(subject || 'TOÁN').toUpperCase()} - Khối ${grade || 12}`;

    return {
      sessionId,
      examTitle,
      subjectSlug: subject,
      grade: grade ? Number(grade) : 12,
      durationMinutes: durationMinutes || 45,
      totalQuestions: selectedQuestions.length,
      questions: selectedQuestions.map((q, idx) => {
        const cognitiveTag = q.cognitive_tag || this.mapBloomToCognitive(q.bloom_level);
        const topic = q.topic_tag || this.mapChapterToTopic(q.chapter_id, q.subject);
        const trapTag = q.trap_tag || this.getTrapTagByContext(q.bloom_level, q.subject);

        const correctAns = q.answers.find((a) => a.is_answer);
        const correctChoice = correctAns
          ? (correctAns.sub_label || String.fromCharCode(65 + q.answers.indexOf(correctAns)))
          : 'A';

        return {
          id: q.id,
          orderIndex: idx + 1,
          questionFormat: q.question_format || QuestionFormat.SINGLE_CHOICE,
          bloomLevel: q.bloom_level || BloomLevel.THONG_HIEU,
          topicTag: topic,
          cognitiveTag,
          trapTag,
          chapterId: q.chapter_id || 1,
          title: q.title || `Câu ${idx + 1} (${cognitiveTag}): ${topic}`,
          content: q.question,
          explanation: q.explanation || '',
          points: Number(q.default_points || 0.25),
          correctChoice,
          answers: q.answers.map((a, aIdx) => ({
            id: a.id,
            label: a.sub_label || String.fromCharCode(65 + aIdx), // A, B, C, D
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
    const effectiveUserId = userId || dto.userId || snapshotData?.userId || null;
    const studentProfile = await this.getOrInitStudentProfile(effectiveUserId, grade);
    const studentProfileId = studentProfile.id;
    const ownerUserId = studentProfile.user_id;

    // Sinh mã attemptToken ngẫu nhiên bảo mật cao (CSPRNG) dạng att_[a-f0-9]{32}
    const attemptToken = await this.ensureUniqueAttemptToken(
      clientAttemptToken || snapshotData?.attemptToken,
    );

    // Chuẩn hóa cấu trúc answers (hỗ trợ cả Object { multipleChoices, trueFalseAnswers, shortAnswers, essayAnswers } và Array)
    const normalizedAnswers: {
      multipleChoices: Record<string, string>;
      trueFalseAnswers: Record<string, Record<string, boolean>>;
      shortAnswers: Record<string, string>;
      essayAnswers: Record<string, string>;
    } = {
      multipleChoices: {},
      trueFalseAnswers: {},
      shortAnswers: {},
      essayAnswers: {},
    };

    if (Array.isArray(answers)) {
      for (const item of answers) {
        if (!item?.questionId) continue;
        if (item.selectedAnswerId) {
          normalizedAnswers.multipleChoices[item.questionId] = item.selectedAnswerId;
        } else if (item.subAnswers && typeof item.subAnswers === 'object') {
          normalizedAnswers.trueFalseAnswers[item.questionId] = item.subAnswers;
        } else if (item.textAnswer !== undefined || item.studentTextAnswer !== undefined) {
          normalizedAnswers.shortAnswers[item.questionId] = String(
            item.textAnswer ?? item.studentTextAnswer ?? '',
          );
        }
      }
    } else if (answers && typeof answers === 'object') {
      normalizedAnswers.multipleChoices = { ...(answers.multipleChoices || {}) };
      normalizedAnswers.trueFalseAnswers = { ...(answers.trueFalseAnswers || {}) };
      normalizedAnswers.shortAnswers = { ...(answers.shortAnswers || {}) };
      normalizedAnswers.essayAnswers = { ...(answers.essayAnswers || {}) };
    }

    // Chấm điểm chi tiết
    let correctCount = 0;
    let wrongCount = 0;
    const details: any[] = [];

    // 1. Chấm trắc nghiệm Multiple Choice (4 chọn 1)
    for (const [qId, ansId] of Object.entries(normalizedAnswers.multipleChoices)) {
      const question = await this.prisma.question.findUnique({
        where: { id: qId },
        include: { answers: true },
      });

      if (question) {
        const correctAns = question.answers.find((a) => a.is_answer);
        const isCorrect = Boolean(
          correctAns && (correctAns.id === ansId || correctAns.sub_label === ansId),
        );
        if (isCorrect) correctCount++;
        else wrongCount++;

        details.push({
          questionId: qId,
          questionFormat: question.question_format || 'SINGLE_CHOICE',
          isCorrect,
          pointsEarned: isCorrect ? Number(question.default_points || 0.25) : 0,
          selectedAnswerId: ansId,
          correctAnswerId: correctAns?.id || null,
          explanation: question.explanation,
        });
      }
    }

    // 2. Chấm câu hỏi Đúng/Sai 4 ý (TRUE_FALSE)
    for (const [qId, subMap] of Object.entries(normalizedAnswers.trueFalseAnswers)) {
      const question = await this.prisma.question.findUnique({
        where: { id: qId },
        include: { answers: true },
      });

      if (question && subMap && typeof subMap === 'object') {
        let matchedSubCount = 0;
        for (const ans of question.answers) {
          const key = ans.sub_label || ans.id;
          if (key && subMap[key] !== undefined && Boolean(subMap[key]) === Boolean(ans.is_answer)) {
            matchedSubCount++;
          }
        }
        const isAllCorrect = matchedSubCount === 4 && question.answers.length > 0;
        if (isAllCorrect) correctCount++;
        else wrongCount++;

        const tfPointsMap: Record<number, number> = { 0: 0, 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0 };
        details.push({
          questionId: qId,
          questionFormat: 'TRUE_FALSE',
          isCorrect: isAllCorrect,
          matchedSubCount,
          pointsEarned: tfPointsMap[matchedSubCount] ?? 0,
          subAnswers: subMap,
          explanation: question.explanation,
        });
      }
    }

    // 3. Chấm câu hỏi Trả lời ngắn / Tự luận (SHORT_ANSWER & ESSAY)
    const textEntries = [
      ...Object.entries(normalizedAnswers.shortAnswers),
      ...Object.entries(normalizedAnswers.essayAnswers),
    ];
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
          snapOrig.wrongCount ?? Math.max(0, Number(snapOrig.totalQuestions || 0) - correctCount),
        );
      } else {
        const totalSubmittedCount =
          Object.keys(normalizedAnswers.multipleChoices).length +
          Object.keys(normalizedAnswers.trueFalseAnswers).length +
          Object.keys(normalizedAnswers.shortAnswers).length +
          Object.keys(normalizedAnswers.essayAnswers).length;
        if (totalSubmittedCount > 0) {
          correctCount = totalSubmittedCount;
          wrongCount = 0;
        }
      }
    }

    const totalQuestions = Math.max(
      1,
      Number(snapshotData?.originalExam?.totalQuestions || snapshotData?.totalQuestions || 0) ||
        correctCount + wrongCount,
    );

    const userRole = (studentProfile as any)?.role || '';
    const isTeacherOrAdmin = userRole === 'TEACHER' || userRole === 'SUPER_ADMIN';

    // Anti-Cheat: Chấm điểm thực tế từ cơ sở dữ liệu nếu có câu hỏi được tìm thấy
    const gradedFromDb = details.length > 0;
    let score = Number(((correctCount / totalQuestions) * 10).toFixed(2));

    if (gradedFromDb) {
      // Khi đã chấm được trực tiếp từ DB: chỉ cho phép giáo viên/admin can thiệp điểm số thủ công
      if (isTeacherOrAdmin && scoreOverride !== undefined && scoreOverride !== null && !Number.isNaN(Number(scoreOverride))) {
        score = Math.max(0, Math.min(10, Number(Number(scoreOverride).toFixed(2))));
      }
    } else {
      // Nếu là đề local/offline chưa đồng bộ câu hỏi vào DB
      if (scoreOverride !== undefined && scoreOverride !== null && !Number.isNaN(Number(scoreOverride))) {
        score = Math.max(0, Math.min(10, Number(Number(scoreOverride).toFixed(2))));
      } else if (
        snapshotData?.originalExam &&
        typeof snapshotData.originalExam.finalScore === 'number'
      ) {
        score = Math.max(0, Math.min(10, Number(Number(snapshotData.originalExam.finalScore).toFixed(2))));
      } else if (snapshotData && typeof snapshotData.score === 'number') {
        score = Math.max(0, Math.min(10, Number(Number(snapshotData.score).toFixed(2))));
      }
    }

    const resolvedTitle =
      examTitle ||
      snapshotData?.examTitle ||
      `Bài thi ${subjectSlug || 'Toán'} Lớp ${grade || 12}`;
    const resolvedExamId = examId || snapshotData?.examId || 'exam-practice';

    const enrichedSnapshotData = {
      ...(snapshotData || {}),
      attemptToken,
      userId: ownerUserId,
      sessionId: resolvedSessionId,
      examId: resolvedExamId,
      examTitle: resolvedTitle,
      subjectSlug: subjectSlug || snapshotData?.subjectSlug || 'toan-hoc',
      grade: grade || snapshotData?.grade || 12,
      answers: normalizedAnswers,
      score,
      maxScore: 10.0,
      correctCount,
      wrongCount,
      totalQuestions,
      timeSpentSeconds: safeTimeSpent,
      details,
    };

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

    // Tự động tính toán thưởng/phạt điểm làm đề sau khi nộp bài
    const pointSettlement = await this.settleExamSubmissionPoints(ownerUserId, {
      score,
      level: level || snapshotData?.level || 'BASIC',
      examTitle: resolvedTitle,
      submissionId: submission.id,
      sessionId: resolvedSessionId,
      deductEntryCost: Boolean(deductEntryCost),
    });

    return {
      attemptToken,
      submissionId: submission.id,
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
    };
  }

  /**
   * Lấy kết quả bài thi theo mã bảo mật attemptToken (Bắt buộc phân quyền RBAC / Ownership chống IDOR):
   * 1. Chưa đăng nhập hoặc token hết hạn -> 401 Unauthorized.
   * 2. Học sinh đăng nhập KHÔNG PHẢI chủ sở hữu bài làm (request.user.id !== submission.userId) -> 403 Forbidden.
   * 3. Đúng chủ sở hữu bài làm HOẶC là Giáo viên phụ trách lớp / Phụ huynh liên kết / Admin -> 200 OK.
   * 4. Token không tồn tại -> 404 Not Found.
   */
  async getResultByAttemptToken(attemptToken: string, currentUser: AuthenticatedExamUser | null) {
    if (!currentUser || !currentUser.id) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để xem kết quả bài thi (401 Unauthorized).',
      );
    }

    const cleanToken = (attemptToken || '').trim();
    if (!cleanToken) {
      throw new NotFoundException('Mã phiên bài thi (attemptToken) không tồn tại (404 Not Found).');
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
    const submissionOwnerUserId = submission.student?.user_id || snap.userId || null;

    // Kiểm tra quyền truy cập (RBAC & Ownership - Chống IDOR):
    const isOwner =
      Boolean(submissionOwnerUserId) && currentUser.id === submissionOwnerUserId;

    const isAdminOrSchoolLeader =
      ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_OF_DEPARTMENT'].includes(
        currentUser.role,
      ) ||
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
      ( submissionOwnerUserId
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
      studentName: submission.student?.user?.fullname || snap.userFullName || 'Học sinh',
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
      timeSpentSeconds: submission.time_spent_seconds ?? snap.timeSpentSeconds ?? 0,
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
      throw new NotFoundException(`Không tìm thấy bài thi với mã: ${idOrToken}`);
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
    answers?: { content: string; is_correct?: boolean; is_answer?: boolean; explanation?: string }[];
  }) {
    const subject = payload.subject || payload.subjectName || 'toan-hoc';
    const grade = Number(payload.grade || payload.gradeLevel || 12);
    const questionText = payload.question || payload.content || 'Câu hỏi luyện tập mới';

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
        explanation: payload.explanation || 'Lời giải chi tiết theo chuẩn GDPT 2018.',
        bloom_level: (payload.bloomLevel as any) || 'THONG_HIEU',
        question_format: this.normalizeQuestionFormat(payload.questionFormat),
        type: 'SINGLE_CHOICE',
        answers: {
          create: (
            payload.answers && payload.answers.length > 0
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
   * Cập nhật câu hỏi trong Ngân hàng đề
   */
  async updateQuestion(
    id: string,
    payload: {
      content?: string;
      question?: string;
      explanation?: string;
      bloomLevel?: string;
      questionFormat?: string;
    },
  ) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy câu hỏi ID=${id}`);
    }

    const qText = payload.question ?? payload.content;
    const anyPayload = payload as any;
    if (Array.isArray(anyPayload.answers) && anyPayload.answers.length > 0) {
      await this.prisma.answer.deleteMany({ where: { question_id: id } });
      await this.prisma.answer.createMany({
        data: anyPayload.answers.map((a: any) => ({
          question_id: id,
          content: String(a.content || ''),
          is_answer: Boolean(a.is_answer ?? a.is_correct),
          explain: a.explanation || a.explain || null,
        })),
      });
    }

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(qText !== undefined ? { question: qText } : {}),
        ...(payload.explanation !== undefined ? { explanation: payload.explanation } : {}),
        ...(payload.bloomLevel !== undefined ? { bloom_level: payload.bloomLevel as any } : {}),
        ...(payload.questionFormat !== undefined
          ? { question_format: this.normalizeQuestionFormat(payload.questionFormat) }
          : {}),
      },
      include: { answers: true },
    });
  }

  private normalizeQuestionFormat(rawFormat?: string): QuestionFormat {
    const normalized = String(rawFormat || 'SINGLE_CHOICE').toUpperCase();
    if (normalized === 'TRUE_FALSE_GROUP' || normalized === 'TRUE_FALSE') {
      return QuestionFormat.TRUE_FALSE;
    }
    if (normalized === 'MULTIPLE_CHOICE' || normalized === 'MULTI_CHOICE') {
      return QuestionFormat.MULTI_CHOICE;
    }
    if (normalized === 'SHORT_ANSWER') {
      return QuestionFormat.SHORT_ANSWER;
    }
    if (normalized === 'ESSAY') {
      return QuestionFormat.ESSAY;
    }
    return QuestionFormat.SINGLE_CHOICE;
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
    await this.prisma.submissionAnswer.deleteMany({ where: { question_id: id } });
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

  private getTodayDateStringVN(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  normalizeExamLevel(rawLevel?: string): {
    code: 'BASIC' | 'MEDIUM' | 'ADVANCED' | 'PROVINCIAL' | 'NATIONAL';
    label: string;
    costPoints: number;
    rewardPoints: number;
    maxDailyExams: number;
  } {
    const norm = String(rawLevel || 'BASIC')
      .trim()
      .toUpperCase();

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
        rewardPoints: 20, // +20 mức quốc gia khi > 8.5
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
        rewardPoints: 10, // +10 mức tỉnh khi > 8.5
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
        costPoints: EXAM_LEVEL_COSTS.ADVANCED, // 9đ -> 1 bài
        rewardPoints: 5, // +5 mức giỏi khi > 8.5
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
        costPoints: EXAM_LEVEL_COSTS.MEDIUM, // 4đ -> 2 bài (8đ, dư 1đ)
        rewardPoints: 3, // +3 mức trung bình khi > 8.5
        maxDailyExams: 2,
      };
    }

    return {
      code: 'BASIC',
      label: 'Cơ bản',
      costPoints: EXAM_LEVEL_COSTS.BASIC, // 3đ -> 3 bài
      rewardPoints: 2, // +2 mức cơ bản khi > 8.5
      maxDailyExams: 3,
    };
  }

  private computeQuotaByLevel(currentPoints: number) {
    const basicMax = Math.floor(currentPoints / EXAM_LEVEL_COSTS.BASIC);
    const mediumMax = Math.floor(currentPoints / EXAM_LEVEL_COSTS.MEDIUM);
    const advancedMax = Math.floor(currentPoints / EXAM_LEVEL_COSTS.ADVANCED);
    return {
      BASIC: {
        code: 'BASIC',
        label: 'Cơ bản',
        costPoints: EXAM_LEVEL_COSTS.BASIC,
        dailyBaseAllowanceExams: 3,
        remainingExamsPossible: basicMax,
        maxExamsAvailable: basicMax,
        canStart: currentPoints >= EXAM_LEVEL_COSTS.BASIC,
      },
      MEDIUM: {
        code: 'MEDIUM',
        label: 'Trung bình',
        costPoints: EXAM_LEVEL_COSTS.MEDIUM,
        dailyBaseAllowanceExams: 2,
        remainingExamsPossible: mediumMax,
        maxExamsAvailable: mediumMax,
        canStart: currentPoints >= EXAM_LEVEL_COSTS.MEDIUM,
      },
      ADVANCED: {
        code: 'ADVANCED',
        label: 'Giỏi',
        costPoints: EXAM_LEVEL_COSTS.ADVANCED,
        dailyBaseAllowanceExams: 1,
        remainingExamsPossible: advancedMax,
        maxExamsAvailable: advancedMax,
        canStart: currentPoints >= EXAM_LEVEL_COSTS.ADVANCED,
      },
    };
  }

  /**
   * Lấy cấu hình quy tắc hệ thống điểm làm đề thi
   */
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
          description: 'Kết quả từ 5 đến 8.5 điểm giữ nguyên không thay đổi (0đ)',
        },
        {
          code: 'SCORE_REWARD_8_5_TO_9_9',
          rangeLabel: 'Từ 8.5 đến 9.9 điểm (8.5 ≤ Điểm < 10.0)',
          minScore: 8.5,
          maxScoreExclusive: 10.0,
          pointDelta: 1,
          description: 'Kết quả đạt từ 8.5 đến 9.9 điểm được thưởng thêm 1 điểm (+1đ)',
        },
        {
          code: 'SCORE_REWARD_10',
          rangeLabel: 'Đạt 10 điểm tuyệt đối (Điểm = 10)',
          minScore: 10.0,
          maxScoreInclusive: 10.0,
          pointDelta: 2,
          description: 'Kết quả đạt 10 điểm tuyệt đối được thưởng thêm 2 điểm (+2đ)',
        },
      ],
    };
  }

  /**
   * Xác định hạn mức Điểm Free và Điểm Xịn hàng ngày dựa trên Gói học sinh
   * - FREE: 9đ Free / ngày, 0đ Xịn / ngày
   * - STUDENT_50K: 18đ Free / ngày (9 free + 9 gói), +5đ Xịn / ngày (tích lũy)
   * - STUDENT_100K: 29đ Free / ngày (9 free + 20 gói), +10đ Xịn / ngày (tích lũy), giảm 50% Điểm AI
   */
  getPackageQuota(profile: any): {
    dailyFreeAllowance: number;
    dailyXinPoints: number;
    activePackage: string;
    hasAi50PercentDiscount: boolean;
  } {
    let pkg = String(profile?.active_package || 'FREE').toUpperCase();
    if (profile?.package_expires_at && new Date(profile.package_expires_at).getTime() < Date.now()) {
      pkg = 'FREE';
    }
    if (pkg === 'STUDENT_100K') {
      return { dailyFreeAllowance: 29, dailyXinPoints: 10, activePackage: 'STUDENT_100K', hasAi50PercentDiscount: true };
    }
    if (pkg === 'STUDENT_50K') {
      return { dailyFreeAllowance: 18, dailyXinPoints: 5, activePackage: 'STUDENT_50K', hasAi50PercentDiscount: false };
    }
    return { dailyFreeAllowance: 9, dailyXinPoints: 0, activePackage: 'FREE', hasAi50PercentDiscount: false };
  }

  /**
   * Lấy hoặc khởi tạo StudentProfile, đồng thời tự động kiểm tra & phát điểm đầu ngày mới theo gói
   */
  async getOrInitStudentProfile(userId: string | null, grade?: number) {
    const today = this.getTodayDateStringVN();
    let profile: any = null;

    if (userId && userId !== 'guest') {
      profile = await this.prisma.studentProfile.findUnique({
        where: { user_id: userId },
      });

      if (!profile) {
        let userExists = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!userExists) {
          const safeEmailSlug = userId.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
          userExists = await this.prisma.user.create({
            data: {
              id: userId,
              email: `${safeEmailSlug}_${Date.now()}@student.schoolify.local`,
              fullname: userId === 'usr-student-01' ? 'Nguyễn Hoàng Minh' : `Học sinh (${userId})`,
              password_hash: 'auto_provisioned_student',
            },
          });
        }
        if (userExists) {
          const pkgInfo = this.getPackageQuota(null);
          profile = await this.prisma.studentProfile.create({
            data: {
              user_id: userId,
              grade_level: grade ? `Lớp ${grade}` : 'Lớp 12',
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
      const guestEmail = 'guest_student@schoolify.local';
      let guestUser = await this.prisma.user.findUnique({
        where: { email: guestEmail },
        include: { student_profile: true },
      });

      if (!guestUser) {
        const pkgInfo = this.getPackageQuota(null);
        guestUser = await this.prisma.user.create({
          data: {
            email: guestEmail,
            fullname: 'Học Sinh Khách (Guest)',
            password_hash: 'guest_no_login',
            student_profile: {
              create: {
                grade_level: grade ? `Lớp ${grade}` : 'Lớp 12',
                points: 10,
                exam_points: pkgInfo.dailyFreeAllowance,
                active_package: 'FREE',
                last_daily_grant_date: today,
              },
            },
          },
          include: { student_profile: true },
        });
        if (guestUser.student_profile) {
          await this.prisma.examPointLog.create({
            data: {
              student_id: guestUser.student_profile.id,
              action_type: 'DAILY_GRANT_FREE',
              points_before: 0,
              points_delta: pkgInfo.dailyFreeAllowance,
              points_after: pkgInfo.dailyFreeAllowance,
              note: `Khởi tạo & phát ${pkgInfo.dailyFreeAllowance} điểm làm đề Free hàng ngày (${today})`,
            },
          });
        }
      }

      profile = guestUser.student_profile;
    }

    // Kiểm tra nếu sang ngày mới -> Reset điểm Free theo gói và cấp Điểm Xịn nếu có gói
    if (profile && profile.last_daily_grant_date !== today) {
      const pkgInfo = this.getPackageQuota(profile);
      const freeBefore = Number(profile.exam_points ?? 0);
      const xinBefore = Number(profile.points ?? 0);
      const newXinPoints = Number((xinBefore + pkgInfo.dailyXinPoints).toFixed(2));

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

  /**
   * API 1: Lấy số dư điểm làm đề hiện tại + Hạn mức bài thi theo từng cấp độ + Thống kê hôm nay
   */
  async getExamPointBalance(userId: string | null) {
    const today = this.getTodayDateStringVN();
    const profile = await this.getOrInitStudentProfile(userId);
    const pkgInfo = this.getPackageQuota(profile);
    const currentPoints = Number(profile.exam_points ?? pkgInfo.dailyFreeAllowance);

    const startOfToday = new Date(`${today}T00:00:00+07:00`);
    const todayLogs = await this.prisma.examPointLog.findMany({
      where: {
        student_id: profile.id,
        created_at: { gte: startOfToday },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const examsStartedToday = todayLogs.filter((l) => l.action_type === 'START_EXAM').length;
    const pointsSpentToday = todayLogs
      .filter((l) => l.action_type === 'START_EXAM')
      .reduce((sum, l) => sum + Math.abs(l.points_delta), 0);
    const pointsRewardedToday = todayLogs
      .filter((l) => l.action_type.startsWith('SCORE_REWARD'))
      .reduce((sum, l) => sum + Math.max(0, l.points_delta), 0);
    const pointsPenalizedToday = todayLogs
      .filter((l) => l.action_type === 'SCORE_PENALTY_UNDER_5')
      .reduce((sum, l) => sum + Math.abs(l.points_delta), 0);

    const alreadyClaimedToday = todayLogs.some((l) => l.action_type === 'DAILY_CHECKIN');

    return {
      studentProfileId: profile.id,
      currentPoints,
      diamonds: Number(profile.points ?? 0),
      activePackage: pkgInfo.activePackage,
      dailyAllowance: pkgInfo.dailyFreeAllowance,
      dailyXinAllowance: pkgInfo.dailyXinPoints,
      hasAi50PercentDiscount: pkgInfo.hasAi50PercentDiscount,
      lastDailyGrantDate: profile.last_daily_grant_date || today,
      alreadyClaimedToday,
      quotaByLevel: this.computeQuotaByLevel(currentPoints),
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

  /**
   * API 2: Điểm danh nhận điểm hàng ngày (Mỗi ngày tuyệt đối chỉ được nhận 1 lần duy nhất)
   */
  async claimDailyExamPoints(userId: string | null, dto: DailyClaimPointsDto) {
    const today = this.getTodayDateStringVN();
    const effectiveUserId = userId || dto?.userId || null;
    const profile = await this.getOrInitStudentProfile(effectiveUserId);
    const before = Number(profile.exam_points ?? DAILY_EXAM_POINT_ALLOWANCE);

    const startOfToday = new Date(`${today}T00:00:00+07:00`);
    const existingCheckinToday = await this.prisma.examPointLog.findFirst({
      where: {
        student_id: profile.id,
        action_type: 'DAILY_CHECKIN',
        created_at: { gte: startOfToday },
      },
    });

    if (existingCheckinToday) {
      return {
        claimed: false,
        alreadyClaimedToday: true,
        grantDate: today,
        dailyAllowance: DAILY_EXAM_POINT_ALLOWANCE,
        previousPoints: before,
        currentPoints: before,
        diamonds: Number(profile.points ?? 0),
        quotaByLevel: this.computeQuotaByLevel(before),
        message: `Hôm nay (${today}) bạn đã điểm danh rồi nhé! Mỗi ngày chỉ được điểm danh 1 lần, vui lòng quay lại vào ngày mai nhé.`,
      };
    }

    const updated = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        points: { increment: 1 },
        last_daily_grant_date: today,
      },
    });

    await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'DAILY_CHECKIN',
        points_before: Number(profile.points ?? 0),
        points_delta: 1,
        points_after: Number(updated.points ?? 0),
        note: `Điểm danh chuyên cần (${today}): Nhận +1 Kim Cương (💎)`,
      },
    });

    return {
      claimed: true,
      alreadyClaimedToday: true,
      grantDate: today,
      dailyAllowance: 9,
      pointsDelta: 1,
      previousPoints: before,
      currentPoints: updated.exam_points,
      diamonds: Number(updated.points ?? 0),
      quotaByLevel: this.computeQuotaByLevel(updated.exam_points),
      message: `Điểm danh thành công ngày ${today}! Bạn đã nhận +1 Kim Cương (💎) hôm nay.`,
    };
  }

  /**
   * API 3: Kiểm tra & Trừ điểm khi bắt đầu vào làm đề thi
   * - Cơ bản (BASIC): -3đ (9đ làm được 3 bài)
   * - Trung bình (MEDIUM): -4đ (9đ làm được 2 bài)
   * - Giỏi (ADVANCED): -9đ (9đ làm được 1 bài)
   */
  async startExamWithPoints(userId: string | null, dto: StartExamWithPointsDto) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(effectiveUserId, dto.grade);
    const levelInfo = this.normalizeExamLevel(dto.level);
    const currentPoints = Number(profile.exam_points ?? 0);

    if (currentPoints < levelInfo.costPoints) {
      throw new BadRequestException({
        success: false,
        errorCode: 'INSUFFICIENT_EXAM_POINTS',
        message: `Không đủ điểm làm đề! Đề cấp độ ${levelInfo.label} cần ${levelInfo.costPoints} điểm, nhưng bạn hiện chỉ còn ${currentPoints} điểm. Hãy quay lại vào ngày mai để nhận điểm mới hoặc nâng cấp gói học sinh!`,
        data: {
          level: levelInfo.code,
          levelLabel: levelInfo.label,
          requiredPoints: levelInfo.costPoints,
          currentPoints,
          shortfallPoints: levelInfo.costPoints - currentPoints,
          quotaByLevel: this.computeQuotaByLevel(currentPoints),
        },
      });
    }

    const pointsAfter = currentPoints - levelInfo.costPoints;
    const updatedProfile = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        exam_points: pointsAfter,
      },
    });

    const resolvedTitle =
      dto.examTitle ||
      `Đề thi ${dto.subjectSlug || 'Toán học'} - Cấp độ ${levelInfo.label}`;

    const log = await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'START_EXAM',
        exam_level: levelInfo.code,
        exam_title: resolvedTitle,
        points_before: currentPoints,
        points_delta: -levelInfo.costPoints,
        points_after: pointsAfter,
        note: `Trừ ${levelInfo.costPoints} điểm khi bắt đầu làm đề cấp độ ${levelInfo.label} ("${resolvedTitle}")`,
      },
    });

    return {
      allowed: true,
      sessionId: `SES-${Date.now()}`,
      logId: log.id,
      examLevel: levelInfo.code,
      examLevelLabel: levelInfo.label,
      examTitle: resolvedTitle,
      costDeducted: levelInfo.costPoints,
      pointsBefore: currentPoints,
      currentPoints: updatedProfile.exam_points,
      quotaByLevel: this.computeQuotaByLevel(updatedProfile.exam_points),
      message: `Đã trừ ${levelInfo.costPoints} điểm để mở đề cấp độ ${levelInfo.label}. Số điểm còn lại: ${updatedProfile.exam_points} điểm.`,
    };
  }

  /**
   * API 4: Tính thưởng / phạt điểm sau khi hoàn thành bài thi:
   * - Điểm Free: < 5.0đ: -1đ (min 0) | >= 5.0đ: 0đ (không đổi, không tích lũy)
   * - Điểm Xịn (💎): Cày Free khi điểm >= 8.5đ theo 5 cấp độ bài thi:
   *   + Cơ bản: +2 💎
   *   + Trung bình: +3 💎
   *   + Giỏi: +5 💎
   *   + Cấp Tỉnh / ĐGNL: +10 💎
   *   + Cấp Quốc Gia / HSG: +20 💎
   */
  async settleExamSubmissionPoints(userId: string | null, dto: SettleExamPointsDto) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(effectiveUserId);
    const rawScore = Math.max(0, Math.min(10, Number(dto.score ?? 0)));
    const score = Number(rawScore.toFixed(2));
    const levelInfo = this.normalizeExamLevel(dto.level);

    let workingFreePoints = Number(profile.exam_points ?? 0);
    const initialFreePoints = workingFreePoints;
    let entryCostDeducted = 0;

    // Nếu client yêu cầu trừ cả phí mở đề trong cùng lúc nộp bài
    if (dto.deductEntryCost) {
      entryCostDeducted = levelInfo.costPoints;
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
          note: `Trừ ${entryCostDeducted} điểm phí làm đề cấp độ ${levelInfo.label}`,
        },
      });
      workingFreePoints = afterEntry;
    }

    // Nếu điểm >= 8.5 -> Thưởng Điểm Xịn (💎) tích lũy vĩnh viễn theo chuẩn 5 cấp độ!
    let rewardXinPoints = 0;
    if (score >= 8.5) {
      rewardXinPoints = levelInfo.rewardPoints; // +2 Cơ bản, +3 Trung bình, +5 Giỏi, +10 Tỉnh, +20 Quốc gia
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
      actionType = score >= 10.0 ? 'SCORE_REWARD_10_XIN' : 'SCORE_REWARD_8_5_XIN';
      tierLabel = `Đạt ${score}/10đ (+${rewardXinPoints} 💎 Điểm Xịn)`;
      explanation = `Xuất sắc! Bạn đạt ${score}/10 điểm cấp độ ${levelInfo.label} và được thưởng nóng +${rewardXinPoints} Điểm Xịn (💎 tích lũy vĩnh viễn)!`;
    }

    const finalFreePoints = Math.max(0, workingFreePoints + scoreFreeDelta);
    const xinBefore = Number(profile.points ?? 0);
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

  /**
   * API 5: Lịch sử giao dịch điểm làm đề của học sinh (Phân trang)
   */
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

  /**
   * API 6: Quản trị viên tự điều chỉnh số điểm của bản thân hoặc học sinh
   * - Hỗ trợ cả điểm Tia Sáng (exam_points) và Điểm Xịn / Ngọc Tri Thức (points)
   */
  async adminAdjustPoints(
    currentUserId: string | null,
    currentUserRole: string | undefined,
    dto: AdminAdjustPointsDto,
  ) {
    const normRole = String(currentUserRole || '').trim().toUpperCase();
    const isAdmin =
      normRole === 'ADMIN' ||
      normRole === 'SUPER_ADMIN' ||
      normRole === 'PRINCIPAL';

    if (!isAdmin) {
      throw new ForbiddenException(
        'Từ chối truy cập! Chỉ người dùng có vai trò Quản Trị Viên (ADMIN / SUPER_ADMIN) mới có quyền điều chỉnh điểm trực tiếp.',
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
        action_type: 'ADMIN_MANUAL_ADJUST',
        points_before: Number(profile.exam_points ?? 0),
        points_delta: deltaPoints,
        points_after: Number(updatedProfile.exam_points),
        note:
          dto.note ||
          `Quản trị viên ${currentUserId || ''} điều chỉnh số điểm ngoài client`,
      },
    });

    return {
      studentProfileId: updatedProfile.id,
      userId: targetUserId,
      currentPoints: Number(updatedProfile.exam_points),
      diamonds: Number(updatedProfile.points ?? 0),
      quotaByLevel: this.computeQuotaByLevel(Number(updatedProfile.exam_points)),
      message: `Đã cập nhật: ${updatedProfile.exam_points} Tia Sáng ✨ | ${updatedProfile.points} Ngọc Tri Thức 💎`,
    };
  }

  // ============================================================================
  // QUESTION BUG REPORTS (Báo cáo sai sót câu hỏi từ phòng thi)
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
        row.issue_type_label || this.issueTypeLabelMap[issueType] || 'Vấn đề khảo thí khác',
      description: row.description,
      reportedAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      studentName: row.reporter?.fullname || row.reporter_name || 'Học sinh luyện thi',
      reporterId: row.reporter_id || null,
      status: row.status as 'PENDING' | 'RESOLVED',
      adminNote: row.admin_note || null,
      resolvedAt:
        row.resolved_at instanceof Date ? row.resolved_at.toISOString() : row.resolved_at || null,
      resolvedByName: row.resolved_by?.fullname || null,
    };
  }

  private assertCanModerateBugReports(authUser: AuthenticatedExamUser | null) {
    if (!authUser) return;
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

  private async resolveExistingUserId(candidateId?: string | null): Promise<string | null> {
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
    const issueType = dto.issueType as QuestionIssueType;
    const issueTypeLabel =
      dto.issueTypeLabel?.trim() || this.issueTypeLabelMap[issueType] || 'Vấn đề khảo thí khác';

    const created = await this.prisma.questionBugReport.create({
      data: {
        question_id: dto.questionId.trim(),
        question_title: dto.questionTitle.trim(),
        subject_name: dto.subjectName?.trim() || 'Toán Học',
        question_snippet: dto.questionContentSnippet?.trim() || null,
        issue_type: issueType,
        issue_type_label: issueTypeLabel,
        description:
          dto.description?.trim() || 'Học sinh báo cáo lỗi đề thi từ phòng thi khảo thí.',
        reporter_id: reporterId,
        reporter_name:
          dto.studentName?.trim() || authUser?.fullname?.trim() || 'Học sinh luyện thi',
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
    const page = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? Number(params.page) : 1;
    const limit =
      Number.isFinite(params.limit) && (params.limit ?? 0) > 0
        ? Math.min(Number(params.limit), 200)
        : 100;
    const skip = (page - 1) * limit;

    const where: any = {};
    const normStatus = String(params.status || '').trim().toUpperCase();
    if (normStatus === 'PENDING' || normStatus === 'RESOLVED') {
      where.status = normStatus as QuestionBugReportStatus;
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
      this.prisma.questionBugReport.count({ where: { status: QuestionBugReportStatus.PENDING } }),
      this.prisma.questionBugReport.count({ where: { status: QuestionBugReportStatus.RESOLVED } }),
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

    const existing = await this.prisma.questionBugReport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy báo cáo câu hỏi với mã ${id}`);
    }

    const nextStatus = dto.status as QuestionBugReportStatus;
    const isResolved = nextStatus === QuestionBugReportStatus.RESOLVED;
    const resolverId = isResolved ? await this.resolveExistingUserId(authUser?.id) : null;

    const updated = await this.prisma.questionBugReport.update({
      where: { id },
      data: {
        status: nextStatus,
        admin_note: dto.adminNote !== undefined ? dto.adminNote.trim() || null : existing.admin_note,
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

  async deleteQuestionBugReport(id: string, authUser: AuthenticatedExamUser | null) {
    this.assertCanModerateBugReports(authUser);

    const existing = await this.prisma.questionBugReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy báo cáo câu hỏi với mã ${id}`);
    }

    await this.prisma.questionBugReport.delete({ where: { id } });
    return { id, deleted: true };
  }
}


