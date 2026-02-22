/**
 * INPUT: RagQueryRequest（問題 + 選填貸款類型）
 * OUTPUT: RagQueryResponse（Claude 合成答案 + 來源 + 信心度 + 快取狀態）
 * POS: 服務層，實作三層知識庫檢索 + Claude claude-sonnet-4-6 合成 + 熱快取
 */

import Anthropic from '@anthropic-ai/sdk';
import { ALL_KB_CHUNKS } from '../data/knowledgeBaseData';
import {
  KbChunk,
  KbSource,
  RagQueryRequest,
  RagQueryResponse,
  ScoredChunk,
  CacheEntry,
} from '../models/rag';

// ─── 常數設定 ──────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 分鐘 TTL
const TOP_K = 5;                      // 取前 5 段落
const HIGH_SCORE_THRESHOLD = 10;      // 高信心度門檻
const MED_SCORE_THRESHOLD = 5;        // 中信心度門檻
const MODEL = 'claude-sonnet-4-6';    // 合成模型

// ─── 金融詞彙字典（用於優先匹配） ─────────────────────────────

const FINANCE_TERMS: string[] = [
  '寬限期', '貸款成數', 'DBR', '青安', '青年安心成家',
  '第1戶', '第一戶', '第2戶', '第二戶', '第3戶', '第三戶',
  '高價住宅', '公司法人', '餘屋貸款', '繼承', '換屋',
  '定存質借', '國軍輔導', '農家樂', '加盟主', '員工認股',
  '無擔保債務', '月收入', '月付款', '負債比', '保證人',
  '授信流程', '5P', '徵信', '撥貸', '對保', '抵押',
  '首購', '自住', '自有住宅', '政策性貸款', '補貼',
  '郵政定儲', '機動利率', '固定利率', '一段式', '二段式',
  '混合式', '22倍', '18倍', '85歲', 'A區', 'B區',
  '18000', '18,000', '基本生活費', '鑑價', '抵押貸款',
  '授信規章', '央行規定', '房屋擔保', '無擔保貸款',
];

// ─── 熱快取（Map，key = 問題 + loanType） ─────────────────────

const queryCache = new Map<string, CacheEntry>();

function buildCacheKey(req: RagQueryRequest): string {
  return `${req.question.trim()}__${req.loanType ?? 'any'}`;
}

function getFromCache(key: string): RagQueryResponse | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  return { ...entry.response, cached: true };
}

