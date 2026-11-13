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
      '[Stack #16] Thêm lời giải / bình luận mới (hỗ trợ phân cấp 2 cấp, cập nhật comments_count & gửi thông báo cho chủ câu hỏi)',
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
      '[Stack #16] Chỉnh sửa lời giải / bình luận an toàn (chặn nếu bài viết bị Admin khóa is_locked & kiểm tra quyền)',
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
      '[Stack #16] Xóa lời giải / bình luận an toàn (Soft delete, tự động giảm comments_count trên bài viết)',
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
}
