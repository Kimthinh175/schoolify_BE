import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
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

  @Post('packages')
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
  @ApiOperation({ summary: 'Tạo vật phẩm đổi thưởng mới (Giáo viên / Admin)' })
  async createStoreItem(@Body() body: any) {
    const data = await this.catalogService.createStoreItem(body);
    return {
      success: true,
      message: 'Tạo phần thưởng mới thành công',
      data,
    };
  }

  @Post('store-items/:id/redeem')
  @ApiOperation({ summary: 'Học sinh đổi quà bằng Điểm Năng Lượng và lưu vào Túi đồ (PostgreSQL)' })
  async redeemStoreItem(@Param('id') id: string, @Body() body: { userId?: string }) {
    const data = await this.catalogService.redeemStoreItem(id, body?.userId);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Danh sách quà tặng trong Túi đồ của học sinh (PostgreSQL student_inventory)' })
  async listStudentInventory(@Query('userId') userId?: string) {
    const data = await this.catalogService.listStudentInventory(userId);
    return {
      success: true,
      data,
    };
  }
}
