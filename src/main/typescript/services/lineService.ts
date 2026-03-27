import { lineClient } from '../core/lineClient';

/**
 * 推播純文字訊息。
 * @param userId LINE userId (U 開頭)
 * @param text 要發送的文字內容
 */
export async function pushText(userId: string, text: string): Promise<void> {
  await lineClient.pushMessage({
    to: userId,
    messages: [{ type: 'text', text }],
  });
}

/**
 * 發送合庫速速貸測試公告，用作排程或手動觸發的範例。
 * message 內容可照實際需求調整或改為 flex/image
 */
export async function pushCobankLoanTest(userId: string): Promise<void> {
  const text =
    '【測試】合庫速速貸專案，利率最低 2.3% 起，立即了解➡️ https://cobank.tcb-bank.com.tw/TCB.LOAN.SERVICE/PersonalLoan/Index';
  await pushText(userId, text);
}
