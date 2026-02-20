/**
 * INPUT: userId
 * OUTPUT: 一次性 token（字串），供 LIFF 頁面識別使用者 Session
 * POS: 設定模組，一次性 token 儲存，15 分鐘過期
 */

import { randomBytes } from 'crypto';

interface TokenEntry {
  userId: string;
  expiresAt: number;
  used: boolean;
}

/** Token 存活時間（15 分鐘） */
const TOKEN_TTL_MS = 15 * 60 * 1000;

/** 記憶體 token 儲存 */
const tokenStore = new Map<string, TokenEntry>();

/** 產生新 token 並綁定 userId */
export function createSessionToken(userId: string): string {
  const token = randomBytes(24).toString('hex');
  tokenStore.set(token, {
    userId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    used: false,
  });
  return token;
}

/** 驗證 token 並取得 userId（不消耗 token） */
export function validateToken(token: string): string | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  return entry.userId;
}

/** 消耗 token（一次性使用後標記） */
export function consumeToken(token: string): string | null {
  const userId = validateToken(token);
  if (!userId) return null;
  tokenStore.delete(token);
  return userId;
}

/** 清理過期 token */
function cleanExpiredTokens(): void {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (now > entry.expiresAt) tokenStore.delete(token);
  }
}

// 每 5 分鐘清理一次
setInterval(cleanExpiredTokens, 5 * 60 * 1000);
