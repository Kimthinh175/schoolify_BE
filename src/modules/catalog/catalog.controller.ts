import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

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

  @Post('orders')
  @ApiOperation({ summary: 'Tạo đơn hàng đăng ký gói cước & sinh mã VietQR' })
  async createOrder(@Body() body: any) {
    const data = await this.catalogService.createOrder(body);
    return {
      success: true,
      message: 'Khởi tạo đơn hàng thành công',
      data,
    };
  }

  @Patch('orders/:id/pay')
  @ApiOperation({ summary: 'Xác nhận thanh toán VietQR tự động (3 giây) & kích hoạt gói + cộng Token' })
  async confirmPayment(@Param('id') id: string) {
    const data = await this.catalogService.confirmOrderPayment(id);
    return {
      success: true,
      message: 'Thanh toán và kích hoạt gói thành công',
      data,
    };
  }

  @Get('orders')
  @ApiOperation({ summary: 'Danh sách lịch sử đơn hàng & giao dịch' })
  async listOrders() {
    const data = await this.catalogService.listOrders();
    return {
      success: true,
      data,
    };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Bảng xếp hạng Học sinh theo Token nỗ lực & Điểm trung bình' })
  async getLeaderboard() {
    const data = await this.catalogService.getLeaderboard();
    return {
      success: true,
      data,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng quan toàn hệ thống (Real-time PostgreSQL KPIs)' })
  async getStats() {
    const data = await this.catalogService.getSystemStats();
    return {
      success: true,
      data,
    };
  }
}
