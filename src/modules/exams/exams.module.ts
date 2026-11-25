import { Module } from '@nestjs/common';
import { ExamsController, ExamPointsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamPointsService } from './exam-points.service';
import { KnowledgeRoadmapService } from './knowledge-roadmap.service';

@Module({
  controllers: [ExamsController, ExamPointsController],
  providers: [ExamsService, ExamPointsService, KnowledgeRoadmapService],
  exports: [ExamsService, ExamPointsService, KnowledgeRoadmapService],
})
export class ExamsModule {}
