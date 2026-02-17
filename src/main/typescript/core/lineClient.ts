/**
 * INPUT: 環境變數 LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
 * OUTPUT: LINE Messaging API 客戶端單例
 * POS: 核心模組，提供全域 LINE SDK 客戶端實例
 */

import { messagingApi, middleware, MiddlewareConfig } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

/** LINE Messaging API 客戶端 */
export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

/** LINE webhook 簽名驗證中介層設定 */
export const lineMiddlewareConfig: MiddlewareConfig = {
  channelSecret,
};

/** LINE webhook 中介層 */
export const lineMiddleware = middleware(lineMiddlewareConfig);
