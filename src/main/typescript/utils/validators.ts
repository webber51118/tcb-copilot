/**
 * INPUT: 使用者輸入的文字
 * OUTPUT: 驗證結果（合法值或 null）
 * POS: 工具模組，驗證各對話階段的使用者輸入
 */

import { LoanType, OccupationType, BuildingType } from '../models/enums';

/** 全形數字轉半形（０-９ → 0-9，．→ .） */
function normalizeFullWidth(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  ).replace(/．/g, '.');
}

/** 解析金額字串，支援「萬」單位（如 1.5萬 → 15000）與全形數字 */
function parseMoneyText(text: string): number | null {
  const cleaned = normalizeFullWidth(text).trim().replace(/,/g, '').replace(/元/g, '');

  if (cleaned.includes('萬')) {
    const numPart = cleaned.replace(/萬/g, '');
    const n = parseFloat(numPart);
    if (isNaN(n)) return null;
    return Math.round(n * 10000);
  }

  const n = parseInt(cleaned, 10);
  if (isNaN(n)) return null;
  return n;
}

/** 解析整數字串，支援全形數字 */
function parseIntNormalized(text: string): number {
  return parseInt(normalizeFullWidth(text).trim(), 10);
}

/** 解析浮點數字串，支援全形數字 */
function parseFloatNormalized(text: string): number {
  return parseFloat(normalizeFullWidth(text).trim());
}

/** 驗證貸款類型 */
export function parseLoanType(text: string): LoanType | null {
  const t = text.trim();
  if (t === '房貸' || t === '房屋貸款') return LoanType.MORTGAGE;
  if (t === '信貸' || t === '信用貸款') return LoanType.PERSONAL;
  if (t === '以房養老') return LoanType.REVERSE_ANNUITY;
  return null;
}

/**
 * 驗證年齡
 * - 一般：20~75 歲
 * - 以房養老：60~75 歲
 */
export function parseAge(text: string, loanType?: LoanType): number | null {
  const n = parseIntNormalized(text);
  if (isNaN(n) || n > 75) return null;
  const minAge = loanType === LoanType.REVERSE_ANNUITY ? 60 : 20;
  if (n < minAge) return null;
  return n;
}

/** 驗證職業 */
export function parseOccupation(text: string): OccupationType | null {
  const t = text.trim();
  const values = Object.values(OccupationType) as string[];
  if (values.includes(t)) return t as OccupationType;
  return null;
}

/** 驗證月收入（最低 1 萬，支援「3萬」「3.5萬」「35000」「３５０００」） */
export function parseIncome(text: string): number | null {
  const n = parseMoneyText(text);
  if (n === null || n < 10000) return null;
  return n;
}

/** 驗證貸款用途（直接接受文字） */
export function parsePurpose(text: string): string | null {
  const t = text.trim();
  if (t.length === 0 || t.length > 20) return null;
  return t;
}

/** 驗證貸款年限 */
export function parseTerm(text: string): number | null {
  const cleaned = normalizeFullWidth(text).trim().replace(/年/g, '');
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n < 1 || n > 40) return null;
  return n;
}

/** 驗證貸款金額（最低 10 萬，支援「500萬」「1.5萬」「1500000」） */
export function parseAmount(text: string): number | null {
  const n = parseMoneyText(text);
  if (n === null || n < 100000) return null;
  return n;
}

/** 驗證屋齡（0~60） */
export function parsePropertyAge(text: string): number | null {
  const cleaned = normalizeFullWidth(text).trim().replace(/年/g, '');
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n < 0 || n > 60) return null;
  return n;
}

/** 驗證坪數（1~200） */
export function parseArea(text: string): number | null {
  const cleaned = normalizeFullWidth(text).trim().replace(/坪/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 1 || n > 200) return null;
  return n;
}

/** 驗證車位 */
export function parseParking(text: string): boolean | null {
  const t = text.trim();
  if (t === '有' || t === '有車位') return true;
  if (t === '無' || t === '無車位' || t === '沒有') return false;
  return null;
}

/** 驗證格局 */
export function parseLayout(text: string): string | null {
  const t = text.trim();
  if (t.length === 0 || t.length > 20) return null;
  return t;
}

/** 驗證樓層（1~99） */
export function parseFloor(text: string): number | null {
  const cleaned = normalizeFullWidth(text).trim().replace(/樓/g, '').replace(/F/gi, '');
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n < 1 || n > 99) return null;
  return n;
}

/** 驗證建物類型 */
export function parseBuildingType(text: string): BuildingType | null {
  const t = text.trim();
  const values = Object.values(BuildingType) as string[];
  if (values.includes(t)) return t as BuildingType;
  return null;
}

/** 驗證申請人姓名（1~10 字，限中英文與空白） */
export function parseName(text: string): string | null {
  const t = text.trim();
  if (t.length === 0 || t.length > 10) return null;
  if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(t)) return null;
  return t;
}

/** 驗證手機號碼（09XXXXXXXX，共10碼） */
export function parsePhone(text: string): string | null {
  const cleaned = normalizeFullWidth(text).trim().replace(/[-\s]/g, '');
  if (!/^09\d{8}$/.test(cleaned)) return null;
  return cleaned;
}
