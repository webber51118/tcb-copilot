/**
 * INPUT: 環境變數（.env）、LINE webhook 事件
 * OUTPUT: Express HTTP 伺服器（LINE Bot + LIFF + 海報 API）
 * POS: 應用程式進入點，整合所有路由與中介層
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { lineMiddleware } from './core/lineClient';
import webhookRouter from './api/webhook';

const app = express();
const PORT = process.env.PORT || 3000;

// LINE webhook 路由（必須在 express.json() 之前，LINE SDK 需要原始 body）
app.post('/api/webhook', lineMiddleware, webhookRouter);

// 其他路由使用 JSON 解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
