import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GenerateMatrixExamDto, SubmitExamDto, SyncOfflineSubmissionsDto } from './dto/exam.dto';
import { BloomLevel, QuestionFormat } from '@prisma/client';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh đề thi theo ma trận Bloom & Chương
   */
  async generateMatrixExam(dto: GenerateMatrixExamDto) {
    const { subject, grade, totalQuestions, durationMinutes, chapters, bloomRatio } = dto;

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
   * Nộp bài thi, chấm điểm và lưu ExamSubmission kèm snapshot_data
   */
  async submitExam(userId: string | null, dto: SubmitExamDto) {
    const { sessionId, examId, examTitle, subjectSlug, grade, chapterId, timeSpentSeconds, answers, snapshotData } = dto;

    // Lấy hoặc tạo mock student_profile nếu chưa có
    let studentProfileId: string;
    if (userId) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { user_id: userId },
      });
      if (student) {
        studentProfileId = student.id;
      } else {
        // Tạo profile nhanh
        const newProfile = await this.prisma.studentProfile.create({
          data: {
            user_id: userId,
            grade_level: grade ? `Lớp ${grade}` : 'Lớp 12',
            points: 0,
          },
        });
        studentProfileId = newProfile.id;
      }
    } else {
      // Guest submission -> tìm hoặc tạo 1 guest user mặc định
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
                points: 0,
              },
            },
          },
          include: { student_profile: true },
        });
      }
      studentProfileId = guestUser.student_profile?.id || '';
    }

    // Chấm điểm sơ bộ
    let correctCount = 0;
    let wrongCount = 0;
    const details: any[] = [];

    // Chấm trắc nghiệm Multiple Choice
    const mcAnswers = answers.multipleChoices || {};
    for (const [qId, ansId] of Object.entries(mcAnswers)) {
      const question = await this.prisma.question.findUnique({
        where: { id: qId },
        include: { answers: true },
      });

      if (question) {
        const correctAns = question.answers.find((a) => a.is_answer);
        const isCorrect = correctAns?.id === ansId;
        if (isCorrect) correctCount++;
        else wrongCount++;

        details.push({
          questionId: qId,
          isCorrect,
          pointsEarned: isCorrect ? Number(question.default_points || 0.25) : 0,
          selectedAnswerId: ansId,
          explanation: question.explanation,
        });
      }
    }

    const totalQuestions = Math.max(1, correctCount + wrongCount);
    const score = Number(((correctCount / totalQuestions) * 10).toFixed(2));

    // Lưu vào database
    const submission = await this.prisma.examSubmission.create({
      data: {
        student_id: studentProfileId,
        exam_title: examTitle || `Bài thi ${subjectSlug || 'Toán'} Lớp ${grade || 12}`,
        score: score,
        total_points: 10.0,
        time_spent_seconds: timeSpentSeconds,
        submitted_at: new Date(),
        status: 'SUBMITTED',
        snapshot_data: snapshotData || {
          sessionId,
          examId,
          answers,
          score,
          correctCount,
          wrongCount,
          timeSpentSeconds,
        },
      },
    });

    return {
      submissionId: submission.id,
      score,
      maxScore: 10.0,
      correctCount,
      wrongCount,
      totalQuestions,
      details,
    };
  }

  /**
   * Lấy chi tiết bài thi đã làm (Snapshot)
   */
  async getSnapshotById(id: string) {
    const submission = await this.prisma.examSubmission.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài thi với ID: ${id}`);
    }

    return {
      id: submission.id,
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
   * Lấy lịch sử làm bài của học sinh
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
        examTitle: s.exam_title,
        score: Number(s.score),
        timeSpentSeconds: s.time_spent_seconds,
        submittedAt: s.submitted_at,
        status: s.status,
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
}
