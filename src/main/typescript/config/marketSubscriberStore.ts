/**
 * INPUT: userId (LINE User ID)
 * OUTPUT: 不動產市場週報訂閱者 CRUD
 * POS: 設定層，市場週報訂閱名單 JSON 儲存（data/market-subscribers.json）
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.resolve(__dirname, '../../../../data/market-subscribers.json');

/** 讀取訂閱名單 */
function readSubscribers(): string[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as string[];
}

/** 寫入訂閱名單 */
function writeSubscribers(list: string[]): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify([...new Set(list)], null, 2), 'utf-8');
}

/** 訂閱 */
export function subscribeUser(userId: string): void {
  const list = readSubscribers();
  if (!list.includes(userId)) {
    list.push(userId);
    writeSubscribers(list);
  }
}

/** 取消訂閱 */
export function unsubscribeUser(userId: string): void {
  writeSubscribers(readSubscribers().filter((id) => id !== userId));
}

/** 是否已訂閱 */
export function isSubscribed(userId: string): boolean {
  return readSubscribers().includes(userId);
}

/** 取得全部訂閱者 */
export function getAllSubscribers(): string[] {
  return readSubscribers();
}
