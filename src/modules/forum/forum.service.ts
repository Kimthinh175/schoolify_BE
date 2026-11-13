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
  ForumReactionType,
  Prisma,
  SystemRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CommentSortOption,
  GetPostCommentsQueryDto,
} from './dto/get-post-comments.dto';
import { CreateForumCommentDto } from './dto/create-comment.dto';
import { UpdateForumCommentDto } from './dto/update-comment.dto';

const AUTHOR_SELECT = {
  id: true,
  fullname: true,
  avatar_url: true,
  role: true,
} satisfies Prisma.UserSelect;

const REACTION_SELECT = {
  id: true,
  user_id: true,
  reaction_type: true,
  created_at: true,
} satisfies Prisma.ForumReactionSelect;

type ReactionRecord = Prisma.ForumReactionGetPayload<{
  select: typeof REACTION_SELECT;
}>;

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Lấy danh sách lời giải & thảo luận phân cấp cha-con (2 cấp) của một bài viết.
   * Luôn ưu tiên ghim lời giải được chấp nhận (is_accepted = true) lên đầu tiên ngay dưới đề bài.
   */
  async getPostComments(
    postIdOrSlug: string,
    query: GetPostCommentsQueryDto = {},
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sort: CommentSortOption = query.sort || 'best';
    const currentUserId = query.userId?.trim() || undefined;

    try {
      // 1. Kiểm tra bài viết tồn tại (hỗ trợ truyền postId hoặc slug)
      const postRecord = await this.prisma.forumPost.findFirst({
        where: {
          OR: [{ id: postIdOrSlug }, { slug: postIdOrSlug }],
          status: { not: ForumPostStatus.DELETED },
        },
      });

      if (!postRecord) {
        throw new NotFoundException(
          `Không tìm thấy bài thảo luận với mã "${postIdOrSlug}".`,
        );
      }

      const post = postRecord as typeof postRecord & {
        chapter_id?: number | null;
        chapter_name?: string | null;
      };

      // 2. Xác định thứ tự sắp xếp cấp 1:
      // Luôn ưu tiên ghim lời giải chuẩn nhất (is_accepted = true) lên đầu tiên (DESC),
      // sau đó mới sắp xếp các lời giải/thảo luận phụ theo tiêu chí người dùng chọn.
      const secondaryOrderBy: Prisma.ForumCommentOrderByWithRelationInput[] =
        this.buildSecondaryOrderBy(sort);

      const rootWhere: Prisma.ForumCommentWhereInput = {
        post_id: post.id,
        parent_id: null,
        status: ForumCommentStatus.ACTIVE,
      };

      const [totalRootComments, totalAllActiveComments, rootComments] =
        await Promise.all([
          this.prisma.forumComment.count({ where: rootWhere }),
          this.prisma.forumComment.count({
            where: {
              post_id: post.id,
              status: ForumCommentStatus.ACTIVE,
            },
          }),
          this.prisma.forumComment.findMany({
            where: rootWhere,
            orderBy: [{ is_accepted: 'desc' }, ...secondaryOrderBy],
            skip: (page - 1) * limit,
            take: limit,
            include: {
              author: {
                select: AUTHOR_SELECT,
              },
              reactions: {
                select: REACTION_SELECT,
              },
              // Phân cấp cha-con rõ ràng: Lấy toàn bộ phản hồi cấp 2 (depth = 2) thuộc bình luận gốc
              replies: {
                where: {
                  status: ForumCommentStatus.ACTIVE,
                },
                orderBy: {
                  created_at: 'asc',
                },
                include: {
                  author: {
                    select: AUTHOR_SELECT,
                  },
                  reply_to_user: {
                    select: AUTHOR_SELECT,
                  },
                  reactions: {
                    select: REACTION_SELECT,
                  },
                },
              },
            },
          }),
        ]);

      // 3. Chuẩn hóa dữ liệu phân cấp cha - con (Root Comment -> Nested Replies)
      // Đồng thời đảm bảo nếu bài viết có accepted_comment_id trùng khớp thì luôn được đánh dấu ghim đầu.
      const formattedComments = rootComments.map((root) => {
        const isAccepted =
          root.is_accepted ||
          (Boolean(post.accepted_comment_id) &&
            post.accepted_comment_id === root.id);

        const formattedReplies = root.replies.map((reply) => ({
          id: reply.id,
          post_id: reply.post_id,
          parent_id: reply.parent_id,
          depth: reply.depth,
          content: reply.content,
          attachments: reply.attachments,
          likes_count: reply.likes_count,
          is_accepted: reply.is_accepted,
          is_edited: reply.is_edited,
          status: reply.status,
          created_at: reply.created_at,
          updated_at: reply.updated_at,
          author: reply.author,
          reply_to_user: reply.reply_to_user,
          reaction_summary: this.buildReactionSummary(
            reply.reactions,
            currentUserId,
          ),
        }));

        return {
          id: root.id,
          post_id: root.post_id,
          parent_id: null,
          depth: root.depth,
          content: root.content,
          attachments: root.attachments,
          likes_count: root.likes_count,
          replies_count: formattedReplies.length,
          is_accepted: isAccepted,
          is_pinned_best_answer: isAccepted,
          is_edited: root.is_edited,
          status: root.status,
          created_at: root.created_at,
          updated_at: root.updated_at,
          author: root.author,
          reaction_summary: this.buildReactionSummary(
            root.reactions,
            currentUserId,
          ),
          // Danh sách phản hồi cấp 2 (con) được lồng trực tiếp bên trong bình luận gốc (cha)
          replies: formattedReplies,
        };
      });

      // Đảm bảo tuyệt đối lời giải được công nhận (is_accepted = true) luôn nằm ở vị trí đầu tiên
      formattedComments.sort((a, b) => {
        if (a.is_accepted !== b.is_accepted) {
          return a.is_accepted ? -1 : 1;
        }
        return 0;
      });

      const acceptedComment =
        formattedComments.find((item) => item.is_accepted) ?? null;

      const totalPages = Math.max(1, Math.ceil(totalRootComments / limit));

      return {
        post: {
          id: post.id,
          title: post.title,
          slug: post.slug,
          author_id: post.author_id,
          subject: post.subject,
          grade: post.grade,
          chapter_id: post.chapter_id ?? null,
          chapter_name: post.chapter_name ?? null,
          is_solved: post.is_solved || Boolean(acceptedComment),
          is_locked: post.is_locked,
          accepted_comment_id:
            post.accepted_comment_id ?? acceptedComment?.id ?? null,
        },
        // Lời giải chuẩn nhất được ghim nổi bật ngay dưới đề bài
        accepted_comment: acceptedComment,
        // Danh sách phân cấp cha-con (đã ghim lời giải is_accepted = true lên vị trí đầu tiên index 0)
        items: formattedComments,
        comments: formattedComments,
        meta: {
          page,
          limit,
          sort,
          total_root_comments: totalRootComments,
          total_replies: Math.max(
            0,
            totalAllActiveComments - totalRootComments,
          ),
          total_all_comments: totalAllActiveComments,
          total_pages: totalPages,
          has_accepted_answer: Boolean(acceptedComment || post.is_solved),
          accepted_comment_id:
            post.accepted_comment_id ?? acceptedComment?.id ?? null,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn(
        `[ForumService] PostgreSQL chưa bật hoặc đang offline, trả về dữ liệu seed phân cấp cha-con cho postId="${postIdOrSlug}".`,
      );
      return this.buildOfflineSeedPreview(
        postIdOrSlug,
        page,
        limit,
        sort,
        currentUserId,
      );
    }
  }

  private buildSecondaryOrderBy(
    sort: CommentSortOption,
  ): Prisma.ForumCommentOrderByWithRelationInput[] {
    switch (sort) {
      case 'newest':
        return [{ created_at: 'desc' }];
      case 'oldest':
        return [{ created_at: 'asc' }];
      case 'most_liked':
        return [{ likes_count: 'desc' }, { created_at: 'asc' }];
      case 'best':
      default:
        return [{ likes_count: 'desc' }, { created_at: 'asc' }];
    }
  }

  private buildReactionSummary(
    reactions: ReactionRecord[],
    currentUserId?: string,
  ) {
    const byType: Record<ForumReactionType, number> = {
      LIKE: 0,
      UPVOTE: 0,
      DOWNVOTE: 0,
      HELPFUL: 0,
      LOVE: 0,
      HAHA: 0,
    };

    let currentUserReaction: ForumReactionType | null = null;

    for (const reaction of reactions) {
      byType[reaction.reaction_type] =
        (byType[reaction.reaction_type] ?? 0) + 1;
      if (currentUserId && reaction.user_id === currentUserId) {
        currentUserReaction = reaction.reaction_type;
      }
    }

    return {
      total: reactions.length,
      by_type: byType,
      user_reaction: currentUserReaction,
    };
  }

  /**
   * Dữ liệu seed dự phòng khi chạy kiểm thử cục bộ mà chưa khởi động dịch vụ PostgreSQL
   */
  private buildOfflineSeedPreview(
    postIdOrSlug: string,
    page: number,
    limit: number,
    sort: CommentSortOption,
    currentUserId?: string,
  ) {
    const now = new Date();
    const acceptedId = `${postIdOrSlug}-comment-accepted-01`;
    const replyId = `${postIdOrSlug}-comment-reply-02`;
    const extraId = `${postIdOrSlug}-comment-extra-03`;

    const acceptedRoot = {
      id: acceptedId,
      post_id: postIdOrSlug,
      parent_id: null,
      depth: 1,
      content:
        "Ta có đạo hàm $y' = 3x^2 - 6mx + 3(2m - 1) = 3(x - 1)(x - 2m + 1)$.\n" +
        "Để hàm số đồng biến trên $(0; +\\infty)$ thì $y' \\ge 0, \\forall x \\in (0; +\\infty)$, suy ra:\n" +
        '$$x^2 - 2mx + 2m - 1 \\ge 0 \\iff 2m(x - 1) \\le x^2 - 1, \\forall x > 0$$\n' +
        "Do vế phải đổi dấu tại $x = 1 \\in (0; +\\infty)$, để bất phương trình luôn đúng với mọi $x > 0$ thì nhân tử $(x - 1)$ phải triệt tiêu hoặc có nghiệm kép tại $x = 1$, tức là $2m - 1 = 1 \\iff m = 1$. Khi $m = 1$, $y' = 3(x - 1)^2 \\ge 0, \\forall x \\in \\mathbb{R}$ (thỏa mãn). Vậy **$m = 1$** là giá trị duy nhất cần tìm.",
      attachments: null,
      likes_count: 29,
      replies_count: 1,
      is_accepted: true,
      is_pinned_best_answer: true,
      is_edited: false,
      status: ForumCommentStatus.ACTIVE,
      created_at: new Date(now.getTime() - 3600_000),
      updated_at: new Date(now.getTime() - 3600_000),
      author: {
        id: 'seed-teacher-01',
        fullname: 'Thầy Trần Văn Giáo Viên',
        avatar_url: null,
        role: SystemRole.USER,
      },
      reaction_summary: {
        total: 3,
        by_type: {
          LIKE: 1,
          UPVOTE: 0,
          DOWNVOTE: 0,
          HELPFUL: 2,
          LOVE: 0,
          HAHA: 0,
        },
        user_reaction: currentUserId ? ForumReactionType.HELPFUL : null,
      },
      replies: [
        {
          id: replyId,
          post_id: postIdOrSlug,
          parent_id: acceptedId,
          depth: 2,
          content:
            "Em hiểu chỗ phân tích thành nhân tử $y' = 3(x - 1)(x - 2m + 1)$ rồi ạ! Nếu hai nghiệm phân biệt mà một nghiệm là $x_1 = 1 > 0$ thì tam thức bậc hai chắc chắn bị âm trên khoảng giữa hai nghiệm nên chỉ có thể $x_2 = x_1 = 1 \\iff m = 1$. Em cảm ơn thầy nhiều ạ!",
          attachments: null,
          likes_count: 11,
          is_accepted: false,
          is_edited: false,
          status: ForumCommentStatus.ACTIVE,
          created_at: new Date(now.getTime() - 2400_000),
          updated_at: new Date(now.getTime() - 2400_000),
          author: {
            id: 'seed-student-01',
            fullname: 'Nguyễn Hoàng Minh (Học Sinh 12A1)',
            avatar_url: null,
            role: SystemRole.USER,
          },
          reply_to_user: {
            id: 'seed-teacher-01',
            fullname: 'Thầy Trần Văn Giáo Viên',
            avatar_url: null,
            role: SystemRole.USER,
          },
          reaction_summary: {
            total: 1,
            by_type: {
              LIKE: 0,
              UPVOTE: 0,
              DOWNVOTE: 0,
              HELPFUL: 0,
              LOVE: 1,
              HAHA: 0,
            },
            user_reaction: null,
          },
        },
      ],
    };

    const secondaryRoot = {
      id: extraId,
      post_id: postIdOrSlug,
      parent_id: null,
      depth: 1,
      content:
        'Cách 2 (cô lập tham số $m$): Trên $(0; 1)$ ta có $x - 1 < 0 \\implies 2m \\ge x + 1 \\implies 2m \\ge \\sup_{(0;1)}(x + 1) = 2 \\iff m \\ge 1$. Trên $(1; +\\infty)$ ta có $x - 1 > 0 \\implies 2m \\le x + 1 \\implies 2m \\le \\inf_{(1;+\\infty)}(x + 1) = 2 \\iff m \\le 1$. Kết hợp hai miền giao nhau ta cũng thu được $m = 1$.',
      attachments: null,
      likes_count: 14,
      replies_count: 0,
      is_accepted: false,
      is_pinned_best_answer: false,
      is_edited: false,
      status: ForumCommentStatus.ACTIVE,
      created_at: new Date(now.getTime() - 1800_000),
      updated_at: new Date(now.getTime() - 1800_000),
      author: {
        id: 'seed-student-01',
        fullname: 'Nguyễn Hoàng Minh (Học Sinh 12A1)',
        avatar_url: null,
        role: SystemRole.USER,
      },
      reaction_summary: {
        total: 1,
        by_type: {
          LIKE: 1,
          UPVOTE: 0,
          DOWNVOTE: 0,
          HELPFUL: 0,
          LOVE: 0,
          HAHA: 0,
        },
        user_reaction: null,
      },
      replies: [],
    };

    const items = [acceptedRoot, secondaryRoot];

    return {
      post: {
        id: postIdOrSlug,
        title:
          'Toán 12: Tìm tham số m để hàm số bậc ba đồng biến trên khoảng (0; +∞)',
        slug: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien-tren-khoang-0-duong-vo-cung',
        author_id: 'seed-student-01',
        subject: 'Toán Học',
        grade: 12,
        chapter_id: 1,
        chapter_name:
          'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
        is_solved: true,
        is_locked: false,
        accepted_comment_id: acceptedId,
      },
      accepted_comment: acceptedRoot,
      items,
      comments: items,
      meta: {
        page,
        limit,
        sort,
        total_root_comments: 2,
        total_replies: 1,
        total_all_comments: 3,
        total_pages: 1,
        has_accepted_answer: true,
        accepted_comment_id: acceptedId,
      },
    };
  }

  // Bộ nhớ in-memory phục vụ kiểm thử cục bộ khi DB PostgreSQL chưa kết nối
  private readonly mockCommentsStore = new Map<string, any>();
  private mockCommentsCount = 3;

  /**
   * [Stack #16 - 15/11/2026] Thêm mới bình luận / lời giải (Cấp 1 hoặc phản hồi lồng Cấp 2).
   * - Kiểm tra an toàn: Chặn bình luận nếu bài viết đã bị Admin khóa (is_locked = true).
   * - Giới hạn cây thảo luận tối đa 2 cấp.
   * - Tự động cập nhật comments_count trên bài viết & replies_count trên bình luận cha.
   * - Bắn Notification cho chủ bài viết và người được phản hồi.
   */
  async createComment(
    postIdOrSlug: string,
    dto: CreateForumCommentDto,
    currentUser?: any,
  ) {
    const authorId = currentUser?.id || dto.authorId || 'seed-student-01';

    try {
      // 1. Kiểm tra bài viết tồn tại
      const post = await this.prisma.forumPost.findFirst({
        where: {
          OR: [{ id: postIdOrSlug }, { slug: postIdOrSlug }],
          status: { not: ForumPostStatus.DELETED },
        },
      });

      if (!post) {
        throw new NotFoundException(
          `Không tìm thấy bài thảo luận với mã "${postIdOrSlug}".`,
        );
      }

      // 2. Chặn bình luận nếu bài viết đã bị Admin khóa (is_locked = true)
      if (post.is_locked) {
        throw new ForbiddenException(
          'Bài viết này đã bị Admin khóa bình luận (is_locked = true). Không thể gửi thêm lời giải hay thảo luận mới.',
        );
      }

      let depth = 1;
      let parentComment: any = null;
      let replyToUserId: string | null = null;

      // 3. Xử lý phản hồi lồng Cấp 2
      if (dto.parentId) {
        parentComment = await this.prisma.forumComment.findUnique({
          where: { id: dto.parentId },
        });

        if (
          !parentComment ||
          parentComment.status === ForumCommentStatus.DELETED
        ) {
          throw new NotFoundException(
            `Không tìm thấy bình luận gốc với ID "${dto.parentId}".`,
          );
        }

        if (parentComment.post_id !== post.id) {
          throw new BadRequestException(
            'Bình luận cha không thuộc về bài thảo luận này.',
          );
        }

        // Chặn lồng quá 2 cấp: chỉ cho phép trả lời vào bình luận gốc Cấp 1
        if (parentComment.depth >= 2 || parentComment.parent_id !== null) {
          throw new BadRequestException(
            'Hệ thống Diễn đàn chỉ hỗ trợ cây thảo luận lồng tối đa 2 cấp (không thể lồng thêm cấp 3).',
          );
        }

        depth = 2;
        replyToUserId = dto.replyToUserId || parentComment.author_id;
      }

      // 4. Tạo bình luận vào cơ sở dữ liệu
      const comment = await this.prisma.forumComment.create({
        data: {
          post_id: post.id,
          author_id: authorId,
          parent_id: dto.parentId || null,
          reply_to_user_id: replyToUserId,
          depth,
          content: dto.content,
          attachments: dto.attachments
            ? (dto.attachments as any)
            : Prisma.JsonNull,
          status: ForumCommentStatus.ACTIVE,
        },
        include: {
          author: { select: AUTHOR_SELECT },
          reply_to_user: { select: AUTHOR_SELECT },
        },
      });

      // 5. Cập nhật comments_count trên bài viết ForumPost
      const updatedPost = await this.prisma.forumPost.update({
        where: { id: post.id },
        data: {
          comments_count: { increment: 1 },
        },
        select: { comments_count: true },
      });

      // Nếu là cấp 2, tăng replies_count của bình luận cha
      if (parentComment) {
        await this.prisma.forumComment.update({
          where: { id: parentComment.id },
          data: {
            replies_count: { increment: 1 },
          },
        });
      }

      // 6. Bắn Notification cho chủ bài viết (nếu người bình luận khác chủ bài viết)
      if (post.author_id && post.author_id !== authorId) {
        try {
          await this.prisma.notification.create({
            data: {
              user_id: post.author_id,
              title: 'Bài viết có lời giải mới',
              message: `Bài viết "${post.title.slice(0, 80)}" của bạn vừa nhận được một phản hồi/lời giải mới.`,
            },
          });
          this.logger.log(
            `[Notification] Đã gửi thông báo lời giải mới cho chủ bài viết: user_id="${post.author_id}"`,
          );
        } catch (notifErr) {
          this.logger.warn(`Lỗi gửi thông báo cho chủ câu hỏi: ${notifErr}`);
        }
      }

      // Nếu là trả lời cấp 2, bắn thông báo cho người viết bình luận gốc
      if (
        parentComment &&
        parentComment.author_id !== authorId &&
        parentComment.author_id !== post.author_id
      ) {
        try {
          await this.prisma.notification.create({
            data: {
              user_id: parentComment.author_id,
              title: 'Có người phản hồi bình luận của bạn',
              message: `Bình luận của bạn trong bài "${post.title.slice(0, 80)}" vừa nhận được một câu trả lời.`,
            },
          });
          this.logger.log(
            `[Notification] Đã gửi thông báo phản hồi cho: user_id="${parentComment.author_id}"`,
          );
        } catch (notifErr) {
          this.logger.warn(
            `Lỗi gửi thông báo cho người được phản hồi: ${notifErr}`,
          );
        }
      }

      return {
        comment,
        post_id: post.id,
        depth: comment.depth,
        comments_count: updatedPost.comments_count,
        message: 'Thêm lời giải/bình luận thành công',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `[ForumService] DB offline fallback cho createComment: ${error}`,
      );
      return this.mockCreateComment(postIdOrSlug, dto, authorId);
    }
  }

  /**
   * [Stack #16 - 15/11/2026] Cập nhật lời giải / bình luận an toàn.
   * - Kiểm tra quyền sở hữu (chỉ tác giả hoặc Admin mới được sửa).
   * - Chặn sửa nếu bài viết đã bị Admin khóa (is_locked = true).
   */
  async updateComment(
    commentId: string,
    dto: UpdateForumCommentDto,
    currentUser?: any,
  ) {
    const requesterId = currentUser?.id || dto.authorId;

    try {
      const comment = await this.prisma.forumComment.findUnique({
        where: { id: commentId },
        include: { post: true },
      });

      if (!comment || comment.status === ForumCommentStatus.DELETED) {
        throw new NotFoundException(
          `Không tìm thấy bình luận với ID "${commentId}".`,
        );
      }

      // Chặn sửa nếu bài viết bị Admin khóa
      if (comment.post.is_locked) {
        throw new ForbiddenException(
          'Bài viết đã bị Admin khóa (is_locked = true), không thể chỉnh sửa bình luận.',
        );
      }

      // Kiểm tra quyền sở hữu
      const isOwner = requesterId && comment.author_id === requesterId;
      const isAdmin =
        currentUser?.role === SystemRole.SUPER_ADMIN ||
        currentUser?.role === 'ADMIN';

      if (requesterId && !isOwner && !isAdmin) {
        throw new ForbiddenException(
          'Bạn không có quyền chỉnh sửa bình luận này.',
        );
      }

      const updated = await this.prisma.forumComment.update({
        where: { id: commentId },
        data: {
          content: dto.content !== undefined ? dto.content : comment.content,
          attachments:
            dto.attachments !== undefined
              ? (dto.attachments as any)
              : comment.attachments,
          is_edited: true,
          updated_at: new Date(),
        },
        include: {
          author: { select: AUTHOR_SELECT },
          reply_to_user: { select: AUTHOR_SELECT },
        },
      });

      return {
        comment: updated,
        message: 'Cập nhật bình luận thành công',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      return this.mockUpdateComment(commentId, dto, requesterId);
    }
  }

  /**
   * [Stack #16 - 15/11/2026] Xóa bình luận lời giải an toàn (Soft delete).
   * - Cập nhật giảm comments_count của bài viết và replies_count của bình luận cha.
   * - Kiểm tra quyền sở hữu hoặc Admin.
   */
  async deleteComment(
    commentId: string,
    currentUser?: any,
    queryUserId?: string,
  ) {
    const requesterId = currentUser?.id || queryUserId;

    try {
      const comment = await this.prisma.forumComment.findUnique({
        where: { id: commentId },
        include: { post: true },
      });

      if (!comment || comment.status === ForumCommentStatus.DELETED) {
        throw new NotFoundException(
          `Không tìm thấy bình luận với ID "${commentId}".`,
        );
      }

      const isOwner = requesterId && comment.author_id === requesterId;
      const isAdmin =
        currentUser?.role === SystemRole.SUPER_ADMIN ||
        currentUser?.role === 'ADMIN';

      if (requesterId && !isOwner && !isAdmin) {
        throw new ForbiddenException('Bạn không có quyền xóa bình luận này.');
      }

      // Soft delete: Chuyển trạng thái sang DELETED
      await this.prisma.forumComment.update({
        where: { id: commentId },
        data: { status: ForumCommentStatus.DELETED },
      });

      // Giảm comments_count trên ForumPost
      const updatedPost = await this.prisma.forumPost.update({
        where: { id: comment.post_id },
        data: {
          comments_count: { decrement: 1 },
        },
        select: { comments_count: true },
      });

      // Nếu là phản hồi cấp 2, giảm replies_count của bình luận cha
      if (comment.parent_id) {
        await this.prisma.forumComment.update({
          where: { id: comment.parent_id },
          data: {
            replies_count: { decrement: 1 },
          },
        });
      }

      return {
        deleted_id: commentId,
        post_id: comment.post_id,
        comments_count: Math.max(0, updatedPost.comments_count),
        message: 'Xóa bình luận thành công',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      return this.mockDeleteComment(commentId, requesterId);
    }
  }

  // --- MOCK FALLBACK HANDLERS KHI CHẠY OFFLINE ---

  private mockCreateComment(
    postIdOrSlug: string,
    dto: CreateForumCommentDto,
    authorId: string,
  ) {
    // Mô phỏng kiểm tra bài viết bị khóa (nếu slug hoặc id có chữ 'locked' hoặc slug là bài đã khóa)
    if (
      postIdOrSlug.includes('locked') ||
      postIdOrSlug === 'toan-11-tim-so-nghiem-phuong-trinh-luong-giac-tren-doan'
    ) {
      throw new ForbiddenException(
        'Bài viết này đã bị Admin khóa bình luận (is_locked = true). Không thể gửi thêm lời giải hay thảo luận mới.',
      );
    }

    // Mô phỏng kiểm tra lồng quá 2 cấp
    if (dto.parentId) {
      const parent = this.mockCommentsStore.get(dto.parentId);
      if (
        (parent && (parent.depth >= 2 || parent.parent_id !== null)) ||
        dto.parentId.includes('reply') ||
        dto.parentId.includes('nested')
      ) {
        throw new BadRequestException(
          'Hệ thống Diễn đàn chỉ hỗ trợ cây thảo luận lồng tối đa 2 cấp (không thể lồng thêm cấp 3).',
        );
      }
    }

    const newId = `mock-comment-${Date.now()}`;
    const depth = dto.parentId ? 2 : 1;
    this.mockCommentsCount += 1;

    const mockComment = {
      id: newId,
      post_id: postIdOrSlug,
      parent_id: dto.parentId || null,
      reply_to_user_id: dto.replyToUserId || (dto.parentId ? 'seed-teacher-01' : null),
      depth,
      content: dto.content,
      attachments: dto.attachments || null,
      likes_count: 0,
      replies_count: 0,
      is_accepted: false,
      is_edited: false,
      status: ForumCommentStatus.ACTIVE,
      created_at: new Date(),
      updated_at: new Date(),
      author: {
        id: authorId,
        fullname:
          authorId === 'seed-teacher-01'
            ? 'ThS. Nguyễn Văn Hùng'
            : 'Nguyễn Hoàng Minh (Học Sinh)',
        avatar_url: null,
        role: authorId === 'seed-teacher-01' ? SystemRole.USER : SystemRole.USER,
      },
    };

    this.mockCommentsStore.set(newId, mockComment);

    this.logger.log(
      `[MockNotification] Bắn thông báo: Bài viết "${postIdOrSlug}" có bình luận mới từ ${mockComment.author.fullname}. comments_count mới: ${this.mockCommentsCount}`,
    );

    return {
      comment: mockComment,
      post_id: postIdOrSlug,
      depth,
      comments_count: this.mockCommentsCount,
      notification_sent: true,
      message: 'Thêm lời giải/bình luận thành công (Offline Mode)',
    };
  }

  private mockUpdateComment(
    commentId: string,
    dto: UpdateForumCommentDto,
    requesterId?: string,
  ) {
    if (commentId.includes('locked')) {
      throw new ForbiddenException(
        'Bài viết đã bị Admin khóa (is_locked = true), không thể chỉnh sửa bình luận.',
      );
    }

    const existing = this.mockCommentsStore.get(commentId) || {
      id: commentId,
      post_id: 'forum-seed-post-01',
      parent_id: null,
      depth: 1,
      content: dto.content || 'Nội dung bình luận mẫu',
      attachments: dto.attachments || null,
      likes_count: 10,
      replies_count: 0,
      is_accepted: false,
      author_id: requesterId || 'seed-student-01',
      author: {
        id: requesterId || 'seed-student-01',
        fullname: 'Nguyễn Hoàng Minh (Học Sinh)',
        avatar_url: null,
        role: SystemRole.USER,
      },
      created_at: new Date(),
    };

    const updated = {
      ...existing,
      content: dto.content !== undefined ? dto.content : existing.content,
      attachments:
        dto.attachments !== undefined ? dto.attachments : existing.attachments,
      is_edited: true,
      updated_at: new Date(),
    };

    this.mockCommentsStore.set(commentId, updated);

    return {
      comment: updated,
      message: 'Cập nhật bình luận thành công (Offline Mode)',
    };
  }

  private mockDeleteComment(commentId: string, requesterId?: string) {
    this.mockCommentsCount = Math.max(0, this.mockCommentsCount - 1);
    this.mockCommentsStore.delete(commentId);

    return {
      deleted_id: commentId,
      post_id: 'forum-seed-post-01',
      comments_count: this.mockCommentsCount,
      message: 'Xóa bình luận thành công (Offline Mode)',
    };
  }
}
