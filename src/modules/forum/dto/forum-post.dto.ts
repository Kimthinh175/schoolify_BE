import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ForumPostSortOption =
  | 'latest'
  | 'newest'
  | 'oldest'
  | 'hot'
  | 'popular'
  | 'most_viewed'
  | 'most_liked'
  | 'most_commented'
  | 'unsolved';

export type ForumPostTabOption =
  'ALL' | 'HOT' | 'UNSOLVED' | 'SOLVED' | 'SAVED' | 'BOOKMARKED';

const transformOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

/**
 * [Task #17] DTO lọc đa tiêu chí, tìm kiếm & phân trang danh sách câu hỏi diễn đàn
 * GET /api/v1/forum/posts
 */
export class GetForumPostsQueryDto {
  @ApiPropertyOptional({
    description: 'Trang hiện tại (bắt đầu từ 1)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng bài viết mỗi trang (tối đa 100)',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Lọc theo môn học (hỗ trợ cả tên tiếng Việt có dấu "Toán Học", "Vật Lý"... lẫn slug "toan-hoc", "vat-ly" hoặc "Tất cả")',
    example: 'Toán Học',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo khối lớp (10, 11, 12)',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @ApiPropertyOptional({
    description: 'Alias snake_case của grade (grade_level)',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade_level?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo chương SGK (chapterId / chapter_id)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapterId?: number;

  @ApiPropertyOptional({
    description: 'Alias snake_case của chapterId',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapter_id?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo nhãn chủ đề (tag)',
    example: 'Đạo hàm',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description:
      'Lọc theo trạng thái đã có lời giải chuẩn hay chưa (true / false)',
    example: true,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isSolved?: boolean;

  @ApiPropertyOptional({
    description: 'Alias snake_case của isSolved',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  is_solved?: boolean;

  @ApiPropertyOptional({
    description:
      'Lọc các câu hỏi có chứa công thức Toán/Lý/Hóa KaTeX (hasMath / has_math)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  hasMath?: boolean;

  @ApiPropertyOptional({
    description: 'Alias snake_case của hasMath',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  has_math?: boolean;

  @ApiPropertyOptional({
    description:
      'Tab lọc nhanh đồng bộ UI Diễn đàn: ALL | HOT | UNSOLVED | SOLVED | SAVED | BOOKMARKED',
    enum: ['ALL', 'HOT', 'UNSOLVED', 'SOLVED', 'SAVED', 'BOOKMARKED'],
    default: 'ALL',
  })
  @IsOptional()
  @IsString()
  tab?: ForumPostTabOption;

  @ApiPropertyOptional({
    description:
      'Alias status từ Frontend: ALL | HOT | UNSOLVED | SOLVED | SAVED | BOOKMARKED',
    enum: ['ALL', 'HOT', 'UNSOLVED', 'SOLVED', 'SAVED', 'BOOKMARKED'],
  })
  @IsOptional()
  @IsString()
  status?: ForumPostTabOption;

  @ApiPropertyOptional({
    description: 'Alias bookmarked từ Frontend (khi lọc tab Đã lưu SAVED)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  bookmarked?: boolean;

  @ApiPropertyOptional({
    description:
      'Từ khóa tìm kiếm theo tiêu đề, nội dung công thức LaTeX, tên chương hoặc tag',
    example: 'đồng biến',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Alias từ khóa tìm kiếm (q)',
    example: 'tích phân',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Tiêu chí sắp xếp: latest (mới nhất, mặc định) | hot (sôi nổi) | most_viewed | most_liked | most_commented | oldest | unsolved',
    enum: [
      'latest',
      'newest',
      'oldest',
      'hot',
      'popular',
      'most_viewed',
      'most_liked',
      'most_commented',
      'unsolved',
    ],
    default: 'latest',
  })
  @IsOptional()
  @IsString()
  sort?: ForumPostSortOption = 'latest';

  @ApiPropertyOptional({
    description: 'Lọc bài viết của một tác giả cụ thể (authorId)',
  })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của authorId',
  })
  @IsOptional()
  @IsString()
  author_id?: string;

  @ApiPropertyOptional({
    description:
      'ID người dùng hiện tại (để kiểm tra trạng thái đã Like / đã Bookmark từng bài viết)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của userId',
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({
    description:
      'Chỉ lấy các bài viết mà người dùng hiện tại đã lưu (Bookmark)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  bookmarkedOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Alias snake_case của bookmarkedOnly',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  bookmarked_only?: boolean;
}

/**
 * [Task #16] DTO đăng bài hỏi mới trên Diễn đàn (tự động tạo slug tiếng Việt duy nhất & nhận diện LaTeX)
 * POST /api/v1/forum/posts
 */
export class CreateForumPostDto {
  @ApiProperty({
    description: 'Tiêu đề câu hỏi / chủ đề thảo luận',
    example:
      'Hỏi bài Toán 12: Tìm tham số m để hàm số bậc ba có hai điểm cực trị trái dấu',
  })
  @IsString()
  @MinLength(5, { message: 'Tiêu đề câu hỏi phải có ít nhất 5 ký tự' })
  @MaxLength(500, { message: 'Tiêu đề câu hỏi không vượt quá 500 ký tự' })
  title!: string;

  @ApiProperty({
    description:
      'Nội dung chi tiết câu hỏi (hỗ trợ Markdown & công thức Toán/Lý/Hóa KaTeX $...$ hoặc $$...$$)',
    example:
      'Cho hàm số $y = x^3 - 3mx^2 + 3(m^2 - 1)x + 1$. Làm sao tìm nhanh $m$ để hàm số có 2 điểm cực trị $x_1, x_2$ trái dấu ạ?',
  })
  @IsString()
  @MinLength(10, { message: 'Nội dung câu hỏi phải có ít nhất 10 ký tự' })
  content!: string;

  @ApiPropertyOptional({
    description:
      'Môn học (chấp nhận cả tên hiển thị "Toán Học", "Vật Lý"... hoặc slug "toan-hoc", "vat-ly")',
    example: 'Toán Học',
    default: 'Toán Học',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Khối lớp (10, 11, 12)',
    example: 12,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @ApiPropertyOptional({
    description: 'Alias snake_case của grade',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade_level?: number;

  @ApiPropertyOptional({
    description: 'Số thứ tự chương SGK (1, 2, 3...)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapterId?: number;

  @ApiPropertyOptional({
    description: 'Alias snake_case của chapterId',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapter_id?: number;

  @ApiPropertyOptional({
    description: 'Tên chương SGK hiển thị',
    example: 'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chapterName?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của chapterName',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chapter_name?: string;

  @ApiPropertyOptional({
    description: 'Danh sách nhãn chủ đề (tags)',
    example: ['Đạo hàm', 'Cực trị', 'Lớp 12'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Ảnh thu nhỏ minh họa đề bài (URL)',
  })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của thumbnailUrl',
  })
  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @ApiPropertyOptional({
    description: 'Danh sách URL ảnh chụp đề bài hoặc tài liệu đính kèm',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Cờ báo câu hỏi có chứa công thức KaTeX (has_math / hasMath)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  has_math?: boolean;

  @ApiPropertyOptional({
    description: 'Alias camelCase của has_math',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  hasMath?: boolean;

  @ApiPropertyOptional({
    description:
      'ID tác giả (chỉ dùng làm fallback khi test trên Swagger không kèm Bearer Token)',
    example: 'seed-student-01',
  })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của authorId',
  })
  @IsOptional()
  @IsString()
  author_id?: string;

  @ApiPropertyOptional({
    description: 'Alias userId',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Alias user_id',
  })
  @IsOptional()
  @IsString()
  user_id?: string;
}

/**
 * [Task #16] DTO cập nhật bài hỏi trên Diễn đàn (kiểm tra quyền sở hữu chống IDOR)
 * PATCH /api/v1/forum/posts/:id
 */
export class UpdateForumPostDto {
  @ApiPropertyOptional({
    description:
      'Tiêu đề câu hỏi mới (nếu đổi tiêu đề sẽ hỗ trợ cập nhật hoặc giữ nguyên slug)',
    example:
      'Hỏi bài Toán 12 (Đã bổ sung đề): Tìm m để hàm bậc ba có 2 cực trị trái dấu',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({
    description: 'Nội dung câu hỏi (hỗ trợ KaTeX $...$ và $$...$$)',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @ApiPropertyOptional({
    description: 'Môn học',
    example: 'Toán Học',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Khối lớp (10, 11, 12)',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @ApiPropertyOptional({
    description: 'Alias snake_case của grade',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade_level?: number;

  @ApiPropertyOptional({
    description: 'Chương SGK',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapterId?: number;

  @ApiPropertyOptional({
    description: 'Alias snake_case của chapterId',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapter_id?: number;

  @ApiPropertyOptional({
    description: 'Tên chương SGK',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chapterName?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của chapterName',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chapter_name?: string;

  @ApiPropertyOptional({
    description: 'Danh sách nhãn chủ đề (tags)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Ảnh thu nhỏ (URL)',
  })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của thumbnailUrl',
  })
  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @ApiPropertyOptional({
    description: 'Danh sách file/ảnh đính kèm',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Đánh dấu câu hỏi đã được giải quyết (is_solved)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isSolved?: boolean;

  @ApiPropertyOptional({
    description: 'Alias snake_case của isSolved',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  is_solved?: boolean;

  @ApiPropertyOptional({
    description: 'Cờ báo câu hỏi có chứa công thức KaTeX (has_math / hasMath)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  has_math?: boolean;

  @ApiPropertyOptional({
    description: 'Alias camelCase của has_math',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  hasMath?: boolean;

  @ApiPropertyOptional({
    description:
      'ID người thực hiện (chỉ dùng khi test Swagger không kèm Bearer Token; nếu khác author_id sẽ bị chặn 403 IDOR)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của userId',
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Alias authorId',
  })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Alias author_id',
  })
  @IsOptional()
  @IsString()
  author_id?: string;
}

/**
 * [Task #15] DTO Lưu / Bỏ lưu (Toggle Bookmark) câu hỏi quan tâm
 * POST /api/v1/forum/posts/:id/bookmark
 */
export class ToggleForumBookmarkDto {
  @ApiPropertyOptional({
    description: 'Ghi chú cá nhân khi lưu câu hỏi để ôn tập lại',
    example: 'Ôn kỹ dạng cô lập tham số m này trước kỳ thi thử THPT',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    description:
      'ID người dùng (fallback khi test trên Swagger không kèm Bearer Token)',
    example: 'seed-student-01',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của userId',
  })
  @IsOptional()
  @IsString()
  user_id?: string;
}

/**
 * DTO Thả tim / Bỏ tim (Toggle Like / Reaction) bài viết
 * POST /api/v1/forum/posts/:id/like
 */
export class ToggleForumLikeDto {
  @ApiPropertyOptional({
    description:
      'Loại cảm xúc (LIKE | UPVOTE | DOWNVOTE | HELPFUL | LOVE | HAHA)',
    default: 'LIKE',
    example: 'LIKE',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Alias reaction_type',
  })
  @IsOptional()
  @IsString()
  reaction_type?: string;

  @ApiPropertyOptional({
    description: 'ID người dùng (fallback khi test trên Swagger)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case của userId',
  })
  @IsOptional()
  @IsString()
  user_id?: string;
}
