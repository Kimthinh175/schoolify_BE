export type DuplicateCheckStatus = 'UNIQUE' | 'EXACT_DUPLICATE' | 'CONFLICT_ANSWER';

export type DuplicateMatchSource = 'DB' | 'BATCH' | 'BOTH' | null;

export type DuplicateResolutionAction = 'SKIP' | 'OVERWRITE' | 'KEEP_BOTH';

export interface DuplicateResolutionInput {
  action: DuplicateResolutionAction;
  existingQuestionId?: string;
}

export interface AnswerProfile {
  fingerprint: string;
  summary: string;
  hasCorrectAnswer: boolean;
}

export interface ExistingQuestionCandidate {
  id: string;
  title?: string | null;
  question: string;
  subject?: string | null;
  grade?: number | null;
  question_format?: string | null;
  answer?: string | null;
  explanation?: string | null;
  answers?: Array<{
    sub_label?: string | null;
    content: string;
    is_answer: boolean;
  }>;
}

export interface DuplicateMatchInfo {
  id?: string;
  title?: string;
  subject?: string;
  grade?: number;
  questionFormat?: string;
  answerSummary: string;
  answerFingerprint: string;
  explanation?: string | null;
  batchIndex?: number;
}

export interface QuestionDuplicateCheckItem {
  index: number;
  clientId: string;
  status: DuplicateCheckStatus;
  source: DuplicateMatchSource;
  stemKey: string;
  incomingAnswerSummary: string;
  incomingAnswerFingerprint: string;
  existingMatch?: DuplicateMatchInfo;
}

export interface QuestionDuplicateCheckSummary {
  totalChecked: number;
  uniqueCount: number;
  exactDuplicateCount: number;
  conflictCount: number;
  results: QuestionDuplicateCheckItem[];
}

/**
 * Chuẩn hóa nội dung câu hỏi để so sánh trùng lặp ổn định giữa nhiều định dạng nhập (.docx / .xlsx / AI).
 */
export function normalizeQuestionStem(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^\s*(?:Câu|Bài|Question)\s+\d+\s*[\.:\]\-]*\s*/i, '')
    .replace(/\[(VDC|VẬN DỤNG CAO|VD|VẬN DỤNG|NB|NHẬN BIẾT|TH|THÔNG HIỂU)\]/gi, ' ')
    .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  text = text.replace(/[.,:;!?]+$/g, '').trim();
  return text;
}

/**
 * Chuẩn hóa nội dung một phương án trả lời hoặc đáp số ngắn.
 */
export function normalizeAnswerText(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^[A-Da-d][\.\)]\s*/i, '')
    .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveCanonicalFormat(rawFormat?: string | null): string {
  const upper = String(rawFormat || 'SINGLE_CHOICE').toUpperCase().trim();
  if (upper === 'FILL_BLANK' || upper === 'SHORT_ANSWER') return 'SHORT_ANSWER';
  if (upper === 'TRUE_FALSE') return 'TRUE_FALSE';
  if (upper === 'MULTIPLE_CHOICE' || upper === 'MULTI_CHOICE') return 'MULTI_CHOICE';
  return 'SINGLE_CHOICE';
}

/**
 * Trích xuất dấu vân tay (fingerprint) và chuỗi mô tả ngắn của đáp án đúng để phát hiện xung đột đáp án.
 */
export function extractAnswerProfile(input: {
  questionFormat?: string | null;
  type?: string | null;
  answer?: string | null;
  shortAnswer?: string | null;
  shortAnswerCorrect?: string | null;
  answers?: any[];
  choices?: any[];
  correctChoice?: string | null;
}): AnswerProfile {
  const format = resolveCanonicalFormat(input.questionFormat || input.type);

  const normalizedAnswers: Array<{ label: string; content: string; isAnswer: boolean }> = Array.isArray(
    input.answers,
  )
    ? input.answers.map((a, idx) => ({
        label: String(a.label || a.sub_label || String.fromCharCode(65 + idx)).trim(),
        content: String(a.content || '').trim(),
        isAnswer: Boolean(a.isAnswer ?? a.is_answer ?? a.isCorrect),
      }))
    : Array.isArray(input.choices)
      ? input.choices.map((c, idx) => {
          const lbl = String(c.key || String.fromCharCode(65 + idx)).trim();
          return {
            label: lbl,
            content: String(c.content || '').trim(),
            isAnswer: Boolean(input.correctChoice && lbl.toUpperCase() === String(input.correctChoice).toUpperCase()),
          };
        })
      : [];

  if (format === 'SHORT_ANSWER') {
    const rawShort =
      input.shortAnswer ||
      input.shortAnswerCorrect ||
      input.answer ||
      normalizedAnswers.find((a) => a.isAnswer)?.content ||
      '';
    const cleaned = String(rawShort).trim();
    const norm = normalizeAnswerText(cleaned);
    if (!norm || norm === '(điền đáp số)') {
      return {
        fingerprint: 'NONE',
        summary: '(Chưa có đáp số)',
        hasCorrectAnswer: false,
      };
    }
    return {
      fingerprint: `SHORT:${norm}`,
      summary: cleaned,
      hasCorrectAnswer: true,
    };
  }

  if (format === 'TRUE_FALSE') {
    if (normalizedAnswers.length === 0) {
      return {
        fingerprint: 'NONE',
        summary: '(Chưa có mệnh đề Đúng/Sai)',
        hasCorrectAnswer: false,
      };
    }
    const items = normalizedAnswers.map((a, idx) => ({
      label: a.label || String.fromCharCode(97 + idx),
      normContent: normalizeAnswerText(a.content),
      flag: a.isAnswer ? 'Đ' : 'S',
    }));
    const fingerprintParts = [...items]
      .sort((x, y) => x.normContent.localeCompare(y.normContent))
      .map((x) => `${x.normContent}=>${x.flag}`);
    const summary = items.map((x) => `${x.label.toLowerCase()}-${x.flag}`).join(', ');
    return {
      fingerprint: `TF:${fingerprintParts.join('||')}`,
      summary,
      hasCorrectAnswer: true,
    };
  }

  // SINGLE_CHOICE / MULTI_CHOICE
  const correctOptions = normalizedAnswers.filter((a) => a.isAnswer);
  if (correctOptions.length === 0) {
    return {
      fingerprint: 'NONE',
      summary: '(Chưa chọn đáp án đúng)',
      hasCorrectAnswer: false,
    };
  }

  const normalizedCorrectContents = correctOptions
    .map((a) => normalizeAnswerText(a.content))
    .filter(Boolean)
    .sort();

  const summary = correctOptions
    .map((a) => (a.content ? `${a.label}. ${a.content}` : a.label))
    .join(' | ');

  return {
    fingerprint: `MC:${normalizedCorrectContents.join('||')}`,
    summary,
    hasCorrectAnswer: true,
  };
}

