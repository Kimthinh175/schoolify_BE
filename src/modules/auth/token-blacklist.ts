const revokedTokens = new Map<string, number>();

/**
 * Đưa JWT vào danh sách thu hồi sau khi người dùng đăng xuất (tự dọn khi hết hạn).
 */
export function revokeToken(token: string, expSeconds?: number): void {
  if (!token) return;
  const now = Date.now();
  for (const [k, expiresAt] of revokedTokens.entries()) {
    if (expiresAt <= now) {
      revokedTokens.delete(k);
    }
  }
  const expiresAtMs =
    typeof expSeconds === 'number' && expSeconds > 0
      ? expSeconds * 1000
      : now + 7 * 24 * 60 * 60 * 1000;
  revokedTokens.set(token.trim(), expiresAtMs);
}

/**
 * Kiểm tra JWT đã bị thu hồi (đăng xuất) hay chưa.
 */
export function isTokenRevoked(token?: string | null): boolean {
  if (!token) return false;
  const trimmed = token.trim();
  const expiresAt = revokedTokens.get(trimmed);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    revokedTokens.delete(trimmed);
    return false;
  }
  return true;
}

/**
 * Trích xuất access_token từ Authorization Bearer header hoặc HTTP-only cookie.
 */
export function extractTokenFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}): string | null {
  const rawAuth = req?.headers?.authorization ?? req?.headers?.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
    return authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();
  }
  if (req?.cookies?.access_token) {
    return String(req.cookies.access_token).trim();
  }
  return null;
}
