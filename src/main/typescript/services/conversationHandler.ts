/**
 * INPUT: LINE 文字訊息事件
 * OUTPUT: 透過 LINE API 回覆訊息
 * POS: 服務層，訊息處理主流程，串接狀態機與推薦引擎
 */

import { WebhookEvent } from '@line/bot-sdk';
import { lineClient } from '../core/lineClient';
import { getSession, updateSession, resetSession } from '../core/sessionStore';
import { transition } from '../core/conversationStateMachine';
import { ConversationState } from '../models/enums';
import { LineReplyMessage } from '../models/types';

/** 處理單一 webhook 事件 */
export async function handleEvent(event: WebhookEvent): Promise<void> {
  // 僅處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;
  if (!userId) return;

  const userText = event.message.text.trim();
  const session = getSession(userId);

  // 重置指令：使用者輸入「重新開始」可重置對話
  if (userText === '重新開始' || userText === '重來') {
    resetSession(userId);
    const freshSession = getSession(userId);
    const result = transition(freshSession, '');
    freshSession.state = result.nextState;
    updateSession(freshSession);
    return replyMessages(event.replyToken, result.messages);
  }

  // 執行狀態轉移
  const result = transition(session, userText);
  session.state = result.nextState;
  updateSession(session);

  // 如果進入 RECOMMEND 狀態，由此處產生推薦結果
  if (session.state === ConversationState.RECOMMEND) {
    // 先回覆「資料收集完成」的訊息
    if (result.messages.length > 0) {
      await replyMessages(event.replyToken, result.messages);
    }

    // TODO: 階段 3 實作推薦引擎 + Flex 卡片 + 海報
    // 完成推薦後重置 Session
    resetSession(userId);
    return;
  }

  return replyMessages(event.replyToken, result.messages);
}

/** 將 LineReplyMessage 陣列轉為 LINE SDK 格式並回覆 */
async function replyMessages(
  replyToken: string,
  messages: LineReplyMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const lineMessages = messages.map((msg) => {
    if (msg.type === 'text') {
      const m: Record<string, unknown> = { type: 'text', text: msg.text };
      if (msg.quickReply) m.quickReply = msg.quickReply;
      return m;
    }
    if (msg.type === 'flex') {
      return { type: 'flex', altText: msg.altText, contents: msg.contents };
    }
    if (msg.type === 'image') {
      return {
        type: 'image',
        originalContentUrl: msg.originalContentUrl,
        previewImageUrl: msg.previewImageUrl,
      };
    }
    return { type: 'text', text: '（系統錯誤）' };
  });

  await lineClient.replyMessage({
    replyToken,
    messages: lineMessages as any[],
  });
}
