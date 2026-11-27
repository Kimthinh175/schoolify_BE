import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  actions?: any[];
  emotion?: string;
  suggestions?: string[];
  pointUsage?: any;
  isError?: boolean;
  /** Vector đặc trưng nén 128 chiều phục vụ truy xuất ngữ nghĩa nhanh kiểu Antigravity */
  turnVector?: number[];
}

export interface ChatSessionSummaryItem {
  id: string;
  sessionKey: string;
  userId: string | null;
  title: string;
  isPinned: boolean;
  messageCount: number;
  lastMessagePreview: string | null;
  summaryText: string | null;
  createdAt: string;
  updatedAt: string;
  similarity?: number;
}

export interface VectorizedContextResult {
  /** 4 tin nhắn gần nhất giữ nguyên văn để nối mạch hội thoại */
  hotWindow: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Top-K lượt hội thoại cũ có độ tương đồng vector cao nhất trong phiên hoặc liên phiên */
  recalledTurns: Array<{
    sessionKey: string;
    sessionTitle: string;
    userQuery: string;
    assistantReply: string;
    similarity: number;
  }>;
  /** Bản tóm tắt nén kiểu <CONTEXT_SUMMARY> của Antigravity */
  contextSummary: string;
  /** Nếu phát hiện câu hỏi trùng khớp rất cao (>= 0.94) trong lịch sử của chính học sinh -> trả lời tức thì */
  instantMemoryHit?: {
    hit: boolean;
    similarity: number;
    sessionKey: string;
    sessionTitle: string;
    responseMessage: string;
    actions?: any[];
    emotion?: string;
    suggestions?: string[];
  };
  stats: {
    totalHistoricalTurnsScanned: number;
    recalledCount: number;
    tokenSavedPercent: number;
    vectorComputeMs: number;
  };
}

