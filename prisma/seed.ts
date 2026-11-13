/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import {
  PrismaClient,
  BloomLevel,
  QuestionFormat,
  QuestionType,
  SystemRole,
  ForumPostStatus,
  ForumCommentStatus,
  ForumTargetType,
  ForumReactionType,
  ForumReportReason,
  ForumReportStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DIFFICULTY_MAP: Record<string, BloomLevel> = {
  EASY: BloomLevel.NHAN_BIET,
  MEDIUM: BloomLevel.THONG_HIEU,
  HARD: BloomLevel.VAN_DUNG,
  VERY_HARD: BloomLevel.VAN_DUNG_CAO,
};

async function seedDefaultUsers() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcrypt');
  console.log(
    '👤 Đang khởi tạo các tài khoản chuẩn (Admin, Giảng viên, Học sinh)...',
  );
  const passwordHash = await bcrypt.hash('123456', 10);

  for (const adminInfo of [
    {
      email: 'admin@schoolify.top',
      fullname: 'Kim Thịnh (Super Admin)',
      phone: '0901000001',
    },
    {
      email: 'thinh@schoolify.edu.vn',
      fullname: 'Kim Thịnh',
      phone: '0901000002',
    },
  ]) {
    await prisma.user.upsert({
      where: { email: adminInfo.email },
      update: { role: SystemRole.SUPER_ADMIN, status: true },
      create: {
        email: adminInfo.email,
        fullname: adminInfo.fullname,
        phone: adminInfo.phone,
        password_hash: passwordHash,
        role: SystemRole.SUPER_ADMIN,
        status: true,
      },
    });
  }

  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher.nguyen@schoolify.edu.vn' },
    update: { status: true },
    create: {
      email: 'teacher.nguyen@schoolify.edu.vn',
      fullname: 'ThS. Nguyễn Văn Hùng',
      phone: '0902000001',
      password_hash: passwordHash,
      role: SystemRole.USER,
      status: true,
    },
  });
  await prisma.teacherProfile.upsert({
    where: { user_id: teacherUser.id },
    update: {},
    create: {
      user_id: teacherUser.id,
      bio: 'Giảng viên Toán & Luyện thi THPT Quốc gia 10 năm kinh nghiệm.',
      expertise: 'Toán học THPT & ĐGNL',
      experience_years: 10,
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'student.minh@schoolify.edu.vn' },
    update: { status: true },
    create: {
      email: 'student.minh@schoolify.edu.vn',
      fullname: 'Nguyễn Hoàng Minh',
      phone: '0987654321',
      password_hash: passwordHash,
      role: SystemRole.USER,
      status: true,
    },
  });
  await prisma.studentProfile.upsert({
    where: { user_id: studentUser.id },
    update: {},
    create: {
      user_id: studentUser.id,
      grade_level: 'Lớp 12',
      points: 250,
      exam_points: 9,
    },
  });

  console.log('✅ Đã khởi tạo xong tài khoản chuẩn (Mật khẩu: 123456)');
  return { teacherUser, studentUser };
}

async function seedForumData(teacherUserId: string, studentUserId: string) {
  const existingPosts = await prisma.forumPost.count();
  if (existingPosts > 0) {
    console.log(`✅ Diễn đàn đã có sẵn ${existingPosts} bài thảo luận.`);
    return;
  }

  console.log(
    '💬 Đang khởi tạo dữ liệu mẫu Diễn Đàn (ForumPost, ForumComment 2 cấp, ForumReaction, ForumReport)...',
  );

  const post = await prisma.forumPost.create({
    data: {
      author_id: studentUserId,
      title:
        'Hỏi bài Toán 12: Tìm m để hàm số bậc ba đồng biến trên khoảng (0; +∞)',
      slug: 'hoi-bai-toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
      content:
        'Em đang làm bài tập khảo sát hàm số Chương 1: $y = x^3 - 3mx^2 + 3(2m-1)x + 1$. Thầy cô và các bạn cho em hỏi trường hợp cô lập $m$ hay dùng tam thức bậc hai thì nhanh hơn ạ?',
      subject: 'Toán Học',
      grade: 12,
      tags: ['Đạo hàm', 'Đơn điệu', 'Lớp 12'],
      views_count: 120,
      likes_count: 2,
      comments_count: 2,
      is_solved: true,
      status: ForumPostStatus.PUBLISHED,
    },
  });

  // Bình luận gốc (Cấp 1 - depth = 1, parent_id = null)
  const rootComment = await prisma.forumComment.create({
    data: {
      post_id: post.id,
      author_id: teacherUserId,
      parent_id: null,
      depth: 1,
      content:
        "Với bài này, hệ số của $m$ trong $y' = 3x^2 - 6mx + 3(2m-1)$ là bậc nhất theo $m$, nên em dùng phương pháp cô lập $m$: $y' \\ge 0 \\iff 2m(x - 1) \\le x^2 - 1$ sẽ nhanh và ít nhầm dấu hơn nhé!",
      likes_count: 1,
      replies_count: 1,
      is_accepted: true,
      status: ForumCommentStatus.ACTIVE,
    },
  });

  // Trả lời lồng (Cấp 2 - depth = 2, parent_id = rootComment.id)
  const nestedReply = await prisma.forumComment.create({
    data: {
      post_id: post.id,
      author_id: studentUserId,
      parent_id: rootComment.id,
      reply_to_user_id: teacherUserId,
      depth: 2,
      content:
        'Dạ em hiểu rồi ạ! Xét tại $x = 1$ thì bất phương trình luôn đúng với mọi $m$, sau đó chia 2 khoảng $(0; 1)$ và $(1; +\\infty)$ là ra ngay $m = 1$. Em cảm ơn thầy nhiều ạ!',
      likes_count: 1,
      replies_count: 0,
      status: ForumCommentStatus.ACTIVE,
    },
  });

  await prisma.forumPost.update({
    where: { id: post.id },
    data: { accepted_comment_id: rootComment.id },
  });

  // Tương tác cảm xúc (ForumReaction cho cả bài viết và bình luận)
  await prisma.forumReaction.createMany({
    data: [
      {
        user_id: teacherUserId,
        target_type: ForumTargetType.POST,
        post_id: post.id,
        reaction_type: ForumReactionType.LIKE,
      },
      {
        user_id: studentUserId,
        target_type: ForumTargetType.COMMENT,
        comment_id: rootComment.id,
        reaction_type: ForumReactionType.HELPFUL,
      },
      {
        user_id: teacherUserId,
        target_type: ForumTargetType.COMMENT,
        comment_id: nestedReply.id,
        reaction_type: ForumReactionType.LOVE,
      },
    ],
  });

  // Báo cáo kiểm duyệt mẫu (ForumReport)
  await prisma.forumReport.create({
    data: {
      reporter_id: studentUserId,
      target_type: ForumTargetType.COMMENT,
      post_id: post.id,
      comment_id: nestedReply.id,
      reason: ForumReportReason.OTHER,
      description: 'Báo cáo thử nghiệm luồng kiểm duyệt bình luận diễn đàn.',
      status: ForumReportStatus.RESOLVED,
      resolved_by_id: teacherUserId,
      admin_note: 'Nội dung hợp lệ, đóng báo cáo thử nghiệm.',
      moderation_action: 'NONE',
      resolved_at: new Date(),
    },
  });

  console.log('✅ Đã khởi tạo xong dữ liệu mẫu Diễn Đàn!');
}

