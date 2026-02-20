/**
 * INPUT: LINE 文字訊息事件
 * OUTPUT: 透過 LINE API 回覆訊息
 * POS: 服務層，訊息處理主流程，串接狀態機與推薦引擎、申請存檔
 */

import { WebhookEvent } from '@line/bot-sdk';
import { lineClient } from '../core/lineClient';
import { getSession, updateSession, resetSession } from '../core/sessionStore';
import { transition } from '../core/conversationStateMachine';
import { ConversationState, LoanType } from '../models/enums';
import { LineReplyMessage, RecommendedProduct, UserSession, LoanApplication } from '../models/types';
import { recommendProducts } from './recommendationEngine';
import { createApplication } from '../config/applicationStore';
import { confirmApplyQuickReply } from '../utils/quickReplyHelper';

/** 處理單一 webhook 事件 */
export async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;
  if (!userId) return;

  const userText = event.message.text.trim();
  const session = getSession(userId);

  // 返回主選單：重置 session 並重新顯示歡迎 Carousel
  if (userText === '返回主選單') {
    resetSession(userId);
    const freshSession = getSession(userId);
    const result = transition(freshSession, '');
    freshSession.state = result.nextState;
    updateSession(freshSession);
    return replyMessages(event.replyToken, result.messages);
  }

  // 洽詢指令
  if (userText === '我想洽詢') {
    return replyMessages(event.replyToken, [{
      type: 'text',
      text: '感謝您的洽詢！\n\n請攜帶相關資料親臨合庫各分行，服務人員將為您詳細說明貸款方案。\n\n如需重新試算，請輸入「重新開始」。',
    }]);
  }

  // 重置指令
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

  // 進入 RECOMMEND 狀態：呼叫推薦引擎，顯示推薦卡片後轉 CONFIRM_APPLY
  if (session.state === ConversationState.RECOMMEND) {
    const recommendation = recommendProducts(session);
    session.recommendedProductId = recommendation.primary.id;

    const messages: LineReplyMessage[] = [
      buildRecommendFlexMessage(recommendation.primary, session.loanType),
    ];

    if (recommendation.alternatives.length > 0) {
      messages.push({
        type: 'text',
        text: `另也為您推薦以下方案供參考：\n${recommendation.alternatives.map((p) => `• ${p.name}（${p.rateRange}）`).join('\n')}`,
      });
    }

    // 文件備妥狀態摘要 + 確認按鈕
    messages.push({
      type: 'text',
      text: buildDocsSummary(session) + '\n\n請確認上方推薦方案，確認後點選「確認送出申請」繼續。',
      quickReply: confirmApplyQuickReply(),
    });

    await replyMessages(event.replyToken, messages);

    session.state = ConversationState.CONFIRM_APPLY;
    updateSession(session);
    return;
  }

  // 進入 APPLY_DONE 狀態：建立申請案件，顯示案件編號，重置 session
  if (session.state === ConversationState.APPLY_DONE) {
    const app = createApplicationFromSession(session);
    await replyMessages(event.replyToken, [buildApplyDoneMessage(app)]);
    resetSession(userId);
    return;
  }

  return replyMessages(event.replyToken, result.messages);
}

/** 從 session 建立申請案件 */
function createApplicationFromSession(session: UserSession): LoanApplication {
  return createApplication(
    session.userId,
    session.applicantName ?? '',
    session.applicantPhone ?? '',
    session.loanType ?? LoanType.PERSONAL,
    session.basicInfo,
    session.propertyInfo,
    session.recommendedProductId ?? '',
    session.mydataReady ?? false,
    session.landRegistryReady,
  );
}

/** 文件備妥狀態摘要文字 */
function buildDocsSummary(session: UserSession): string {
  const lines: string[] = ['📄 文件備妥狀態'];
  const mydataLabel = session.mydataReady === true
    ? '已備妥 ✅'
    : session.mydataReady === false
      ? '尚未備妥 ⚠️（可後續補件）'
      : '未確認';
  lines.push(`• MYDATA 所得資料：${mydataLabel}`);

  if (session.loanType !== LoanType.PERSONAL) {
    const landLabel = session.landRegistryReady === true
      ? '已備妥 ✅'
      : session.landRegistryReady === false
        ? '尚未備妥 ⚠️（可後續補件）'
        : '未確認';
    lines.push(`• 土地建物謄本：${landLabel}`);
  }

  return lines.join('\n');
}

