/**
 * INPUT: 環境變數（.env）、LINE webhook 事件
 * OUTPUT: Express HTTP 伺服器（LINE Bot + LIFF + 海報 API）
 * POS: 應用程式進入點，整合所有路由與中介層
 */

import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import express, { Request, Response, NextFunction } from 'express';

// 確保資料目錄存在
['data', 'data/applications', 'data/credit-reviews'].forEach((dir) => {
  const p = path.join(process.cwd(), dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});
import { lineMiddleware } from './core/lineClient';
import webhookRouter from './api/webhook';
import { promotionAdminRouter } from './api/promotionAdmin';
import { applicationAdminRouter } from './api/applicationAdmin';
import { recommendRouter } from './api/recommend';
import { parseDocumentRouter } from './api/parseDocument';
import { submitApplicationRouter } from './api/submitApplication';
import { valuateRouter } from './api/valuate';
import { creditReviewRouter } from './api/creditReview';
import { ragQueryRouter } from './api/ragQuery';
import { committeeReviewRouter } from './api/committeeReview';
import { workflowRouter } from './api/workflow';

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

// 後台管理 API（活動 + 申請案件）
app.use('/api/admin', adminAuth, promotionAdminRouter);
app.use('/api/admin', adminAuth, applicationAdminRouter);

// LIFF 公開 API（推薦引擎 + 活動查詢，允許 CORS 供前端呼叫）
app.use('/api', (_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});
app.options('/api/*', (_req, res) => res.sendStatus(200));
app.use('/api', recommendRouter);
app.use('/api', parseDocumentRouter);
app.use('/api', submitApplicationRouter);
app.use('/api', valuateRouter);
app.use('/api', creditReviewRouter);
app.use('/api', ragQueryRouter);
app.use('/api', committeeReviewRouter);
app.use('/api', workflowRouter);

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
