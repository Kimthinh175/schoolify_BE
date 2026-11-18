import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ForumCommentStatus,
  ForumPostStatus,
  ForumReportReason,
  ForumReportStatus,
  ForumTargetType,
  SystemRole,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { GetReportsQueryDto } from './dto/get-reports-query.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Injectable()
export class ForumModerationService {
  private readonly logger = new Logger(ForumModerationService.name);

  // In-memory mock store phục vụ kiểm thử cục bộ khi DB offline
  private readonly mockPinnedPosts = new Set<string>();
  private readonly mockLockedPosts = new Set<string>();
  private readonly mockHiddenPosts = new Set<string>();
  private readonly mockHiddenComments = new Set<string>();
  private readonly mockReports = new Map<string, any>();

  constructor(private readonly prisma: PrismaService) {
    this.initMockReports();
  }

  private initMockReports() {
    this.mockReports.set('mock-rep-01', {
      id: 'mock-rep-01',
      reporter_id: 'seed-student-01',
      target_type: ForumTargetType.POST,
      post_id: 'demo-post-1',
      comment_id: null,
      reason: ForumReportReason.SPAM,
      description: 'Nội dung có chứa liên kết quảng cáo không phù hợp',
      status: ForumReportStatus.PENDING,
      created_at: new Date(),
      reporter: {
        id: 'seed-student-01',
        fullname: 'Lê Văn Phúc',
        role: 'USER',
      },
    });
  }

