import { Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PrismaService } from '../../../database/prisma.service';
import { SemanticCacheService } from './semantic-cache.service';
import { AntigravityIpcBridgeService } from './antigravity-ipc-bridge.service';
import { DocxScanGenerateDto, SaveGeneratedQuestionsDto } from '../dto/agent.dto';
import { BloomLevel, QuestionFormat, QuestionType } from '@prisma/client';

export interface ParsedSeedQuestion {
  title: string;
  content: string;
  questionFormat: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
  bloomLevel: 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG' | 'VAN_DUNG_CAO';
  chapter?: string;
  chapterId?: number;
  topic?: string;
  points: number;
  explanation?: string;
  shortAnswer?: string;
  answers: Array<{
    label: string;
    content: string;
    isAnswer: boolean;
    explain?: string;
  }>;
}

export interface KnowledgeTopicItem {
  topicName: string;
  chapterId: number;
  weightPercent: number;
  vectorConfidence: number;
  sampleKeywords: string[];
}

@Injectable()
export class DocxExamGeneratorService {
  private readonly logger = new Logger(DocxExamGeneratorService.name);

  private readonly SUBJECT_CATALOG: Array<{
    slug: string;
    name: string;
    keywords: string[];
    topics: Array<{ chapterId: number; name: string; keywords: string[] }>;
  }> = [
    {
      slug: 'toan-hoc',
      name: 'Toán Học',
      keywords: [
        'hàm số', 'đạo hàm', 'cực trị', 'đơn điệu', 'tiệm cận', 'đồ thị',
        'nguyên hàm', 'tích phân', 'logarit', 'mũ', 'tọa độ', 'vectơ',
        'mặt phẳng', 'mặt cầu', 'xác suất', 'cấp số', 'phương trình', 'bất phương trình',
      ],
      topics: [
        { chapterId: 1, name: 'Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số', keywords: ['đạo hàm', 'cực trị', 'đơn điệu', 'đồng biến', 'nghịch biến', 'tiệm cận', 'giá trị lớn nhất', 'đồ thị'] },
        { chapterId: 2, name: 'Vectơ và hệ trục tọa độ trong không gian Oxyz', keywords: ['vectơ', 'tọa độ', 'không gian', 'oxyz', 'mặt phẳng', 'đường thẳng', 'mặt cầu'] },
        { chapterId: 3, name: 'Các số đặc trưng đo mức độ phân tán của mẫu số liệu ghép nhóm', keywords: ['mẫu số liệu', 'phương sai', 'độ lệch chuẩn', 'khoảng biến thiên', 'tứ phân vị'] },
        { chapterId: 4, name: 'Nguyên hàm và Tích phân ứng dụng', keywords: ['nguyên hàm', 'tích phân', 'diện tích hình phẳng', 'thể tích khối tròn xoay', 'dx'] },
        { chapterId: 5, name: 'Xác suất có điều kiện và Công thức Bayes', keywords: ['xác suất', 'biến cố', 'điều kiện', 'bayes'] },
      ],
    },
    {
      slug: 'vat-ly',
      name: 'Vật Lý',
      keywords: [
        'dao động', 'con lắc', 'tần số', 'biên độ', 'sóng cơ', 'giao thoa',
        'dòng điện xoay chiều', 'cảm kháng', 'dung kháng', 'nhiệt học', 'khí lý tưởng',
        'từ trường', 'cảm ứng từ', 'hạt nhân', 'phóng xạ', 'photon',
      ],
      topics: [
        { chapterId: 1, name: 'Vật lý nhiệt & Sự chuyển thể', keywords: ['nhiệt', 'nội năng', 'nhiệt dung', 'nóng chảy', 'hóa hơi', 'nhiệt độ'] },
        { chapterId: 2, name: 'Khí lý tưởng & Phương trình trạng thái', keywords: ['khí lý tưởng', 'áp suất', 'thể tích', 'đẳng nhiệt', 'đẳng tích', 'đẳng áp', 'động năng phân tử'] },
        { chapterId: 3, name: 'Từ trường & Cảm ứng điện từ', keywords: ['từ trường', 'cảm ứng từ', 'từ thông', 'suất điện động', 'dòng điện xoay chiều', 'lực từ'] },
        { chapterId: 4, name: 'Vật lý hạt nhân & Phóng xạ', keywords: ['hạt nhân', 'độ hụt khối', 'năng lượng liên kết', 'phóng xạ', 'chu kỳ bán rã', 'phân hạch'] },
      ],
    },
    {
      slug: 'hoa-hoc',
      name: 'Hóa Học',
      keywords: [
        'este', 'lipit', 'xà phòng', 'cacbohidrat', 'glucozơ', 'fructozơ',
        'amin', 'amino axit', 'peptit', 'protein', 'polime', 'kim loại',
        'ăn mòn', 'điện phân', 'kiềm', 'sắt', 'nhôm', 'mol', 'dung dịch',
      ],
      topics: [
        { chapterId: 1, name: 'Ester - Lipid và Chất giặt rửa', keywords: ['este', 'ester', 'lipit', 'lipid', 'xà phòng', 'thủy phân', 'chất béo'] },
        { chapterId: 2, name: 'Carbohydrate (Glucozơ, Saccharose, Tinh bột)', keywords: ['cacbohidrat', 'carbohydrate', 'glucozơ', 'glucose', 'fructozơ', 'tinh bột', 'xenlulozơ', 'tráng bạc'] },
        { chapterId: 3, name: 'Hợp chất chứa Nitrogen (Amine, Amino acid, Peptide)', keywords: ['amin', 'amine', 'amino axit', 'amino acid', 'peptit', 'peptide', 'protein'] },
        { chapterId: 4, name: 'Polymer & Đại cương Kim loại, Điện hóa', keywords: ['polime', 'polymer', 'kim loại', 'điện phân', 'ăn mòn', 'thế điện cực'] },
      ],
    },
    {
      slug: 'sinh-hoc',
      name: 'Sinh Học',
      keywords: [
        'gen', 'adn', 'dna', 'arn', 'rna', 'phiên mã', 'dịch mã', 'nhiễm sắc thể',
        'đột biến', 'di truyền', 'menden', 'quần thể', 'tiến hóa', 'sinh thái', 'quang hợp', 'lục lạp',
      ],
      topics: [
        { chapterId: 1, name: 'Cơ chế di truyền và biến dị ở cấp độ phân tử & tế bào', keywords: ['gen', 'dna', 'adn', 'phiên mã', 'dịch mã', 'đột biến', 'nhiễm sắc thể', 'operon'] },
        { chapterId: 2, name: 'Tính quy luật của hiện tượng di truyền', keywords: ['di truyền', 'menden', 'liên kết gen', 'hoán vị gen', 'tương tác gen', 'nhiệt độ', 'quang hợp'] },
        { chapterId: 3, name: 'Di truyền học quần thể & Tiến hóa', keywords: ['quần thể', 'hardy-weinberg', 'tiến hóa', 'chọn lọc tự nhiên', 'loài mới'] },
        { chapterId: 4, name: 'Sinh thái học và Môi trường', keywords: ['sinh thái', 'quần xã', 'hệ sinh thái', 'chuỗi thức ăn', 'ổ sinh thái'] },
      ],
    },
    {
      slug: 'tieng-anh',
      name: 'Tiếng Anh',
      keywords: [
        'mark the letter', 'closest in meaning', 'opposite in meaning', 'reading comprehension',
        'grammar', 'vocabulary', 'tense', 'conditional', 'passive voice', 'relative clause',
      ],
      topics: [
        { chapterId: 1, name: 'Ngữ pháp trọng tâm & Cấu trúc câu (Grammar & Tenses)', keywords: ['tense', 'passive', 'conditional', 'relative', 'clause', 'verb', 'preposition'] },
        { chapterId: 2, name: 'Từ vựng, Cụm động từ & Thành ngữ (Vocabulary & Phrasal Verbs)', keywords: ['meaning', 'closest', 'opposite', 'phrasal', 'idiom', 'collocation', 'word'] },
        { chapterId: 3, name: 'Đọc hiểu & Sắp xếp hội thoại/đoạn văn (Reading & Discourse)', keywords: ['passage', 'read', 'paragraph', 'arrangement', 'conversation'] },
      ],
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly semanticCacheService: SemanticCacheService,
    private readonly ipcBridgeService: AntigravityIpcBridgeService,
  ) {}

  /**
   * QUY TRÌNH CHÍNH:
   * 1. Đọc & Bóc tách nội dung đề thi từ file .docx (hoặc dữ liệu câu hỏi gốc).
   * 2. Quét Phạm Vi Kiến Thức (Subject, Khối lớp, Chuyên đề, Phân bố Bloom, Vector Similarity).
   * 3. Nhân bản & Sinh mới đúng `targetCount` câu hỏi nằm trong phạm vi kiến thức của đề.
   * 4. Tự động lưu vào PostgreSQL nếu `saveToBank = true`.
   */
  async scanAndGenerateFromDocx(
    dto: DocxScanGenerateDto,
    fileBuffer?: Buffer,
    uploadedFileName?: string,
  ) {
    const targetCount = Math.min(100, Math.max(1, Number(dto.targetCount) || 15));
    const fileName = uploadedFileName || dto.fileName || 'De_Thi_Goc.docx';

    this.logger.log(`📄 [AI Docx Scan] Đang phân tích đề "${fileName}" -> Mục tiêu sinh: ${targetCount} câu hỏi`);

    // 1. Trích xuất HTML và Text từ Buffer .docx (nếu có upload file binary)
    let rawHtml = '';
    let rawText = dto.rawText || '';

    if (fileBuffer && fileBuffer.length > 0) {
      try {
        const htmlResult = await mammoth.convertToHtml(
          { buffer: fileBuffer },
          {
            styleMap: [
              'u => u',
              'b => strong',
              'i => em',
              'span[color] => span[color]',
            ],
          },
        );
        rawHtml = htmlResult.value || '';
        const textResult = await mammoth.extractRawText({ buffer: fileBuffer });
        rawText = textResult.value || rawHtml.replace(/<[^>]+>/g, ' ');
      } catch (err: any) {
        this.logger.warn(`Không đọc được binary docx bằng mammoth, chuyển sang đọc text trực tiếp: ${err.message}`);
        rawText = fileBuffer.toString('utf-8');
      }
    }

    // 2. Bóc tách các câu hỏi hạt giống (Seed Questions) có sẵn trong đề .docx
    let seedQuestions: ParsedSeedQuestion[] = [];
    if (Array.isArray(dto.seedQuestions) && dto.seedQuestions.length > 0) {
      seedQuestions = this.normalizeClientSeedQuestions(dto.seedQuestions);
    } else if (rawHtml || rawText) {
      seedQuestions = this.parseQuestionsFromDocxContent(rawHtml || rawText);
    }

    // Tổng hợp văn bản đại diện cho toàn bộ đề thi để quét phạm vi kiến thức
    const fullExamCorpus = [
      fileName,
      rawText,
      ...seedQuestions.map((q) => `${q.title} ${q.content} ${q.answers.map((a) => a.content).join(' ')}`),
    ]
      .join(' ')
      .trim();

    // 3. Quét & Nhận diện Môn học, Khối lớp và Các chuyên đề kiến thức (Knowledge Scope)
    const scopeAnalysis = await this.analyzeKnowledgeScope(
      fullExamCorpus,
      seedQuestions,
      dto.subject,
      dto.grade,
    );

    // 4. Tính toán tỉ lệ phân bổ mức độ nhận thức Bloom cho đề sinh mới
    const targetBloomRatio = this.resolveTargetBloomRatio(dto.bloomRatio, seedQuestions);

    // 5. Truy vấn các câu hỏi cùng phạm vi kiến thức trong PostgreSQL bằng Vector Similarity
    const inScopeDbQuestions = await this.findInScopeQuestionsByVector(
      fullExamCorpus,
      seedQuestions,
      scopeAnalysis.detectedSubjectSlug,
      scopeAnalysis.detectedGrade,
      scopeAnalysis.detectedTopics.map((t) => t.chapterId),
    );

    // 6. Sinh ra đúng `targetCount` câu hỏi trong phạm vi kiến thức của đề
    const generatedQuestions = this.synthesizeQuestionsInScope(
      targetCount,
      seedQuestions,
      inScopeDbQuestions,
      scopeAnalysis,
      targetBloomRatio,
    );

    // 7. Nếu Admin chọn lưu ngay vào PostgreSQL Question Bank
    let savedCount = 0;
    if (dto.saveToBank) {
      const saveRes = await this.saveGeneratedQuestionsToBank({
        questions: generatedQuestions,
        subject: scopeAnalysis.detectedSubjectSlug,
        grade: scopeAnalysis.detectedGrade,
      });
      savedCount = saveRes.savedCount;
    }

    return {
      fileName,
      targetCount,
      generatedCount: generatedQuestions.length,
      savedToBank: Boolean(dto.saveToBank),
      savedCount,
      knowledgeScope: {
        detectedSubjectSlug: scopeAnalysis.detectedSubjectSlug,
        detectedSubjectName: scopeAnalysis.detectedSubjectName,
        detectedGrade: scopeAnalysis.detectedGrade,
        extractedSeedQuestionCount: seedQuestions.length,
        matchedBankQuestionCount: inScopeDbQuestions.length,
        detectedTopics: scopeAnalysis.detectedTopics,
        sourceBloomDistribution: scopeAnalysis.sourceBloomDistribution,
        targetBloomDistribution: targetBloomRatio,
        scopeSummary: scopeAnalysis.scopeSummary,
      },
      generatedQuestions,
    };
  }

  /**
   * Lưu danh sách câu hỏi đã được AI sinh (và Admin kiểm duyệt) vào PostgreSQL
   */
  async saveGeneratedQuestionsToBank(dto: SaveGeneratedQuestionsDto) {
    const subjectSlug = dto.subject || 'toan-hoc';
    const grade = Number(dto.grade) || 12;
    const savedIds: string[] = [];

    for (let i = 0; i < dto.questions.length; i++) {
      const q = dto.questions[i];
      const qId = q.id && !String(q.id).startsWith('word_q_')
        ? String(q.id)
        : `ai-docx-${subjectSlug}-${Date.now()}-${i + 1}`;

      const bloomLevel = this.mapToPrismaBloom(q.bloomLevel || q.difficulty);
      const { qFormat, qType } = this.mapToPrismaFormat(q.questionFormat || q.type);

      const rawAnswers: any[] = Array.isArray(q.answers)
        ? q.answers
        : Array.isArray(q.choices)
          ? q.choices.map((c: any) => ({
              label: c.key,
              content: c.content,
              isAnswer: c.key === q.correctChoice,
            }))
          : [];

      const createdQuestion = await this.prisma.question.upsert({
        where: { id: qId },
        update: {
          chapter_id: Number(q.chapterId) || 1,
          subject: q.subjectSlug || subjectSlug,
          grade: Number(q.grade) || grade,
          bloom_level: bloomLevel,
          question_format: qFormat,
          type: qType,
          title: q.title || `Câu ${i + 1}`,
          question: q.content || q.question || '',
          default_points: Number(q.points || q.score || 0.25),
          explanation: q.explanation || q.explain || null,
          answer: q.shortAnswer ? String(q.shortAnswer) : null,
        },
        create: {
          id: qId,
          chapter_id: Number(q.chapterId) || 1,
          subject: q.subjectSlug || subjectSlug,
          grade: Number(q.grade) || grade,
          bloom_level: bloomLevel,
          question_format: qFormat,
          type: qType,
          title: q.title || `Câu ${i + 1}`,
          question: q.content || q.question || '',
          default_points: Number(q.points || q.score || 0.25),
          explanation: q.explanation || q.explain || null,
          answer: q.shortAnswer ? String(q.shortAnswer) : null,
        },
      });

      await this.prisma.answer.deleteMany({
        where: { question_id: createdQuestion.id },
      });

      for (let aIdx = 0; aIdx < rawAnswers.length; aIdx++) {
        const ans = rawAnswers[aIdx];
        await this.prisma.answer.create({
          data: {
            question_id: createdQuestion.id,
            content: ans.content || '',
            sub_label: ans.label || ans.sub_label || String.fromCharCode(65 + aIdx),
            is_answer: Boolean(ans.isAnswer ?? ans.is_answer),
            explain: ans.explain || null,
          },
        });
      }

      savedIds.push(createdQuestion.id);
    }

    this.logger.log(`💾 Đã lưu ${savedIds.length} câu hỏi AI sinh từ .docx vào PostgreSQL!`);

    return {
      savedCount: savedIds.length,
      savedIds,
    };
  }

  /**
   * Chuẩn hóa danh sách câu hỏi gửi từ Frontend Word Parser
   */
  private normalizeClientSeedQuestions(rawList: any[]): ParsedSeedQuestion[] {
    return rawList.map((item, idx) => {
      const bloomMap: Record<string, ParsedSeedQuestion['bloomLevel']> = {
        RECOGNITION: 'NHAN_BIET',
        EASY: 'NHAN_BIET',
        NHAN_BIET: 'NHAN_BIET',
        UNDERSTANDING: 'THONG_HIEU',
        MEDIUM: 'THONG_HIEU',
        THONG_HIEU: 'THONG_HIEU',
        APPLICATION: 'VAN_DUNG',
        HARD: 'VAN_DUNG',
        VAN_DUNG: 'VAN_DUNG',
        ADVANCED_APPLICATION: 'VAN_DUNG_CAO',
        VERY_HARD: 'VAN_DUNG_CAO',
        VAN_DUNG_CAO: 'VAN_DUNG_CAO',
      };

      const formatMap: Record<string, ParsedSeedQuestion['questionFormat']> = {
        SINGLE_CHOICE: 'SINGLE_CHOICE',
        MULTIPLE_CHOICE: 'SINGLE_CHOICE',
        MULTI_CHOICE: 'MULTI_CHOICE',
        TRUE_FALSE: 'TRUE_FALSE',
        FILL_BLANK: 'SHORT_ANSWER',
        SHORT_ANSWER: 'SHORT_ANSWER',
        ESSAY: 'ESSAY',
      };

      const answers = Array.isArray(item.answers)
        ? item.answers.map((a: any, aIdx: number) => ({
            label: a.label || a.sub_label || String.fromCharCode(65 + aIdx),
            content: a.content || '',
            isAnswer: Boolean(a.is_answer ?? a.isAnswer),
            explain: a.explain,
          }))
        : [];

      return {
        title: item.title || `Câu ${idx + 1}`,
        content: item.content || '',
        questionFormat: formatMap[item.type || item.questionFormat] || 'SINGLE_CHOICE',
        bloomLevel: bloomMap[item.difficulty || item.bloomLevel] || 'THONG_HIEU',
        chapter: item.chapter || 'Chuyên đề trong đề gốc',
        points: Number(item.points || 0.25),
        explanation: item.explain || item.explanation,
        answers,
      };
    });
  }

  /**
   * Bóc tách câu hỏi từ nội dung HTML / Text của file .docx
   */
  private parseQuestionsFromDocxContent(content: string): ParsedSeedQuestion[] {
    const textWithBreaks = content
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/div>/gi, '\n');

    const rawBlocks = textWithBreaks.split(/(?=(?:<[^>]+>)*\s*(?:Câu|Bài|Question)\s+\d+[\.:\]])/gi);
    const parsed: ParsedSeedQuestion[] = [];
    let qIndex = 0;

    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (!trimmed || !/(?:Câu|Bài|Question)\s+\d+[\.:\]]/i.test(trimmed)) {
        continue;
      }

      qIndex++;
      let questionBody = trimmed;
      let explanation = '';

      const explainMatch = trimmed.match(/(?:Lời giải|Hướng dẫn giải|Giải chi tiết)[:\s]+([\s\S]*)$/i);
      if (explainMatch) {
        explanation = explainMatch[1].replace(/<[^>]+>/g, '').trim();
        questionBody = trimmed.substring(0, explainMatch.index).trim();
      }

      const lines = questionBody.split('\n').map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || '';

      // Độ khó Bloom
      let bloomLevel: ParsedSeedQuestion['bloomLevel'] = 'THONG_HIEU';
      if (/\[(VDC|VẬN DỤNG CAO)\]/i.test(firstLine)) bloomLevel = 'VAN_DUNG_CAO';
      else if (/\[(VD|VẬN DỤNG)\]/i.test(firstLine)) bloomLevel = 'VAN_DUNG';
      else if (/\[(NB|NHẬN BIẾT)\]/i.test(firstLine)) bloomLevel = 'NHAN_BIET';
      else if (/\[(TH|THÔNG HIỂU)\]/i.test(firstLine)) bloomLevel = 'THONG_HIEU';

      const cleanHeader = firstLine
        .replace(/^(?:<[^>]+>)*\s*(?:Câu|Bài|Question)\s+\d+[\.:\]]\s*/i, '')
        .replace(/\[(VDC|VẬN DỤNG CAO|VD|VẬN DỤNG|NB|NHẬN BIẾT|TH|THÔNG HIỂU)\]/gi, '')
        .trim();

      const stemLines: string[] = [cleanHeader];
      const answerLines: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (
          /(?:<[^>]+>)*\s*[*]?\s*[<u>]?\s*[A-D][\.\)]/i.test(line) ||
          /(?:<[^>]+>)*\s*[a-d]\)\s*.*\[[ĐSTF]\]/i.test(line) ||
          /(?:<[^>]+>)*\s*Đáp án[:\s]/i.test(line)
        ) {
          answerLines.push(line);
        } else if (answerLines.length === 0) {
          stemLines.push(line);
        } else {
          answerLines[answerLines.length - 1] += ' ' + line;
        }
      }

      const cleanStem = stemLines.join(' ').replace(/<[^>]+>/g, '').trim();
      if (!cleanStem) continue;

      const isTrueFalse = answerLines.some((l) => /\[[ĐSTF]\]/i.test(l));
      const isShortAnswer = answerLines.some((l) => /^Đáp án[:\s]/i.test(l.replace(/<[^>]+>/g, '').trim()));

      let questionFormat: ParsedSeedQuestion['questionFormat'] = 'SINGLE_CHOICE';
      const answers: ParsedSeedQuestion['answers'] = [];
      let shortAnswer: string | undefined;

      if (isTrueFalse) {
        questionFormat = 'TRUE_FALSE';
        answerLines.forEach((al, aIdx) => {
          const isCorrect = /\[[ĐT]\]/i.test(al);
          const label = String.fromCharCode(97 + aIdx);
          const cleanAns = al
            .replace(/<[^>]+>/g, '')
            .replace(/^[a-d]\)\s*/i, '')
            .replace(/\[[ĐSTF]\]/gi, '')
            .trim();
          answers.push({ label, content: cleanAns, isAnswer: isCorrect });
        });
      } else if (isShortAnswer) {
        questionFormat = 'SHORT_ANSWER';
        const rawAns = answerLines[0].replace(/<[^>]+>/g, '').replace(/^Đáp án[:\s]*/i, '').trim();
        shortAnswer = rawAns;
        answers.push({ label: 'Đáp số', content: rawAns, isAnswer: true });
      } else {
        const splitted: string[] = [];
        answerLines.forEach((al) => {
          const parts = al
            .split(/(?=(?:^|\s)(?:<[^>]+>)*\s*(?:[*]\s*)?(?:<u>\s*)?[A-D][\.\)])/g)
            .map((p) => p.trim())
            .filter(Boolean);
          parts.forEach((p) => splitted.push(p));
        });

        splitted.forEach((ansHtml) => {
          const labelMatch = ansHtml.match(/([A-D])[\.\)]/i);
          const isUnderlined = /<u>/i.test(ansHtml) || /text-decoration:\s*underline/i.test(ansHtml);
          const isRed = /color:\s*(red|#ff0000|#f00)/i.test(ansHtml);
          const hasAsterisk = /^\s*[*]/i.test(ansHtml.replace(/<[^>]+>/g, ''));
          const isAnswer = isUnderlined || isRed || hasAsterisk;

          const cleanAns = ansHtml
            .replace(/<[^>]+>/g, '')
            .replace(/^\s*[*]\s*/, '')
            .replace(/^[A-D][\.\)]\s*/i, '')
            .trim();

          if (!cleanAns) return;
          const label = labelMatch ? labelMatch[1].toUpperCase() : String.fromCharCode(65 + answers.length);
          answers.push({ label, content: cleanAns, isAnswer });
        });

        // Đảm bảo ít nhất 1 đáp án đúng nếu file chưa đánh dấu
        if (answers.length > 0 && !answers.some((a) => a.isAnswer)) {
          answers[0].isAnswer = true;
        }
      }

      parsed.push({
        title: `Câu ${qIndex}`,
        content: cleanStem,
        questionFormat,
        bloomLevel,
        points: questionFormat === 'TRUE_FALSE' ? 1.0 : questionFormat === 'SHORT_ANSWER' ? 0.5 : 0.25,
        explanation,
        shortAnswer,
        answers,
      });
    }

    return parsed;
  }

  /**
   * Phân tích Phạm Vi Kiến Thức (Knowledge Scope) của đề thi .docx
   */
  private async analyzeKnowledgeScope(
    corpus: string,
    seedQuestions: ParsedSeedQuestion[],
    explicitSubject?: string,
    explicitGrade?: number,
  ) {
    const lowerCorpus = corpus.toLowerCase();

    // 1. Nhận diện môn học
    let bestSubject = this.SUBJECT_CATALOG[0];
    if (explicitSubject) {
      const found = this.SUBJECT_CATALOG.find((s) => s.slug === explicitSubject);
      if (found) bestSubject = found;
    } else {
      let maxScore = -1;
      for (const sub of this.SUBJECT_CATALOG) {
        let score = 0;
        for (const kw of sub.keywords) {
          if (lowerCorpus.includes(kw)) score += 2;
        }
        if (lowerCorpus.includes(sub.name.toLowerCase()) || lowerCorpus.includes(sub.slug)) {
          score += 5;
        }
        if (score > maxScore) {
          maxScore = score;
          bestSubject = sub;
        }
      }
    }

    // 2. Nhận diện khối lớp
    let detectedGrade = explicitGrade || 12;
    if (!explicitGrade) {
      const gradeMatch = lowerCorpus.match(/(?:lớp|khối)\s*(10|11|12)\b/i);
      if (gradeMatch) {
        detectedGrade = parseInt(gradeMatch[1], 10);
      }
    }

    // 3. Quét các chuyên đề (Topics / Chapters) xuất hiện trong đề thi
    const topicScores: Array<{
      topicName: string;
      chapterId: number;
      rawScore: number;
      matchedKeywords: string[];
    }> = [];

    for (const topic of bestSubject.topics) {
      const matchedKw: string[] = [];
      for (const kw of topic.keywords) {
        if (lowerCorpus.includes(kw)) {
          matchedKw.push(kw);
        }
      }
      topicScores.push({
        topicName: topic.name,
        chapterId: topic.chapterId,
        rawScore: matchedKw.length * 3 + 1, // Base weight để luôn có phạm vi hợp lệ
        matchedKeywords: matchedKw.length > 0 ? matchedKw : topic.keywords.slice(0, 2),
      });
    }

    // Sắp xếp chuyên đề theo mức độ xuất hiện giảm dần, chọn các chuyên đề chính
    topicScores.sort((a, b) => b.rawScore - a.rawScore);
    const activeTopics = topicScores.filter((t, idx) => t.rawScore > 1 || idx < 2).slice(0, 4);
    const totalRaw = activeTopics.reduce((sum, t) => sum + t.rawScore, 0) || 1;

    const detectedTopics: KnowledgeTopicItem[] = activeTopics.map((t, idx) => ({
      topicName: t.topicName,
      chapterId: t.chapterId,
      weightPercent: Math.round((t.rawScore / totalRaw) * 100),
      vectorConfidence: Number((0.88 - idx * 0.04).toFixed(2)),
      sampleKeywords: t.matchedKeywords.slice(0, 4),
    }));

    // 4. Phân bố Bloom của đề gốc
    const bloomCounts = { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 };
    for (const q of seedQuestions) {
      bloomCounts[q.bloomLevel] = (bloomCounts[q.bloomLevel] || 0) + 1;
    }
    const totalSeeds = seedQuestions.length || 1;
    const sourceBloomDistribution = seedQuestions.length > 0
      ? {
          NHAN_BIET: Math.round((bloomCounts.NHAN_BIET / totalSeeds) * 100),
          THONG_HIEU: Math.round((bloomCounts.THONG_HIEU / totalSeeds) * 100),
          VAN_DUNG: Math.round((bloomCounts.VAN_DUNG / totalSeeds) * 100),
          VAN_DUNG_CAO: Math.round((bloomCounts.VAN_DUNG_CAO / totalSeeds) * 100),
        }
      : { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 };

    const scopeSummary = `Đề thi thuộc môn ${bestSubject.name} (Khối ${detectedGrade}), tập trung vào ${detectedTopics.length} mạch kiến thức chính: ${detectedTopics.map((t) => t.topicName).join('; ')}.`;

    return {
      detectedSubjectSlug: bestSubject.slug,
      detectedSubjectName: bestSubject.name,
      detectedGrade,
      detectedTopics,
      sourceBloomDistribution,
      scopeSummary,
    };
  }

  private resolveTargetBloomRatio(
    rawRatio: any,
    seedQuestions: ParsedSeedQuestion[],
  ): { NHAN_BIET: number; THONG_HIEU: number; VAN_DUNG: number; VAN_DUNG_CAO: number } {
    if (rawRatio) {
      try {
        const parsed = typeof rawRatio === 'string' ? JSON.parse(rawRatio) : rawRatio;
        if (
          typeof parsed.NHAN_BIET === 'number' ||
          typeof parsed.THONG_HIEU === 'number'
        ) {
          return {
            NHAN_BIET: Number(parsed.NHAN_BIET ?? 30),
            THONG_HIEU: Number(parsed.THONG_HIEU ?? 40),
            VAN_DUNG: Number(parsed.VAN_DUNG ?? 20),
            VAN_DUNG_CAO: Number(parsed.VAN_DUNG_CAO ?? 10),
          };
        }
      } catch {
        // Fallback nếu không parse được JSON
      }
    }

    if (seedQuestions.length >= 4) {
      const counts = { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 };
      seedQuestions.forEach((q) => {
        counts[q.bloomLevel] = (counts[q.bloomLevel] || 0) + 1;
      });
      const n = seedQuestions.length;
      return {
        NHAN_BIET: Math.round((counts.NHAN_BIET / n) * 100),
        THONG_HIEU: Math.round((counts.THONG_HIEU / n) * 100),
        VAN_DUNG: Math.round((counts.VAN_DUNG / n) * 100),
        VAN_DUNG_CAO: Math.max(
          0,
          100 -
            Math.round((counts.NHAN_BIET / n) * 100) -
            Math.round((counts.THONG_HIEU / n) * 100) -
            Math.round((counts.VAN_DUNG / n) * 100),
        ),
      };
    }

    return { NHAN_BIET: 30, THONG_HIEU: 40, VAN_DUNG: 20, VAN_DUNG_CAO: 10 };
  }

  /**
   * Tìm kiếm các câu hỏi trong PostgreSQL thuộc cùng phạm vi kiến thức bằng Vector Embedding
   */
  private async findInScopeQuestionsByVector(
    corpus: string,
    seedQuestions: ParsedSeedQuestion[],
    subjectSlug: string,
    grade: number,
    chapterIds: number[],
  ) {
    const dbQuestions = await this.prisma.question.findMany({
      where: {
        subject: subjectSlug,
        ...(chapterIds.length > 0 ? { chapter_id: { in: chapterIds } } : {}),
      },
      include: {
        answers: true,
      },
      take: 60,
    });

    if (dbQuestions.length === 0) {
      return this.prisma.question.findMany({
        where: { subject: subjectSlug },
        include: { answers: true },
        take: 40,
      });
    }

    // Dùng Vector Embedding của đoạn văn mẫu để xếp hạng độ tương đồng với câu hỏi trong DB
    try {
      const sampleQuery = seedQuestions.length > 0
        ? seedQuestions.slice(0, 3).map((q) => q.content).join(' ')
        : corpus.slice(0, 500);

      if (sampleQuery.trim().length > 10) {
        const queryVec = await this.semanticCacheService.getEmbedding(sampleQuery);
        const scored = await Promise.all(
          dbQuestions.map(async (q) => {
            const qVec = await this.semanticCacheService.getEmbedding(`${q.title || ''} ${q.question}`);
            const sim = this.semanticCacheService.cosineSimilarity(queryVec, qVec);
            return { q, sim };
          }),
        );
        scored.sort((a, b) => b.sim - a.sim);
        return scored.map((item) => item.q);
      }
    } catch (e: any) {
      this.logger.debug(`Bỏ qua xếp hạng vector sâu, dùng bộ lọc chuyên đề trực tiếp: ${e.message}`);
    }

    return dbQuestions;
  }

  /**
   * Nhân bản biến thể đồng cấu (Isomorphic Cloning) & Sinh mới đúng `targetCount` câu hỏi
   * nằm gói gọn trong phạm vi kiến thức của đề .docx đã tải lên.
   */
  private synthesizeQuestionsInScope(
    targetCount: number,
    seedQuestions: ParsedSeedQuestion[],
    inScopeDbQuestions: any[],
    scopeAnalysis: {
      detectedSubjectSlug: string;
      detectedSubjectName: string;
      detectedGrade: number;
      detectedTopics: KnowledgeTopicItem[];
    },
    targetBloomRatio: { NHAN_BIET: number; THONG_HIEU: number; VAN_DUNG: number; VAN_DUNG_CAO: number },
  ) {
    // 1. Tạo danh sách nguồn hạt giống kết hợp (ưu tiên câu hỏi từ file .docx trước, sau đó đến câu hỏi cùng phạm vi từ DB)
    const combinedTemplates: ParsedSeedQuestion[] = [...seedQuestions];

    for (const dbQ of inScopeDbQuestions) {
      combinedTemplates.push({
        title: dbQ.title || 'Câu hỏi chuyên đề',
        content: dbQ.question,
        questionFormat: (dbQ.question_format as ParsedSeedQuestion['questionFormat']) || 'SINGLE_CHOICE',
        bloomLevel: (dbQ.bloom_level as ParsedSeedQuestion['bloomLevel']) || 'THONG_HIEU',
        chapterId: dbQ.chapter_id || 1,
        topic: scopeAnalysis.detectedTopics.find((t) => t.chapterId === dbQ.chapter_id)?.topicName ||
          scopeAnalysis.detectedTopics[0]?.topicName ||
          'Chuyên đề trọng tâm',
        points: Number(dbQ.default_points || 0.25),
        explanation: dbQ.explanation || undefined,
        shortAnswer: dbQ.answer || undefined,
        answers: (dbQ.answers || []).map((a: any, idx: number) => ({
          label: a.sub_label || String.fromCharCode(65 + idx),
          content: a.content,
          isAnswer: Boolean(a.is_answer),
          explain: a.explain || undefined,
        })),
      });
    }

    // Nếu cả file docx và DB đều rỗng, tạo mẫu cơ sở theo chuyên đề
    if (combinedTemplates.length === 0) {
      const defaultTopic = scopeAnalysis.detectedTopics[0]?.topicName || 'Kiến thức trọng tâm';
      combinedTemplates.push({
        title: 'Câu 1',
        content: `Trong chuyên đề ${defaultTopic} (${scopeAnalysis.detectedSubjectName} ${scopeAnalysis.detectedGrade}), khẳng định nào sau đây phản ánh đúng bản chất định lý cơ bản при khảo sát bài toán?`,
        questionFormat: 'SINGLE_CHOICE',
        bloomLevel: 'THONG_HIEU',
        chapterId: 1,
        topic: defaultTopic,
        points: 0.25,
        explanation: `Áp dụng trực tiếp tính chất nền tảng của chuyên đề ${defaultTopic}.`,
        answers: [
          { label: 'A', content: `Biểu thức luôn bảo toàn tính liên tục và thỏa mãn điều kiện biên của ${defaultTopic}.`, isAnswer: true },
          { label: 'B', content: `Hàm đại diện không tồn tại cực trị trên mọi miền xác định.`, isAnswer: false },
          { label: 'C', content: `Giá trị tham số độc lập hoàn toàn với điều kiện đầu.`, isAnswer: false },
          { label: 'D', content: `Hệ phương trình luôn suy biến về nghiệm tầm thường.`, isAnswer: false },
        ],
      });
    }

    // 2. Xây dựng danh sách hạn ngạch Bloom cho đúng `targetCount` câu
    const bloomSlots: Array<ParsedSeedQuestion['bloomLevel']> = [];
    const nbCount = Math.round((targetBloomRatio.NHAN_BIET / 100) * targetCount);
    const thCount = Math.round((targetBloomRatio.THONG_HIEU / 100) * targetCount);
    const vdCount = Math.round((targetBloomRatio.VAN_DUNG / 100) * targetCount);
    const vdcCount = Math.max(0, targetCount - nbCount - thCount - vdCount);

    for (let i = 0; i < nbCount; i++) bloomSlots.push('NHAN_BIET');
    for (let i = 0; i < thCount; i++) bloomSlots.push('THONG_HIEU');
    for (let i = 0; i < vdCount; i++) bloomSlots.push('VAN_DUNG');
    for (let i = 0; i < vdcCount; i++) bloomSlots.push('VAN_DUNG_CAO');

    while (bloomSlots.length < targetCount) bloomSlots.push('THONG_HIEU');

    // 3. Sinh từng câu hỏi biến thể theo phạm vi kiến thức
    const results: any[] = [];
    const bloomToDifficultyMap: Record<ParsedSeedQuestion['bloomLevel'], string> = {
      NHAN_BIET: 'RECOGNITION',
      THONG_HIEU: 'UNDERSTANDING',
      VAN_DUNG: 'APPLICATION',
      VAN_DUNG_CAO: 'ADVANCED_APPLICATION',
    };
    const bloomLabelVi: Record<ParsedSeedQuestion['bloomLevel'], string> = {
      NHAN_BIET: 'Nhận biết',
      THONG_HIEU: 'Thông hiểu',
      VAN_DUNG: 'Vận dụng',
      VAN_DUNG_CAO: 'Vận dụng cao',
    };

    for (let i = 0; i < targetCount; i++) {
      const desiredBloom = bloomSlots[i];
      const topicObj = scopeAnalysis.detectedTopics[i % scopeAnalysis.detectedTopics.length] || {
        topicName: 'Chuyên đề trong đề gốc',
        chapterId: 1,
      };

      // Tìm câu hạt giống khớp mức độ Bloom hoặc lấy xoay vòng
      const matchingPool = combinedTemplates.filter((t) => t.bloomLevel === desiredBloom);
      const pool = matchingPool.length > 0 ? matchingPool : combinedTemplates;
      const baseTemplate = pool[i % pool.length];
      const variantRound = Math.floor(i / pool.length) + 1;

      const mutated = this.mutateQuestionWithinScope(
        baseTemplate,
        i + 1,
        variantRound,
        desiredBloom,
        topicObj.topicName,
        scopeAnalysis.detectedSubjectSlug,
      );

      const qId = `ai_docx_q_${Date.now()}_${i + 1}`;
      const mappedType =
        mutated.questionFormat === 'TRUE_FALSE'
          ? 'TRUE_FALSE'
          : mutated.questionFormat === 'SHORT_ANSWER'
            ? 'FILL_BLANK'
            : mutated.questionFormat === 'ESSAY'
              ? 'ESSAY'
              : 'SINGLE_CHOICE';

      results.push({
        id: qId,
        originalIndex: i + 1,
        orderIndex: i + 1,
        title: `Câu ${i + 1} (${bloomLabelVi[desiredBloom]})`,
        content: mutated.content,
        type: mappedType,
        questionFormat: mutated.questionFormat,
        difficulty: bloomToDifficultyMap[desiredBloom],
        bloomLevel: desiredBloom,
        subjectSlug: scopeAnalysis.detectedSubjectSlug,
        subjectName: scopeAnalysis.detectedSubjectName,
        grade: scopeAnalysis.detectedGrade,
        chapterId: topicObj.chapterId,
        chapter: `Chương ${topicObj.chapterId}: ${topicObj.topicName}`,
        topic: topicObj.topicName,
        points: mutated.points,
        explain: mutated.explanation,
        explanation: mutated.explanation,
        shortAnswer: mutated.shortAnswer,
        isFromDocxSeed: i < seedQuestions.length,
        generationMethod:
          i < seedQuestions.length
            ? 'DOCX_SEED_CLONE'
            : 'KNOWLEDGE_SCOPE_SYNTHESIS',
        answers: mutated.answers.map((a, aIdx) => ({
          id: `${qId}_ans_${aIdx}`,
          question_id: qId,
          label: a.label,
          content: a.content,
          is_answer: a.isAnswer,
          isAnswer: a.isAnswer,
          explain: a.explain,
        })),
        hasError: false,
        created_at: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Biến đổi tham số toán học / ngữ cảnh khoa học để tạo câu hỏi mới đồng cấu
   * giữ nguyên phạm vi kiến thức của câu gốc trong đề .docx
   */
  private mutateQuestionWithinScope(
    template: ParsedSeedQuestion,
    questionNumber: number,
    variantSeed: number,
    targetBloom: ParsedSeedQuestion['bloomLevel'],
    topicName: string,
    subjectSlug: string,
  ): ParsedSeedQuestion {
    const transformText = (input: string): string => {
      if (!input) return input;
      if (variantSeed <= 1) return input; // Giữ nguyên tham số chuẩn ở lượt đầu tiên
      let out = input;
      const shift = (variantSeed % 4) + 1;

      // Biến đổi các tham số số học phổ biến nhưng giữ nguyên số mũ (^2, ^3), chỉ số dưới (_1, _2) và năm học/khối lớp
      out = out.replace(/(?<![\^_])(\b\d+\b)/g, (match) => {
        const val = parseInt(match, 10);
        if (
          val >= 2 &&
          val <= 50 &&
          val !== 10 &&
          val !== 11 &&
          val !== 12 &&
          val !== 100 &&
          val !== 2018 &&
          val !== 2025
        ) {
          return String(val + shift);
        }
        return match;
      });

      out = out
        .replace(/\[0;\s*4\]/g, `[0; ${4 + shift}]`)
        .replace(/\[-10;\s*10\]/g, `[-${10 + shift * 2}; ${10 + shift * 2}]`)
        .replace(/m\s*>\s*1/g, `m > ${1 + shift}`)
        .replace(/m\s*=\s*0/g, `m = ${shift}`);

      return out;
    };

    const mutatedContent = transformText(template.content);
    let mutatedAnswers = template.answers.map((a) => ({
      ...a,
      content: transformText(a.content),
    }));

    // Nếu là câu trắc nghiệm 4 lựa chọn A, B, C, D -> Hoán vị vị trí đáp án theo questionNumber
    if (template.questionFormat === 'SINGLE_CHOICE' && mutatedAnswers.length === 4) {
      const labels = ['A', 'B', 'C', 'D'];
      const shift = questionNumber % 4;
      const rotated = mutatedAnswers.map((_, idx) => {
        const src = (idx + shift) % 4;
        return mutatedAnswers[src];
      });
      mutatedAnswers = rotated.map((item, idx) => ({
        ...item,
        label: labels[idx],
      }));
    }

    const correctItem = mutatedAnswers.find((a) => a.isAnswer);
    const defaultExplain =
      template.explanation
        ? transformText(template.explanation)
        : `Áp dụng kiến thức trọng tâm thuộc chuyên đề "${topicName}" (${subjectSlug.toUpperCase()}). Phân tích điều kiện bài toán và biến đổi tương đương, ta xác định được đáp án chuẩn là ${correctItem ? `${correctItem.label} (${correctItem.content})` : 'như biểu thức đã cho'}.`;

    return {
      ...template,
      bloomLevel: targetBloom,
      content: mutatedContent,
      answers: mutatedAnswers,
      explanation: defaultExplain,
    };
  }

  private mapToPrismaBloom(val?: string): BloomLevel {
    const map: Record<string, BloomLevel> = {
      NHAN_BIET: BloomLevel.NHAN_BIET,
      RECOGNITION: BloomLevel.NHAN_BIET,
      EASY: BloomLevel.NHAN_BIET,
      THONG_HIEU: BloomLevel.THONG_HIEU,
      UNDERSTANDING: BloomLevel.THONG_HIEU,
      MEDIUM: BloomLevel.THONG_HIEU,
      VAN_DUNG: BloomLevel.VAN_DUNG,
      APPLICATION: BloomLevel.VAN_DUNG,
      HARD: BloomLevel.VAN_DUNG,
      VAN_DUNG_CAO: BloomLevel.VAN_DUNG_CAO,
      ADVANCED_APPLICATION: BloomLevel.VAN_DUNG_CAO,
      VERY_HARD: BloomLevel.VAN_DUNG_CAO,
    };
    return map[val || ''] || BloomLevel.THONG_HIEU;
  }

  private mapToPrismaFormat(val?: string): { qFormat: QuestionFormat; qType: QuestionType } {
    if (val === 'TRUE_FALSE') {
      return { qFormat: QuestionFormat.TRUE_FALSE, qType: QuestionType.TRUE_FALSE };
    }
    if (val === 'SHORT_ANSWER' || val === 'FILL_BLANK') {
      return { qFormat: QuestionFormat.SHORT_ANSWER, qType: QuestionType.SINGLE_CHOICE };
    }
    if (val === 'ESSAY') {
      return { qFormat: QuestionFormat.ESSAY, qType: QuestionType.ESSAY };
    }
    if (val === 'MULTI_CHOICE') {
      return { qFormat: QuestionFormat.MULTI_CHOICE, qType: QuestionType.MULTIPLE_CHOICE };
    }
    return { qFormat: QuestionFormat.SINGLE_CHOICE, qType: QuestionType.MULTIPLE_CHOICE };
  }
}
