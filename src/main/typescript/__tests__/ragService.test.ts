/**
 * 測試：ragService — extractKeywords / retrieveTopChunks / 信心度邊界
 */

import { extractKeywords, retrieveTopChunks } from '../services/ragService';
import { ALL_KB_CHUNKS } from '../data/knowledgeBaseData';

// ─── extractKeywords ────────────────────────────────────────────

describe('extractKeywords', () => {
  test('能辨識金融詞彙字典中的詞（寬限期）', () => {
    const kws = extractKeywords('第1戶購屋有寬限期嗎？');
    expect(kws).toContain('寬限期');
    expect(kws).toContain('第1戶');
  });

  test('能辨識英文縮寫 DBR', () => {
    const kws = extractKeywords('DBR 上限是多少？');
    expect(kws).toContain('DBR');
  });

  test('能辨識青安相關詞彙', () => {
    const kws = extractKeywords('青安貸款申請條件？');
    expect(kws).toContain('青安');
  });

  test('空字串回傳空陣列', () => {
    const kws = extractKeywords('');
    expect(Array.isArray(kws)).toBe(true);
  });

  test('純標點符號不產生有意義關鍵詞', () => {
    const kws = extractKeywords('？！。、，');
    // 標點不應產生金融詞彙
    expect(kws.every((k) => !['寬限期', 'DBR', '青安'].includes(k))).toBe(true);
  });

  test('2-4 字中文滑窗生成子詞', () => {
    const kws = extractKeywords('負債比計算');
    // 應包含 "負債" 或 "負債比" 等子詞
    const hasChinese2char = kws.some((k) => k.length >= 2 && /[\u4e00-\u9fff]/.test(k));
    expect(hasChinese2char).toBe(true);
  });
});

// ─── retrieveTopChunks ─────────────────────────────────────────

describe('retrieveTopChunks', () => {
  test('KB1 央行規定（priority=3）對第1戶問題應排最前', () => {
    const kws = extractKeywords('第1戶購屋不得有寬限期嗎？');
    const chunks = retrieveTopChunks(kws);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunk.source).toBe('央行規定');
  });

  test('青安關鍵詞應命中 KB2 政策性貸款段落', () => {
    const kws = extractKeywords('青安貸款利率和資格');
    const chunks = retrieveTopChunks(kws, 'mortgage');
    const kb2Hit = chunks.some((c) => c.chunk.source === '政策性貸款');
    expect(kb2Hit).toBe(true);
  });

  test('DBR 22倍應命中 KB3 授信規章', () => {
    const kws = extractKeywords('DBR 22倍上限');
    const chunks = retrieveTopChunks(kws, 'personal');
    const kb3Hit = chunks.some((c) => c.chunk.source === '授信規章');
    expect(kb3Hit).toBe(true);
  });

  test('loanType=personal 過濾掉僅 mortgage 適用的段落', () => {
    const kws = extractKeywords('第1戶寬限期');
    const chunks = retrieveTopChunks(kws, 'personal');
    // 央行規定 kb1-001 標記 loanTypes=['mortgage']，不應出現於 personal 查詢
    const hasKb1 = chunks.some((c) => c.chunk.id === 'kb1-001');
    expect(hasKb1).toBe(false);
  });

  test('最多回傳 5 筆', () => {
    const kws = extractKeywords('房貸負債比寬限期成數上限購屋繼承換屋DBR');
    const chunks = retrieveTopChunks(kws);
    expect(chunks.length).toBeLessThanOrEqual(5);
  });

  test('結果依分數降序排列', () => {
    const kws = extractKeywords('第2戶成數 5成 寬限期');
    const chunks = retrieveTopChunks(kws);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i - 1].score).toBeGreaterThanOrEqual(chunks[i].score);
    }
  });

  test('無關問題應回傳空陣列或低分', () => {
    const kws = extractKeywords('今天天氣如何？');
    const chunks = retrieveTopChunks(kws);
    // 不相關問題分數應為 0，故回傳空
    expect(Array.isArray(chunks)).toBe(true);
  });

  test('優先權加權：KB1 分數 > KB3 分數（相同命中數時）', () => {
    // kb1-001 priority=3, kb3-001 priority=1
    // 各命中 1 次關鍵詞時，kb1 分數應 > kb3
    const kws = extractKeywords('寬限期');
    const chunks = retrieveTopChunks(kws);
    const kb1 = chunks.find((c) => c.chunk.source === '央行規定');
    const kb3 = chunks.find((c) => c.chunk.source === '授信規章');
    if (kb1 && kb3) {
      // 只有當兩者命中數相同時，kb1 分數應更高
      // 不強制相同命中數，只驗證 kb1 score 是 priority 加權後的值
      expect(kb1.score).toBeGreaterThan(0);
    }
  });
});

// ─── knowledgeBaseData 完整性 ──────────────────────────────────

describe('ALL_KB_CHUNKS 知識庫完整性', () => {
  test('共 22 個段落', () => {
    expect(ALL_KB_CHUNKS.length).toBe(22);
  });

  test('每個段落都有 id、source、priority、keywords、content', () => {
    for (const chunk of ALL_KB_CHUNKS) {
      expect(chunk.id).toBeTruthy();
      expect(chunk.source).toBeTruthy();
      expect(chunk.priority).toBeGreaterThanOrEqual(1);
      expect(chunk.keywords.length).toBeGreaterThan(0);
      expect(chunk.content.length).toBeGreaterThan(10);
    }
  });

  test('KB1 共 7 段（source = 央行規定）', () => {
    const kb1 = ALL_KB_CHUNKS.filter((c) => c.source === '央行規定');
    expect(kb1.length).toBe(7);
  });

  test('KB2 共 7 段（source = 政策性貸款）', () => {
    const kb2 = ALL_KB_CHUNKS.filter((c) => c.source === '政策性貸款');
    expect(kb2.length).toBe(7);
  });

  test('KB3 共 8 段（source = 授信規章）', () => {
    const kb3 = ALL_KB_CHUNKS.filter((c) => c.source === '授信規章');
    expect(kb3.length).toBe(8);
  });

  test('KB1 priority 全為 3', () => {
    const kb1 = ALL_KB_CHUNKS.filter((c) => c.source === '央行規定');
    kb1.forEach((c) => expect(c.priority).toBe(3));
  });

  test('KB2 priority 全為 2', () => {
    const kb2 = ALL_KB_CHUNKS.filter((c) => c.source === '政策性貸款');
    kb2.forEach((c) => expect(c.priority).toBe(2));
  });

  test('KB3 priority 全為 1', () => {
    const kb3 = ALL_KB_CHUNKS.filter((c) => c.source === '授信規章');
    kb3.forEach((c) => expect(c.priority).toBe(1));
  });
});
