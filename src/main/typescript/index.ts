/**
 * INPUT: 環境變數（.env）、LINE webhook 事件
 * OUTPUT: Express HTTP 伺服器（LINE Bot + LIFF + 海報 API）
 * POS: 應用程式進入點，整合所有路由與中介層
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { lineMiddleware } from './core/lineClient';
import webhookRouter from './api/webhook';
import { promotionAdminRouter } from './api/promotionAdmin';
import { recommendRouter } from './api/recommend';

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

// LINE webhook 路由（必須在 express.json() 之前，LINE SDK 需要原始 body）
// 使用 app.use 讓 Express strip prefix，使 router.post('/') 能正確匹配
app.use('/api/webhook', lineMiddleware, webhookRouter);

// 其他路由使用 JSON 解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin API 金鑰驗證中介層
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-admin-api-key'];
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    res.status(401).json({ success: false, message: '未授權：缺少或錯誤的 Admin API Key' });
    return;
  }
  next();
}

// 活動後台管理 API
app.use('/api/admin', adminAuth, promotionAdminRouter);

// LIFF 公開 API（推薦引擎 + 活動查詢，允許 CORS 供前端呼叫）
app.use('/api', (_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});
app.options('/api/*', (_req, res) => res.sendStatus(200));
app.use('/api', recommendRouter);

// 健康檢查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '個金Co-Pilot領航員' });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 個金Co-Pilot領航員 啟動成功`);
  console.log(`📡 伺服器運行於 http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}/api/webhook`);
  console.log(`💡 請確認 LINE Developers Console 已設定 Webhook URL`);
});
