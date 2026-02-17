/**
 * INPUT: LINE webhook 事件（WebhookEvent）
 * OUTPUT: 回覆訊息至 LINE 使用者
 * POS: API 層，處理 LINE 平台傳入的 webhook 事件，委派至 conversationHandler
 */

import { Router, Request, Response } from 'express';
import { WebhookEvent } from '@line/bot-sdk';
import { handleEvent } from '../services/conversationHandler';

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

export default router;
