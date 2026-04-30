/**
 * INPUT: HTTP Request（Admin API Key 驗證）
 * OUTPUT: 手動觸發市場週報推播
 * POS: API 層，不動產市場週報後台管理端點
 *
 * 路由（掛載於 /api/admin）：
 *   POST /market-push/trigger   — 立即觸發推播（測試用）
 *   GET  /market-push/preview   — 預覽本週 Flex JSON（不推播）
 *   GET  /market-push/stats     — 查看訂閱人數
 */

import { Router, Request, Response } from 'express';
import { pushWeeklyMarket, buildMarketInfoFlex } from '../services/marketPushService';
import { getAllSubscribers } from '../config/marketSubscriberStore';

export const marketPushRouter = Router();

/** 立即觸發推播 */
marketPushRouter.post('/market-push/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await pushWeeklyMarket();
    res.json({ success: true, successCount: result.success, failedCount: result.failed });
  } catch (err) {
    console.error('[admin] market-push trigger failed:', err);
    res.status(500).json({ success: false, message: '推播執行失敗' });
  }
});

/** 預覽本週 Flex JSON（不推播） */
marketPushRouter.get('/market-push/preview', (_req: Request, res: Response) => {
  // 產生本週資料預覽，傳回 Flex JSON
  const now = new Date();
  const weekNum = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const previewData = {
    weekLabel: `${now.getFullYear()} 第 ${weekNum + 1} 週（${fmt(monday)}–${fmt(sunday)}）`,
    mortgageRate: '2.06%', mortgageRateTrend: '▲ +0.01', mortgageRateColor: '#DC2626',
    avgPricePerPing: '42.5 萬/坪', priceChange: '▼ -0.3%', priceChangeColor: '#16A34A',
    hotDistrict: '大安區、信義區', inventoryDays: '42 天',
    tip: '央行利率維持高檔，建議優先評估固定利率方案，鎖定還款成本。',
  };
  res.json({ success: true, flex: buildMarketInfoFlex(previewData) });
});

/** 訂閱人數統計 */
marketPushRouter.get('/market-push/stats', (_req: Request, res: Response) => {
  const subscribers = getAllSubscribers();
  res.json({ success: true, subscriberCount: subscribers.length });
});
