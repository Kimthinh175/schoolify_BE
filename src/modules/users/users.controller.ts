import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng (Admin / Quản trị)' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.usersService.findAll({
      role,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    return {
      success: true,
      ...result,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới từ Admin (SUPER_ADMIN / TEACHER / STUDENT)' })
  async createUser(
    @Body()
    body: {
      fullname: string;
      email: string;
      phone?: string;
      password?: string;
      role?: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT';
    },
  ) {
    const created = await this.usersService.createAdminUser(body);
    return {
      success: true,
      message: 'Tạo người dùng mới thành công',
      user: created,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết thông tin người dùng theo ID' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng (Admin / Profile)' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      fullname?: string;
      phone?: string;
      avatar_url?: string;
      status?: boolean;
      points?: number;
      grade_level?: string;
      role?: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT';
    },
  ) {
    const updated = await this.usersService.updateUser(id, body);
    return {
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: updated,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa tài khoản người dùng (Admin)' })
  async remove(@Param('id') id: string) {
    const result = await this.usersService.deleteUser(id);
    return {
      success: true,
      message: 'Đã xóa người dùng thành công',
      ...result,
    };
  }
}
