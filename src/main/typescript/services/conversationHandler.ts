/**
 * INPUT: LINE 文字訊息事件
 * OUTPUT: 透過 LINE API 回覆訊息
 * POS: 服務層，訊息處理主流程，串接狀態機與推薦引擎
 */

import { WebhookEvent } from '@line/bot-sdk';
import { lineClient } from '../core/lineClient';
import { getSession, updateSession, resetSession } from '../core/sessionStore';
import { transition } from '../core/conversationStateMachine';
import { ConversationState, LoanType } from '../models/enums';
import { LineReplyMessage, RecommendedProduct } from '../models/types';
import { recommendProducts } from './recommendationEngine';

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

  // 如果進入 RECOMMEND 狀態，呼叫推薦引擎並產生 Flex 卡片
  if (session.state === ConversationState.RECOMMEND) {
    const recommendation = recommendProducts(session);
    const messages: LineReplyMessage[] = [
      buildRecommendFlexMessage(recommendation.primary, session.loanType),
    ];
    if (recommendation.alternatives.length > 0) {
      messages.push({
        type: 'text',
        text: `另也為您推薦以下方案供參考：\n${recommendation.alternatives.map((p) => `• ${p.name}（${p.rateRange}）`).join('\n')}`,
      });
    }
    await replyMessages(event.replyToken, messages);
    resetSession(userId);
    return;
  }

  return replyMessages(event.replyToken, result.messages);
}

/** 建構推薦產品 Flex Message 卡片 */
function buildRecommendFlexMessage(product: RecommendedProduct, loanType: LoanType | null): LineReplyMessage {
  const isReverseAnnuity = loanType === LoanType.REVERSE_ANNUITY;
  const monthlyLabel = isReverseAnnuity ? '每月撥付' : '預估月付';
  const monthlyValue = product.monthlyPayment
    ? `NT$ ${product.monthlyPayment.toLocaleString()}`
    : '依實際核貸金額計算';

  const bubbleContents: Record<string, unknown> = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '為您推薦最適方案', size: 'sm', color: '#aaaaaa' },
        { type: 'text', text: product.name, weight: 'bold', size: 'md', wrap: true },
      ],
      backgroundColor: '#1B4F8A',
      paddingAll: '20px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: '利率', size: 'sm', color: '#555555', flex: 2 },
            { type: 'text', text: product.rateRange, size: 'sm', weight: 'bold', flex: 3 },
          ],
        },
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: monthlyLabel, size: 'sm', color: '#555555', flex: 2 },
            { type: 'text', text: monthlyValue, size: 'sm', weight: 'bold', color: '#1B4F8A', flex: 3 },
          ],
        },
        { type: 'separator' },
        {
          type: 'box', layout: 'vertical', spacing: 'xs',
          contents: product.features.slice(0, 4).map((f) => ({
            type: 'text', text: `• ${f}`, size: 'xs', color: '#555555', wrap: true,
          })),
        },
        { type: 'separator' },
        {
          type: 'text', text: product.savingsHighlight,
          size: 'xs', color: '#1B4F8A', wrap: true,
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1B4F8A',
          action: { type: 'message', label: '立即洽詢分行', text: '我想洽詢' },
        },
        {
          type: 'button',
          style: 'secondary',
          action: { type: 'message', label: '重新試算', text: '重新開始' },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `推薦您：${product.name}（${product.rateRange}）`,
    contents: bubbleContents,
  };
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
