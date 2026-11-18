/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  CreateForumPostDto,
  GetForumPostsQueryDto,
  ToggleForumBookmarkDto,
  ToggleForumLikeDto,
  UpdateForumPostDto,
} from '../dto/forum-post.dto';
import { ForumPostsService } from './forum-posts.service';

@ApiTags('Forum & Community (Diễn đàn học thuật)')
@Controller(['api/v1/forum', 'forum'])
export class ForumPostsController {
  constructor(private readonly forumPostsService: ForumPostsService) {}

  // =========================================================================
  // 1. TASK #15: API THỐNG KÊ CỘNG ĐỒNG & DANH SÁCH BOOKMARK
  // =========================================================================

  @Get(['stats', 'community-stats'])
  @ApiOperation({
    summary:
      '[Task #15] Lấy số liệu thống kê thực tế cho cột phải trang Diễn đàn (Tổng câu hỏi, Tỷ lệ đã giải, Top chủ đề nóng, Top thành viên)',
    description:
      'Cung cấp toàn bộ số liệu thực tế từ PostgreSQL: tổng số câu hỏi, số câu đã giải, tỷ lệ đã giải (%), phân bố theo môn học, top 5 chủ đề sôi nổi nhất, top nhãn chủ đề (tags) và bảng xếp hạng thành viên tích cực.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thống kê cộng đồng diễn đàn thành công',
  })
  async getCommunityStats() {
    const data = await this.forumPostsService.getCommunityStats();
    return {
      success: true,
      message: 'Lấy thống kê cộng đồng diễn đàn thành công',
      data,
    };
  }

