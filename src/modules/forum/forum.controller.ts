import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ForumService } from './forum.service';
import { GetPostCommentsQueryDto } from './dto/get-post-comments.dto';
import { CreateForumCommentDto } from './dto/create-comment.dto';
import { UpdateForumCommentDto } from './dto/update-comment.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { AcceptCommentDto } from './dto/accept-comment.dto';
import { CreateForumReportDto } from './dto/create-forum-report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Forum & Community (Diễn đàn học thuật)')
@Controller(['api/v1/forum', 'forum'])
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('posts/:postId/comments')
  @ApiOperation({
    summary:
      'Lấy danh sách lời giải & thảo luận phân cấp cha-con (ưu tiên ghim Lời giải được chấp nhận is_accepted = true lên đầu)',
    description:
      'Trả về cây bình luận 2 cấp (Cấp 1: Lời giải gốc, Cấp 2: Thảo luận phản hồi lồng bên trong `replies`), luôn ghim lời giải chuẩn nhất (`is_accepted = true`) ngay đầu danh sách dưới đề bài.',
  })
  @ApiParam({
    name: 'postId',
    description: 'ID hoặc Slug của bài viết/câu hỏi trên diễn đàn',
    example: 'forum-seed-post-01',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lấy danh sách lời giải phân cấp cha-con thành công, lời giải chuẩn nhất được ghim lên đầu',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bài viết trên diễn đàn',
  })
  async getPostComments(
    @Param('postId') postId: string,
    @Query() query: GetPostCommentsQueryDto,
  ) {
    const data = await this.forumService.getPostComments(postId, query);
    return {
      success: true,
      message:
        'Lấy danh sách lời giải phân cấp thành công (đã ưu tiên ghim lời giải được chấp nhận lên đầu)',
      data,
    };
  }

  @Post('posts/:postId/comments')
  @ApiOperation({
    summary:
      'Thêm lời giải / bình luận mới (hỗ trợ phân cấp 2 cấp, cập nhật comments_count & gửi thông báo cho chủ câu hỏi)',
    description:
      'Thêm mới lời giải Cấp 1 (parentId để trống) hoặc phản hồi thảo luận Cấp 2 (truyền parentId). Chặn bình luận nếu bài viết đã bị Admin khóa (`is_locked = true`). Tự động tăng `comments_count` trên `ForumPost` và gửi `Notification` cho chủ câu hỏi.',
  })
  @ApiParam({
    name: 'postId',
    description: 'ID hoặc Slug của bài viết/câu hỏi trên diễn đàn',
    example: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien-tren-khoang-0-duong-vo-cung',
  })
  @ApiBody({ type: CreateForumCommentDto })
  @ApiResponse({
    status: 201,
    description:
      'Thêm lời giải/bình luận thành công, comments_count đã được cập nhật',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc cố gắng lồng bình luận vượt quá 2 cấp',
  })
  @ApiResponse({
    status: 403,
    description: 'Bài viết đã bị Admin khóa (is_locked = true), không thể bình luận',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bài viết hoặc bình luận cha',
  })
  async createComment(
    @Param('postId') postId: string,
    @Body() dto: CreateForumCommentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.createComment(postId, dto, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('comments/:commentId')
  @ApiOperation({
    summary:
      'Chỉnh sửa lời giải / bình luận an toàn (chặn nếu bài viết bị Admin khóa is_locked & kiểm tra quyền)',
    description:
      'Cho phép tác giả hoặc Admin chỉnh sửa nội dung lời giải hoặc ảnh đính kèm. Chặn chỉnh sửa nếu bài viết gốc đã bị Admin khóa (`is_locked = true`).',
  })
  @ApiParam({
    name: 'commentId',
    description: 'ID của bình luận cần chỉnh sửa',
    example: 'forum-seed-post-01-comment-accepted-01',
  })
  @ApiBody({ type: UpdateForumCommentDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật bình luận thành công',
  })
  @ApiResponse({
    status: 403,
    description: 'Bài viết đã bị Admin khóa hoặc bạn không có quyền sửa bình luận này',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bình luận cần sửa',
  })
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateForumCommentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.updateComment(commentId, dto, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Delete('comments/:commentId')
  @ApiOperation({
    summary:
      'Xóa lời giải / bình luận an toàn (Soft delete, tự động giảm comments_count trên bài viết)',
    description:
      'Xóa an toàn (Soft delete: đổi trạng thái sang DELETED), tự động giảm bộ đếm `comments_count` trên bài viết `ForumPost` và `replies_count` trên bình luận cha nếu là Cấp 2.',
  })
  @ApiParam({
    name: 'commentId',
    description: 'ID của bình luận cần xóa',
    example: 'forum-seed-post-01-comment-extra-03',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'ID người thực hiện xóa (dùng khi test trên Swagger không kèm Bearer token)',
    example: 'seed-student-01',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa bình luận thành công, comments_count đã được giảm',
  })
  @ApiResponse({
    status: 403,
    description: 'Bạn không có quyền xóa bình luận này',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bình luận',
  })
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: any,
    @Query('userId') queryUserId?: string,
  ) {
    const data = await this.forumService.deleteComment(
      commentId,
      user,
      queryUserId,
    );
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post('reactions/toggle')
  @ApiOperation({
    summary:
      'Thả / gỡ Hữu ích (ThumbsUp) cho Bài hỏi & Lời giải không bị race condition',
    description:
      'Cho phép học sinh bình chọn ThumbsUp cho Bài hỏi (targetType = POST) hoặc Lời giải (targetType = COMMENT). Cập nhật nguyên tử bộ đếm likes_count tức thì không bị race condition.',
  })
  @ApiBody({ type: ToggleReactionDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái Hữu ích thành công',
  })
  async toggleReaction(
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.toggleReaction(dto, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('posts/:postId/accept-comment')
  @ApiOperation({
    summary:
      'Chốt Lời giải chuẩn nhất, cộng thưởng Ngọc Tri Thức & gia cố chống gian lận',
    description:
      'Chốt câu trả lời đúng (is_accepted = true), đánh dấu bài hỏi đã giải quyết (is_solved = true), cộng thưởng 15 Ngọc Tri Thức cho người giải và bắn Notification. Gia cố chống gian lận: CẤM tự tick bài của chính mình để farm Ngọc, kiểm tra quyền chủ bài viết.',
  })
  @ApiParam({
    name: 'postId',
    description: 'ID hoặc Slug của bài viết',
    example: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiBody({ type: AcceptCommentDto })
  @ApiResponse({
    status: 200,
    description:
      'Công nhận lời giải chuẩn nhất thành công và đã cộng thưởng Ngọc Tri Thức',
  })
  @ApiResponse({
    status: 400,
    description:
      'Lỗi chống gian lận (tự tick bài của chính mình để nhận Ngọc) hoặc dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: 403,
    description: 'Chỉ chủ bài viết hoặc Quản trị viên mới có quyền công nhận',
  })
  async acceptComment(
    @Param('postId') postId: string,
    @Body() dto: AcceptCommentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.acceptComment(
      postId,
      dto?.commentId,
      dto,
      user,
    );
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('posts/:postId/accept-comment/:commentId')
  @ApiOperation({
    summary:
      'Chốt Lời giải chuẩn nhất theo đường dẫn postId và commentId',
    description:
      'Chốt câu trả lời đúng theo URL param, đánh dấu bài hỏi đã giải quyết, cộng thưởng 15 Ngọc Tri Thức và kiểm tra chống gian lận.',
  })
  @ApiParam({
    name: 'postId',
    description: 'ID hoặc Slug của bài viết',
    example: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiParam({
    name: 'commentId',
    description: 'ID của lời giải Cấp 1 cần công nhận',
    example: 'cmt-accepted-01',
  })
  async acceptCommentWithParam(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: AcceptCommentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.acceptComment(
      postId,
      commentId,
      dto,
      user,
    );
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('comments/:commentId/accept')
  @ApiOperation({
    summary:
      'Chốt Lời giải chuẩn nhất trực tiếp theo commentId',
    description:
      'Tự động tìm bài viết cha từ commentId và kích hoạt nghiệp vụ công nhận Lời giải chuẩn nhất kèm thưởng Ngọc Tri Thức.',
  })
  @ApiParam({
    name: 'commentId',
    description: 'ID của lời giải Cấp 1 cần công nhận',
    example: 'cmt-accepted-01',
  })
  async acceptCommentDirect(
    @Param('commentId') commentId: string,
    @Body() dto: AcceptCommentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.acceptCommentDirect(
      commentId,
      dto,
      user,
    );
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post('reports')
  @ApiOperation({
    summary: 'Báo cáo vi phạm quy tắc cộng đồng (bài viết hoặc bình luận)',
    description:
      'Cho phép học sinh và giáo viên báo cáo bài đăng hoặc bình luận spam, quảng cáo, sai kiến thức hoặc ngôn từ thiếu chuẩn mực.',
  })
  @ApiBody({ type: CreateForumReportDto })
  @ApiResponse({
    status: 201,
    description: 'Gửi báo cáo vi phạm thành công',
  })
  async createReport(
    @Body() dto: CreateForumReportDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.forumService.createReport(dto, user);
    return {
      success: true,
      message: data.message,
      data: data.report,
    };
  }
}
