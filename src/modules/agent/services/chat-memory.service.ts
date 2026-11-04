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
}

@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lưu phiên trò chuyện và quản lý Sliding Window 40 tin nhắn gần nhất (Chuẩn cho-cong-nghe)
   * Thời hạn lưu trữ: 7 ngày (expiresAt)
   */
  async saveSession(
    sessionKey: string,
    userId: string | undefined,
    messages: StoredChatMessage[],
  ): Promise<void> {
    if (!sessionKey) return;

    try {
      // Giữ tối đa 40 câu chat gần nhất (sliding window)
      const slicedMessages = messages.slice(-40);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Giữ 7 ngày

      await this.prisma.chatSession.upsert({
        where: { sessionKey },
        update: {
          userId: userId || null,
          messages: slicedMessages as any,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          sessionKey,
          userId: userId || null,
          messages: slicedMessages as any,
          expiresAt,
        },
      });

      this.logger.debug(
        `💾 [ChatMemory] Đã lưu session ${sessionKey} (${slicedMessages.length} tin nhắn) cho user ${userId || 'guest'}`,
      );
    } catch (err: any) {
      this.logger.error(`[ChatMemory] Lỗi khi lưu session ${sessionKey}:`, err.message);
    }
  }

  /**
   * Lấy lại toàn bộ lịch sử tin nhắn đã cache của một session (Khôi phục khi tải lại trang / F5)
   */
  async getSession(sessionKey: string): Promise<StoredChatMessage[]> {
    if (!sessionKey) return [];

    try {
      const record = await this.prisma.chatSession.findUnique({
        where: { sessionKey },
      });

      if (!record || !record.messages) {
        return [];
      }

      // Kiểm tra nếu session đã hết hạn
      if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
        await this.clearSession(sessionKey);
        return [];
      }

      return Array.isArray(record.messages)
        ? (record.messages as unknown as StoredChatMessage[])
        : [];
    } catch (err: any) {
      this.logger.error(`[ChatMemory] Lỗi khi đọc session ${sessionKey}:`, err.message);
      return [];
    }
  }

  /**
   * Xóa phiên trò chuyện để bắt đầu cuộc trò chuyện mới
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
      this.logger.warn(`[ChatMemory] Lỗi khi xóa session ${sessionKey}:`, err.message);
      return false;
    }
  }
}
