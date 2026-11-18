import { Module } from '@nestjs/common';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumPostsController } from './posts/forum-posts.controller';
import { ForumPostsService } from './posts/forum-posts.service';
import { ForumModerationController } from './moderation/forum-moderation.controller';
import { ForumModerationService } from './moderation/forum-moderation.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [
    ForumPostsController,
    ForumController,
    ForumModerationController,
  ],
  providers: [
    ForumPostsService,
    ForumService,
    ForumModerationService,
    PrismaService,
  ],
  exports: [ForumPostsService, ForumService, ForumModerationService],
})
export class ForumModule {}
