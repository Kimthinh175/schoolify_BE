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
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller(['users', 'api/v1/users'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Danh sách người dùng (Chỉ SUPER_ADMIN)' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.usersService.findAll({
      role,
      status,
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
  @ApiOperation({ summary: 'Tạo người dùng mới từ Admin (SUPER_ADMIN / STUDENT)' })
  async createUser(
    @Body()
    body: {
      fullname: string;
      email: string;
      phone?: string;
      password?: string;
      role?: 'SUPER_ADMIN' | 'STUDENT';
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
    return this.usersService.formatUserItem(sanitized);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng (Chính chủ sửa profile, SUPER_ADMIN sửa quyền/điểm)' })
  async update(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
    @Body() body: UpdateUserDto,
  ) {
    const isAdmin = currentUser?.role === SystemRole.SUPER_ADMIN;
    if (!isAdmin && currentUser?.id !== id) {
      throw new ForbiddenException('Bạn chỉ có quyền cập nhật thông tin tài khoản của chính mình');
    }

    if (isAdmin && currentUser?.id === id && body.status === false) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    }

    // Nếu không phải SUPER_ADMIN thì không được phép tự sửa role, status hoặc points/exam_points/active_package
    const safeBody = isAdmin
      ? body
      : {
          fullname: body.fullname,
          phone: body.phone,
          avatar_url: body.avatar_url,
          avatarUrl: body.avatarUrl,
          date_of_birth: body.date_of_birth,
          dateOfBirth: body.dateOfBirth,
          grade_level: body.grade_level,
          gradeLevel: body.gradeLevel,
          school_name: body.school_name,
          schoolName: body.schoolName,
          province: body.province,
          bio: body.bio,
          equipped_frame: body.equipped_frame,
          equippedFrame: body.equippedFrame,
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
