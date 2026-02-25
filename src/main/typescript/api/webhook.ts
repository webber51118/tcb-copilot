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

  // LINE 要求 webhook 一律回 200，否則會重試導致重複訊息
  res.json({ success: true });

  // 非同步處理事件，個別事件失敗不影響其他事件
  await Promise.all(events.map(async (event) => {
    try {
      await handleEvent(event);
    } catch (err) {
      const lineErr = err as { statusCode?: number; message?: string; originalError?: unknown };
      console.error('[webhook] 事件處理失敗:', {
        statusCode: lineErr?.statusCode,
        message: lineErr?.message,
        body: lineErr?.originalError,
      });
    }
  }));
});

export default router;
