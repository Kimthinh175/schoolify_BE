import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  NotificationsService,
  type RequestWithAuthHeaders,
} from './notifications.service';
import { CreateNotificationDto } from './dto/notification.dto';

@ApiTags('Notifications (Thông báo Hệ thống)')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller(['notifications', 'api/v1/notifications'])
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse('stream')
  @ApiOperation({
    summary: 'Luồng SSE đẩy thông báo real-time cho user hiện tại',
  })
  stream(@Req() req: RequestWithAuthHeaders): Observable<MessageEvent> {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    return this.notificationsService.subscribeForUser(
      requester.id,
    ) as Observable<MessageEvent>;
  }

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách thông báo của user hiện tại (bao gồm thông báo chung user_id = ALL)',
  })
  @ApiQuery({ name: 'limit', required: false, example: 40 })
  async list(
    @Req() req: RequestWithAuthHeaders,
    @Query('limit') limit?: string,
  ) {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    const data = await this.notificationsService.listForUser(
      requester.id,
      limit ? parseInt(limit, 10) : 40,
    );
    return {
      success: true,
      items: data.items,
      unreadCount: data.unreadCount,
      total: data.total,
      data: {
        items: data.items,
        unreadCount: data.unreadCount,
        total: data.total,
      },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Admin / Giáo viên phát thông báo hệ thống (userId = ALL) hoặc gửi tới 1 user',
  })
  async create(
    @Req() req: RequestWithAuthHeaders,
    @Body() dto: CreateNotificationDto,
  ) {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    const notification = await this.notificationsService.createNotification(
      requester,
      dto,
    );
    return {
      success: true,
      message: 'Gửi thông báo thành công',
      notification,
      data: notification,
    };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đánh dấu tất cả thông báo của user hiện tại là đã đọc',
  })
  async markAllRead(@Req() req: RequestWithAuthHeaders) {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    const result = await this.notificationsService.markAllAsRead(requester);
    return {
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      ...result,
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo đã đọc' })
  async markRead(@Req() req: RequestWithAuthHeaders, @Param('id') id: string) {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    const notification = await this.notificationsService.markAsRead(
      id,
      requester,
    );
    return {
      success: true,
      message: 'Đã đánh dấu thông báo đã đọc',
      notification,
      data: notification,
    };
  }

  @Delete('clear-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa toàn bộ thông báo riêng của user hiện tại' })
  async clearAll(@Req() req: RequestWithAuthHeaders) {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    const result = await this.notificationsService.clearAll(requester);
    return {
      success: true,
      message: 'Đã xóa toàn bộ thông báo của bạn',
      ...result,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa 1 thông báo' })
  async remove(@Req() req: RequestWithAuthHeaders, @Param('id') id: string) {
    const requester = this.notificationsService.resolveRequester(req, true)!;
    const result = await this.notificationsService.deleteOne(id, requester);
    return {
      success: true,
      message: 'Đã xóa thông báo',
      ...result,
    };
  }
}