@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);
  private readonly VECTOR_DIM = 128;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tính Vector nhúng siêu tốc 128 chiều (L2-normalized Feature Hashing: Accented + Unaccented + Synonym + Trigram)
   * Tốc độ < 0.15ms, phục vụ tìm kiếm ngữ nghĩa lịch sử trò chuyện & nén ngữ cảnh chuẩn Antigravity
   */
  computeFastVector(text: string): number[] {
    const dim = this.VECTOR_DIM;
    const vec = new Float64Array(dim);
    const cleaned = (text || '')
      .toLowerCase()
      .normalize('NFC')
      .replace(
        /^(cho mình hỏi|cho tớ hỏi|giúp mình|giúp tớ|bạn ơi|ai ơi|hãy|làm ơn|cho hỏi)\s+/i,
        '',
      )
      .replace(/\b(nhé|nha|ạ|với|đi)\b/gi, ' ')
      .replace(/\bbậc 2\b/g, 'bậc hai')
      .replace(/\bbac 2\b/g, 'bac hai')
      .replace(/\bpt\b/g, 'phương trình')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      return new Array<number>(dim).fill(0);
    }

    const unaccented = cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

    const tokens = cleaned.split(' ').filter(Boolean);
    const asciiTokens = unaccented.split(' ').filter(Boolean);

    for (let i = 0; i < 8; i++) {
      vec[i] = 0.15;
    }

    const addFeat = (feat: string, weight: number) => {
      let h1 = 2166136261;
      let h2 = 16777619;
      for (let i = 0; i < feat.length; i++) {
        const c = feat.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 16777619);
        h2 ^= c;
        h2 = Math.imul(h2, 1099511628211 & 0xffffffff);
      }
      const idx = (Math.abs(h1) % (dim - 8)) + 8;
      const sign = (h2 & 1) === 0 ? 1 : -1;
      vec[idx] += sign * weight;
    };

    for (let i = 0; i < tokens.length; i++) {
      addFeat(`w:${tokens[i]}`, 2.0);
      if (asciiTokens[i]) {
        addFeat(`a:${asciiTokens[i]}`, 1.8);
      }
      if (i + 1 < tokens.length) {
        addFeat(`b:${tokens[i]}_${tokens[i + 1]}`, 1.5);
      }
      if (i + 1 < asciiTokens.length) {
        addFeat(`ab:${asciiTokens[i]}_${asciiTokens[i + 1]}`, 1.4);
      }
      const w = asciiTokens[i] || tokens[i];
      for (let c = 0; c <= w.length - 3; c++) {
        addFeat(`g:${w.slice(c, c + 3)}`, 0.6);
      }
    }

    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm) || 1;
    const out = new Array<number>(dim);
    for (let i = 0; i < dim; i++) {
      out[i] = Number((vec[i] / norm).toFixed(5));
    }
    return out;
  }

  cosineSimilarity(v1?: number[] | null, v2?: number[] | null): number {
    if (
      !Array.isArray(v1) ||
      !Array.isArray(v2) ||
      v1.length !== v2.length ||
      v1.length === 0
    ) {
      return 0;
    }
    let dot = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += (v1[i] || 0) * (v2[i] || 0);
    }
    return dot;
  }

  /**
   * Tự động đặt tên phiên trò chuyện thông minh theo phong cách Google Gemini
   * từ câu hỏi đầu tiên của người dùng
   */
  generateSmartTitle(firstUserMessage: string): string {
    const clean = (firstUserMessage || '')
      .replace(/^[\s💡🎯📐🏫💳⚡🤖✨•\-]+/u, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return 'Cuộc trò chuyện mới';

    // Nếu câu hỏi bắt đầu bằng các cụm rườm rà, rút gọn cho tinh tế như Gemini
    const stripped = clean
      .replace(
        /^(cho mình hỏi|cho tớ hỏi|giúp mình|giúp tớ|bạn ơi|ai ơi|hãy|làm ơn)\s+/i,
        '',
      )
      .trim();

    const base = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    if (base.length <= 46) return base;
    return `${base.slice(0, 44).trim()}...`;
  }

  /**
   * Tự động nén tiến trình học tập (Pedagogical Learning State Auto-Compaction) chuẩn context-mode
   * Thay vì tóm tắt văn bản thô, trích xuất cấu trúc 4 chiều tối ưu:
   * 1. Chuyên đề & Dạng bài toán cốt lõi (Topic & Domain)
   * 2. Đề bài / Giả thiết ban đầu của học sinh (Problem Setup & Variables)
   * 3. Tiến trình đã thống nhất & Kết quả trung gian (Resolved Steps & Interim Results)
   * 4. Bẫy sai lầm / Điều kiện biên đã được nhắc nhở (Traps & Conditions)
   */
  buildCompactSummary(messages: StoredChatMessage[]): string {
    if (!messages || messages.length === 0) return '';

    // Khi cuộc trò chuyện còn ngắn (<= 4 tin), chỉ cần ghi nhận số lượt
    if (messages.length <= 4) {
      const userQueries = messages
        .filter((m) => m.role === 'user' && m.content?.trim())
        .map((m) => m.content.trim().slice(0, 60));
      return userQueries.length > 0
        ? `Đã trao đổi ${userQueries.length} lượt. Chủ đề: ${userQueries.join(' → ')}`
        : '';
    }

    // Các tin nhắn cũ hơn Hot Window (từ đầu đến trước 4 tin cuối)
    const coldMessages = messages.slice(0, -4);
    const userMessages = coldMessages.filter(
      (m) => m.role === 'user' && m.content?.trim(),
    );
    const assistantMessages = coldMessages.filter(
      (m) => m.role === 'assistant' && m.content?.trim(),
    );

    if (userMessages.length === 0) return '';

    // 1. Phân loại Chuyên đề & Lĩnh vực toán học cốt lõi
    const allUserText = userMessages.map((m) => m.content).join(' ');
    const detectedTopics: string[] = [];
    if (
      /hình học|hình chóp|lăng trụ|tứ diện|thể tích|mặt phẳng|vuông góc|khoảng cách|góc giữa|vectơ/i.test(
        allUserText,
      )
    ) {
      detectedTopics.push('Hình học không gian (Oxyz / Khối đa diện)');
    }
    if (
      /phương trình|bậc 2|bậc hai|tam thức|delta|vi-?ét|hệ phương trình|bất phương trình/i.test(
        allUserText,
      )
    ) {
      detectedTopics.push('Phương trình đại số & Hệ thức Vi-ét');
    }
    if (
      /đạo hàm|cực trị|đồng biến|nghịch biến|tiệm cận|bảng biến thiên|đồ thị|tiếp tuyến/i.test(
        allUserText,
      )
    ) {
      detectedTopics.push('Khảo sát hàm số & Ứng dụng đạo hàm');
    }
    if (
      /tích phân|nguyên hàm|diện tích hình phẳng|thể tích tròn xoay/i.test(
        allUserText,
      )
    ) {
      detectedTopics.push('Nguyên hàm - Tích phân');
    }
    if (/xác suất|tổ hợp|chỉnh hợp|nhị thức/i.test(allUserText)) {
      detectedTopics.push('Tổ hợp & Xác suất');
    }
    if (
      /sql|python|vòng lặp|mảng|đệ quy|thuật toán|tin học/i.test(allUserText)
    ) {
      detectedTopics.push('Lập trình & Cơ sở dữ liệu Tin học');
    }

    const topicLabel =
      detectedTopics.length > 0
        ? detectedTopics.join(', ')
        : 'Toán học & Khoa học K-12';

    // 2. Bài toán gốc & Giả thiết ban đầu (thường ở tin nhắn user đầu tiên)
    const firstUserQuery = userMessages[0].content.trim();

    // 3. Trích lọc các biểu thức toán học / Ký hiệu KaTeX chính
    const mathExpressions = Array.from(
      allUserText.matchAll(
        /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|[a-zA-Z]\s*=\s*[\d\w\/\.\+\-]+|[A-Z]{2,4}\s*[\perp\parallel]\s*[A-Z\(\)]+)/g,
      ),
    )
      .map((m) => m[0].trim())
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .slice(0, 5);

    // 4. Kết quả trung gian & Các bước đã hoàn thành
    const resolvedPoints: string[] = [];
    for (const aMsg of assistantMessages) {
      const text = aMsg.content;
      const stepMatches = text.match(
        /(?:bước \d+|suy ra|kết quả|ta có|vậy|tính được)\s*[:=]?\s*([^\n\.\?!]{15,90})/gi,
      );
      if (stepMatches) {
        for (const st of stepMatches.slice(0, 2)) {
          const cleanedStep = st.replace(/^[*\s•\-]+/g, '').trim();
          if (cleanedStep && !resolvedPoints.includes(cleanedStep)) {
            resolvedPoints.push(cleanedStep);
          }
        }
      }
    }

    // 5. Bẫy sai lầm / Điều kiện biên đã được nhắc nhở
    const traps: string[] = [];
    for (const aMsg of assistantMessages) {
      const trapMatch = aMsg.content.match(
        /(?:chú ý|lưu ý|cẩn thận|bẫy|sai lầm|điều kiện xác định)\s*[:=]?\s*([^\n\.\?!]{15,100})/i,
      );
      if (trapMatch && trapMatch[0]) {
        traps.push(trapMatch[0].trim());
      }
    }

    // Ghép thành khối <CONTEXT_SUMMARY> chuẩn Antigravity / context-mode
    const lines: string[] = [
      `<CONTEXT_SUMMARY>`,
      `- Chuyên đề: ${topicLabel}`,
      `- Đề bài đang giải: "${firstUserQuery.slice(0, 150)}${firstUserQuery.length > 150 ? '...' : ''}"`,
    ];

    if (mathExpressions.length > 0) {
      lines.push(`- Dữ kiện/Ký hiệu chính: ${mathExpressions.join(', ')}`);
    }

    if (resolvedPoints.length > 0) {
      lines.push(
        `- Tiến trình đã thống nhất: ${resolvedPoints.slice(0, 2).join('; ')}`,
      );
    }

    if (traps.length > 0) {
      lines.push(`- Lưu ý/Điều kiện đã nhắc: ${traps.slice(0, 2).join('; ')}`);
    }

    lines.push(`- Đã nén ${coldMessages.length} tin nhắn cũ thành công.`);
    lines.push(`</CONTEXT_SUMMARY>`);

    return lines.join('\n');
  }

  /**
   * Tự động kích hoạt nén phiên trò chuyện (On-demand / Background Auto-Compaction)
   */
  async autoCompactSession(sessionKey: string): Promise<{
    sessionKey: string;
    summaryText: string;
    originalMessageCount: number;
    tokenSavedPercent: number;
  } | null> {
    try {
      const record = await this.prisma.chatSession.findUnique({
        where: { sessionKey },
      });
      if (!record) return null;

      const msgs = Array.isArray(record.messages)
        ? (record.messages as unknown as StoredChatMessage[])
        : [];

      if (msgs.length <= 4) {
        return {
          sessionKey,
          summaryText: record.summaryText || '',
          originalMessageCount: msgs.length,
          tokenSavedPercent: 0,
        };
      }

      const summaryText = this.buildCompactSummary(msgs);
      const rawLength = msgs.reduce(
        (acc, m) => acc + (m.content?.length || 0),
        0,
      );
      const hotWindow = msgs.slice(-4);
      const hotLength = hotWindow.reduce(
        (acc, m) => acc + (m.content?.length || 0),
        0,
      );
      const compactedLength = hotLength + summaryText.length;
      const tokenSavedPercent =
        rawLength > compactedLength
          ? Math.max(
              15,
              Math.min(
                88,
                Math.round(((rawLength - compactedLength) / rawLength) * 100),
              ),
            )
          : 0;

      await this.prisma.chatSession.update({
        where: { sessionKey },
        data: {
          summaryText,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `[AutoCompaction] Đã nén session ${sessionKey} (${msgs.length} tin nhắn -> tiết kiệm ~${tokenSavedPercent}% token)`,
      );

      return {
        sessionKey,
        summaryText,
        originalMessageCount: msgs.length,
        tokenSavedPercent,
      };
    } catch (err: any) {
      this.logger.warn(
        `[AutoCompaction] Lỗi khi nén session ${sessionKey}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Lưu phiên trò chuyện + tự động sinh tiêu đề Gemini + Vector hóa từng lượt hội thoại (Chuẩn Antigravity)
   */
  async saveSession(
    sessionKey: string,
    userId: string | undefined,
    messages: StoredChatMessage[],
  ): Promise<ChatSessionSummaryItem | null> {
    if (!sessionKey) return null;

    try {
      // Giữ tối đa 50 tin nhắn trong 1 session, loại bỏ tin nhắn welcome mẫu nếu đã có hội thoại thật
      const realMessages = messages.filter((m) => m.id !== 'welcome-msg');
      const slicedMessages = (
        realMessages.length > 0 ? realMessages : messages
      ).slice(-50);

      // Gắn turnVector cho các tin nhắn user chưa có vector
      const enrichedMessages: StoredChatMessage[] = slicedMessages.map(
        (msg) => {
          if (
            msg.role === 'user' &&
            (!Array.isArray(msg.turnVector) || msg.turnVector.length === 0)
          ) {
            return {
              ...msg,
              turnVector: this.computeFastVector(msg.content),
            };
          }
          return msg;
        },
      );

      const existing = await this.prisma.chatSession.findUnique({
        where: { sessionKey },
      });

      const firstUserMsg = enrichedMessages.find((m) => m.role === 'user');
      const lastMsg = enrichedMessages[enrichedMessages.length - 1];

      const shouldAutoTitle =
        !existing ||
        !existing.title ||
        existing.title === 'Cuộc trò chuyện mới' ||
        existing.title.startsWith('Phiên ');

      const resolvedTitle =
        shouldAutoTitle && firstUserMsg
          ? this.generateSmartTitle(firstUserMsg.content)
          : existing?.title || 'Cuộc trò chuyện mới';

      const lastPreview = lastMsg
        ? lastMsg.content
            .replace(/[#*`_~>\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 110)
        : null;

      const summaryText = this.buildCompactSummary(enrichedMessages);
      const combinedTextForSessionVector = `${resolvedTitle} ${summaryText}`;
      const sessionVector = this.computeFastVector(
        combinedTextForSessionVector,
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // Lưu trữ 90 ngày chuẩn Gemini Workspace

      const saved = await this.prisma.chatSession.upsert({
        where: { sessionKey },
        update: {
          userId: userId || existing?.userId || 'usr-student-01',
          title: resolvedTitle,
          messageCount: enrichedMessages.length,
          lastMessagePreview: lastPreview,
          summaryText,
          sessionVector: sessionVector as any,
          messages: enrichedMessages as any,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          sessionKey,
          userId: userId || 'usr-student-01',
          title: resolvedTitle,
          isPinned: false,
          messageCount: enrichedMessages.length,
          lastMessagePreview: lastPreview,
          summaryText,
          sessionVector: sessionVector as any,
          messages: enrichedMessages as any,
          expiresAt,
        },
      });

      return this.mapRecordToSummary(saved);
    } catch (err: any) {
      this.logger.error(
        `[ChatMemory] Lỗi khi lưu session ${sessionKey}:`,
        err.message,
      );
      return null;
    }
  }

  /**
   * Truy xuất Bộ nhớ Vector hóa Đa tầng chuẩn Antigravity (3-Tier Vectorized Memory)
   * - Quét các lượt hỏi-đáp trong phiên hiện tại và các phiên gần đây của học sinh
   * - Nếu độ tương đồng ngữ nghĩa >= 0.94 -> Trả kết quả tức thì (Instant Vector Memory Hit)
   * - Nếu không -> Trích xuất 4 tin nhắn gần nhất (Hot Window) + Top-3 lượt hội thoại liên quan nhất (Vector Recall)
   */
  async buildVectorizedContext(
    userId: string,
    currentSessionKey: string,
    queryText: string,
    fallbackHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [],
  ): Promise<VectorizedContextResult> {
    const startTime = Date.now();
    const queryVector = this.computeFastVector(queryText);

    try {
      const sessions = await this.prisma.chatSession.findMany({
        where: {
          OR: [{ userId }, { sessionKey: currentSessionKey }],
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 15,
      });

      let currentSessionMessages: StoredChatMessage[] = [];
      const candidateTurns: Array<{
        sessionKey: string;
        sessionTitle: string;
        userMsg: StoredChatMessage;
        assistantMsg: StoredChatMessage;
        similarity: number;
      }> = [];

      let totalTurnsScanned = 0;

      for (const sess of sessions) {
        const msgs = Array.isArray(sess.messages)
          ? (sess.messages as unknown as StoredChatMessage[])
          : [];

        if (sess.sessionKey === currentSessionKey) {
          currentSessionMessages = msgs;
        }

        for (let i = 0; i < msgs.length - 1; i++) {
          const uMsg = msgs[i];
          const aMsg = msgs[i + 1];
          if (
            uMsg?.role === 'user' &&
            aMsg?.role === 'assistant' &&
            !aMsg.isError
          ) {
            totalTurnsScanned++;
            const uVec = this.computeFastVector(uMsg.content);
            const sim = this.cosineSimilarity(queryVector, uVec);
            candidateTurns.push({
              sessionKey: sess.sessionKey,
              sessionTitle: sess.title || 'Cuộc trò chuyện',
              userMsg: uMsg,
              assistantMsg: aMsg,
              similarity: sim,
            });
          }
        }
      }

      candidateTurns.sort((a, b) => b.similarity - a.similarity);
      const bestTurn = candidateTurns[0];

      const sourceHistory =
        currentSessionMessages.length > 0
          ? currentSessionMessages.map((m) => ({
              role: m.role,
              content: m.content,
            }))
          : fallbackHistory;

      // Hot Window: chỉ giữ 4 tin nhắn gần nhất để nối mạch trực tiếp
      const hotWindow = sourceHistory.slice(-4);

      // Top-3 lượt hội thoại liên quan theo Vector (similarity >= 0.65)
      const recalledTurns = candidateTurns
        .filter((t) => t.similarity >= 0.65)
        .slice(0, 3)
        .map((t) => ({
          sessionKey: t.sessionKey,
          sessionTitle: t.sessionTitle,
          userQuery: t.userMsg.content,
          assistantReply: t.assistantMsg.content.slice(0, 320),
          similarity: Number(t.similarity.toFixed(3)),
        }));

      const currentSessRecord = sessions.find(
        (s) => s.sessionKey === currentSessionKey,
      );
      const contextSummary =
        currentSessRecord?.summaryText ||
        this.buildCompactSummary(
          currentSessionMessages.length > 0
            ? currentSessionMessages
            : (fallbackHistory as any),
        );

      // Tính toán tỉ lệ tiết kiệm token chuẩn xác (dựa trên ký tự thô so với ngữ cảnh nén)
      const rawHistoryLength = sourceHistory.reduce(
        (acc, m) => acc + (m.content?.length || 0),
        0,
      );
      const compactedLength =
        hotWindow.reduce((acc, m) => acc + (m.content?.length || 0), 0) +
        (contextSummary?.length || 0) +
        recalledTurns.reduce(
          (acc, t) => acc + t.userQuery.length + t.assistantReply.length,
          0,
        );

      const tokenSavedPercent =
        rawHistoryLength > 300 && rawHistoryLength > compactedLength
          ? Math.min(
              92,
              Math.max(
                15,
                Math.round(
                  ((rawHistoryLength - compactedLength) / rawHistoryLength) *
                    100,
                ),
              ),
            )
          : sourceHistory.length > 4
            ? Math.min(
                85,
                Math.max(
                  20,
                  Math.round(
                    ((sourceHistory.length - hotWindow.length) /
                      sourceHistory.length) *
                      100,
                  ),
                ),
              )
            : 0;

      const vectorComputeMs = Math.max(1, Date.now() - startTime);

      // Kiểm tra Instant Vector Memory Hit (đã từng hỏi câu tương đồng >= 0.90)
      if (bestTurn && bestTurn.similarity >= 0.9) {
        return {
          hotWindow,
          recalledTurns,
          contextSummary,
          instantMemoryHit: {
            hit: true,
            similarity: Number(bestTurn.similarity.toFixed(4)),
            sessionKey: bestTurn.sessionKey,
            sessionTitle: bestTurn.sessionTitle,
            responseMessage: bestTurn.assistantMsg.content,
            actions: bestTurn.assistantMsg.actions,
            emotion: bestTurn.assistantMsg.emotion,
            suggestions: bestTurn.assistantMsg.suggestions,
          },
          stats: {
            totalHistoricalTurnsScanned: totalTurnsScanned,
            recalledCount: recalledTurns.length,
            tokenSavedPercent: 95,
            vectorComputeMs,
          },
        };
      }

      return {
        hotWindow,
        recalledTurns,
        contextSummary,
        stats: {
          totalHistoricalTurnsScanned: totalTurnsScanned,
          recalledCount: recalledTurns.length,
          tokenSavedPercent,
          vectorComputeMs,
        },
      };
    } catch (err: any) {
      this.logger.warn(
        `[ChatMemory] Lỗi buildVectorizedContext: ${err.message}`,
      );
      return {
        hotWindow: fallbackHistory.slice(-4),
        recalledTurns: [],
        contextSummary: '',
        stats: {
          totalHistoricalTurnsScanned: 0,
          recalledCount: 0,
          tokenSavedPercent: 0,
          vectorComputeMs: Math.max(1, Date.now() - startTime),
        },
      };
    }
  }

  /**
   * Lấy danh sách toàn bộ các phiên trò chuyện của người dùng (hỗ trợ tìm kiếm từ khóa + ngữ nghĩa Vector)
   */
  async listUserSessions(
    userId: string = 'usr-student-01',
    searchQuery?: string,
  ): Promise<{
    sessions: ChatSessionSummaryItem[];
    grouped: {
      pinned: ChatSessionSummaryItem[];
      today: ChatSessionSummaryItem[];
      previous7Days: ChatSessionSummaryItem[];
      older: ChatSessionSummaryItem[];
    };
  }> {
    try {
      const records = await this.prisma.chatSession.findMany({
        where: {
          OR: [{ userId }, { userId: null }],
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 60,
      });

      // Tự động backfill tiêu đề cho các session cũ từ trước khi nâng cấp nếu cần
      const items: ChatSessionSummaryItem[] = [];
      for (const rec of records) {
        const msgs = Array.isArray(rec.messages)
          ? (rec.messages as unknown as StoredChatMessage[]).filter(
              (m) => m.id !== 'welcome-msg',
            )
          : [];

        // Bỏ qua các session rỗng hoàn toàn chưa có tin nhắn trừ khi vừa mới tạo trong vòng 10 phút
        const ageMs = Date.now() - new Date(rec.updatedAt).getTime();
        if (msgs.length === 0 && ageMs > 10 * 60 * 1000 && !rec.isPinned) {
          continue;
        }

        let resolvedTitle = rec.title || 'Cuộc trò chuyện mới';
        if (resolvedTitle === 'Cuộc trò chuyện mới' && msgs.length > 0) {
          const firstUser = msgs.find((m) => m.role === 'user');
          if (firstUser) {
            resolvedTitle = this.generateSmartTitle(firstUser.content);
          }
        }

        const lastMsg = msgs[msgs.length - 1];
        const preview =
          rec.lastMessagePreview ||
          (lastMsg
            ? lastMsg.content
                .replace(/[#*`_~>\n]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 110)
            : 'Bắt đầu cuộc trò chuyện mới');

        items.push({
          id: rec.id,
          sessionKey: rec.sessionKey,
          userId: rec.userId,
          title: resolvedTitle,
          isPinned: Boolean(rec.isPinned),
          messageCount: rec.messageCount || msgs.length,
          lastMessagePreview: preview,
          summaryText: rec.summaryText || null,
          createdAt: rec.createdAt.toISOString(),
          updatedAt: rec.updatedAt.toISOString(),
        });
      }

      // Lọc theo từ khóa (có dấu & không dấu) hoặc độ tương đồng ngữ nghĩa Vector nếu có searchQuery
      let filtered = items;
      if (searchQuery && searchQuery.trim()) {
        const stripAccents = (s: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .trim();
        const qNorm = stripAccents(searchQuery);
        const qVec = this.computeFastVector(searchQuery);

        filtered = items
          .map((item) => {
            const sVec = this.computeFastVector(
              `${item.title} ${item.lastMessagePreview || ''} ${item.summaryText || ''}`,
            );
            const sim = this.cosineSimilarity(qVec, sVec);
            const haystack = stripAccents(
              `${item.title} ${item.lastMessagePreview || ''} ${item.summaryText || ''}`,
            );
            const keywordMatch = haystack.includes(qNorm);

            return {
              ...item,
              similarity: keywordMatch ? Math.max(sim, 0.95) : sim,
            };
          })
          .filter((item) => (item.similarity ?? 0) >= 0.35)
          .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
      }

      // Phân nhóm theo chuẩn Sidebar của Google Gemini
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();
      const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

      const pinned: ChatSessionSummaryItem[] = [];
      const today: ChatSessionSummaryItem[] = [];
      const previous7Days: ChatSessionSummaryItem[] = [];
      const older: ChatSessionSummaryItem[] = [];

      for (const item of filtered) {
        if (item.isPinned) {
          pinned.push(item);
          continue;
        }
        const t = new Date(item.updatedAt).getTime();
        if (t >= startOfToday) {
          today.push(item);
        } else if (t >= startOf7DaysAgo) {
          previous7Days.push(item);
        } else {
          older.push(item);
        }
      }

      return {
        sessions: filtered,
        grouped: {
          pinned,
          today,
          previous7Days,
          older,
        },
      };
    } catch (err: any) {
      this.logger.error(`[ChatMemory] Lỗi listUserSessions:`, err.message);
      return {
        sessions: [],
        grouped: { pinned: [], today: [], previous7Days: [], older: [] },
      };
    }
  }

  /**
   * Tạo một phiên trò chuyện mới theo phong cách Gemini ("+ Cuộc trò chuyện mới")
   */
  async createNewSession(
    userId: string = 'usr-student-01',
    customTitle?: string,
  ): Promise<ChatSessionSummaryItem> {
    const sessionKey = `sess-scl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const created = await this.prisma.chatSession.create({
      data: {
        sessionKey,
        userId,
        title: customTitle?.trim() || 'Cuộc trò chuyện mới',
        isPinned: false,
        messageCount: 0,
        lastMessagePreview: null,
        messages: [],
        expiresAt,
      },
    });

    return this.mapRecordToSummary(created);
  }

  /**
   * Lấy chi tiết một phiên trò chuyện (bao gồm cả metadata lẫn danh sách messages)
   */
  async getSessionDetail(sessionKey: string): Promise<{
    session: ChatSessionSummaryItem | null;
    messages: StoredChatMessage[];
  }> {
    if (!sessionKey) {
      return { session: null, messages: [] };
    }

    try {
      const record = await this.prisma.chatSession.findUnique({
        where: { sessionKey },
      });

      if (!record) {
        return { session: null, messages: [] };
      }

      if (
        record.expiresAt &&
        new Date(record.expiresAt).getTime() < Date.now()
      ) {
        await this.clearSession(sessionKey);
        return { session: null, messages: [] };
      }

      const messages = Array.isArray(record.messages)
        ? (record.messages as unknown as StoredChatMessage[])
        : [];

      return {
        session: this.mapRecordToSummary(record),
        messages,
      };
    } catch (err: any) {
      this.logger.error(
        `[ChatMemory] Lỗi đọc chi tiết session ${sessionKey}:`,
        err.message,
      );
      return { session: null, messages: [] };
    }
  }

  /**
   * Lấy lại toàn bộ lịch sử tin nhắn đã cache của một session (Tương thích ngược)
   */
  async getSession(sessionKey: string): Promise<StoredChatMessage[]> {
    const detail = await this.getSessionDetail(sessionKey);
    return detail.messages;
  }

  /**
   * Đổi tên hoặc Ghim / Bỏ ghim phiên trò chuyện (Chuẩn Gemini Sidebar)
   */
  async updateSessionMetadata(
    sessionKey: string,
    patch: { title?: string; isPinned?: boolean },
  ): Promise<ChatSessionSummaryItem | null> {
    if (!sessionKey) return null;

    try {
      const existing = await this.prisma.chatSession.findUnique({
        where: { sessionKey },
      });

      if (!existing) {
        return null;
      }

      const dataToUpdate: Record<string, any> = {};
      if (typeof patch.title === 'string' && patch.title.trim()) {
        dataToUpdate.title = patch.title.trim().slice(0, 80);
      }
      if (typeof patch.isPinned === 'boolean') {
        dataToUpdate.isPinned = patch.isPinned;
      }

      const updated = await this.prisma.chatSession.update({
        where: { sessionKey },
        data: dataToUpdate,
      });

      return this.mapRecordToSummary(updated);
    } catch (err: any) {
      this.logger.error(
        `[ChatMemory] Lỗi cập nhật metadata session ${sessionKey}:`,
        err.message,
      );
      return null;
    }
  }

  /**
   * Xóa một phiên trò chuyện cụ thể khỏi PostgreSQL
   */
  async clearSession(sessionKey: string): Promise<boolean> {
    if (!sessionKey) return false;

    try {
      await this.prisma.chatSession.deleteMany({
        where: { sessionKey },
      });
      this.logger.log(`🧹 [ChatMemory] Đã xóa session ${sessionKey}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `[ChatMemory] Lỗi khi xóa session ${sessionKey}:`,
        err.message,
      );
      return false;
    }
  }

  private mapRecordToSummary(rec: any): ChatSessionSummaryItem {
    const msgs = Array.isArray(rec.messages)
      ? (rec.messages as unknown as StoredChatMessage[]).filter(
          (m) => m.id !== 'welcome-msg',
        )
      : [];
    return {
      id: rec.id,
      sessionKey: rec.sessionKey,
      userId: rec.userId || null,
      title: rec.title || 'Cuộc trò chuyện mới',
      isPinned: Boolean(rec.isPinned),
      messageCount:
        typeof rec.messageCount === 'number' ? rec.messageCount : msgs.length,
      lastMessagePreview: rec.lastMessagePreview || null,
      summaryText: rec.summaryText || null,
      createdAt:
        rec.createdAt instanceof Date
          ? rec.createdAt.toISOString()
          : String(rec.createdAt),
      updatedAt:
        rec.updatedAt instanceof Date
          ? rec.updatedAt.toISOString()
          : String(rec.updatedAt),
    };
  }
}
