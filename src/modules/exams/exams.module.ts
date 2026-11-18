import { Module } from '@nestjs/common';
import { ExamsController, ExamPointsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { KnowledgeRoadmapService } from './knowledge-roadmap.service';

@Module({
  controllers: [ExamsController, ExamPointsController],
  providers: [ExamsService, KnowledgeRoadmapService],
  exports: [ExamsService, KnowledgeRoadmapService],
})
export class ExamsModule {}


