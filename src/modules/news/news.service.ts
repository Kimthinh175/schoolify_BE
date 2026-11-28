import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NewsStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function slugify(text: string): string {
  return removeVietnameseTones(text)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const DEFAULT_NEWS_CATEGORIES = [
  {
    id: 'cat-thpt',
    name: 'Thi Tốt Nghiệp THPT',
    slug: 'thi-tot-nghiep-thpt',
    description:
      'Thông tin quy chế, cấu trúc đề minh họa và phân tích chuyên sâu kỳ thi Tốt nghiệp THPT theo Chương trình GDPT 2018.',
    icon: 'GraduationCap',
    color: '#00B8DD',
    order_index: 1,
    is_active: true,
    is_featured: true,
    meta_title: 'Tin Tức Thi Tốt Nghiệp THPT 2026 | Schoolify',
    meta_description:
      'Cập nhật cấu trúc đề thi, lịch thi và phân tích ma trận đề Tốt nghiệp THPT mới nhất từ Bộ GD&ĐT.',
    meta_keywords: ['thi tốt nghiệp thpt 2026', 'đề minh họa 2026', 'chương trình gdpt 2018'],
    is_indexable: true,
  },
  {
    id: 'cat-edtech',
    name: 'Công Nghệ Giáo Dục',
    slug: 'cong-nghe-giao-duc',
    description:
      'Xu hướng ứng dụng AI, Adaptive Learning và chuyển đổi số trong dạy và học phổ thông.',
    icon: 'Sparkles',
    color: '#6366F1',
    order_index: 2,
    is_active: true,
    is_featured: true,
    meta_title: 'Công Nghệ Giáo Dục & AI Học Tập | Schoolify',
    meta_description:
      'Khám phá công nghệ AI tạo đề thích ứng, chấm bài tự luận tự động và cá nhân hóa lộ trình học tập.',
    meta_keywords: ['công nghệ giáo dục', 'edtech', 'ai giáo dục', 'adaptive learning'],
    is_indexable: true,
  },
  {
    id: 'cat-bi-quyet',
    name: 'Bí Quyết Ôn Thi',
    slug: 'bi-quyet-on-thi',
    description:
      'Phương pháp giải nhanh, sơ đồ tư duy, công thức Toán - Tin và kinh nghiệm đạt điểm 9+ từ giáo viên chuyên.',
    icon: 'BookOpen',
    color: '#10B981',
    order_index: 3,
    is_active: true,
    is_featured: true,
    meta_title: 'Bí Quyết Ôn Thi & Phương Pháp Giải Nhanh | Schoolify',
    meta_description:
      'Tổng hợp mẹo giải nhanh Toán, Tin và chiến thuật phân bổ thời gian làm bài thi THPT.',
    meta_keywords: ['bí quyết ôn thi', 'giải nhanh toán 12', 'công thức oxyz'],
    is_indexable: true,
  },
  {
    id: 'cat-su-kien',
    name: 'Sự Kiện Schoolify',
    slug: 'su-kien-schoolify',
    description:
      'Các cuộc thi học thuật trực tuyến, giải đấu Bảng Vàng và hoạt động ngoại khóa sôi động trên nền tảng Schoolify.',
    icon: 'Trophy',
    color: '#F59E0B',
    order_index: 4,
    is_active: true,
    is_featured: true,
    meta_title: 'Sự Kiện & Giải Đấu Học Thuật | Schoolify',
    meta_description:
      'Tham gia đua top Bảng Vàng, thi thử toàn quốc và nhận học bổng Ngọc Tri Thức cùng Schoolify.',
    meta_keywords: ['sự kiện schoolify', 'đua top bảng vàng', 'thi thử thpt online'],
    is_indexable: true,
  },
  {
    id: 'cat-huong-dan',
    name: 'Hướng Dẫn Nền Tảng',
    slug: 'huong-dan-nen-tang',
    description:
      'Cẩm nang sử dụng các công cụ học tập, phòng thi ảo, máy tính Casio tích hợp và bộ gõ LaTeX trên Schoolify.',
    icon: 'Compass',
    color: '#EC4899',
    order_index: 5,
    is_active: true,
    is_featured: true,
    meta_title: 'Hướng Dẫn Sử Dụng Nền Tảng Schoolify',
    meta_description:
      'Hướng dẫn chi tiết cho học sinh và giáo viên khai thác tối đa hệ sinh thái Schoolify.',
    meta_keywords: ['hướng dẫn schoolify', 'gõ công thức latex', 'phòng thi ảo'],
    is_indexable: true,
  },
  {
    id: 'cat-nha-truong',
    name: 'Nhà Trường Số',
    slug: 'nha-truong-so',
    description:
      'Giải pháp quản trị trường học thông minh, ngân hàng đề kiểm tra chuẩn hóa và kết nối học tập.',
    icon: 'Building2',
    color: '#0EA5E9',
    order_index: 6,
    is_active: true,
    is_featured: true,
    meta_title: 'Nhà Trường Số & Quản Trị Giáo Dục | Schoolify',
    meta_description:
      'Chia sẻ kinh nghiệm chuyển đổi số trường THPT, quản lý ma trận đề và đánh giá năng lực học sinh.',
    meta_keywords: ['nhà trường số', 'chuyển đổi số giáo dục', 'quản lý trường học'],
    is_indexable: true,
  },
];

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureDefaultCategoriesIfEmpty() {
    const countFn = (this.prisma.newsCategory as any).count;
    if (typeof countFn !== 'function') return;
    const total = await countFn.call(this.prisma.newsCategory);
    if (total > 0) return;

    for (const preset of DEFAULT_NEWS_CATEGORIES) {
      try {
        await this.prisma.newsCategory.create({ data: preset });
      } catch {
        // Bỏ qua nếu đã tồn tại do race condition khi nhiều request cùng gọi
      }
    }
  }

  async listCategories(onlyActive = false) {
    let categories = await this.prisma.newsCategory.findMany({
      where: onlyActive ? { is_active: true } : undefined,
      orderBy: [{ order_index: 'asc' }, { created_at: 'desc' }],
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    if (categories.length === 0) {
      await this.ensureDefaultCategoriesIfEmpty();
      categories = await this.prisma.newsCategory.findMany({
        where: onlyActive ? { is_active: true } : undefined,
        orderBy: [{ order_index: 'asc' }, { created_at: 'desc' }],
        include: {
          _count: {
            select: { articles: true },
          },
        },
      });
    }

    return categories.map(({ _count, ...rest }) => ({
      ...rest,
      articles_count: _count?.articles ?? 0,
    }));
  }

  async saveCategory(body: any, id?: string) {
    const name = String(body?.name || '').trim();
    if (!name && !id) {
      throw new BadRequestException('Tên danh mục không được để trống');
    }

    const baseSlug = String(body?.slug || '').trim() || slugify(name);
    const data: any = {
      ...(name ? { name } : {}),
      ...(baseSlug ? { slug: baseSlug } : {}),
      ...(body?.parent_id !== undefined ? { parent_id: body.parent_id || null } : {}),
      ...(body?.description !== undefined ? { description: body.description } : {}),
      ...(body?.icon !== undefined ? { icon: body.icon } : {}),
      ...(body?.color !== undefined ? { color: body.color } : {}),
      ...(body?.cover_image_url !== undefined ? { cover_image_url: body.cover_image_url } : {}),
      ...(body?.order_index !== undefined ? { order_index: Number(body.order_index) || 0 } : {}),
      ...(body?.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
      ...(body?.is_featured !== undefined ? { is_featured: Boolean(body.is_featured) } : {}),
      ...(body?.meta_title !== undefined ? { meta_title: body.meta_title } : {}),
      ...(body?.meta_description !== undefined ? { meta_description: body.meta_description } : {}),
      ...(Array.isArray(body?.meta_keywords) ? { meta_keywords: body.meta_keywords } : {}),
      ...(body?.canonical_url !== undefined ? { canonical_url: body.canonical_url } : {}),
      ...(body?.og_image_url !== undefined ? { og_image_url: body.og_image_url } : {}),
      ...(body?.is_indexable !== undefined ? { is_indexable: Boolean(body.is_indexable) } : {}),
    };

    const targetId = id || body?.id;
    if (targetId) {
      const existing = await this.prisma.newsCategory.findUnique({ where: { id: targetId } });
      if (existing) {
        return this.prisma.newsCategory.update({
          where: { id: targetId },
          data,
        });
      }
    }

    const uniqueSlug = `${baseSlug || 'danh-muc'}-${Date.now().toString(36)}`;
    const existingBySlug = baseSlug
      ? await this.prisma.newsCategory.findUnique({ where: { slug: baseSlug } })
      : null;

    return this.prisma.newsCategory.create({
      data: {
        ...(targetId ? { id: targetId } : {}),
        ...data,
        name: name || 'Danh mục mới',
        slug: existingBySlug ? uniqueSlug : baseSlug || uniqueSlug,
      },
    });
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.newsCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục tin tức');
    }
    const articlesCount = await this.prisma.newsArticle.count({
      where: { category_id: id, deleted_at: null },
    });
    if (articlesCount > 0) {
      throw new BadRequestException('Không thể xóa danh mục đang có bài viết');
    }
    await this.prisma.newsCategory.delete({ where: { id } });
    return { deletedId: id };
  }

  async listArticles(params?: {
    onlyPublic?: boolean;
    categoryId?: string;
    status?: string;
    tag?: string;
    search?: string;
  }) {
    const where: any = { deleted_at: null };
    if (params?.onlyPublic) {
      where.status = NewsStatus.PUBLISHED;
    } else if (params?.status && params.status !== 'ALL') {
      where.status = params.status as NewsStatus;
    }

    if (params?.categoryId && params.categoryId !== 'ALL') {
      where.category_id = params.categoryId;
    }

    if (params?.tag) {
      where.tags = { has: params.tag };
    }

    const articles = await this.prisma.newsArticle.findMany({
      where,
      include: { category: true },
      orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }, { created_at: 'desc' }],
    });

    if (params?.search && params.search.trim()) {
      const q = removeVietnameseTones(params.search);
      return articles.filter((a) => {
        const hay = removeVietnameseTones(
          `${a.title} ${a.excerpt} ${(a.tags || []).join(' ')} ${a.search_text || ''}`,
        );
        return hay.includes(q);
      });
    }

    return articles;
  }

  async getArticleBySlug(slugOrId: string, onlyPublic = true) {
    const article = await this.prisma.newsArticle.findFirst({
      where: {
        deleted_at: null,
        ...(onlyPublic ? { status: NewsStatus.PUBLISHED } : {}),
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      include: { category: true },
    });

    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    const updated = await this.prisma.newsArticle.update({
      where: { id: article.id },
      data: { view_count: { increment: 1 } },
      include: { category: true },
    });

    return updated;
  }

  async saveArticle(body: any, id?: string, authorUser?: any) {
    const title = String(body?.title || '').trim();
    const targetId = id || body?.id;
    const existing = targetId
      ? await this.prisma.newsArticle.findUnique({ where: { id: targetId } })
      : null;

    if (!title && !existing) {
      throw new BadRequestException('Tiêu đề bài viết không được để trống');
    }

    let categoryId: string | undefined = body?.category_id || existing?.category_id;
    if (categoryId) {
      const matchedCat = await this.prisma.newsCategory.findUnique({
        where: { id: categoryId },
      });
      if (!matchedCat) {
        const preset = DEFAULT_NEWS_CATEGORIES.find((c) => c.id === categoryId);
        if (preset) {
          const bySlug = await this.prisma.newsCategory.findUnique({
            where: { slug: preset.slug },
          });
          if (bySlug) {
            categoryId = bySlug.id;
          } else {
            const createdPreset = await this.prisma.newsCategory.create({ data: preset });
            categoryId = createdPreset.id;
          }
        } else {
          categoryId = undefined;
        }
      }
    }

    if (!categoryId) {
      await this.ensureDefaultCategoriesIfEmpty();
      const firstCat = await this.prisma.newsCategory.findFirst({
        orderBy: { order_index: 'asc' },
      });
      if (!firstCat) {
        const createdCat = await this.saveCategory(DEFAULT_NEWS_CATEGORIES[0]);
        categoryId = createdCat.id;
      } else {
        categoryId = firstCat.id;
      }
    }

    const baseSlug = String(body?.slug || '').trim() || slugify(title || existing?.title || 'bai-viet');
    let finalSlug = existing?.slug || baseSlug;
    if (!existing || (body?.slug && body.slug !== existing.slug)) {
      const collision = await this.prisma.newsArticle.findFirst({
        where: { slug: baseSlug, NOT: existing ? { id: existing.id } : undefined },
      });
      finalSlug = collision ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    }

    const status = (body?.status || existing?.status || 'DRAFT') as NewsStatus;
    const contentText = String(body?.content ?? existing?.content ?? '');
    const plain = contentText.replace(/<[^>]+>/g, ' ').trim();
    const wordCount = body?.word_count ?? (plain ? plain.split(/\s+/).length : 0);
    const readingTimeMinutes = body?.reading_time_minutes ?? Math.max(1, Math.ceil(wordCount / 200));

    const data: any = {
      category_id: categoryId,
      title: title || existing?.title,
      slug: finalSlug,
      excerpt: String(body?.excerpt ?? existing?.excerpt ?? ''),
      content: contentText,
      table_of_contents: body?.table_of_contents ?? existing?.table_of_contents ?? undefined,
      thumbnail_url:
        body?.thumbnail_url ||
        existing?.thumbnail_url ||
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
      cover_image_url: body?.cover_image_url ?? existing?.cover_image_url ?? null,
      image_alt: body?.image_alt ?? existing?.image_alt ?? null,
      image_caption: body?.image_caption ?? existing?.image_caption ?? null,
      attachments: body?.attachments ?? existing?.attachments ?? undefined,
      reading_time_minutes: Number(readingTimeMinutes) || 1,
      word_count: Number(wordCount) || 0,
      tags: Array.isArray(body?.tags) ? body.tags : existing?.tags ?? [],
      grade_levels: Array.isArray(body?.grade_levels)
        ? body.grade_levels.map(Number)
        : existing?.grade_levels ?? [],
      subject_slugs: Array.isArray(body?.subject_slugs)
        ? body.subject_slugs
        : existing?.subject_slugs ?? [],
      target_roles: Array.isArray(body?.target_roles)
        ? body.target_roles
        : existing?.target_roles ?? [],
      search_text: removeVietnameseTones(`${title || existing?.title || ''} ${plain}`),
      related_article_ids: Array.isArray(body?.related_article_ids)
        ? body.related_article_ids
        : existing?.related_article_ids ?? [],
      meta_title: body?.meta_title ?? existing?.meta_title ?? null,
      meta_description: body?.meta_description ?? existing?.meta_description ?? null,
      meta_keywords: Array.isArray(body?.meta_keywords)
        ? body.meta_keywords
        : existing?.meta_keywords ?? [],
      focus_keyword: body?.focus_keyword ?? existing?.focus_keyword ?? null,
      canonical_url: body?.canonical_url ?? existing?.canonical_url ?? null,
      og_title: body?.og_title ?? existing?.og_title ?? null,
      og_description: body?.og_description ?? existing?.og_description ?? null,
      og_image_url: body?.og_image_url ?? existing?.og_image_url ?? null,
      is_indexable: body?.is_indexable !== undefined ? Boolean(body.is_indexable) : existing?.is_indexable ?? true,
      author_id: body?.author_id ?? authorUser?.id ?? existing?.author_id ?? null,
      author_name:
        body?.author_name || authorUser?.fullname || existing?.author_name || 'Ban Biên Tập Schoolify',
      author_avatar: body?.author_avatar ?? authorUser?.avatar_url ?? existing?.author_avatar ?? null,
      author_role: body?.author_role ?? existing?.author_role ?? 'Biên tập viên',
      author_bio: body?.author_bio ?? existing?.author_bio ?? null,
      source_name: body?.source_name ?? existing?.source_name ?? null,
      source_url: body?.source_url ?? existing?.source_url ?? null,
      structured_data: body?.structured_data ?? existing?.structured_data ?? undefined,
      status,
      is_featured: body?.is_featured !== undefined ? Boolean(body.is_featured) : existing?.is_featured ?? false,
      is_pinned: body?.is_pinned !== undefined ? Boolean(body.is_pinned) : existing?.is_pinned ?? false,
      is_breaking: body?.is_breaking !== undefined ? Boolean(body.is_breaking) : existing?.is_breaking ?? false,
      allow_comments:
        body?.allow_comments !== undefined ? Boolean(body.allow_comments) : existing?.allow_comments ?? true,
      published_at:
        status === NewsStatus.PUBLISHED
          ? body?.published_at
            ? new Date(body.published_at)
            : existing?.published_at || new Date()
          : existing?.published_at || null,
      scheduled_at: body?.scheduled_at ? new Date(body.scheduled_at) : existing?.scheduled_at || null,
      last_edited_by: authorUser?.id || body?.last_edited_by || null,
    };

    if (existing) {
      return this.prisma.newsArticle.update({
        where: { id: existing.id },
        data,
        include: { category: true },
      });
    }

    return this.prisma.newsArticle.create({
      data: {
        ...(targetId ? { id: targetId } : {}),
        ...data,
      },
      include: { category: true },
    });
  }

  async deleteArticle(id: string) {
    const existing = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    await this.prisma.newsArticle.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { deletedId: id };
  }

  async toggleLikeArticle(id: string) {
    const existing = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return this.prisma.newsArticle.update({
      where: { id },
      data: { like_count: { increment: 1 } },
    });
  }
}
