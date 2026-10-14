import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChapterRatioDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  chapterId: number;

  @ApiProperty({ example: 70 })
  @IsNumber()
  ratioPercent: number;
}

export class BloomRatioDto {
  @ApiProperty({ example: 40 })
  @IsNumber()
  nhanBiet: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  thongHieu: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  vanDung: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  vanDungCao: number;
}

export class GenerateMatrixExamDto {
  @ApiProperty({ example: 'toan-hoc' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  grade: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  totalQuestions: number;

  @ApiProperty({ example: 45 })
  @IsNumber()
  durationMinutes: number;

  @ApiPropertyOptional({ type: [ChapterRatioDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChapterRatioDto)
  chapters?: ChapterRatioDto[];

  @ApiPropertyOptional({ type: BloomRatioDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BloomRatioDto)
  bloomRatio?: BloomRatioDto;
}

export class SubmitExamDto {
  @ApiProperty({ example: 'SES-1791982545377' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiPropertyOptional({ example: 'exam-toan-hoc-g12' })
  @IsOptional()
  @IsString()
  examId?: string;

  @ApiPropertyOptional({ example: 'Đề Luyện Trắc Nghiệm Toán 12' })
  @IsOptional()
  @IsString()
  examTitle?: string;

  @ApiPropertyOptional({ example: 'toan-hoc' })
  @IsOptional()
  @IsString()
  subjectSlug?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  timeSpentSeconds: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isAutoSubmit?: boolean;

  @ApiPropertyOptional({ example: 'fp_chrome_linux_89412' })
  @IsOptional()
  @IsString()
  guestFingerprint?: string;

  @ApiProperty({
    example: {
      multipleChoices: { "q-101": "ans-1" },
      trueFalseAnswers: { "q-102": { "a": true, "b": false, "c": true, "d": false } },
      shortAnswers: { "q-103": "62" },
      essayAnswers: {}
    }
  })
  @IsObject()
  answers: {
    multipleChoices?: Record<string, string>;
    trueFalseAnswers?: Record<string, Record<string, boolean>>;
    shortAnswers?: Record<string, string>;
    essayAnswers?: Record<string, string>;
    flaggedIds?: Record<string, boolean>;
  };

  @ApiPropertyOptional({ description: 'Toàn bộ snapshot dữ liệu đề để lưu snapshot_data' })
  @IsOptional()
  snapshotData?: any;
}

export class SyncOfflineSubmissionsDto {
  @ApiProperty({
    example: [
      {
        id: "sub-offline-1791982571254",
        sessionId: "SES-1791982545377",
        examId: "exam-toan-hoc-01",
        answers: {},
        timeSpentSeconds: 1200,
        submittedAt: "2026-10-14T12:00:00Z"
      }
    ]
  })
  @IsArray()
  submissions: any[];
}
