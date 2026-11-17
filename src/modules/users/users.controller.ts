import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Danh sách người dùng (Chỉ SUPER_ADMIN)' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết thông tin người dùng theo ID (Chính chủ hoặc SUPER_ADMIN)' })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (currentUser?.role !== SystemRole.SUPER_ADMIN && currentUser?.id !== id) {
      throw new ForbiddenException('Bạn chỉ có quyền xem thông tin tài khoản của chính mình');
    }
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng (Chính chủ sửa profile, SUPER_ADMIN sửa quyền/điểm)' })
  async update(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
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
    const isAdmin = currentUser?.role === SystemRole.SUPER_ADMIN;
    if (!isAdmin && currentUser?.id !== id) {
      throw new ForbiddenException('Bạn chỉ có quyền cập nhật thông tin tài khoản của chính mình');
    }

    // Nếu không phải SUPER_ADMIN thì không được phép tự sửa role, status hoặc points
    const safeBody = isAdmin
      ? body
      : {
          fullname: body.fullname,
          phone: body.phone,
          avatar_url: body.avatar_url,
          grade_level: body.grade_level,
        };

    const updated = await this.usersService.updateUser(id, safeBody);
    return {
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: updated,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Xóa tài khoản người dùng (Chỉ SUPER_ADMIN)' })
  async remove(@Param('id') id: string) {
    const result = await this.usersService.deleteUser(id);
    return {
      success: true,
      message: 'Đã xóa người dùng thành công',
      ...result,
    };
  }
}
