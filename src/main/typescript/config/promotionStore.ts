/**
 * INPUT: data/promotions.json
 * OUTPUT: Promotion CRUD 操作
 * POS: 設定層，活動資料 JSON 儲存層（MVP，後期可替換為 Azure Cosmos DB）
 */

import * as fs from 'fs';
import * as path from 'path';
import { Promotion } from '../models/promotion';

const DATA_FILE = path.resolve(__dirname, '../../../../data/promotions.json');

/** 讀取所有活動（從 JSON 檔案） */
export function getAllPromotions(): Promotion[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as Promotion[];
}

/** 取得目前進行中的活動（isActive=true 且日期範圍內） */
export function getActivePromotions(): Promotion[] {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return getAllPromotions().filter(
    (p) => p.isActive && p.startDate <= today && p.endDate >= today,
  );
}

/** 儲存（新增或更新）活動 */
export function savePromotion(promotion: Promotion): void {
  const list = getAllPromotions();
  const idx = list.findIndex((p) => p.id === promotion.id);
  if (idx >= 0) {
    list[idx] = promotion;
  } else {
    list.push(promotion);
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

/** 刪除活動 */
export function deletePromotion(id: string): boolean {
  const list = getAllPromotions();
  const filtered = list.filter((p) => p.id !== id);
  if (filtered.length === list.length) return false;
  fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  return true;
}

/** 切換啟用/停用 */
export function togglePromotion(id: string): Promotion | null {
  const list = getAllPromotions();
  const item = list.find((p) => p.id === id);
  if (!item) return null;
  item.isActive = !item.isActive;
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  return item;
}
