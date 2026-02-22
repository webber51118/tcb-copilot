/**
 * INPUT: 無（純型別定義）
 * OUTPUT: RAG 問答系統所需的所有 TypeScript 型別
 * POS: 型別層，供 ragService / ragQuery 共用
 */

// ─── 知識庫段落 ────────────────────────────────────────────────

export type KbSource = '央行規定' | '政策性貸款' | '授信規章';
export type KbPriority = 1 | 2 | 3; // 1=一般, 2=中, 3=最高

export interface KbChunk {
  id: string;              // 唯一識別碼，例 "kb1-001"
  source: KbSource;        // 來源標籤
  priority: KbPriority;   // 權重（用於評分）
  topic: string;           // 主題關鍵詞（如「第2戶成數」）
  keywords: string[];      // 命中關鍵詞列表（用於檢索）
  content: string;         // 段落全文（提供給 Claude 合成）
  loanTypes?: ('mortgage' | 'personal')[];  // 適用貸款類型（不填表示通用）
}

// ─── API Request / Response ─────────────────────────────────────

export interface RagQueryRequest {
  question: string;                           // 問題（必填，最多 500 字）
  loanType?: 'mortgage' | 'personal';         // 選填，縮小檢索範圍
}

export interface RagQueryResponse {
  success: true;
  answer: string;                             // Claude 合成的繁體中文答案
  sources: KbSource[];                        // 來源清單
  confidence: 'high' | 'medium' | 'low';     // 依命中分數判斷
  cached: boolean;                            // 是否命中熱快取
}

export interface RagQueryErrorResponse {
  success: false;
  message: string;
}

// ─── 內部檢索結果 ───────────────────────────────────────────────

export interface ScoredChunk {
  chunk: KbChunk;
  score: number;  // matchCount × priority
}

// ─── 快取條目 ──────────────────────────────────────────────────

export interface CacheEntry {
  response: RagQueryResponse;
  expiresAt: number;  // Date.now() + TTL
}