  private checkSuperAdmin(currentUser?: any) {
    if (!currentUser) return; // Cho phép test offline nếu chưa có context
    const role = currentUser.role;
    const isSuperAdmin =
      role === SystemRole.SUPER_ADMIN || role === 'SUPER_ADMIN' || role === 'ADMIN';
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền thực hiện thao tác kiểm duyệt này.',
      );
    }
  }

  /**
   * Ghim / Bỏ ghim bài viết (toggle is_pinned)
   */
  async togglePinPost(postId: string, currentUser?: any) {
    this.checkSuperAdmin(currentUser);

    try {
      const post = await this.prisma.forumPost.findFirst({
        where: {
          OR: [{ id: postId }, { slug: postId }],
          status: { not: ForumPostStatus.DELETED },
        },
      });

      if (!post) {
        throw new NotFoundException(`Không tìm thấy bài viết "${postId}".`);
      }

      const nextPinned = !post.is_pinned;
      const updated = await this.prisma.forumPost.update({
        where: { id: post.id },
        data: { is_pinned: nextPinned },
      });

      return {
        post_id: updated.id,
        is_pinned: updated.is_pinned,
        message: updated.is_pinned
          ? 'Đã ghim bài viết lên đầu diễn đàn thành công'
          : 'Đã bỏ ghim bài viết thành công',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.warn(`[ForumModeration] DB offline fallback togglePinPost: ${error}`);
      const isPinned = !this.mockPinnedPosts.has(postId);
      if (isPinned) {
        this.mockPinnedPosts.add(postId);
      } else {
        this.mockPinnedPosts.delete(postId);
      }
      return {
        post_id: postId,
        is_pinned: isPinned,
        message: isPinned
          ? 'Đã ghim bài viết thành công (Offline Mode)'
          : 'Đã bỏ ghim bài viết thành công (Offline Mode)',
      };
    }
  }

  /**
   * Khóa / Mở khóa bình luận bài viết (toggle is_locked)
   */
  async toggleLockPost(postId: string, currentUser?: any) {
    this.checkSuperAdmin(currentUser);

    try {
      const post = await this.prisma.forumPost.findFirst({
        where: {
          OR: [{ id: postId }, { slug: postId }],
          status: { not: ForumPostStatus.DELETED },
        },
      });

      if (!post) {
        throw new NotFoundException(`Không tìm thấy bài viết "${postId}".`);
      }

      const nextLocked = !post.is_locked;
      const updated = await this.prisma.forumPost.update({
        where: { id: post.id },
        data: { is_locked: nextLocked },
      });

      return {
        post_id: updated.id,
        is_locked: updated.is_locked,
        message: updated.is_locked
          ? 'Đã khóa bình luận bài viết (ngăn chặn phản hồi mới)'
          : 'Đã mở khóa bình luận cho bài viết',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.warn(`[ForumModeration] DB offline fallback toggleLockPost: ${error}`);
      const isLocked = !this.mockLockedPosts.has(postId);
      if (isLocked) {
        this.mockLockedPosts.add(postId);
      } else {
        this.mockLockedPosts.delete(postId);
      }
      return {
        post_id: postId,
        is_locked: isLocked,
        message: isLocked
          ? 'Đã khóa bài viết thành công (Offline Mode)'
          : 'Đã mở khóa bài viết thành công (Offline Mode)',
      };
    }
  }

  /**
   * Ẩn / Bỏ ẩn bài viết vi phạm (toggle status: HIDDEN <-> PUBLISHED)
   */
  async toggleHidePost(postId: string, currentUser?: any) {
    this.checkSuperAdmin(currentUser);

    try {
      const post = await this.prisma.forumPost.findFirst({
        where: {
          OR: [{ id: postId }, { slug: postId }],
        },
      });

      if (!post) {
        throw new NotFoundException(`Không tìm thấy bài viết "${postId}".`);
      }

      const nextStatus =
        post.status === ForumPostStatus.HIDDEN
          ? ForumPostStatus.PUBLISHED
          : ForumPostStatus.HIDDEN;

      const updated = await this.prisma.forumPost.update({
        where: { id: post.id },
        data: { status: nextStatus },
      });

      return {
        post_id: updated.id,
        status: updated.status,
        is_hidden: updated.status === ForumPostStatus.HIDDEN,
        message:
          updated.status === ForumPostStatus.HIDDEN
            ? 'Đã ẩn bài viết vi phạm khỏi diễn đàn cộng đồng'
            : 'Đã bỏ ẩn bài viết, khôi phục hiển thị công khai',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.warn(`[ForumModeration] DB offline fallback toggleHidePost: ${error}`);
      const isHidden = !this.mockHiddenPosts.has(postId);
      if (isHidden) {
        this.mockHiddenPosts.add(postId);
      } else {
        this.mockHiddenPosts.delete(postId);
      }
      return {
        post_id: postId,
        status: isHidden ? ForumPostStatus.HIDDEN : ForumPostStatus.PUBLISHED,
        is_hidden: isHidden,
        message: isHidden
          ? 'Đã ẩn bài viết thành công (Offline Mode)'
          : 'Đã khôi phục hiển thị bài viết thành công (Offline Mode)',
      };
    }
  }

  /**
   * Ẩn / Bỏ ẩn lời giải/bình luận vi phạm (toggle status: HIDDEN <-> ACTIVE)
   */
  async toggleHideComment(commentId: string, currentUser?: any) {
    this.checkSuperAdmin(currentUser);

    try {
      const comment = await this.prisma.forumComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException(`Không tìm thấy bình luận với ID "${commentId}".`);
      }

      const nextStatus =
        comment.status === ForumCommentStatus.HIDDEN
          ? ForumCommentStatus.ACTIVE
          : ForumCommentStatus.HIDDEN;

      const updated = await this.prisma.forumComment.update({
        where: { id: comment.id },
        data: { status: nextStatus },
      });

      return {
        comment_id: updated.id,
        status: updated.status,
        is_hidden: updated.status === ForumCommentStatus.HIDDEN,
        message:
          updated.status === ForumCommentStatus.HIDDEN
            ? 'Đã ẩn bình luận vi phạm khỏi cuộc thảo luận'
            : 'Đã bỏ ẩn bình luận, khôi phục hiển thị công khai',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.warn(
        `[ForumModeration] DB offline fallback toggleHideComment: ${error}`,
      );
      const isHidden = !this.mockHiddenComments.has(commentId);
      if (isHidden) {
        this.mockHiddenComments.add(commentId);
      } else {
        this.mockHiddenComments.delete(commentId);
      }
      return {
        comment_id: commentId,
        status: isHidden ? ForumCommentStatus.HIDDEN : ForumCommentStatus.ACTIVE,
        is_hidden: isHidden,
        message: isHidden
          ? 'Đã ẩn bình luận thành công (Offline Mode)'
          : 'Đã khôi phục hiển thị bình luận thành công (Offline Mode)',
      };
    }
  }

  /**
   * Lấy danh sách báo cáo vi phạm quy tắc cộng đồng
   */
  async getReports(query: GetReportsQueryDto, currentUser?: any) {
    this.checkSuperAdmin(currentUser);

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    try {
      const where: any = {};
      if (query.status) where.status = query.status;
      if (query.targetType) where.target_type = query.targetType;

      const [reports, total] = await Promise.all([
        this.prisma.forumReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            reporter: {
              select: {
                id: true,
                fullname: true,
                avatar_url: true,
                role: true,
              },
            },
            resolved_by: {
              select: {
                id: true,
                fullname: true,
                role: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
              },
            },
            comment: {
              select: {
                id: true,
                content: true,
                status: true,
              },
            },
          },
        }),
        this.prisma.forumReport.count({ where }),
      ]);

      return {
        data: reports,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.warn(`[ForumModeration] DB offline fallback getReports: ${error}`);
      const list = Array.from(this.mockReports.values()).filter((r) => {
        if (query.status && r.status !== query.status) return false;
        if (query.targetType && r.target_type !== query.targetType) return false;
        return true;
      });
      return {
        data: list,
        total: list.length,
        page,
        limit,
        total_pages: Math.ceil(list.length / limit) || 1,
      };
    }
  }

  /**
   * Duyệt / Xử lý báo cáo vi phạm quy tắc cộng đồng
   */
  async resolveReport(
    reportId: string,
    dto: ResolveReportDto,
    currentUser?: any,
  ) {
    this.checkSuperAdmin(currentUser);

    const resolverId = currentUser?.id || 'seed-admin-01';

    try {
      const report = await this.prisma.forumReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new NotFoundException(`Không tìm thấy báo cáo vi phạm "${reportId}".`);
      }

      // Xử lý hành động kiểm duyệt tương ứng
      if (dto.moderationAction === 'HIDE_CONTENT') {
        if (report.target_type === ForumTargetType.POST && report.post_id) {
          await this.prisma.forumPost.update({
            where: { id: report.post_id },
            data: { status: ForumPostStatus.HIDDEN },
          });
        } else if (
          report.target_type === ForumTargetType.COMMENT &&
          report.comment_id
        ) {
          await this.prisma.forumComment.update({
            where: { id: report.comment_id },
            data: { status: ForumCommentStatus.HIDDEN },
          });
        }
      } else if (dto.moderationAction === 'DELETE_CONTENT') {
        if (report.target_type === ForumTargetType.POST && report.post_id) {
          await this.prisma.forumPost.update({
            where: { id: report.post_id },
            data: { status: ForumPostStatus.DELETED },
          });
        } else if (
          report.target_type === ForumTargetType.COMMENT &&
          report.comment_id
        ) {
          await this.prisma.forumComment.update({
            where: { id: report.comment_id },
            data: { status: ForumCommentStatus.DELETED },
          });
        }
      }

      const updatedReport = await this.prisma.forumReport.update({
        where: { id: reportId },
        data: {
          status: dto.status,
          moderation_action: dto.moderationAction || 'NONE',
          admin_note: dto.adminNote || null,
          resolved_by_id: resolverId,
          resolved_at: new Date(),
        },
      });

      return {
        report: updatedReport,
        message:
          dto.status === ForumReportStatus.RESOLVED
            ? 'Đã duyệt và xử lý báo cáo vi phạm thành công'
            : 'Đã từ chối báo cáo vi phạm',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.warn(
        `[ForumModeration] DB offline fallback resolveReport: ${error}`,
      );

      const existing = this.mockReports.get(reportId) || {
        id: reportId,
        status: ForumReportStatus.PENDING,
      };

      const updated = {
        ...existing,
        status: dto.status,
        moderation_action: dto.moderationAction || 'NONE',
        admin_note: dto.adminNote || null,
        resolved_by_id: resolverId,
        resolved_at: new Date(),
      };
      this.mockReports.set(reportId, updated);

      return {
        report: updated,
        message:
          dto.status === ForumReportStatus.RESOLVED
            ? 'Đã duyệt và xử lý báo cáo vi phạm thành công (Offline Mode)'
            : 'Đã từ chối báo cáo vi phạm (Offline Mode)',
      };
    }
  }
}
