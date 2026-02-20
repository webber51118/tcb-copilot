/**
 * INPUT: UserSession（使用者對話狀態）
 * OUTPUT: get/set/delete Session 操作
 * POS: 核心模組，記憶體式 Session 儲存，管理所有使用者的對話狀態
 */

import { ConversationState } from '../models/enums';
import { UserSession } from '../models/types';

/** Session 存活時間（30 分鐘） */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** 記憶體 Session 儲存 */
const sessions = new Map<string, UserSession>();

/** 建立新的空白 Session */
function createEmptySession(userId: string): UserSession {
  const now = Date.now();
  return {
    userId,
    state: ConversationState.IDLE,
    loanType: null,
    basicInfo: {
      age: null,
      occupation: null,
      income: null,
      purpose: null,
      termYears: null,
      amount: null,
    },
    propertyInfo: {
      propertyAge: null,
      areaPing: null,
      hasParking: null,
      layout: null,
      floor: null,
      buildingType: null,
    },
    applicantName: null,
    applicantPhone: null,
    recommendedProductId: null,
    mydataReady: null,
    landRegistryReady: null,
    idNumber: null,
    employer: null,
    annualIncome: null,
    parsedFromDoc: false,
    docReviewConfirmed: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** 取得使用者 Session，不存在或已過期則建立新的 */
export function getSession(userId: string): UserSession {
  const session = sessions.get(userId);

  if (!session || Date.now() - session.updatedAt > SESSION_TTL_MS) {
    const newSession = createEmptySession(userId);
    sessions.set(userId, newSession);
    return newSession;
  }

  return session;
}

/** 更新使用者 Session */
export function updateSession(session: UserSession): void {
  session.updatedAt = Date.now();
  sessions.set(session.userId, session);
}

/** 重置使用者 Session（對話結束時呼叫） */
export function resetSession(userId: string): void {
  sessions.set(userId, createEmptySession(userId));
}

/** 清除過期 Session（定期呼叫） */
export function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  }
}

// 每 10 分鐘清理一次過期 Session
setInterval(cleanExpiredSessions, 10 * 60 * 1000);
