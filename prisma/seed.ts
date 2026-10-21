import { PrismaClient, BloomLevel, QuestionFormat, QuestionType, SystemRole } from '@prisma/client';
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
  console.log('👤 Đang khởi tạo các tài khoản chuẩn (Admin, Giảng viên, Học sinh)...');
  const passwordHash = await bcrypt.hash('123456', 10);

  for (const adminInfo of [
    { email: 'admin@schoolify.top', fullname: 'Kim Thịnh (Super Admin)', phone: '0901000001' },
    { email: 'thinh@schoolify.edu.vn', fullname: 'Kim Thịnh', phone: '0901000002' },
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
}

async function main() {
  await seedDefaultUsers();
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
  const dataPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
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

    const shortAns = q.shortAnswerCorrect !== undefined && q.shortAnswerCorrect !== null
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