  @Get('bookmarks')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Task #15] Lấy danh sách các câu hỏi đã lưu (Bookmark) của người dùng hiện tại',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description:
      'ID người dùng (fallback khi test trên Swagger không kèm Bearer Token)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách câu hỏi đã lưu thành công',
  })
  async getUserBookmarks(
    @Req() req: any,
    @CurrentUser() user: any,
    @Query('userId') queryUserId?: string,
  ) {
    const data = await this.forumPostsService.getUserBookmarks(
      req,
      user,
      queryUserId,
    );
    return {
      success: true,
      message: 'Lấy danh sách câu hỏi đã lưu thành công',
      data: data.items,
      total: data.total,
      meta: data,
    };
  }

  // =========================================================================
  // 2. TASK #17: API DANH SÁCH BÀI VIẾT HỖ TRỢ LỌC ĐA TIÊU CHÍ, TÌM KIẾM & SẮP XẾP
  // =========================================================================

  @Get('posts')
  @ApiOperation({
    summary:
      '[Task #17] Lấy danh sách câu hỏi diễn đàn hỗ trợ lọc đa tiêu chí (Môn, Khối, Chương, Tag, Tab), tìm kiếm & sắp xếp hiệu năng cao',
    description:
      'Hỗ trợ lọc theo `subject` (cả tên tiếng Việt có dấu lẫn slug), `grade` (10, 11, 12), `chapterId`, `tag`, `tab` (ALL | HOT | UNSOLVED | SOLVED | BOOKMARKED), tìm kiếm `search`/`q` và sắp xếp `sort` (latest | hot | most_viewed | most_liked | most_commented | oldest | unsolved). Luôn ghim bài Nội quy (`is_pinned = true`) lên đầu danh sách.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách bài thảo luận kèm phân trang thành công',
  })
  async getForumPosts(
    @Query() query: GetForumPostsQueryDto,
    @Req() req: any,
    @CurrentUser() user: any,
  ) {
    const requester = await this.forumPostsService.resolveRequester(
      req,
      user,
      query.userId || query.user_id,
      false,
    );
    const result = await this.forumPostsService.getPosts(query, requester);
    return {
      success: true,
      message: 'Lấy danh sách câu hỏi diễn đàn thành công',
      data: result.items,
      pagination: result.pagination,
      filters: result.filters_applied,
    };
  }

  // =========================================================================
  // 3. TASK #16: API CHI TIẾT BÀI VIẾT THEO SLUG (TĂNG VIEW THÔNG MINH) & CRUD CHỐNG IDOR
  // =========================================================================

  @Get('posts/:slug')
  @ApiOperation({
    summary:
      '[Task #16] Lấy chi tiết câu hỏi theo slug (hoặc ID) kèm cơ chế tăng view thông minh chống spam F5',
    description:
      'Tìm bài viết theo `slug` tiếng Việt (hoặc UUID `id`), tự động tăng `views_count` thông minh (chống cộng dồn view ảo khi cùng một người dùng/IP tải lại trang trong 15 phút), đồng thời trả về trạng thái Bookmark, Reaction breakdown và danh sách câu hỏi liên quan cùng môn.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug tiếng Việt hoặc UUID của câu hỏi trên diễn đàn',
    example: 'hoi-bai-toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description:
      'ID người xem (để kiểm tra trạng thái đã lưu Bookmark / Reaction và chống trùng lặp lượt xem)',
  })
  @ApiQuery({
    name: 'trackView',
    required: false,
    description:
      'Mặc định true; truyền false nếu chỉ muốn đọc dữ liệu mà không tính lượt xem',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết câu hỏi thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy câu hỏi với slug tương ứng',
  })
  async getForumPostBySlug(
    @Param('slug') slug: string,
    @Req() req: any,
    @CurrentUser() user: any,
    @Query('userId') queryUserId?: string,
    @Query('trackView') trackView?: string,
  ) {
    const requester = await this.forumPostsService.resolveRequester(
      req,
      user,
      queryUserId,
      false,
    );
    const forwardedFor = req?.headers?.['x-forwarded-for'];
    const viewerIp =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      'local-ip';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'browser';

    const data = await this.forumPostsService.getPostDetailBySlug(slug, {
      viewerId: requester?.id,
      viewerIp: String(viewerIp),
      userAgent,
      trackView: trackView !== 'false' && trackView !== '0',
    });

    return {
      success: true,
      message: 'Lấy chi tiết câu hỏi thảo luận thành công',
      data,
    };
  }

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Task #16] Đăng câu hỏi mới lên Diễn đàn (tự tạo slug tiếng Việt duy nhất & nhận diện công thức KaTeX)',
    description:
      'Tạo bài thảo luận mới, tự động sinh `slug` tiếng Việt chuẩn SEO (nối hậu tố `-2`, `-3` nếu trùng tiêu đề), tự động đánh dấu `has_math = true` khi phát hiện cú pháp LaTeX `$...$` hoặc `$$...$$`, và trích xuất `content_plain` phục vụ tìm kiếm.',
  })
  @ApiBody({ type: CreateForumPostDto })
  @ApiResponse({
    status: 201,
    description:
      'Đăng câu hỏi mới thành công, trả về bài viết kèm slug duy nhất',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu đầu vào không hợp lệ',
  })
  async createForumPost(
    @Body() dto: CreateForumPostDto,
    @Req() req: any,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumPostsService.createPost(dto, req, user);
    return {
      success: true,
      message: 'Đăng câu hỏi thành công!',
      data,
    };
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (!allowedMimeTypes.includes((file.mimetype || '').toLowerCase())) {
          return cb(
            new BadRequestException({
              success: false,
              message:
                'Định dạng file không hợp lệ. Chỉ chấp nhận ảnh image/jpeg, image/png, image/webp hoặc image/gif.',
            }),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      '[Task #11] Upload ảnh chụp đề bài / vở nháp (<= 5MB) lên Cloudinary (POST /api/v1/forum/upload)',
    description:
      'Nhận file ảnh (JPG, PNG, WEBP, GIF dung lượng tối đa 5MB) qua field `file` trong `multipart/form-data`. Tải lên Cloudinary folder `schoolify_forum` (hoặc tự động fallback lưu trữ tĩnh `/uploads/schoolify_forum` khi môi trường local chưa điền CLOUDINARY_API_KEY) và trả về `{ url, secure_url, public_id }`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh chụp đề bài (JPG, PNG, WEBP, GIF <= 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Upload ảnh đề bài thành công, trả về url, secure_url và public_id',
  })
  @ApiResponse({
    status: 400,
    description: 'File vượt quá 5MB hoặc sai định dạng ảnh',
  })
  async uploadForumImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const data = await this.forumPostsService.uploadForumAttachment(file, req);
    return {
      success: true,
      message: 'Tải ảnh chụp đề bài lên thành công!',
      data,
    };
  }

  @Patch('posts/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Task #16] Chỉnh sửa câu hỏi (Kiểm tra quyền sở hữu author_id nghiêm ngặt chống lỗ hổng IDOR)',
    description:
      'Chỉ tác giả của câu hỏi (`post.author_id === user.id`) hoặc Quản trị viên (`SUPER_ADMIN`) mới được phép cập nhật nội dung. Mọi yêu cầu từ tài khoản khác sẽ bị chặn với mã `403 Forbidden` (Chống IDOR).',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của câu hỏi cần chỉnh sửa',
    example: 'hoi-bai-toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'ID người thực hiện (fallback khi test trên Swagger)',
  })
  @ApiBody({ type: UpdateForumPostDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật câu hỏi thành công',
  })
  @ApiResponse({
    status: 403,
    description: 'Chặn IDOR: Bạn không phải là tác giả của câu hỏi này',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy câu hỏi',
  })
  async updateForumPost(
    @Param('id') id: string,
    @Body() dto: UpdateForumPostDto,
    @Req() req: any,
    @CurrentUser() user: any,
    @Query('userId') queryUserId?: string,
  ) {
    const data = await this.forumPostsService.updatePost(
      id,
      dto,
      req,
      user,
      queryUserId,
    );
    return {
      success: true,
      message: 'Cập nhật câu hỏi thành công',
      data,
    };
  }

  @Delete('posts/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Task #16] Xóa câu hỏi an toàn (Soft Delete & Kiểm tra quyền sở hữu chống lỗ hổng IDOR)',
    description:
      'Chỉ tác giả của câu hỏi (`post.author_id === user.id`) hoặc Quản trị viên (`SUPER_ADMIN`) mới có quyền xóa. Thực hiện Soft Delete (`status = DELETED`). Chặn xóa bài Nội quy đang ghim nếu không phải Admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của câu hỏi cần xóa',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'ID người thực hiện xóa (fallback khi test trên Swagger)',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa câu hỏi thành công',
  })
  @ApiResponse({
    status: 403,
    description: 'Chặn IDOR: Bạn không phải là tác giả của câu hỏi này',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy câu hỏi',
  })
  async deleteForumPost(
    @Param('id') id: string,
    @Req() req: any,
    @CurrentUser() user: any,
    @Query('userId') queryUserId?: string,
  ) {
    const data = await this.forumPostsService.deletePost(
      id,
      req,
      user,
      queryUserId,
    );
    return {
      success: true,
      message: 'Xóa câu hỏi thành công',
      data,
    };
  }

  // =========================================================================
  // 4. TASK #15: API LƯU / BỎ LƯU (TOGGLE BOOKMARK) CÂU HỎI QUAN TÂM
  // =========================================================================

  @Post('posts/:id/bookmark')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[Task #15] Lưu / Bỏ lưu (Toggle Bookmark) câu hỏi quan tâm (POST /api/v1/forum/posts/:id/bookmark)',
    description:
      'Nếu người dùng chưa lưu bài viết thì tạo bản ghi `ForumBookmark` mới và tăng `bookmarks_count` (+1). Nếu đã lưu trước đó thì tự động bỏ lưu (xóa bản ghi) và giảm `bookmarks_count` (-1) trong cùng một Transaction nguyên tử.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của câu hỏi cần lưu / bỏ lưu',
    example: 'hoi-bai-toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiBody({ type: ToggleForumBookmarkDto, required: false })
  @ApiResponse({
    status: 200,
    description:
      'Lưu hoặc bỏ lưu câu hỏi thành công, trả về trạng thái bookmarked & bookmarks_count mới',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy câu hỏi',
  })
  async togglePostBookmark(
    @Param('id') id: string,
    @Body() dto: ToggleForumBookmarkDto = {},
    @Req() req: any,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumPostsService.toggleBookmark(
      id,
      dto,
      req,
      user,
    );
    return {
      success: true,
      message: data.message,
      bookmarked: data.bookmarked,
      is_bookmarked: data.is_bookmarked,
      bookmarks_count: data.bookmarks_count,
      data,
    };
  }

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Thả tim / Bỏ tim (Toggle Like / Reaction) bài viết (POST /api/v1/forum/posts/:id/like)',
    description:
      'Nếu người dùng chưa thả cảm xúc thì tạo bản ghi `ForumReaction` mới và tăng `likes_count` (+1). Nếu đã thả trước đó thì tự động bỏ thích và giảm `likes_count` (-1) trong cùng một Transaction nguyên tử.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của câu hỏi cần thả tim / bỏ tim',
    example: 'hoi-bai-toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiBody({ type: ToggleForumLikeDto, required: false })
  @ApiResponse({
    status: 200,
    description:
      'Thả tim hoặc bỏ tim thành công, trả về likes_count và is_liked mới',
  })
  async togglePostLike(
    @Param('id') id: string,
    @Body() dto: ToggleForumLikeDto = {},
    @Req() req: any,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumPostsService.toggleLike(id, dto, req, user);
    return {
      success: true,
      message: data.message,
      likes_count: data.likes_count,
      is_liked: data.is_liked,
      data,
    };
  }
}
