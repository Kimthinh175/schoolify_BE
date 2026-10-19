import {
  Controller,
  Get,
  Patch,
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
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      success: true,
      ...result,
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
    },
  ) {
    const updated = await this.usersService.updateUser(id, body);
    return {
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: updated,
    };
  }
}