async function main() {
  const { teacherUser, studentUser } = await seedDefaultUsers();
  await seedForumData(teacherUser.id, studentUser.id);
  const existingQCount = await prisma.question.count();
  if (existingQCount >= 580) {
    console.log(`✅ Ngân hàng đề đã có sẵn ${existingQCount} câu hỏi.`);
    return;
  }
  console.log('🌱 Bắt đầu nạp dữ liệu câu hỏi GDPT 2025 vào PostgreSQL...');

  const candidatePaths = [
    path.resolve(__dirname, '../../schoolify_FE/src/data/questions-db.json'),
    path.resolve(__dirname, '../../FE/src/data/questions-db.json'),
  ];
  const dataPath =
    candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Không tìm thấy file dữ liệu câu hỏi tại: ${dataPath}`);
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const questions: any[] = JSON.parse(rawData);
  console.log(`📦 Tìm thấy ${questions.length} câu hỏi từ questions-db.json`);

  let count = 0;
  for (const q of questions) {
    const bloom = DIFFICULTY_MAP[q.difficulty] || BloomLevel.THONG_HIEU;

    let qFormat: QuestionFormat = QuestionFormat.SINGLE_CHOICE;
    let qType: QuestionType = QuestionType.MULTIPLE_CHOICE;

    if (q.type === 'TRUE_FALSE') {
      qFormat = QuestionFormat.TRUE_FALSE;
      qType = QuestionType.TRUE_FALSE;
    } else if (q.type === 'SHORT_ANSWER') {
      qFormat = QuestionFormat.SHORT_ANSWER;
      qType = QuestionType.SINGLE_CHOICE;
    } else if (q.type === 'ESSAY') {
      qFormat = QuestionFormat.ESSAY;
      qType = QuestionType.ESSAY;
    }

    const shortAns =
      q.shortAnswerCorrect !== undefined && q.shortAnswerCorrect !== null
        ? String(q.shortAnswerCorrect)
        : null;

    // Upsert Question
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        chapter_id: q.chapterId || 1,
        subject: q.subjectSlug || 'toan-hoc',
        grade: q.grade || 12,
        bloom_level: bloom,
        question_format: qFormat,
        type: qType,
        title: q.title || '',
        question: q.content || '',
        default_points: q.score || 0.25,
        explanation: q.explanation || null,
        answer: shortAns,
      },
      create: {
        id: q.id,
        chapter_id: q.chapterId || 1,
        subject: q.subjectSlug || 'toan-hoc',
        grade: q.grade || 12,
        bloom_level: bloom,
        question_format: qFormat,
        type: qType,
        title: q.title || '',
        question: q.content || '',
        default_points: q.score || 0.25,
        explanation: q.explanation || null,
        answer: shortAns,
      },
    });

    // Reset old answers if any
    await prisma.answer.deleteMany({
      where: { question_id: q.id },
    });

    // Handle Multiple Choice choices
    if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.choices)) {
      for (const choice of q.choices) {
        await prisma.answer.create({
          data: {
            question_id: q.id,
            content: choice.content || '',
            sub_label: choice.key || '',
            is_answer: choice.key === q.correctChoice,
          },
        });
      }
    }

    // Handle True / False statements
    if (q.type === 'TRUE_FALSE' && Array.isArray(q.statements)) {
      for (const st of q.statements) {
        await prisma.answer.create({
          data: {
            question_id: q.id,
            content: st.statement || '',
            sub_label: st.subId || '',
            is_answer: Boolean(st.isCorrect),
            explain: st.explanation || null,
          },
        });
      }
    }

    count++;
    if (count % 100 === 0) {
      console.log(`  -> Đã nạp ${count}/${questions.length} câu hỏi...`);
    }
  }

  console.log(`✅ Hoàn thành nạp ${count} câu hỏi vào PostgreSQL!`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed câu hỏi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
