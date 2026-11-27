import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Catalog, Orders, Leaderboard & Stats')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('packages')
  @ApiOperation({ summary: 'Danh sách các gói cước SaaS (Free, PRO, VIP)' })
  async listPackages() {
    const data = await this.catalogService.listPackages();
    return {
      success: true,
      data,
    };
  }

  @Post('packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo gói cước SaaS mới (Admin)' })
  async createPackage(@Body() body: any) {
    const data = await this.catalogService.createPackage(body);
    return {
      success: true,
      message: 'Tạo gói đăng ký mới thành công',
      data,
    };
  }

  @Patch('packages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật gói cước SaaS (Admin)' })
  async updatePackage(@Param('id') id: string, @Body() body: any) {
    const data = await this.catalogService.updatePackage(id, body);
    return {
      success: true,
      message: 'Cập nhật gói đăng ký thành công',
      data,
    };
  }

  @Delete('packages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa gói cước SaaS (Admin)' })
  async deletePackage(@Param('id') id: string) {
    const data = await this.catalogService.deletePackage(id);
    return {
      success: true,
      message: 'Xóa gói đăng ký thành công',
      data,
    };
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đơn hàng đăng ký gói cước & sinh mã VietQR' })
  async createOrder(@Req() req: any, @Body() body: any) {
    const data = await this.catalogService.createOrder({
      ...body,
      userId: req?.user?.id || body?.userId,
    });
    return {
      success: true,
      message: 'Khởi tạo đơn hàng thành công',
      data,
    };
  }

  @Patch('orders/:id/pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác nhận thanh toán VietQR tự động & kích hoạt gói + cộng Token (Admin)' })
  async confirmPayment(@Param('id') id: string) {
    const data = await this.catalogService.confirmOrderPayment(id);
    return {
      success: true,
      message: 'Thanh toán và kích hoạt gói thành công',
      data,
    };
  }

  @Patch('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy đơn hàng đang chờ thanh toán (PENDING -> CANCELLED)' })
  async cancelOrder(@Param('id') id: string, @Body() body?: { reason?: string }) {
    const data = await this.catalogService.cancelOrder(id, body?.reason);
    return {
      success: true,
      message: 'Đã hủy đơn hàng thành công',
      data,
    };
  }

  @Post('payos/create-payment-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Khởi tạo link thanh toán VietQR động qua cổng PayOS' })
  async createPayosPaymentLink(@Req() req: any, @Body() body: any) {
    const data = await this.catalogService.createPayosOrder({
      ...body,
      userId: req?.user?.id || body?.userId,
    });
    return {
      success: true,
      message: 'Khởi tạo link thanh toán PayOS thành công',
      data,
    };
  }

  @Get('payos/order-status/:orderCode')
  @ApiOperation({ summary: 'Kiểm tra trạng thái thanh toán PayOS real-time theo orderCode' })
  async getPayosOrderStatus(@Param('orderCode') orderCode: string) {
    const data = await this.catalogService.getPayosOrderStatus(Number(orderCode));
    return {
      success: true,
      data,
    };
  }

  @Post('payos/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook nhận thông báo thanh toán tự động từ PayOS' })
  async handlePayosWebhook(@Body() body: any) {
    const data = await this.catalogService.handlePayosWebhook(body);
    return {
      success: true,
      data,
    };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách lịch sử đơn hàng & giao dịch (Admin)' })
  async listOrders() {
    const data = await this.catalogService.listOrders();
    return {
      success: true,
      data,
    };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Bảng xếp hạng Học sinh theo Token nỗ lực & Điểm trung bình' })
  async getLeaderboard(
    @Query('timeframe') timeframe?: string,
    @Query('grade') grade?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.catalogService.getLeaderboard({ timeframe, grade, search });
    return {
      success: true,
      data,
    };
  }

  @Get('seasons')
  @ApiOperation({ summary: 'Danh sách mùa giải Bảng xếp hạng (PostgreSQL)' })
  async listSeasons() {
    const data = await this.catalogService.listSeasons();
    return {
      success: true,
      data,
    };
  }

  @Post('seasons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mùa giải Bảng xếp hạng mới (Admin)' })
  async createSeason(@Body() body: any) {
    const data = await this.catalogService.createSeason(body);
    return {
      success: true,
      message: 'Tạo mùa giải mới thành công',
      data,
    };
  }

  @Patch('seasons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật mùa giải Bảng xếp hạng (Admin)' })
  async updateSeason(@Param('id') id: string, @Body() body: any) {
    const data = await this.catalogService.updateSeason(id, body);
    return {
      success: true,
      message: 'Cập nhật mùa giải thành công',
      data,
    };
  }

  @Post('seasons/:id/freeze')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đóng băng / Mở lại bảng xếp hạng mùa giải (Admin)' })
  async toggleSeasonFreeze(@Param('id') id: string) {
    const data = await this.catalogService.toggleSeasonFreeze(id);
    return {
      success: true,
      message: data.isFrozen ? 'Đã đóng băng BXH mùa giải' : 'Đã mở lại BXH mùa giải',
      data,
    };
  }

  @Post('seasons/:id/distribute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chốt sổ & phát thưởng Ngọc Tri Thức cho Top BXH mùa giải (Admin)' })
  async distributeSeasonRewards(@Param('id') id: string, @Req() req: any) {
    const data = await this.catalogService.distributeSeasonRewards(id, req?.user);
    return {
      success: true,
      message: 'Phát thưởng mùa giải thành công!',
      data,
    };
  }

  @Get('seasons/distribution-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử quyết toán & phát thưởng mùa giải (Admin)' })
  async listDistributionLogs() {
    const data = await this.catalogService.listDistributionLogs();
    return {
      success: true,
      data,
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê tổng quan toàn hệ thống (Real-time PostgreSQL KPIs - Admin)' })
  async getStats() {
    const data = await this.catalogService.getSystemStats();
    return {
      success: true,
      data,
    };
  }

  @Get('store-items')
  @ApiOperation({ summary: 'Danh sách vật phẩm Cửa hàng Đổi quà (PostgreSQL store_items)' })
  async listStoreItems() {
    const data = await this.catalogService.listStoreItems();
    return {
      success: true,
      data,
    };
  }

  @Post('store-items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo vật phẩm đổi thưởng mới (Admin)' })
  async createStoreItem(@Body() body: any) {
    const data = await this.catalogService.createStoreItem(body);
    return {
      success: true,
      message: 'Tạo phần thưởng mới thành công',
      data,
    };
  }

  @Post('store-items/:id/redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Học sinh đổi quà bằng Điểm Năng Lượng và lưu vào Túi đồ (PostgreSQL)' })
  async redeemStoreItem(@Req() req: any, @Param('id') id: string, @Body() body: { userId?: string }) {
    const targetUserId = req?.user?.id || body?.userId;
    const data = await this.catalogService.redeemStoreItem(id, targetUserId);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('inventory')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách quà tặng trong Túi đồ của học sinh (PostgreSQL student_inventory)' })
  async listStudentInventory(@Req() req: any, @Query('userId') userId?: string) {
    const targetUserId = req?.user?.role === SystemRole.SUPER_ADMIN && userId ? userId : req?.user?.id || userId;
    const data = await this.catalogService.listStudentInventory(targetUserId);
    return {
      success: true,
      data,
    };
  }

  @Post('analytics/visit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi nhận lượt truy cập trang web vào PostgreSQL (web_visit_logs)' })
  async recordVisit(@Body() body: any, @Req() req: Request) {
    const data = await this.catalogService.recordWebVisit(body || {}, {
      headers: (req?.headers || {}) as Record<string, string | string[] | undefined>,
      remoteAddress: req?.socket?.remoteAddress || req?.ip || undefined,
    });
    return {
      success: true,
      data,
    };
  }

  @Get('analytics/behavior')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê hành vi học sinh & toàn diện hệ thống Web (PostgreSQL 100% - Admin)' })
  async getBehaviorAnalytics() {
    const data = await this.catalogService.getBehaviorAnalytics();
    return {
      success: true,
      data,
    };
  }
}

