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
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Lấy danh sách thông báo của user hiện tại (bao gồm thông báo chung user_id = ALL)',
  })
  @ApiQuery({ name: 'limit', required: false, example: 40 })
  async list(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const data = await this.notificationsService.listForUser(
      user.id,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Admin phát thông báo hệ thống (userId = ALL) hoặc gửi tới 1 user (Chỉ SUPER_ADMIN)',
  })
  async create(@CurrentUser() user: any, @Body() dto: CreateNotificationDto) {
    const requester = {
      id: String(user.id),
      role: String(user.role || 'SUPER_ADMIN').toUpperCase(),
    };
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Đánh dấu tất cả thông báo của user hiện tại là đã đọc',
  })
  async markAllRead(@CurrentUser() user: any) {
    const result = await this.notificationsService.markAllAsRead({
      id: String(user.id),
      role: String(user.role || 'STUDENT').toUpperCase(),
    });
    return {
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      ...result,
      data: result,
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo đã đọc (Chống IDOR)' })
  async markRead(@Param('id') id: string, @CurrentUser() user: any) {
    const notification = await this.notificationsService.markAsRead(id, {
      id: String(user.id),
      role: String(user.role || 'STUDENT').toUpperCase(),
    });
    return {
      success: true,
      message: 'Đã đánh dấu thông báo đã đọc',
      notification,
      data: notification,
    };
  }

  @Delete('clear-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xóa toàn bộ thông báo riêng của user hiện tại' })
  async clearAll(@CurrentUser() user: any) {
    const result = await this.notificationsService.clearAll({
      id: String(user.id),
      role: String(user.role || 'STUDENT').toUpperCase(),
    });
    return {
      success: true,
      message: 'Đã xóa toàn bộ thông báo của bạn',
      ...result,
      data: result,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xóa 1 thông báo (Chống IDOR)' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.notificationsService.deleteOne(id, {
      id: String(user.id),
      role: String(user.role || 'STUDENT').toUpperCase(),
    });
    return {
      success: true,
      message: 'Đã xóa thông báo',
      ...result,
      data: result,
    };
  }
}
