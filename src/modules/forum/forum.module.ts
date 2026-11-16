import { Module } from '@nestjs/common';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumPostsController } from './posts/forum-posts.controller';
import { ForumPostsService } from './posts/forum-posts.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [ForumPostsController, ForumController],
  providers: [ForumPostsService, ForumService, PrismaService],
  exports: [ForumPostsService, ForumService],
})
export class ForumModule {}
