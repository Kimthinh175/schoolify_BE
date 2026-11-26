import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications (Thông báo hệ thống)')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['notifications', 'api/v1/notifications'])
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của người dùng hiện tại' })
  async list(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const data = await this.notificationsService.listForUser(
      user.id,
      limit ? parseInt(limit, 10) : 30,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  async markAllRead(@CurrentUser() user: any) {
    const data = await this.notificationsService.markAllAsRead(user.id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo đã đọc (Chống IDOR)' })
  async markRead(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.notificationsService.markAsRead(id, user.id);
    return {
      success: true,
      data,
    };
  }

  @Delete('clear-all')
  @ApiOperation({ summary: 'Xóa toàn bộ thông báo của người dùng hiện tại' })
  async clearAll(@CurrentUser() user: any) {
    const data = await this.notificationsService.clearAll(user.id);
    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa 1 thông báo (Chống IDOR)' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.notificationsService.deleteOne(id, user.id);
    return {
      success: true,
      data,
    };
  }
}
