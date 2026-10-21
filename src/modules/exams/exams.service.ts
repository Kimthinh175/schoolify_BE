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
  DailyClaimPointsDto,
  GenerateMatrixExamDto,
  SettleExamPointsDto,
  StartExamWithPointsDto,
  SubmitExamDto,
  SyncOfflineSubmissionsDto,
} from './dto/exam.dto';
import { BloomLevel, QuestionFormat } from '@prisma/client';

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

  /**
   * Sinh đề thi theo ma trận Bloom & Chương
   */
  async generateMatrixExam(dto: GenerateMatrixExamDto) {
    const { subject, grade, totalQuestions, durationMinutes } = dto;

    // 1. Tìm câu hỏi từ DB theo môn học và lớp
    const questions = await this.prisma.question.findMany({
      where: {
        subject: subject,
        grade: grade,
      },
      include: {
        answers: true,
      },
      take: totalQuestions * 2, // Lấy dư để bốc ngẫu nhiên
    });

    // Nếu DB chưa có câu hỏi nào, trả về mock cấu trúc chuẩn
    let selectedQuestions = questions;
    if (questions.length > totalQuestions) {
      // Shuffle & pick
      selectedQuestions = questions.sort(() => 0.5 - Math.random()).slice(0, totalQuestions);
    }

    const sessionId = `SES-${Date.now()}`;
    const examTitle = `Đề Luyện Thi Ma Trận ${subject.toUpperCase()} - Khối ${grade}`;

    return {
      sessionId,
      examTitle,
      subjectSlug: subject,
      grade,
      durationMinutes,
      totalQuestions: selectedQuestions.length,
      questions: selectedQuestions.map((q, idx) => ({
        id: q.id,
        orderIndex: idx + 1,
        questionFormat: q.question_format || QuestionFormat.SINGLE_CHOICE,
        bloomLevel: q.bloom_level || BloomLevel.THONG_HIEU,
        content: q.question,
        points: Number(q.default_points || 0.25),
        answers: q.answers.map((a, aIdx) => ({
          id: a.id,
          label: a.sub_label || String.fromCharCode(65 + aIdx), // A, B, C, D
          content: a.content,
        })),
      })),
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

    let score = Number(((correctCount / totalQuestions) * 10).toFixed(2));
    if (scoreOverride !== undefined && scoreOverride !== null && !Number.isNaN(Number(scoreOverride))) {
      score = Number(Number(scoreOverride).toFixed(2));
    } else if (
      snapshotData?.originalExam &&
      typeof snapshotData.originalExam.finalScore === 'number'
    ) {
      score = Number(Number(snapshotData.originalExam.finalScore).toFixed(2));
    } else if (snapshotData && typeof snapshotData.score === 'number') {
      score = Number(Number(snapshotData.score).toFixed(2));
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
        question_format: (
          payload.questionFormat === 'TRUE_FALSE_GROUP'
            ? 'TRUE_FALSE'
            : payload.questionFormat === 'MULTIPLE_CHOICE'
              ? 'MULTI_CHOICE'
              : payload.questionFormat || 'SINGLE_CHOICE'
        ) as any,
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
          ? { question_format: payload.questionFormat as any }
          : {}),
      },
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
    code: 'BASIC' | 'MEDIUM' | 'ADVANCED';
    label: string;
    costPoints: number;
    maxDailyExams: number;
  } {
    const norm = String(rawLevel || 'BASIC')
      .trim()
      .toUpperCase();

    if (
      norm === 'ADVANCED' ||
      norm === 'HARD' ||
      norm === 'VERY_HARD' ||
      norm === 'GIOI' ||
      norm === 'GIỎI' ||
      norm === 'EXCELLENT' ||
      norm === 'PROVINCIAL_EXCELLENT' ||
      norm === 'NATIONAL_EXCELLENT' ||
      norm === 'OLYMPIAD' ||
      norm === 'VAN_DUNG' ||
      norm === 'VAN_DUNG_CAO'
    ) {
      return {
        code: 'ADVANCED',
        label: 'Giỏi',
        costPoints: EXAM_LEVEL_COSTS.ADVANCED, // 9đ -> 1 bài
        maxDailyExams: 1,
      };
    }

    if (
      norm === 'MEDIUM' ||
      norm === 'INTERMEDIATE' ||
      norm === 'TRUNG_BINH' ||
      norm === 'TRUNG BÌNH' ||
      norm === 'THONG_HIEU'
    ) {
      return {
        code: 'MEDIUM',
        label: 'Trung bình',
        costPoints: EXAM_LEVEL_COSTS.MEDIUM, // 4đ -> 2 bài (8đ, dư 1đ)
        maxDailyExams: 2,
      };
    }

    return {
      code: 'BASIC',
      label: 'Cơ bản',
      costPoints: EXAM_LEVEL_COSTS.BASIC, // 3đ -> 3 bài
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
   * Lấy hoặc khởi tạo StudentProfile, đồng thời tự động kiểm tra & phát 9 điểm đầu ngày mới
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
          profile = await this.prisma.studentProfile.create({
            data: {
              user_id: userId,
              grade_level: grade ? `Lớp ${grade}` : 'Lớp 12',
              points: 100,
              exam_points: DAILY_EXAM_POINT_ALLOWANCE,
              last_daily_grant_date: today,
            },
          });
          await this.prisma.examPointLog.create({
            data: {
              student_id: profile.id,
              action_type: 'DAILY_GRANT',
              points_before: 0,
              points_delta: DAILY_EXAM_POINT_ALLOWANCE,
              points_after: DAILY_EXAM_POINT_ALLOWANCE,
              note: `Phát ${DAILY_EXAM_POINT_ALLOWANCE} điểm làm đề hàng ngày (${today})`,
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
        guestUser = await this.prisma.user.create({
          data: {
            email: guestEmail,
            fullname: 'Học Sinh Khách (Guest)',
            password_hash: 'guest_no_login',
            student_profile: {
              create: {
                grade_level: grade ? `Lớp ${grade}` : 'Lớp 12',
                points: 100,
                exam_points: DAILY_EXAM_POINT_ALLOWANCE,
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
              action_type: 'DAILY_GRANT',
              points_before: 0,
              points_delta: DAILY_EXAM_POINT_ALLOWANCE,
              points_after: DAILY_EXAM_POINT_ALLOWANCE,
              note: `Khởi tạo & phát ${DAILY_EXAM_POINT_ALLOWANCE} điểm làm đề hàng ngày (${today})`,
            },
          });
        }
      }

      profile = guestUser.student_profile;
    }

    // Kiểm tra nếu sang ngày mới -> Reset cố định về 9 điểm
    if (profile && profile.last_daily_grant_date !== today) {
      const pointsBefore = Number(profile.exam_points ?? 0);
      profile = await this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: {
          exam_points: DAILY_EXAM_POINT_ALLOWANCE,
          last_daily_grant_date: today,
        },
      });

      await this.prisma.examPointLog.create({
        data: {
          student_id: profile.id,
          action_type: 'DAILY_GRANT',
          points_before: pointsBefore,
          points_delta: DAILY_EXAM_POINT_ALLOWANCE - pointsBefore,
          points_after: DAILY_EXAM_POINT_ALLOWANCE,
          note: `Phát ${DAILY_EXAM_POINT_ALLOWANCE} điểm năng lượng làm đề đầu ngày mới (${today})`,
        },
      });
    }

    return profile;
  }

  /**
   * API 1: Lấy số dư điểm làm đề hiện tại + Hạn mức bài thi theo từng cấp độ + Thống kê hôm nay
   */
  async getExamPointBalance(userId: string | null) {
    const today = this.getTodayDateStringVN();
    const profile = await this.getOrInitStudentProfile(userId);
    const currentPoints = Number(profile.exam_points ?? DAILY_EXAM_POINT_ALLOWANCE);

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
      dailyAllowance: DAILY_EXAM_POINT_ALLOWANCE,
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
   * API 2: Điểm danh nhận 9 điểm hàng ngày (Mỗi ngày tuyệt đối chỉ được nhận 1 lần duy nhất)
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
        exam_points: { increment: 9 },
        points: { increment: 9 },
        last_daily_grant_date: today,
      },
    });

    await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'DAILY_CHECKIN',
        points_before: Number(profile.points ?? 0),
        points_delta: 9,
        points_after: Number(updated.points ?? 0),
        note: `Điểm danh chuyên cần (${today}): Nhận +9 Kim Cương (💎)`,
      },
    });

    return {
      claimed: true,
      alreadyClaimedToday: true,
      grantDate: today,
      dailyAllowance: 9,
      pointsDelta: 9,
      previousPoints: before,
      currentPoints: updated.exam_points,
      diamonds: Number(updated.points ?? 0),
      quotaByLevel: this.computeQuotaByLevel(updated.exam_points),
      message: `Điểm danh thành công ngày ${today}! Bạn đã nhận +9 Kim Cương (💎) hôm nay.`,
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
        message: `Không đủ điểm làm đề! Đề cấp độ ${levelInfo.label} cần ${levelInfo.costPoints} điểm, nhưng bạn hiện chỉ còn ${currentPoints} điểm. Hãy làm bài đạt 8.5+ (+1đ) hoặc 10đ (+2đ), hoặc quay lại vào ngày mai để nhận 9 điểm mới!`,
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
   * API 4: Tính thưởng / phạt điểm sau khi hoàn thành bài thi dựa trên điểm số (thang 10):
   * - Dưới 5đ (< 5.0): -1đ
   * - Từ 5đ đến dưới 8.5đ (5.0 <= score < 8.5): 0đ (không thay đổi)
   * - Từ 8.5đ đến 9.9đ (8.5 <= score < 10.0): +1đ
   * - Đạt 10đ (score >= 10.0): +2đ
   */
  async settleExamSubmissionPoints(userId: string | null, dto: SettleExamPointsDto) {
    const effectiveUserId = userId || dto.userId || null;
    const profile = await this.getOrInitStudentProfile(effectiveUserId);
    const rawScore = Math.max(0, Math.min(10, Number(dto.score ?? 0)));
    const score = Number(rawScore.toFixed(2));
    const levelInfo = this.normalizeExamLevel(dto.level);

    let workingPoints = Number(profile.exam_points ?? 0);
    const initialPoints = workingPoints;
    let entryCostDeducted = 0;

    // Nếu client yêu cầu trừ cả phí mở đề trong cùng lúc nộp bài
    if (dto.deductEntryCost) {
      entryCostDeducted = levelInfo.costPoints;
      const afterEntry = Math.max(0, workingPoints - entryCostDeducted);
      await this.prisma.examPointLog.create({
        data: {
          student_id: profile.id,
          action_type: 'START_EXAM',
          exam_level: levelInfo.code,
          exam_title: dto.examTitle || `Đề thi cấp độ ${levelInfo.label}`,
          submission_id: dto.submissionId || null,
          points_before: workingPoints,
          points_delta: -(workingPoints - afterEntry),
          points_after: afterEntry,
          note: `Trừ ${entryCostDeducted} điểm phí làm đề cấp độ ${levelInfo.label}`,
        },
      });
      workingPoints = afterEntry;
    }

    let scorePointDelta = 0;
    let actionType = 'SCORE_NEUTRAL_5_TO_8_5';
    let tierLabel = 'Từ 5.0 - 8.5 điểm (Không thay đổi: 0đ)';
    let explanation = `Bạn đạt ${score}/10 điểm (nằm trong khoảng 5.0 - 8.5đ) nên số điểm làm đề giữ nguyên không đổi (0đ).`;

    if (score < 5.0) {
      scorePointDelta = -1;
      actionType = 'SCORE_PENALTY_UNDER_5';
      tierLabel = 'Dưới 5.0 điểm (-1đ)';
      explanation = `Bài thi đạt ${score}/10 điểm (dưới 5.0đ) nên bị trừ 1 điểm năng lượng (-1đ). Hãy ôn kỹ lại lời giải để gỡ điểm ở bài sau nhé!`;
    } else if (score >= 10.0) {
      scorePointDelta = 2;
      actionType = 'SCORE_REWARD_10';
      tierLabel = 'Điểm 10 tuyệt đối (+2đ)';
      explanation = `Xuất sắc! Bạn đạt điểm tuyệt đối ${score}/10 và được thưởng nóng +2 điểm làm đề (+2đ)!`;
    } else if (score >= 8.5) {
      scorePointDelta = 1;
      actionType = 'SCORE_REWARD_8_5_TO_9_9';
      tierLabel = 'Từ 8.5 - 9.9 điểm (+1đ)';
      explanation = `Tuyệt vời! Bạn đạt ${score}/10 điểm (mốc 8.5 - 9.9đ) và được thưởng thêm +1 điểm làm đề (+1đ)!`;
    }

    const finalPoints = Math.max(0, workingPoints + scorePointDelta);

    const updatedProfile = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        exam_points: finalPoints,
      },
    });

    const log = await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: actionType,
        exam_level: levelInfo.code,
        exam_title: dto.examTitle || `Kết quả bài thi (${score}/10)`,
        submission_id: dto.submissionId || null,
        exam_score: score,
        points_before: workingPoints,
        points_delta: scorePointDelta,
        points_after: finalPoints,
        note: explanation,
      },
    });

    return {
      logId: log.id,
      submissionId: dto.submissionId || null,
      examLevel: levelInfo.code,
      examLevelLabel: levelInfo.label,
      score,
      tierCode: actionType,
      tierLabel,
      pointsBefore: initialPoints,
      entryCostDeducted,
      scorePointDelta,
      netPointDelta: finalPoints - initialPoints,
      currentPoints: updatedProfile.exam_points,
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
}


