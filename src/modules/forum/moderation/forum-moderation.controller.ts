import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ForumModerationService } from './forum-moderation.service';
import { GetReportsQueryDto } from './dto/get-reports-query.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Forum Moderation (Kiểm duyệt diễn đàn Admin)')
@Controller(['api/v1/forum/moderation', 'forum/moderation'])
export class ForumModerationController {
  constructor(
    private readonly moderationService: ForumModerationService,
  ) {}

  @Patch('posts/:id/pin')
  @ApiOperation({
    summary: 'Ghim / Bỏ ghim bài viết lên đầu diễn đàn (SUPER_ADMIN)',
    description:
      'Chỉ dành cho SUPER_ADMIN: Đảo trạng thái is_pinned của bài viết để ghim các thông báo, chủ đề tiêu biểu lên đầu trang.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của bài viết',
    example: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã thay đổi trạng thái ghim bài viết thành công',
  })
  async togglePinPost(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.moderationService.togglePinPost(id, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('posts/:id/lock')
  @ApiOperation({
    summary: 'Khóa / Mở khóa bình luận bài viết (SUPER_ADMIN)',
    description:
      'Chỉ dành cho SUPER_ADMIN: Khóa bài viết (is_locked = true) để ngăn học sinh gửi thêm lời giải hay thảo luận mới.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của bài viết',
    example: 'toan-12-tim-m-de-ham-so-bac-ba-dong-bien',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã thay đổi trạng thái khóa bài viết thành công',
  })
  async toggleLockPost(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.moderationService.toggleLockPost(id, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('posts/:id/hide')
  @ApiOperation({
    summary: 'Ẩn / Khôi phục hiển thị bài viết vi phạm (SUPER_ADMIN)',
    description:
      'Chỉ dành cho SUPER_ADMIN: Ẩn bài viết khỏi diễn đàn công cộng (status = HIDDEN) nếu vi phạm quy tắc.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc Slug của bài viết',
    example: 'demo-post-1',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã cập nhật trạng thái hiển thị của bài viết thành công',
  })
  async toggleHidePost(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.moderationService.toggleHidePost(id, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Patch('comments/:id/hide')
  @ApiOperation({
    summary: 'Ẩn / Khôi phục hiển thị bình luận lời giải vi phạm (SUPER_ADMIN)',
    description:
      'Chỉ dành cho SUPER_ADMIN: Ẩn bình luận (status = HIDDEN) nếu chứa ngôn từ công kích, spam hoặc sai kiến thức nghiêm trọng.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của bình luận lời giải',
    example: 'cmt-sample-01',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã cập nhật trạng thái hiển thị của bình luận thành công',
  })
  async toggleHideComment(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.moderationService.toggleHideComment(id, user);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('reports')
  @ApiOperation({
    summary: 'Lấy danh sách báo cáo vi phạm quy tắc cộng đồng (SUPER_ADMIN)',
    description:
      'Lấy danh sách các bài đăng và bình luận bị học sinh/giáo viên báo cáo vi phạm, phân trang và lọc theo trạng thái.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách báo cáo vi phạm thành công',
  })
  async getReports(
    @Query() query: GetReportsQueryDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.moderationService.getReports(query, user);
    return {
      success: true,
      data: data.data,
      meta: {
        total: data.total,
        page: data.page,
        limit: data.limit,
        total_pages: data.total_pages,
      },
    };
  }

  @Patch('reports/:id/resolve')
  @ApiOperation({
    summary: 'Duyệt / Xử lý báo cáo vi phạm quy tắc cộng đồng (SUPER_ADMIN)',
    description:
      'Chỉ dành cho SUPER_ADMIN: Chấp thuận báo cáo (RESOLVED) kèm hành động kiểm duyệt (ẩn nội dung, xóa nội dung) hoặc Từ chối báo cáo (REJECTED).',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của báo cáo vi phạm',
    example: 'rep-sample-01',
  })
  @ApiBody({ type: ResolveReportDto })
  @ApiResponse({
    status: 200,
    description: 'Xử lý báo cáo vi phạm thành công',
  })
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.moderationService.resolveReport(id, dto, user);
    return {
      success: true,
      message: data.message,
      data: data.report,
    };
  }
}
