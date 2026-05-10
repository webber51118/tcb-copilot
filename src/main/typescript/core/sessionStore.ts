/**
 * INPUT: UserSession（使用者對話狀態）
 * OUTPUT: get/set/delete Session 操作
 * POS: 核心模組，JSON 持久化 Session 儲存，管理所有使用者的對話狀態
 *
 * 持久化策略：
 *   - 啟動時從 data/sessions.json 載入
 *   - updateSession / resetSession 觸發 debounce 寫入（2 秒批次）
 *   - 寫入失敗靜默記錄，不影響主流程
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConversationState } from '../models/enums';
import { UserSession } from '../models/types';

/** Session 存活時間（30 分鐘） */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** 持久化檔案路徑 */
const SESSION_FILE = path.resolve(process.cwd(), 'data', 'sessions.json');

/** 記憶體 Session 儲存 */
const sessions = new Map<string, UserSession>();

// ─── 持久化：啟動載入 ─────────────────────────────────────────────
(function loadFromDisk() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
      const obj = JSON.parse(raw) as Record<string, UserSession>;
      const now = Date.now();
      for (const [userId, session] of Object.entries(obj)) {
        if (now - session.updatedAt <= SESSION_TTL_MS) {
          sessions.set(userId, session);
        }
      }
      console.log(`[sessionStore] 載入 ${sessions.size} 筆有效 Session`);
    }
  } catch (err) {
    console.error('[sessionStore] 載入失敗，以空白狀態啟動：', err);
  }
})();

// ─── 持久化：debounce 寫入 ────────────────────────────────────────
let _writeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    const obj: Record<string, UserSession> = {};
    for (const [userId, session] of sessions) {
      obj[userId] = session;
    }
    fs.writeFile(SESSION_FILE, JSON.stringify(obj, null, 2), 'utf-8', (err) => {
      if (err) console.error('[sessionStore] 寫入失敗：', err);
    });
  }, 2_000);
}

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
    applicationId: null,
    chatHistory: [],
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
  scheduleSave();
}

/** 重置使用者 Session（對話結束時呼叫） */
export function resetSession(userId: string): void {
  sessions.set(userId, createEmptySession(userId));
  scheduleSave();
}

/** 清除過期 Session（定期呼叫） */
export function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  }
  scheduleSave();
}

// 每 10 分鐘清理一次過期 Session
setInterval(cleanExpiredSessions, 10 * 60 * 1000);
