/**
 * INPUT:  POST /api/admin/demo/reset（需 Admin API Key）
 * OUTPUT: 重置 Agent Monitor 種子資料 + 回傳重置結果
 * POS:    黑客松展示前呼叫，讓監控中心顯示正常的今日統計數字
 */

import { Router } from 'express';
import { resetDemoData } from '../config/agentMonitorStore';

export const demoSeedRouter = Router();

demoSeedRouter.post('/demo/reset', (_req, res) => {
  resetDemoData();
  res.json({
    success: true,
    message: 'Demo 資料已重置',
    resetAt: new Date().toISOString(),
  });
});
