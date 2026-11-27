import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AchievementsService } from './achievements.service';

@ApiTags('Achievements (Thành tựu & Huy hiệu)')
@Controller(['achievements', 'api/v1/achievements'])
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Danh sách thành tựu toàn hệ thống (kèm tiến độ nếu đã đăng nhập)' })
  async list(@CurrentUser() user: any, @Req() req: any) {
    const userId = user?.id || (req?.headers?.['x-user-id'] as string) || null;
    const data = await this.achievementsService.listAchievements(userId);
    return { success: true, data };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kiểm tra và lấy thành tựu của bản thân' })
  async myAchievements(@CurrentUser() user: any) {
    const data = await this.achievementsService.listAchievements(user.id);
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mốc thành tựu mới (Admin)' })
  async create(@Body() body: any) {
    const data = await this.achievementsService.createAchievement(body);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa thành tựu (Admin)' })
  async remove(@Param('id') id: string) {
    const data = await this.achievementsService.deleteAchievement(id);
    return { success: true, data };
  }
}
