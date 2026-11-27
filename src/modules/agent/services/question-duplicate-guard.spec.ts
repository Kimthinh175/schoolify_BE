import {
  evaluateQuestionDuplicates,
  extractAnswerProfile,
  normalizeQuestionStem,
} from './question-duplicate-guard';

describe('question-duplicate-guard', () => {
  it('normalizes stems across Câu N: prefixes, whitespace, and $ latex wrappers', () => {
    const a = normalizeQuestionStem('Câu 12: [TH] Tìm nghiệm của phương trình $x^2 - 4 = 0$.');
    const b = normalizeQuestionStem('Tìm nghiệm của phương trình x^2 - 4 = 0');
    expect(a).toBe(b);
  });

  it('detects EXACT_DUPLICATE against existing DB question when stem and correct answer match', () => {
    const dbQuestions = [
      {
        id: 'db-q-1',
        title: 'Câu 1',
        question: 'Giá trị của $\\int_0^1 x\\,dx$ bằng bao nhiêu?',
        subject: 'toan-hoc',
        grade: 12,
        question_format: 'SINGLE_CHOICE',
        answers: [
          { sub_label: 'A', content: '1/2', is_answer: true },
          { sub_label: 'B', content: '1', is_answer: false },
        ],
      },
    ];

    const incoming = [
      {
        id: 'word_q_1',
        originalIndex: 1,
        content: 'Câu 5: Giá trị của \\int_0^1 x\\,dx bằng bao nhiêu',
        type: 'SINGLE_CHOICE',
        answers: [
          { label: 'A', content: '1', is_answer: false },
          { label: 'B', content: '1/2', is_answer: true },
        ],
      },
    ];

    const report = evaluateQuestionDuplicates(incoming, dbQuestions);
    expect(report.exactDuplicateCount).toBe(1);
    expect(report.conflictCount).toBe(0);
    expect(report.results[0].status).toBe('EXACT_DUPLICATE');
    expect(report.results[0].source).toBe('DB');
    expect(report.results[0].existingMatch?.id).toBe('db-q-1');
  });

  it('detects CONFLICT_ANSWER when same stem has a different correct answer in DB', () => {
    const dbQuestions = [
      {
        id: 'db-q-2',
        title: 'Câu 2',
        question: 'Đạo hàm của hàm số $y = x^3$ là:',
        question_format: 'SINGLE_CHOICE',
        answers: [
          { sub_label: 'A', content: '$3x^2$', is_answer: true },
          { sub_label: 'B', content: '$x^2$', is_answer: false },
        ],
      },
    ];

    const incoming = [
      {
        id: 'word_q_2',
        originalIndex: 1,
        content: 'Đạo hàm của hàm số y = x^3 là',
        type: 'SINGLE_CHOICE',
        answers: [
          { label: 'A', content: '3x^2', is_answer: false },
          { label: 'B', content: 'x^2', is_answer: true },
        ],
      },
    ];

    const report = evaluateQuestionDuplicates(incoming, dbQuestions);
    expect(report.conflictCount).toBe(1);
    expect(report.results[0].status).toBe('CONFLICT_ANSWER');
    expect(report.results[0].incomingAnswerSummary).toContain('x^2');
    expect(report.results[0].existingMatch?.answerSummary).toContain('$3x^2$');
  });

  it('detects intra-batch CONFLICT_ANSWER and EXACT_DUPLICATE across multiple formats', () => {
    const incoming = [
      {
        id: 'word_q_10',
        originalIndex: 1,
        type: 'TRUE_FALSE',
        content: 'Cho hàm số f(x) = 2x.',
        answers: [
          { label: 'a', content: 'f(1) = 2', is_answer: true },
          { label: 'b', content: 'f(0) = 1', is_answer: false },
        ],
      },
      {
        id: 'word_q_11',
        originalIndex: 2,
        type: 'TRUE_FALSE',
        content: 'Cho hàm số f(x) = 2x.',
        answers: [
          { label: 'a', content: 'f(1) = 2', is_answer: false },
          { label: 'b', content: 'f(0) = 1', is_answer: true },
        ],
      },
      {
        id: 'word_q_12',
        originalIndex: 3,
        type: 'FILL_BLANK',
        content: 'Tổng 2 + 3 bằng bao nhiêu?',
        shortAnswerCorrect: '5',
      },
      {
        id: 'word_q_13',
        originalIndex: 4,
        type: 'FILL_BLANK',
        content: 'Câu 9: Tổng 2 + 3 bằng bao nhiêu?',
        shortAnswerCorrect: '5',
      },
    ];

    const report = evaluateQuestionDuplicates(incoming, []);
    expect(report.uniqueCount).toBe(2);
    expect(report.conflictCount).toBe(1);
    expect(report.exactDuplicateCount).toBe(1);
    expect(report.results[1].status).toBe('CONFLICT_ANSWER');
    expect(report.results[1].source).toBe('BATCH');
    expect(report.results[3].status).toBe('EXACT_DUPLICATE');
    expect(report.results[3].source).toBe('BATCH');
  });

  it('marks incoming missing correct answer as NONE fingerprint', () => {
    const profile = extractAnswerProfile({
      type: 'SINGLE_CHOICE',
      answers: [
        { label: 'A', content: '1', is_answer: false },
        { label: 'B', content: '2', is_answer: false },
      ],
    });
    expect(profile.fingerprint).toBe('NONE');
    expect(profile.hasCorrectAnswer).toBe(false);
  });
});
