import { Module } from '@nestjs/common';
import { ExamsController, ExamPointsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  controllers: [ExamsController, ExamPointsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}