/**
 * So sánh toàn bộ câu hỏi trong lô nhập (kiểm tra cả trùng nội bộ trong file và trùng/xung đột với DB).
 */
export function evaluateQuestionDuplicates(
  incomingQuestions: any[],
  existingDbQuestions: ExistingQuestionCandidate[],
): QuestionDuplicateCheckSummary {
  const dbStemMap = new Map<string, DuplicateMatchInfo[]>();

  for (const dbQ of existingDbQuestions) {
    const stemKey = normalizeQuestionStem(dbQ.question);
    if (!stemKey) continue;
    const profile = extractAnswerProfile({
      questionFormat: dbQ.question_format,
      answer: dbQ.answer,
      answers: dbQ.answers,
    });
    const list = dbStemMap.get(stemKey) || [];
    list.push({
      id: dbQ.id,
      title: dbQ.title || undefined,
      subject: dbQ.subject || undefined,
      grade: dbQ.grade ?? undefined,
      questionFormat: dbQ.question_format || undefined,
      answerSummary: profile.summary,
      answerFingerprint: profile.fingerprint,
      explanation: dbQ.explanation,
    });
    dbStemMap.set(stemKey, list);
  }

  const batchStemMap = new Map<string, DuplicateMatchInfo[]>();
  const results: QuestionDuplicateCheckItem[] = [];
  let uniqueCount = 0;
  let exactDuplicateCount = 0;
  let conflictCount = 0;

  for (let i = 0; i < incomingQuestions.length; i++) {
    const q = incomingQuestions[i] || {};
    const clientId = String(q.id || `row_${i}`);
    const stemKey = normalizeQuestionStem(q.content || q.question);
    const incomingProfile = extractAnswerProfile(q);

    if (!stemKey) {
      uniqueCount++;
      results.push({
        index: i,
        clientId,
        status: 'UNIQUE',
        source: null,
        stemKey: '',
        incomingAnswerSummary: incomingProfile.summary,
        incomingAnswerFingerprint: incomingProfile.fingerprint,
      });
      continue;
    }

    const dbMatches = dbStemMap.get(stemKey) || [];
    const batchMatches = batchStemMap.get(stemKey) || [];

    const hasDb = dbMatches.length > 0;
    const hasBatch = batchMatches.length > 0;
    const allMatches = [...dbMatches, ...batchMatches];

    let status: DuplicateCheckStatus = 'UNIQUE';
    let source: DuplicateMatchSource = null;
    let chosenMatch: DuplicateMatchInfo | undefined;

    if (allMatches.length > 0) {
      source = hasDb && hasBatch ? 'BOTH' : hasDb ? 'DB' : 'BATCH';

      const conflictingMatch = allMatches.find(
        (m) =>
          m.answerFingerprint !== incomingProfile.fingerprint ||
          (m.answerFingerprint !== 'NONE' && incomingProfile.fingerprint === 'NONE'),
      );

      if (conflictingMatch) {
        status = 'CONFLICT_ANSWER';
        chosenMatch = conflictingMatch;
        conflictCount++;
      } else {
        status = 'EXACT_DUPLICATE';
        chosenMatch = dbMatches[0] || batchMatches[0];
        exactDuplicateCount++;
      }
    } else {
      uniqueCount++;
    }

    const batchList = batchStemMap.get(stemKey) || [];
    batchList.push({
      title: q.title || `Câu ${q.originalIndex || i + 1}`,
      batchIndex: Number(q.originalIndex) || i + 1,
      questionFormat: resolveCanonicalFormat(q.questionFormat || q.type),
      answerSummary: incomingProfile.summary,
      answerFingerprint: incomingProfile.fingerprint,
      explanation: q.explain || q.explanation || null,
    });
    batchStemMap.set(stemKey, batchList);

    results.push({
      index: i,
      clientId,
      status,
      source,
      stemKey,
      incomingAnswerSummary: incomingProfile.summary,
      incomingAnswerFingerprint: incomingProfile.fingerprint,
      existingMatch: chosenMatch,
    });
  }

  return {
    totalChecked: incomingQuestions.length,
    uniqueCount,
    exactDuplicateCount,
    conflictCount,
    results,
  };
}
