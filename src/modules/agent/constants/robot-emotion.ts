export const ROBOT_EMOTIONS = [
  'default',
  'happy',
  'excited',
  'wink',
  'thinking',
  'idea',
  'love',
  'celebrate',
  'sad',
  'angry',
  'sleeping',
  'surprised',
  'stunned',
] as const;

export type RobotEmotion = (typeof ROBOT_EMOTIONS)[number];

export const isRobotEmotion = (v: unknown): v is RobotEmotion =>
  typeof v === 'string' && (ROBOT_EMOTIONS as readonly string[]).includes(v);

/** Thời gian giữ biểu cảm hợp lệ (ms): 1s – 15s, mặc định 4s */
export function clampEmotionDuration(value: unknown, fallback = 4000): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(15000, Math.max(1000, Math.round(n)));
}

/** Fallback khi LLM không trả emotion */
export function inferEmotion(message: string, actions: any[] = []): RobotEmotion {
  const t = message.toLowerCase();
  if (actions.some((a) => a?.type === 'SOCRATIC_HINT')) return 'thinking';
  if (actions.some((a) => a?.type === 'SELECT_PRICING_PLAN') || /bảng giá|gói cước|gói pro|gói vip|học phí/.test(t)) {
    return 'wink';
  }
  if (/chúc mừng|xuất sắc|tuyệt vời|🎉|🏆/.test(t)) return 'celebrate';
  if (/xin lỗi|rất tiếc|không thể|lỗi|không đủ/.test(t)) return 'sad';
  if (/cảm ơn|❤️|thương/.test(t)) return 'love';
  if (/schoolify|chào mừng|khám phá|kỷ nguyên/.test(t)) return 'excited';
  if (actions.length) return 'idea';
  return 'happy';
}
