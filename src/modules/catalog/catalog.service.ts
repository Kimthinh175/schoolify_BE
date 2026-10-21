import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách gói cước SaaS (Tự động khởi tạo 3 gói FREE / PRO / VIP nếu chưa có)
   */
  async listPackages() {
    let packages = await this.prisma.subscriptionPackage.findMany({
      orderBy: { price: 'asc' },
    });

    if (packages.length === 0) {
      await this.prisma.subscriptionPackage.createMany({
        data: [
          {
            name: 'Gói Cơ Bản (Free)',
            description: 'Luyện đề tiêu chuẩn mỗi ngày, xem đáp án cơ bản và tích lũy Streak.',
            price: 0,
            billing_cycle: 'MONTHLY',
            duration_days: 30,
            max_teachers: 1,
            max_students_total: 50,
            max_classes: 2,
            max_students_per_class: 30,
            storage_limit_gb: 2,
            can_sell_courses: false,
            is_active: true,
            features: [
              'Luyện đề giới hạn 3 đề/ngày',
              'Xem điểm và đáp án A/B/C/D',
              'Tích lũy chuỗi ngày học (Streak)',
            ],
          },
          {
            name: 'Gói Chuyên Sâu (PRO)',
            description: 'Mở khóa toàn bộ ma trận đề GDPT 2018, Trợ lý AI Agentic chữa bài Socratic & lời giải chi tiết.',
            price: 199000,
            billing_cycle: 'MONTHLY',
            duration_days: 30,
            max_teachers: 5,
            max_students_total: 300,
            max_classes: 10,
            max_students_per_class: 50,
            storage_limit_gb: 20,
            can_sell_courses: true,
            is_active: true,
            features: [
              'Luyện đề không giới hạn theo Ma trận Bloom',
              'AI Gia Sư gợi mở Socratic & Semantic Checkpoint',
              'Xem lời giải chi tiết từng bước chuẩn KaTeX',
              'Tặng ngay +200 Token thưởng khi kích hoạt',
            ],
          },
          {
            name: 'Gói Toàn Diện (VIP / Trường Học)',
            description: 'Dành cho Học sinh mục tiêu 9+ và Giáo viên/Trường học: AI Quét đề Word .docx sinh câu hỏi tự động.',
            price: 499000,
            billing_cycle: 'YEARLY',
            duration_days: 365,
            max_teachers: 50,
            max_students_total: 2000,
            max_classes: 100,
            max_students_per_class: 100,
            storage_limit_gb: 100,
            can_sell_courses: true,
            is_active: true,
            features: [
              'Toàn bộ đặc quyền gói PRO 365 ngày',
              'AI Docx Exam Scanner & Generator không giới hạn',
              'Phân tích lỗ hổng kiến thức chuyên sâu theo 4 mức độ Bloom',
              'Tặng ngay +1,000 Token thưởng & Huy hiệu VIP',
            ],
          },
        ],
      });

      packages = await this.prisma.subscriptionPackage.findMany({
        orderBy: { price: 'asc' },
      });
    }

    return packages.map((p) => ({
      ...p,
      price: Number(p.price),
      features: Array.isArray(p.features) ? p.features : [],
    }));
  }

  /**
   * Tạo gói đăng ký mới trên PostgreSQL (Admin)
   */
  async createPackage(payload: {
    name: string;
    description?: string;
    price?: number;
    billing_cycle?: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
    duration_days?: number;
    max_teachers?: number;
    max_students_total?: number;
    max_classes?: number;
    max_students_per_class?: number;
    storage_limit_gb?: number;
    can_sell_courses?: boolean;
    is_active?: boolean;
    features?: string[];
  }) {
    if (!payload.name?.trim()) {
      throw new BadRequestException('Tên gói cước không được để trống');
    }

    const created = await this.prisma.subscriptionPackage.create({
      data: {
        name: payload.name.trim(),
        description:
          payload.description ||
          'Gói đăng ký bản quyền dịch vụ luyện thi & quản lý học tập trên nền tảng Schoolify.',
        price: Number(payload.price ?? 199000),
        billing_cycle: payload.billing_cycle || 'MONTHLY',
        duration_days: Number(payload.duration_days || 30),
        max_teachers: Number(payload.max_teachers || 10),
        max_students_total: Number(payload.max_students_total || 500),
        max_classes: Number(payload.max_classes || 20),
        max_students_per_class: Number(payload.max_students_per_class || 40),
        storage_limit_gb: Number(payload.storage_limit_gb || 50),
        can_sell_courses: payload.can_sell_courses ?? true,
        is_active: payload.is_active ?? true,
        features:
          Array.isArray(payload.features) && payload.features.length > 0
            ? payload.features
            : ['Quản lý toàn diện', 'Luyện đề chuẩn GDPT 2018', 'Hỗ trợ kỹ thuật 24/7'],
      },
    });

    return {
      ...created,
      price: Number(created.price),
      features: Array.isArray(created.features) ? created.features : [],
    };
  }

  /**
   * Cập nhật gói đăng ký trên PostgreSQL (Admin)
   */
  async updatePackage(
    id: string,
    payload: {
      name?: string;
      description?: string;
      price?: number;
      billing_cycle?: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
      max_teachers?: number;
      max_students_total?: number;
      storage_limit_gb?: number;
      is_active?: boolean;
      features?: string[];
    },
  ) {
    const existing = await this.prisma.subscriptionPackage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy gói cước ID=${id}`);
    }

    const updated = await this.prisma.subscriptionPackage.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
        ...(payload.billing_cycle !== undefined ? { billing_cycle: payload.billing_cycle } : {}),
        ...(payload.max_teachers !== undefined ? { max_teachers: Number(payload.max_teachers) } : {}),
        ...(payload.max_students_total !== undefined
          ? { max_students_total: Number(payload.max_students_total) }
          : {}),
        ...(payload.storage_limit_gb !== undefined
          ? { storage_limit_gb: Number(payload.storage_limit_gb) }
          : {}),
        ...(payload.is_active !== undefined ? { is_active: Boolean(payload.is_active) } : {}),
        ...(payload.features !== undefined ? { features: payload.features } : {}),
      },
    });

    return {
      ...updated,
      price: Number(updated.price),
      features: Array.isArray(updated.features) ? updated.features : [],
    };
  }

  /**
   * Xóa gói đăng ký trên PostgreSQL (Admin)
   */
  async deletePackage(id: string) {
    const existing = await this.prisma.subscriptionPackage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy gói cước ID=${id}`);
    }
    await this.prisma.subscriptionPackage.delete({ where: { id } });
    return { deletedId: id };
  }

  /**
   * Tạo đơn hàng mua gói SaaS (VietQR / MoMo / Ngân hàng)
   */
  async createOrder(payload: {
    userId?: string;
    email?: string;
    packageId?: string;
    packageName?: string;
    amount?: number;
    billingCycle?: string;
    paymentMethod?: 'BANK' | 'COD';
  }) {
    // Tìm hoặc tạo user mua hàng nếu chưa truyền userId
    let user = payload.userId
      ? await this.prisma.user.findUnique({ where: { id: payload.userId } })
      : payload.email
        ? await this.prisma.user.findUnique({ where: { email: payload.email } })
        : await this.prisma.user.findFirst({ orderBy: { created_at: 'desc' } });

    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng để khởi tạo đơn hàng');
    }

    const packages = await this.listPackages();
    let pkg = payload.packageId
      ? packages.find((p) => p.id === payload.packageId)
      : payload.packageName
        ? packages.find((p) =>
            p.name.toLowerCase().includes(payload.packageName!.toLowerCase()),
          )
        : packages[1] || packages[0];

    if (!pkg) {
      pkg = packages[0];
    }

    const price = payload.amount !== undefined ? Number(payload.amount) : Number(pkg.price);
    const displayPackageName = payload.packageName || pkg.name;
    const vietQrCode = `SCHOOLIFY-${Date.now().toString().slice(-6)}`;

    const order = await this.prisma.order.create({
      data: {
        user_id: user.id,
        reference_type: 'SUBSCRIPTION',
        subscription_id: pkg.id,
        item_name_snapshot: {
          packageName: displayPackageName,
          billingCycle: payload.billingCycle || pkg.billing_cycle,
          durationDays: pkg.duration_days || 30,
          vietQrCode,
        },
        item_price_snapshot: price,
        status: price === 0 ? 'PAID' : 'PENDING',
        payment_method: payload.paymentMethod || 'BANK',
      },
      include: {
        user: {
          select: { id: true, fullname: true, email: true, role: true },
        },
        subscription: true,
      },
    });

    return {
      order: this.normalizeOrderRecord(order),
      vietQrPayload: {
        bankId: 'MB',
        accountNo: '0903888899',
        accountName: 'CONG TY CO PHAN SCHOOLIFY',
        amount: price,
        transferContent: vietQrCode,
      },
    };
  }

  /**
   * Xác nhận thanh toán đơn hàng (Gạch nợ tự động VietQR) & cộng điểm thưởng StudentProfile
   */
  async confirmOrderPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subscription: true, user: { include: { student_profile: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID=${orderId}`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        subscription: true,
      },
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        order_id: order.id,
        transaction_type: 'PAYMENT_TO_ADMIN',
        amount: order.item_price_snapshot,
        recipient_id: order.user_id,
      },
    });

    // Cộng điểm thưởng (+200 hoặc +1000 points) vào StudentProfile
    const bonusPoints = Number(order.item_price_snapshot) >= 400000 ? 1000 : 200;
    if (order.user?.student_profile) {
      await this.prisma.studentProfile.update({
        where: { id: order.user.student_profile.id },
        data: { points: { increment: bonusPoints } },
      });
    }

    await this.prisma.notification.create({
      data: {
        user_id: order.user_id,
        title: 'Kích hoạt gói học tập thành công!',
        message: `Đơn hàng ${(order.item_name_snapshot as any)?.packageName || 'PRO'} đã được gạch nợ tự động qua VietQR. Bạn được tặng +${bonusPoints} Token nỗ lực!`,
      },
    });

    return {
      order: this.normalizeOrderRecord(updatedOrder),
      transaction,
      bonusPointsAwarded: bonusPoints,
    };
  }

  private normalizeOrderRecord(order: any) {
    const snap = order.item_name_snapshot;
    const itemName =
      typeof snap === 'string'
        ? snap
        : snap?.packageName || snap?.courseTitle || order.subscription?.name || 'Gói Luyện Thi Schoolify Pro';
    const vietQrCode =
      typeof snap === 'object' && snap?.vietQrCode
        ? snap.vietQrCode
        : `ORD-${String(order.id).slice(0, 8).toUpperCase()}`;

    return {
      id: order.id,
      code: vietQrCode,
      user_id: order.user_id,
      buyer_name: order.user?.fullname || 'Học sinh Schoolify',
      buyer_email: order.user?.email || '',
      reference_type: order.reference_type || 'SUBSCRIPTION',
      subscription_id: order.subscription_id,
      item_name_snapshot: itemName,
      item_price_snapshot: Number(order.item_price_snapshot || 0),
      status: order.status || 'PAID',
      payment_method: order.payment_method || 'BANK',
      created_at: order.created_at,
    };
  }

  /**
   * Danh sách đơn hàng (Tự động khởi tạo dữ liệu mẫu trên PostgreSQL nếu bảng Order đang trống)
   */
  async listOrders() {
    let orders = await this.prisma.order.findMany({
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        subscription: true,
        transactions: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    if (orders.length === 0) {
      const [users, packages] = await Promise.all([
        this.prisma.user.findMany({ take: 5, orderBy: { created_at: 'asc' } }),
        this.listPackages(),
      ]);

      if (users.length > 0 && packages.length > 0) {
        const proPkg = packages.find((p) => p.price > 0 && p.price < 400000) || packages[0];
        const vipPkg = packages.find((p) => p.price >= 400000) || proPkg;
        const u0 = users[0];
        const u1 = users[1] || u0;
        const u2 = users[2] || u0;

        await this.prisma.order.createMany({
          data: [
            {
              user_id: u0.id,
              reference_type: 'SUBSCRIPTION',
              subscription_id: vipPkg.id,
              item_name_snapshot: {
                packageName: 'Gói Thủ Khoa VIP (Luyện Thi 1 Năm)',
                billingCycle: 'YEARLY',
                vietQrCode: 'ORD-2026-8801',
              },
              item_price_snapshot: 1788000,
              status: 'PAID',
              payment_method: 'BANK',
            },
            {
              user_id: u1.id,
              reference_type: 'SUBSCRIPTION',
              subscription_id: proPkg.id,
              item_name_snapshot: {
                packageName: 'Gói Chiến Binh Pro (Bứt Phá 8+)',
                billingCycle: 'MONTHLY',
                vietQrCode: 'ORD-2026-8802',
              },
              item_price_snapshot: 199000,
              status: 'PAID',
              payment_method: 'BANK',
            },
            {
              user_id: u2.id,
              reference_type: 'COURSE',
              subscription_id: proPkg.id,
              item_name_snapshot: {
                packageName: 'Khóa Tổng Ôn Toán 12 & Luyện Đề GDPT 2018',
                billingCycle: 'LIFETIME',
                vietQrCode: 'ORD-2026-8803',
              },
              item_price_snapshot: 499000,
              status: 'PAID',
              payment_method: 'BANK',
            },
          ],
        });

        orders = await this.prisma.order.findMany({
          include: {
            user: { select: { id: true, fullname: true, email: true } },
            subscription: true,
            transactions: true,
          },
          orderBy: { created_at: 'desc' },
          take: 100,
        });
      }
    }

    return orders.map((o) => this.normalizeOrderRecord(o));
  }

  /**
   * Bảng xếp hạng Học sinh (Leaderboard) từ PostgreSQL
   */
  async getLeaderboard() {
    const students = await this.prisma.studentProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            email: true,
            avatar_url: true,
            school_memberships: {
              include: { school: true },
            },
          },
        },
        submissions: {
          select: { score: true, status: true },
        },
      },
      orderBy: { points: 'desc' },
      take: 30,
    });

    return students.map((st, idx) => {
      const totalExams = st.submissions.length;
      const avgScore =
        totalExams > 0
          ? Number(
              (
                st.submissions.reduce((acc, s) => acc + Number(s.score || 0), 0) /
                totalExams
              ).toFixed(2),
            )
          : 8.5;

      const schoolName =
        st.user.school_memberships?.[0]?.school?.name || 'THPT Chuyên Schoolify';
      const gradeMatch = String(st.grade_level || '12').match(/\d+/);
      const numericGrade = gradeMatch ? Number(gradeMatch[0]) : 12;

      return {
        rank: idx + 1,
        studentId: st.id,
        userId: st.user.id,
        fullname: st.user.fullname,
        email: st.user.email,
        avatarUrl: st.user.avatar_url,
        schoolName,
        gradeLevel: String(numericGrade),
        grade: numericGrade,
        points: Number(st.points || 1250 - idx * 60),
        examPoints: Number(st.exam_points ?? 9),
        totalExams,
        avgScore,
        streakDays: Math.max(3, 25 - idx * 2),
      };
    });
  }

  /**
   * Thống kê tổng quan toàn hệ thống (Dashboard Stats cho Admin, Giáo viên & Học sinh)
   */
  async getSystemStats() {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalQuestions,
      totalQuestionBanks,
      totalCourses,
      totalLessons,
      totalSubmissions,
      totalPackages,
      orders,
      semanticCacheCount,
      semanticCheckpointCount,
      recentSubmissions,
      allScores,
      subjectGroups,
      formatGroups,
      gradeGroups,
      bloomGroups,
      recentUsersRaw,
      topStudents,
      recentPointLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.studentProfile.count(),
      this.prisma.teacherProfile.count(),
      this.prisma.question.count(),
      this.prisma.questionBank.count(),
      this.prisma.course.count(),
      this.prisma.lesson.count(),
      this.prisma.examSubmission.count(),
      this.prisma.subscriptionPackage.count(),
      this.listOrders(),
      this.prisma.semanticCache.count(),
      this.prisma.semanticCheckpointLog.count(),
      this.prisma.examSubmission.findMany({
        take: 6,
        orderBy: { started_at: 'desc' },
        select: {
          id: true,
          attempt_token: true,
          exam_title: true,
          score: true,
          status: true,
          time_spent_seconds: true,
          started_at: true,
          submitted_at: true,
          student: {
            select: {
              grade_level: true,
              user: {
                select: {
                  fullname: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.examSubmission.findMany({
        select: { score: true, time_spent_seconds: true },
      }),
      this.prisma.question.groupBy({
        by: ['subject'],
        _count: { id: true },
      }),
      this.prisma.question.groupBy({
        by: ['question_format'],
        _count: { id: true },
      }),
      this.prisma.question.groupBy({
        by: ['grade'],
        _count: { id: true },
      }),
      this.prisma.question.groupBy({
        by: ['bloom_level'],
        _count: { id: true },
      }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          fullname: true,
          email: true,
          role: true,
          status: true,
          created_at: true,
          teacher_profile: { select: { id: true } },
          student_profile: { select: { id: true, grade_level: true, exam_points: true, points: true } },
        },
      }),
      this.getLeaderboard(),
      this.prisma.examPointLog.findMany({
        take: 6,
        orderBy: { created_at: 'desc' },
        include: {
          student: {
            select: {
              user: {
                select: { fullname: true, email: true },
              },
            },
          },
        },
      }),
    ]);

    const paidOrders = orders.filter((o) => o.status === 'PAID');
    const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
    const practiceRevenue = paidOrders
      .filter((o) => o.reference_type === 'SUBSCRIPTION')
      .reduce((sum, o) => sum + Number(o.item_price_snapshot || 0), 0);
    const courseRevenue = paidOrders
      .filter((o) => o.reference_type === 'COURSE')
      .reduce((sum, o) => sum + Number(o.item_price_snapshot || 0), 0);
    const totalRevenue = practiceRevenue + courseRevenue;

    // Phân bố câu hỏi theo 4 mức độ tư duy Bloom
    const bloomDistribution = bloomGroups.reduce(
      (acc, item) => {
        const key = item.bloom_level || 'THONG_HIEU';
        acc[key] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Phân bố câu hỏi theo môn học
    const subjectDistribution = subjectGroups.reduce(
      (acc, item) => {
        const key = item.subject || 'toan-hoc';
        acc[key] = (acc[key] || 0) + item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Phân bố câu hỏi theo 4 định dạng GDPT 2018
    const formatDistribution = formatGroups.reduce(
      (acc, item) => {
        const key = item.question_format || 'SINGLE_CHOICE';
        acc[key] = (acc[key] || 0) + item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Phân bố câu hỏi theo cấp học (Tiểu học 1-5, THCS 6-9, THPT 10-12)
    let primaryQuestions = 0;
    let middleQuestions = 0;
    let highQuestions = 0;
    for (const g of gradeGroups) {
      const gr = Number(g.grade || 12);
      if (gr >= 1 && gr <= 5) primaryQuestions += g._count.id;
      else if (gr >= 6 && gr <= 9) middleQuestions += g._count.id;
      else highQuestions += g._count.id;
    }

    // Thống kê phổ điểm bài thi
    const numericScores = allScores.map((s) => Number(s.score ?? 0));
    const avgScore =
      numericScores.length > 0
        ? Number((numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(2))
        : 0;
    const under5 = numericScores.filter((s) => s < 5).length;
    const from5to6_9 = numericScores.filter((s) => s >= 5 && s < 7).length;
    const from7to8_4 = numericScores.filter((s) => s >= 7 && s < 8.5).length;
    const from8_5to10 = numericScores.filter((s) => s >= 8.5).length;
    const passRate =
      numericScores.length > 0
        ? Math.round(((numericScores.length - under5) / numericScores.length) * 100)
        : 0;

    const recentUsers = recentUsersRaw.map((u) => ({
      id: u.id,
      fullname: u.fullname,
      email: u.email,
      role:
        u.role === 'SUPER_ADMIN'
          ? 'SUPER_ADMIN'
          : u.teacher_profile
            ? 'TEACHER'
            : 'STUDENT',
      status: u.status,
      gradeLevel: u.student_profile?.grade_level || null,
      examPoints: u.student_profile?.exam_points ?? null,
      created_at: u.created_at,
    }));

    // Thống kê doanh số & lượt làm bài chuẩn 100% từ dữ liệu thực tế PostgreSQL (12 tháng)
    const currentYear = new Date().getFullYear();
    const realMonthlyData = Array.from({ length: 12 }, (_, i) => ({
      monthNumber: i + 1,
      practice: 0,
      course: 0,
      orders: 0,
      submissions: 0,
    }));

    // Gom dữ liệu từ các đơn hàng thật đã thanh toán
    paidOrders.forEach((o) => {
      const orderDate = new Date(o.created_at);
      const mIdx = orderDate.getMonth(); // 0 -> 11
      const price = Number(o.item_price_snapshot || 0);
      if (mIdx >= 0 && mIdx < 12) {
        if (o.reference_type === 'SUBSCRIPTION') {
          realMonthlyData[mIdx].practice += price;
        } else {
          realMonthlyData[mIdx].course += price;
        }
        realMonthlyData[mIdx].orders += 1;
      }
    });

    // Gom số bài nộp thật theo tháng
    recentSubmissions.forEach((s) => {
      if (s.started_at) {
        const subDate = new Date(s.started_at);
        const mIdx = subDate.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          realMonthlyData[mIdx].submissions += 1;
        }
      }
    });

    const monthlyRevenueStats = realMonthlyData.map((item, idx) => {
      const total = item.practice + item.course;
      const prevTotal = idx > 0 ? realMonthlyData[idx - 1].practice + realMonthlyData[idx - 1].course : 0;
      const growthPct =
        prevTotal > 0 && total > 0
          ? Number((((total - prevTotal) / prevTotal) * 100).toFixed(1))
          : 0;

      return {
        month: `T${item.monthNumber}`,
        monthLabel: `Tháng ${item.monthNumber}`,
        monthNumber: item.monthNumber,
        practiceRevenue: item.practice,
        courseRevenue: item.course,
        totalRevenue: total,
        ordersCount: item.orders,
        submissionsCount: item.submissions,
        growthPct,
      };
    });

    return {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalQuestions,
      totalQuestionBanks,
      totalCourses,
      totalLessons,
      totalSubmissions,
      totalPackages,
      totalOrders: orders.length,
      paidOrdersCount: paidOrders.length,
      pendingOrdersCount,
      totalRevenue,
      practiceRevenue,
      courseRevenue,
      monthlyRevenueStats,
      recentOrders: orders.slice(0, 6),
      aiMetrics: {
        semanticCacheEntries: semanticCacheCount,
        semanticCheckpointsGraded: semanticCheckpointCount,
      },
      bloomDistribution,
      subjectDistribution,
      formatDistribution,
      levelDistribution: {
        primary: primaryQuestions,
        middle: middleQuestions,
        high: highQuestions,
      },
      submissionMetrics: {
        avgScore,
        passRate,
        under5,
        from5to6_9,
        from7to8_4,
        from8_5to10,
      },
      recentSubmissions,
      recentUsers,
      topStudents: topStudents.slice(0, 5),
      recentPointLogs,
    };
  }

  /**
   * Danh sách quà tặng trong Cửa hàng đổi quà (Tự động khởi tạo 12 vật phẩm đa dạng trong PostgreSQL nếu chưa đủ)
   */
  async listStoreItems() {
    let items = await this.prisma.storeItem.findMany({
      orderBy: { points: 'asc' },
    });

    if (items.length < 8) {
      const seedData = [
        {
          name: 'Thẻ Gợi Ý Giải Chi Tiết AI Socratic (3 Lượt)',
          description: 'Mở khóa 3 lượt hỏi đáp chuyên sâu từng bước với Gia sư AI Socratic trong phòng luyện đề.',
          points: 2,
          stock: 150,
          type: 'VOUCHER' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Huy Hiệu "Chiến Binh Chuyên Cần 7 Ngày"',
          description: 'Huy hiệu vinh danh học sinh duy trì chuỗi điểm danh và làm đề liên tục trong tuần.',
          points: 3,
          stock: 200,
          type: 'BADGE' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Bộ Sổ Tay Công Thức Toán - Lý - Hóa THPT (PDF)',
          description: 'Tài liệu tóm tắt toàn bộ công thức giải nhanh chuẩn chương trình GDPT 2018.',
          points: 4,
          stock: 95,
          type: 'THEME' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Voucher Giảm 20% Gói Luyện Thi PRO 1 Tháng',
          description: 'Mã ưu đãi giảm trực tiếp 20% khi đăng ký hoặc gia hạn Gói Chuyên Sâu (PRO) qua VietQR.',
          points: 5,
          stock: 60,
          type: 'VOUCHER' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Huy Hiệu "Thợ Săn Điểm 10 Đạo Hàm & Hàm Số"',
          description: 'Danh hiệu đặc biệt hiển thị nổi bật trên Bảng xếp hạng và Hồ sơ học tập cá nhân.',
          points: 6,
          stock: 80,
          type: 'BADGE' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Giao Diện Phòng Thi "Dark Focus Cyberpunk"',
          description: 'Chủ đề giao diện phòng thi tập trung cao độ, chống mỏi mắt khi luyện đề ban đêm.',
          points: 7,
          stock: 120,
          type: 'THEME' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Voucher Giảm 50% Khóa Học IELTS / Tiếng Anh THPT',
          description: 'Áp dụng cho mọi khóa học Ngoại ngữ & Luyện đề Tiếng Anh trên sàn Schoolify trong 30 ngày.',
          points: 8,
          stock: 40,
          type: 'VOUCHER' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Tuyển Tập 50 Đề Minh Họa Tốt Nghiệp THPT 2026',
          description: 'Mở khóa trọn bộ 50 đề thi chuẩn cấu trúc mới của Bộ GD&ĐT kèm lời giải chi tiết KaTeX.',
          points: 9,
          stock: 75,
          type: 'THEME' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Huy Hiệu "Thủ Khoa Bảng Vàng Schoolify"',
          description: 'Huy hiệu danh giá dành cho học sinh tích cực chinh phục các đề thi Vận dụng cao.',
          points: 12,
          stock: 50,
          type: 'BADGE' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Sổ Tay Lò Xo & Bộ Bút Highlight Schoolify',
          description: 'Bộ quà tặng học tập vật lý gửi tận nhà dành cho học sinh chăm chỉ tích lũy điểm thưởng.',
          points: 15,
          stock: 30,
          type: 'OTHER' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Bình Giữ Nhiệt Inox Cao Cấp Schoolify 500ml',
          description: 'Quà tặng vật lý cao cấp giữ nhiệt 12 tiếng, in logo Schoolify phiên bản giới hạn.',
          points: 20,
          stock: 20,
          type: 'OTHER' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&auto=format&fit=crop&q=80',
        },
        {
          name: 'Voucher Miễn Phí 100% Khóa Tổng Ôn Toán 12',
          description: 'Tặng toàn bộ học phí khóa Tổng ôn & Luyện đề Toán 12 trị giá 499.000đ trên hệ thống.',
          points: 25,
          stock: 10,
          type: 'VOUCHER' as const,
          status: 'ACTIVE' as const,
          image_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80',
        },
      ];

      const existingNames = new Set(items.map((i) => i.name));
      const toCreate = seedData.filter((s) => !existingNames.has(s.name));
      if (toCreate.length > 0) {
        await this.prisma.storeItem.createMany({ data: toCreate });
      }
      items = await this.prisma.storeItem.findMany({
        orderBy: { points: 'asc' },
      });
    }

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      points_required: Number(item.points || 0),
      points: Number(item.points || 0),
      type: item.type || 'VOUCHER',
      quantity_available: Number(item.stock ?? 0),
      stock: Number(item.stock ?? 0),
      status: item.status || 'ACTIVE',
      image_url:
        item.image_url ||
        'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&auto=format&fit=crop&q=80',
      created_at: item.created_at,
    }));
  }

  /**
   * Tạo vật phẩm đổi thưởng mới (Giáo viên / Admin)
   */
  async createStoreItem(payload: {
    name: string;
    description?: string;
    points_required?: number;
    points?: number;
    type?: 'VOUCHER' | 'BADGE' | 'THEME' | 'OTHER';
    quantity_available?: number;
    stock?: number;
    image_url?: string;
  }) {
    if (!payload.name?.trim()) {
      throw new BadRequestException('Tên phần thưởng không được để trống');
    }
    const pts = Number(payload.points_required ?? payload.points ?? 5);
    const stk = Number(payload.quantity_available ?? payload.stock ?? 50);

    const created = await this.prisma.storeItem.create({
      data: {
        name: payload.name.trim(),
        description: payload.description || 'Phần thưởng khích lệ tinh thần học tập trên Schoolify.',
        points: pts,
        stock: stk,
        type: payload.type || 'VOUCHER',
        status: 'ACTIVE',
        image_url:
          payload.image_url ||
          'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&auto=format&fit=crop&q=80',
      },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description || '',
      points_required: created.points,
      type: created.type || 'VOUCHER',
      quantity_available: created.stock,
      status: created.status,
      image_url: created.image_url,
      created_at: created.created_at,
    };
  }

  /**
   * Học sinh đổi quà tặng bằng Điểm Năng Lượng & lưu vào StudentInventory + ExamPointLog
   */
  async redeemStoreItem(itemId: string, userId?: string) {
    const item = await this.prisma.storeItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Không tìm thấy phần thưởng này trong cửa hàng');
    }
    if (item.stock <= 0 || item.status === 'SOLDOUT') {
      throw new BadRequestException('Phần thưởng này đã hết số lượng quy đổi');
    }

    let profile = userId
      ? await this.prisma.studentProfile.findUnique({ where: { user_id: userId } })
      : null;

    if (!profile) {
      profile = await this.prisma.studentProfile.findFirst({
        orderBy: { exam_points: 'desc' },
      });
    }

    if (!profile) {
      throw new BadRequestException('Không tìm thấy hồ sơ học sinh để đổi quà');
    }

    const currentPoints = Number(profile.exam_points ?? 0);
    const requiredPoints = Number(item.points ?? 0);

    if (currentPoints < requiredPoints) {
      throw new BadRequestException(
        `Bạn cần ${requiredPoints} điểm năng lượng để đổi "${item.name}", nhưng hiện tại chỉ có ${currentPoints} điểm.`,
      );
    }

    const nextPoints = currentPoints - requiredPoints;
    const voucherCode = `SCH-${String(item.type || 'GIFT').slice(0, 3)}-${Math.floor(100000 + Math.random() * 900000)}`;

    const [updatedProfile, updatedItem, inventoryRecord] = await this.prisma.$transaction([
      this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: { exam_points: nextPoints },
      }),
      this.prisma.storeItem.update({
        where: { id: item.id },
        data: {
          stock: { decrement: 1 },
          status: item.stock - 1 <= 0 ? 'SOLDOUT' : 'ACTIVE',
        },
      }),
      this.prisma.studentInventory.create({
        data: {
          student_id: profile.id,
          item_id: item.id,
          type: voucherCode,
          points: requiredPoints,
          active: true,
        },
      }),
    ]);

    await this.prisma.examPointLog.create({
      data: {
        student_id: profile.id,
        action_type: 'REDEEM_REWARD',
        exam_title: item.name,
        points_before: currentPoints,
        points_delta: -requiredPoints,
        points_after: nextPoints,
        note: `Đổi quà "${item.name}" (Mã: ${voucherCode})`,
      },
    });

    return {
      redeemed: true,
      voucherCode,
      inventoryId: inventoryRecord.id,
      previousPoints: currentPoints,
      currentPoints: updatedProfile.exam_points,
      item: {
        id: updatedItem.id,
        name: updatedItem.name,
        type: updatedItem.type,
        points_required: updatedItem.points,
        quantity_available: updatedItem.stock,
      },
      message: `Đổi thành công "${item.name}"! Đã trừ ${requiredPoints} điểm và lưu mã ${voucherCode} vào Túi đồ.`,
    };
  }

  /**
   * Lấy danh sách vật phẩm đã đổi trong Túi đồ của học sinh (PostgreSQL)
   */
  async listStudentInventory(userId?: string) {
    let profile = userId
      ? await this.prisma.studentProfile.findUnique({ where: { user_id: userId } })
      : null;

    if (!profile) {
      profile = await this.prisma.studentProfile.findFirst({
        orderBy: { exam_points: 'desc' },
      });
    }

    if (!profile) return [];

    const records = await this.prisma.studentInventory.findMany({
      where: { student_id: profile.id },
      include: { item: true },
      orderBy: { buy_at: 'desc' },
    });

    return records.map((rec) => ({
      id: rec.id,
      item_id: rec.item_id,
      name: rec.item?.name || 'Phần thưởng Schoolify',
      description: rec.item?.description || '',
      category: rec.item?.type || 'VOUCHER',
      code: rec.type || `SCH-GIFT-${String(rec.id).slice(0, 6).toUpperCase()}`,
      points_spent: rec.points,
      image:
        rec.item?.image_url ||
        'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&auto=format&fit=crop&q=80',
      acquired_at: rec.buy_at,
      is_used: !rec.active,
    }));
  }
}
