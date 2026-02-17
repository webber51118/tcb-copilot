/**
 * INPUT: LINE webhook 事件（WebhookEvent）
 * OUTPUT: 回覆訊息至 LINE 使用者
 * POS: API 層，處理 LINE 平台傳入的 webhook 事件
 */

import { Router, Request, Response } from 'express';
import { WebhookEvent } from '@line/bot-sdk';
import { lineClient } from '../core/lineClient';

const router = Router();

/** POST /api/webhook — LINE webhook 事件處理 */
router.post('/', async (req: Request, res: Response) => {
  const events: WebhookEvent[] = req.body.events;

  try {
    await Promise.all(events.map(handleEvent));
    res.json({ success: true });
  } catch (err) {
    console.error('Webhook 處理錯誤:', err);
    res.status(500).json({ error: '內部伺服器錯誤' });
  }
});

/** 處理單一 webhook 事件 */
async function handleEvent(event: WebhookEvent): Promise<void> {
  // 目前僅處理文字訊息（後續階段會接入狀態機）
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const { replyToken } = event;
  const userMessage = event.message.text;

  // 階段 1：回聲模式（驗證 webhook 連接）
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: `收到您的訊息：${userMessage}\n\n（個金Co-Pilot領航員啟動中...）`,
      },
    ],
  });
}

export default router;
