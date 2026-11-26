import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NewsService } from './news.service';

@ApiTags('News CMS (Tin tức & Giáo dục)')
@Controller(['news', 'api/v1/news'])
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục tin tức' })
  async listCategories(@Query('onlyActive') onlyActive?: string) {
    const data = await this.newsService.listCategories(onlyActive === 'true');
    return { success: true, data };
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo hoặc cập nhật danh mục tin tức (Admin)' })
  async createCategory(@Body() body: any) {
    const data = await this.newsService.saveCategory(body);
    return { success: true, data };
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật danh mục tin tức (Admin)' })
  async updateCategory(@Param('id') id: string, @Body() body: any) {
    const data = await this.newsService.saveCategory(body, id);
    return { success: true, data };
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa danh mục tin tức (Admin)' })
  async deleteCategory(@Param('id') id: string) {
    const data = await this.newsService.deleteCategory(id);
    return { success: true, data };
  }

  @Get('articles')
  @ApiOperation({ summary: 'Danh sách bài viết tin tức (hỗ trợ lọc public, category, tag, search)' })
  async listArticles(
    @Query('onlyPublic') onlyPublic?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.newsService.listArticles({
      onlyPublic: onlyPublic === 'true',
      categoryId,
      status,
      tag,
      search,
    });
    return { success: true, data };
  }

  @Get('articles/:slug')
  @ApiOperation({ summary: 'Chi tiết bài viết theo slug hoặc id' })
  async getArticle(
    @Param('slug') slug: string,
    @Query('onlyPublic') onlyPublic?: string,
  ) {
    const data = await this.newsService.getArticleBySlug(slug, onlyPublic !== 'false');
    return { success: true, data };
  }

  @Post('articles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo hoặc cập nhật bài viết tin tức (Admin)' })
  async createArticle(@Body() body: any, @CurrentUser() user: any) {
    const data = await this.newsService.saveArticle(body, undefined, user);
    return { success: true, data };
  }

  @Patch('articles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật bài viết tin tức (Admin)' })
  async updateArticle(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    const data = await this.newsService.saveArticle(body, id, user);
    return { success: true, data };
  }

  @Delete('articles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa mềm bài viết tin tức (Admin)' })
  async deleteArticle(@Param('id') id: string) {
    const data = await this.newsService.deleteArticle(id);
    return { success: true, data };
  }

  @Post('articles/:id/like')
  @ApiOperation({ summary: 'Thích bài viết tin tức' })
  async likeArticle(@Param('id') id: string) {
    const data = await this.newsService.toggleLikeArticle(id);
    return { success: true, data };
  }
}