function setCache(key: string, response: RagQueryResponse): void {
  queryCache.set(key, {
    response: { ...response, cached: false },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ─── 關鍵詞提取（金融詞彙字典 + 2-4 字滑窗） ──────────────────

export function extractKeywords(text: string): string[] {
  const found = new Set<string>();

  // 1. 先從金融詞彙字典匹配（最優先）
  for (const term of FINANCE_TERMS) {
    if (text.includes(term)) {
      found.add(term);
    }
  }

  // 2. 補充 2-4 字中文滑窗（過濾純英文/數字/標點）
  const chineseOnly = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbfA-Za-z0-9%]/g, ' ');
  const tokens = chineseOnly.split(/\s+/).filter((t) => t.length > 0);

  for (const token of tokens) {
    // 中文字元 2-4 字的 n-gram
    if (/[\u4e00-\u9fff]/.test(token)) {
      for (let len = 2; len <= 4; len++) {
        for (let i = 0; i <= token.length - len; i++) {
          found.add(token.slice(i, i + len));
        }
      }
    } else {
      // 英文/數字詞彙直接加入（如 DBR、22倍等）
      if (token.length >= 2) found.add(token);
    }
  }

  return Array.from(found);
}

// ─── 段落評分與檢索（priority 加權） ──────────────────────────

export function retrieveTopChunks(keywords: string[], loanType?: string): ScoredChunk[] {
  const scored: ScoredChunk[] = [];

  for (const chunk of ALL_KB_CHUNKS) {
    // loanType 過濾：若段落有指定適用類型，且與查詢類型不符則跳過
    if (loanType && chunk.loanTypes && chunk.loanTypes.length > 0) {
      if (!chunk.loanTypes.includes(loanType as 'mortgage' | 'personal')) {
        continue;
      }
    }

    // 計算命中關鍵詞數量
    let matchCount = 0;
    for (const kw of keywords) {
      // 在段落關鍵詞列表和段落內容中匹配
      if (chunk.keywords.some((ck) => ck.includes(kw) || kw.includes(ck))) {
        matchCount++;
      } else if (chunk.content.includes(kw)) {
        matchCount += 0.5; // 內容命中給半分
      }
    }

    if (matchCount > 0) {
      scored.push({
        chunk,
        score: matchCount * chunk.priority, // priority 加權
      });
    }
  }

  // 依分數降序，取前 TOP_K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TOP_K);
}

// ─── 信心度判斷 ────────────────────────────────────────────────

function calcConfidence(chunks: ScoredChunk[]): 'high' | 'medium' | 'low' {
  const totalScore = chunks.reduce((sum, c) => sum + c.score, 0);
  if (totalScore >= HIGH_SCORE_THRESHOLD) return 'high';
  if (totalScore >= MED_SCORE_THRESHOLD) return 'medium';
  return 'low';
}

// ─── 去重來源清單 ───────────────────────────────────────────────

function deduplicateSources(chunks: ScoredChunk[]): KbSource[] {
  const seen = new Set<KbSource>();
  for (const { chunk } of chunks) {
    seen.add(chunk.source);
  }
  // 依 priority 排序（高優先度在前）
  const order: KbSource[] = ['央行規定', '政策性貸款', '授信規章'];
  return order.filter((s) => seen.has(s));
}

// ─── Claude 合成答案 ───────────────────────────────────────────

async function synthesizeAnswer(
  question: string,
  chunks: ScoredChunk[],
  loanType?: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const contextText = chunks
    .map(({ chunk }, idx) => `【參考資料 ${idx + 1}】${chunk.source} — ${chunk.topic}\n${chunk.content}`)
    .join('\n\n');

  const loanTypeHint = loanType === 'mortgage' ? '（此問題涉及房屋貸款）'
    : loanType === 'personal' ? '（此問題涉及個人信用貸款）'
    : '';

  const systemPrompt = `你是台灣彰化銀行（TCB）個人金融部門的授信法規顧問。
請依據以下法規參考資料，以繁體中文、台灣金融業專業用語，精確回答行員的授信法規問題。
回答規則：
1. 優先引用「央行規定」，其次「政策性貸款」，最後「授信規章」
2. 引用具體數字（成數、利率、期限、倍數等）時必須精確
3. 如有例外情形（如繼承、換屋協處）需一併說明
4. 若參考資料不足，誠實告知，不得捏造規定
5. 回答格式：先結論，再細節，最後注意事項`;

  const userPrompt = `${loanTypeHint}
問題：${question}

參考法規資料：
${contextText}

請根據以上參考資料回答，並在回答末尾標註主要依據來源（如：依據央行規定Q3/Q4）。`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Claude 回應格式異常（非文字）');
  }
  return content.text;
}

// ─── 主服務函式 ────────────────────────────────────────────────

export async function ragQuery(req: RagQueryRequest): Promise<RagQueryResponse> {
  const cacheKey = buildCacheKey(req);

  // 1. 快取命中
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[ragService] 快取命中：${cacheKey.slice(0, 30)}...`);
    return cached;
  }

  // 2. 關鍵詞提取
  const keywords = extractKeywords(req.question);
  console.log(`[ragService] 提取關鍵詞 ${keywords.length} 個：${keywords.slice(0, 8).join('、')}`);

  // 3. 三層知識庫檢索
  const topChunks = retrieveTopChunks(keywords, req.loanType);
  console.log(`[ragService] 命中 ${topChunks.length} 段落，最高分：${topChunks[0]?.score ?? 0}`);

  // 4. 若無任何命中，回傳低信心度答案
  if (topChunks.length === 0) {
    const fallback: RagQueryResponse = {
      success: true,
      answer: '很抱歉，目前知識庫中未找到與您問題相關的法規資料。建議洽詢授信主管或查閱最新法規公告。',
      sources: [],
      confidence: 'low',
      cached: false,
    };
    setCache(cacheKey, fallback);
    return fallback;
  }

  // 5. Claude 合成答案
  const answer = await synthesizeAnswer(req.question, topChunks, req.loanType);

  // 6. 組裝回應
  const response: RagQueryResponse = {
    success: true,
    answer,
    sources: deduplicateSources(topChunks),
    confidence: calcConfidence(topChunks),
    cached: false,
  };

  // 7. 寫入快取
  setCache(cacheKey, response);

  return response;
}
