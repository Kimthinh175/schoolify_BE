import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { QuestionFormat } from '@prisma/client';
import { ExamsService } from './exams.service';
import { KnowledgeRoadmapService } from './knowledge-roadmap.service';
import { PrismaService } from '../../database/prisma.service';

function signTestJwt(payload: Record<string, any>): string {
  const secret = process.env.JWT_SECRET || 'schoolify_super_secret_key_2026_local';
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

describe('ExamsModule Security & Grading (Unit Tests)', () => {
  let service: ExamsService;
  let prisma: any;
  let roadmapService: any;

  const todayVn = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      studentProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
          id: where.id || 'sp-1',
          user_id: 'student-1',
          exam_points: 9,
          points: 0,
          last_daily_grant_date: todayVn,
          ...data,
        })),
      },
      question: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      examSubmission: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      examPointLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      studentPoolCursor: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      studentChapterProgress: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      studentSubjectDiagnostic: {
        findUnique: jest.fn(),
      },
    };

    roadmapService = {
      extractOutcomesFromSubmission: jest.fn().mockReturnValue([]),
      recordQuestionOutcomes: jest.fn().mockResolvedValue({ topicDeltas: [], nextRecommendedStep: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: KnowledgeRoadmapService, useValue: roadmapService },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
  });

  describe('Auth & Header Spoofing Prevention', () => {
    it('ignores spoofed x-user-role / x-user-id when JWT is absent', async () => {
      const req = {
        headers: {
          'x-user-id': 'victim-user',
          'x-user-role': 'SUPER_ADMIN',
        },
        cookies: {},
      };
      await expect(service.resolveAuthenticatedUser(req, false)).resolves.toBeNull();
      await expect(service.resolveAuthenticatedUser(req, true)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('uses authoritative DB role from verified JWT and rejects x-user-role escalation', async () => {
      const jwt = signTestJwt({
        sub: 'student-1',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'student-1',
        email: 'hs1@schoolify.top',
        fullname: 'Hoc Sinh 1',
        role: 'USER',
        student_profile: { id: 'sp-1' },
      });

      const resolved = await service.resolveAuthenticatedUser(
        {
          headers: {
            authorization: `Bearer ${jwt}`,
            'x-user-id': 'admin-victim',
            'x-user-role': 'SUPER_ADMIN',
          },
        },
        true,
      );

      expect(resolved?.id).toBe('student-1');
      expect(resolved?.role).toBe('USER');
    });
  });

  describe('Exam Points & Anti-Cheat Enforcement', () => {
    it('does NOT allow regular student to bypass point check with skipPointCheck=true', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: 'sp-zero',
        user_id: 'student-zero',
        exam_points: 0,
        points: 0,
        active_package: 'FREE',
        grade_level: 'Lớp 12',
        last_daily_grant_date: todayVn,
      });

      await expect(
        service.generateMatrixExam(
          'student-zero',
          {
            subject: 'toan-hoc',
            grade: 12,
            totalQuestions: 10,
            level: 'BASIC',
            skipPointCheck: true,
          } as any,
          'USER',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GDPT 2018 Multi-Format Grading & Anti-Cheat', () => {
    it('grades SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE (partial points), and SHORT_ANSWER accurately', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        user_id: 'student-1',
        exam_points: 9,
        points: 5,
        grade_level: 'Lớp 12',
        last_daily_grant_date: todayVn,
      });
      prisma.examSubmission.findUnique.mockResolvedValue(null);
      prisma.examSubmission.create.mockImplementation(async ({ data }: any) => ({
        id: 'sub-1',
        attempt_token: data.attempt_token,
        score: data.score,
        total_points: data.total_points,
        submitted_at: new Date(),
      }));

      prisma.question.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'q-mcq') {
          return {
            id: 'q-mcq',
            question_format: QuestionFormat.SINGLE_CHOICE,
            default_points: 1,
            answers: [
              { id: 'a1', sub_label: 'A', is_answer: true },
              { id: 'a2', sub_label: 'B', is_answer: false },
            ],
          };
        }
        if (where.id === 'q-multi') {
          return {
            id: 'q-multi',
            question_format: QuestionFormat.MULTI_CHOICE,
            default_points: 1,
            answers: [
              { id: 'm1', sub_label: 'A', is_answer: true },
              { id: 'm2', sub_label: 'B', is_answer: false },
              { id: 'm3', sub_label: 'C', is_answer: true },
            ],
          };
        }
        if (where.id === 'q-tf') {
          return {
            id: 'q-tf',
            question_format: QuestionFormat.TRUE_FALSE,
            default_points: 1,
            answers: [
              { id: 'tf1', sub_label: 'a', is_answer: true },
              { id: 'tf2', sub_label: 'b', is_answer: false },
              { id: 'tf3', sub_label: 'c', is_answer: true },
              { id: 'tf4', sub_label: 'd', is_answer: false },
            ],
          };
        }
        if (where.id === 'q-sa') {
          return {
            id: 'q-sa',
            question_format: QuestionFormat.SHORT_ANSWER,
            default_points: 1,
            answer: '42',
            answers: [],
          };
        }
        return null;
      });

      const result = await service.submitExam(
        'student-1',
        {
          examTitle: 'Đề kiểm tra hỗn hợp',
          subjectSlug: 'toan-hoc',
          grade: 12,
          timeSpentSeconds: 120,
          scoreOverride: 10, // Attempt cheat override by student
          answers: {
            multipleChoices: {
              'q-mcq': 'A', // +1.0
              'q-multi': 'A,C', // +1.0 (both correct)
            },
            trueFalseAnswers: {
              'q-tf': { a: true, b: false, c: true, d: true }, // 3/4 correct -> 0.5 pts
            },
            shortAnswers: {
              'q-sa': ' 42 ', // +1.0
            },
          },
          snapshotData: { totalQuestions: 4 },
        } as any,
        'USER',
      );

      // Total earned = 1 + 1 + 0.5 + 1 = 3.5 / 4.0 -> 8.75/10 (ignores student scoreOverride=10)
      expect(result.score).toBe(8.75);
    });

    it('does not auto-award 100% score or points for non-existent DB question IDs', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        user_id: 'student-1',
        exam_points: 9,
        points: 0,
        grade_level: 'Lớp 12',
        last_daily_grant_date: todayVn,
      });
      prisma.question.findUnique.mockResolvedValue(null);
      prisma.examSubmission.findUnique.mockResolvedValue(null);
      prisma.examSubmission.create.mockImplementation(async ({ data }: any) => ({
        id: 'sub-fake',
        attempt_token: data.attempt_token,
        score: data.score,
        total_points: 10,
        submitted_at: new Date(),
      }));

      const result = await service.submitExam(
        'student-1',
        {
          examTitle: 'Fake exam',
          answers: { multipleChoices: { 'fake-id-1': 'A', 'fake-id-2': 'B' } },
          scoreOverride: 10,
        } as any,
        'USER',
      );

      expect(result.score).toBe(0);
      expect(result.pointSettlement).toBeNull();
    });
  });

  describe('IDOR & History Access Control', () => {
    it('blocks non-owner student from reading another student snapshot (403 Forbidden)', async () => {
      prisma.examSubmission.findFirst.mockResolvedValueOnce({
        id: 'sub-victim',
        attempt_token: 'att_abc123',
        student_id: 'sp-victim',
        exam_title: 'Đề Toán 12',
        score: 9.5,
        total_points: 10,
        time_spent_seconds: 300,
        submitted_at: new Date(),
        snapshot_data: {},
        student: { user_id: 'user-victim', user: { fullname: 'Victim' } },
      });

      await expect(
        service.getSnapshotById('sub-victim', {
          id: 'user-attacker',
          role: 'USER',
          schoolRoles: ['USER'],
          isTeacher: false,
          isParent: false,
          linkedStudentIds: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns empty list from getPracticeHistory when unauthenticated instead of querying all users', async () => {
      const res = await service.getPracticeHistory(null, 1, 10);
      expect(res.items).toEqual([]);
      expect(res.pagination.totalItems).toBe(0);
      expect(prisma.examSubmission.findMany).not.toHaveBeenCalled();
    });
  });
});