/** 申請完成 Flex Message — 顯示案件編號 */
function buildApplyDoneMessage(app: LoanApplication): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const ACCENT = '#69F0AE'; const BTN = '#1B5E20';

  return {
    type: 'flex',
    altText: `✅ 申請完成！案件編號：${app.id}`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '✅', size: '3xl', align: 'center' },
              { type: 'text', text: '線上申請已完成！', weight: 'bold', size: 'lg', color: '#FFFFFF', align: 'center', margin: 'sm' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '3px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: M, paddingAll: '16px', spacing: 'md',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '案件編號', size: 'sm', color: '#90A4AE', flex: 4 },
                { type: 'text', text: app.id, size: 'sm', weight: 'bold', color: ACCENT, flex: 6, wrap: true },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '申請人', size: 'sm', color: '#90A4AE', flex: 4 },
                { type: 'text', text: app.applicantName, size: 'sm', color: '#FFFFFF', flex: 6 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '聯絡電話', size: 'sm', color: '#90A4AE', flex: 4 },
                { type: 'text', text: app.applicantPhone, size: 'sm', color: '#FFFFFF', flex: 6 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '審核狀態', size: 'sm', color: '#90A4AE', flex: 4 },
                { type: 'text', text: '待審核', size: 'sm', color: '#FFD54F', weight: 'bold', flex: 6 },
              ]},
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px',
            contents: [
              { type: 'text', text: '合庫將於 3~5 個工作天內與您聯繫，請保持電話暢通。感謝您的申請！', size: 'xs', color: '#90A4AE', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
        contents: [{ type: 'button', style: 'primary', color: BTN,
          action: { type: 'message', label: '回到主選單', text: '返回主選單' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 建構推薦產品 Flex Message 卡片 — 深色科技風格（footer 改為確認送出申請） */
function buildRecommendFlexMessage(product: RecommendedProduct, loanType: LoanType | null): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const isReverseAnnuity = loanType === LoanType.REVERSE_ANNUITY;
  const isMortgage = loanType === LoanType.MORTGAGE || isReverseAnnuity;
  const ACCENT = isMortgage ? '#4FC3F7' : '#69F0AE';
  const BTN = isMortgage ? '#1565C0' : '#1B5E20';
  const monthlyLabel = isReverseAnnuity ? '每月撥付' : '預估月付';
  const monthlyValue = product.monthlyPayment
    ? `NT$ ${product.monthlyPayment.toLocaleString()}`
    : '依核貸金額計算';

  return {
    type: 'flex',
    altText: `🎯 AI 推薦：${product.name}（${product.rateRange}）`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'horizontal', paddingAll: '16px', paddingBottom: '8px',
            alignItems: 'center', spacing: 'sm',
            contents: [
              { type: 'text', text: '🎯', size: 'sm', flex: 0 },
              { type: 'text', text: 'AI 智能推薦', size: 'xs', color: ACCENT, weight: 'bold', flex: 1 },
              { type: 'text', text: '最適合您的方案', size: 'xxs', color: '#546E7A', align: 'end' },
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingBottom: '12px',
            contents: [{ type: 'text', text: product.name, weight: 'bold', size: 'lg', color: '#FFFFFF', wrap: true }],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'horizontal', backgroundColor: M, paddingAll: '16px',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                contents: [
                  { type: 'text', text: product.rateRange, weight: 'bold', size: 'md', color: ACCENT, wrap: true, align: 'center' },
                  { type: 'text', text: '利率', size: 'xxs', color: '#78909C', align: 'center' },
                ],
              },
              { type: 'box', layout: 'vertical', width: '1px', backgroundColor: '#1E3A5F', contents: [{ type: 'filler' }] },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                contents: [
                  { type: 'text', text: monthlyValue, weight: 'bold', size: 'sm', color: '#FFD54F', wrap: true, align: 'center' },
                  { type: 'text', text: monthlyLabel, size: 'xxs', color: '#78909C', align: 'center' },
                ],
              },
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: '方案特色', size: 'xs', color: '#78909C', weight: 'bold' },
              ...product.features.slice(0, 4).map((f) => ({
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '◆', size: 'xs', color: ACCENT, flex: 0 },
                  { type: 'text', text: f, size: 'xs', color: '#B0BEC5', flex: 1, wrap: true },
                ],
              })),
              { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#1E3A5F', margin: 'md', contents: [{ type: 'filler' }] },
              { type: 'text', text: `💡 ${product.savingsHighlight}`, size: 'xs', color: '#69F0AE', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'primary', color: BTN,
            action: { type: 'message', label: '確認送出申請 →', text: '確認送出' },
          },
          { type: 'button', style: 'secondary',
            action: { type: 'message', label: '重新試算', text: '重新開始' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
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
