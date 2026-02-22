/**
 * INPUT: LINE 文字訊息 / 圖片訊息事件
 * OUTPUT: 透過 LINE API 回覆訊息
 * POS: 服務層，訊息處理主流程，串接狀態機、文件解析、推薦引擎
 */

import { WebhookEvent, messagingApi } from '@line/bot-sdk';
import { lineClient } from '../core/lineClient';
import { getSession, updateSession, resetSession } from '../core/sessionStore';
import { transition } from '../core/conversationStateMachine';
import { ConversationState, LoanType, BuildingType, OccupationType } from '../models/enums';
import { LineReplyMessage, RecommendedProduct, UserSession, DocumentParseResult } from '../models/types';
import { recommendProducts } from './recommendationEngine';
import { parseImageBuffer } from './documentParser';
import { ragQuery } from './ragService';
import { runFullReview } from './workflowService';
import { FullReviewRequest, FullReviewResponse } from '../models/workflow';

/** LINE Blob 客戶端（用於下載圖片內容） */
const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

/** 處理單一 webhook 事件 */
export async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message') return;
  if (event.message.type !== 'text' && event.message.type !== 'image') return;

  const userId = event.source.userId;
  if (!userId) return;

  const session = getSession(userId);

  // ── 圖片訊息處理（UPLOAD_DOCS 狀態下解析文件）──
  if (event.message.type === 'image') {
    if (session.state === ConversationState.UPLOAD_DOCS) {
      await handleImageUpload(event.replyToken, userId, event.message.id, session);
      return;
    }
    // 其他狀態下收到圖片，忽略
    return;
  }

  const userText = event.message.text.trim();

  // 返回主選單
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

  // 法規問答入口（全域可用）
  if (userText === '法規問答') {
    return replyMessages(event.replyToken, [{
      type: 'text',
      text: '⚖️ 法規問答服務\n\n請選擇常見問題，或輸入「法規:您的問題」進行查詢：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '第一戶寬限期', text: '法規:第一戶房貸有寬限期嗎？' } },
          { type: 'action', action: { type: 'message', label: '第二戶成數', text: '法規:第二戶房貸最高可以貸幾成？' } },
          { type: 'action', action: { type: 'message', label: 'DBR上限', text: '法規:DBR上限是多少？' } },
          { type: 'action', action: { type: 'message', label: '青安貸款', text: '法規:青安貸款的利率和申請條件是什麼？' } },
        ],
      },
    }]);
  }

  // 法規問答查詢（「法規:問題」前綴）
  if (userText.startsWith('法規:')) {
    const question = userText.slice(3).trim();
    if (question.length > 0) {
      await replyMessages(event.replyToken, [{
        type: 'text',
        text: '📖 正在查詢法規知識庫，請稍候...',
      }]);
      try {
        const loanTypeHint =
          session.loanType === LoanType.MORTGAGE ? 'mortgage'
          : session.loanType === LoanType.PERSONAL ? 'personal'
          : undefined;
        const ragResult = await ragQuery({ question, loanType: loanTypeHint });
        const confidenceLabel: Record<string, string> = { high: '高', medium: '中', low: '低' };
        await pushMessages(userId, [{
          type: 'text',
          text: `📋 法規問答\n\n${ragResult.answer}\n\n📌 資料來源：${ragResult.sources.join('、')}\n🔍 信心程度：${confidenceLabel[ragResult.confidence] ?? '中'}`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '繼續查詢', text: '法規問答' } },
              { type: 'action', action: { type: 'message', label: '返回主選單', text: '返回主選單' } },
            ],
          },
        }]);
      } catch (err) {
        console.error('[conversationHandler] RAG 查詢失敗:', err);
        await pushMessages(userId, [{
          type: 'text',
          text: '⚠️ 法規查詢暫時無法使用，請稍後再試。',
        }]);
      }
      return;
    }
  }

  // 執行狀態轉移
  const result = transition(session, userText);
  session.state = result.nextState;
  updateSession(session);

  // 申請完成 → 非同步觸發完整 AI 審核流程
  if (result.nextState === ConversationState.APPLY_DONE) {
    triggerWorkflowAsync(userId, session).catch((err) =>
      console.error('[conversationHandler] Workflow 觸發失敗:', err),
    );
  }

  // 進入 RECOMMEND 狀態：呼叫推薦引擎，顯示豐富推薦海報 → 轉 CONFIRM_APPLY
  if (session.state === ConversationState.RECOMMEND) {
    const recommendation = recommendProducts(session);
    session.recommendedProductId = recommendation.primary.id;

    const messages: LineReplyMessage[] = [
      buildRecommendFlexMessage(recommendation.primary, session.loanType),
    ];

    // 備選方案
    if (recommendation.alternatives.length > 0) {
      messages.push({
        type: 'text',
        text: `另也為您推薦以下方案供參考：\n${recommendation.alternatives.map((p) => `• ${p.name}（${p.rateRange}）`).join('\n')}`,
      });
    }

    // 交叉銷售小卡（若有）
    const crossSell = recommendation.primary.crossSell;
    if (crossSell) {
      messages.push(buildCrossSellFlex(crossSell, session.loanType));
    }

    // 說明下一步
    messages.push({
      type: 'text',
      text: '✅ 推薦方案已產生！\n\n請點選下方「填寫申請書」按鈕完成電子申請書並進行簽名。',
    });

    await replyMessages(event.replyToken, messages);

    // 轉入 CONFIRM_APPLY，由狀態機產生 LIFF 連結 Flex
    session.state = ConversationState.CONFIRM_APPLY;
    updateSession(session);

    // 用 push 送出申請書 LIFF 連結（reply token 已用完）
    const applyResult = transition(session, '');
    if (applyResult.messages.length > 0) {
      await pushMessages(userId, applyResult.messages);
    }
    return;
  }

  return replyMessages(event.replyToken, result.messages);
}

// ─────────────────────────────────────────────────────────────
// 圖片上傳 & 文件解析
// ─────────────────────────────────────────────────────────────

/** 處理 UPLOAD_DOCS 狀態下的圖片訊息 */
async function handleImageUpload(
  replyToken: string,
  userId: string,
  messageId: string,
  session: UserSession,
): Promise<void> {
  // 先回應「解析中」
  await replyMessages(replyToken, [{
    type: 'text',
    text: '📷 已收到您的圖片，AI 正在辨識文件...\n\n（通常需要 3~5 秒）',
  }]);

  try {
    // 下載圖片內容
    const stream = await blobClient.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 判斷文件類型（MYDATA 優先，若已有 MyData 且是房貸則解析謄本）
    const hasMydata = session.mydataReady === true;
    const docType = hasMydata && session.loanType !== LoanType.PERSONAL
      ? 'landRegistry'
      : 'mydata';

    const parseResult = await parseImageBuffer(buffer, docType);

    if (!parseResult.success) {
      // 解析失敗 → 引導手動填寫
      session.parsedFromDoc = false;
      updateSession(session);
      await pushMessages(userId, [{
        type: 'text',
        text: `⚠️ 文件辨識失敗：${parseResult.error || '無法識別文件內容'}\n\n請重新上傳清晰圖片，或選擇手動填寫。`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '手動填寫', text: '手動填寫' } },
          ],
        },
      }]);
      return;
    }

    // 解析成功：更新 session
    if (docType === 'mydata' && parseResult.mydata) {
      const { name, idNumber, annualIncome, employer, phone } = parseResult.mydata;
      if (name) session.applicantName = name;
      if (idNumber) session.idNumber = idNumber;
      if (annualIncome) {
        session.annualIncome = annualIncome;
        session.basicInfo.income = Math.round(annualIncome / 12);
      }
      if (employer) session.employer = employer;
      if (phone) session.applicantPhone = phone;
      session.mydataReady = true;
      session.parsedFromDoc = true;
    } else if (docType === 'landRegistry' && parseResult.landRegistry) {
      const { buildingType, floor, areaPing, propertyAge } = parseResult.landRegistry;
      const btMap: Record<string, BuildingType> = {
        '大樓': BuildingType.APARTMENT,
        '華廈': BuildingType.MANSION,
        '公寓': BuildingType.WALK_UP,
        '透天': BuildingType.TOWNHOUSE,
        '套房': BuildingType.STUDIO,
      };
      if (buildingType) {
        const normalized = Object.keys(btMap).find((k) => buildingType.includes(k));
        if (normalized) session.propertyInfo.buildingType = btMap[normalized];
      }
      if (floor) session.propertyInfo.floor = floor;
      if (areaPing) session.propertyInfo.areaPing = areaPing;
      if (propertyAge) session.propertyInfo.propertyAge = propertyAge;
      session.landRegistryReady = true;
      session.parsedFromDoc = true;
    }

    session.state = ConversationState.DOC_REVIEW;
    updateSession(session);

    // Push DOC_REVIEW Flex 摘要卡片
    await pushMessages(userId, [
      buildDocReviewFlex(session, docType, parseResult),
    ]);
  } catch (err) {
    console.error('[conversationHandler] 圖片處理失敗:', err);
    await pushMessages(userId, [{
      type: 'text',
      text: '⚠️ 圖片處理發生錯誤，請重新上傳或選擇手動填寫。',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '手動填寫', text: '手動填寫' } },
        ],
      },
    }]);
  }
}

/** 建構文件解析摘要 Flex 卡片 */
function buildDocReviewFlex(
  session: UserSession,
  docType: 'mydata' | 'landRegistry',
  result: DocumentParseResult,
): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const ACCENT = '#69F0AE';

  const rows: Array<{ label: string; value: string }> = [];

  if (docType === 'mydata' && result.mydata) {
    const { name, idNumber, annualIncome, employer } = result.mydata;
    if (name) rows.push({ label: '姓名', value: name });
    if (idNumber) rows.push({ label: '身分證字號', value: idNumber });
    if (annualIncome) rows.push({ label: '年所得', value: `NT$ ${annualIncome.toLocaleString()}` });
    if (employer) rows.push({ label: '就業單位', value: employer });
    // 換算月收入
    if (annualIncome) rows.push({ label: '換算月收入', value: `NT$ ${Math.round(annualIncome / 12).toLocaleString()}` });
  } else if (docType === 'landRegistry' && result.landRegistry) {
    const { buildingType, floor, areaPing, propertyAge } = result.landRegistry;
    if (buildingType) rows.push({ label: '建物種類', value: buildingType });
    if (floor) rows.push({ label: '所在樓層', value: `${floor} 樓` });
    if (areaPing) rows.push({ label: '建築面積', value: `${areaPing} 坪` });
    if (propertyAge) rows.push({ label: '屋齡', value: `${propertyAge} 年` });
  }

  const hasMydata = session.mydataReady && docType === 'mydata';
  const isMortgage = session.loanType !== LoanType.PERSONAL;
  const needsLandReg = isMortgage && !session.landRegistryReady;

  let nextHint = '';
  if (hasMydata && needsLandReg) {
    nextHint = '\n\n📋 請繼續上傳土地建物謄本';
  }

  return {
    type: 'flex',
    altText: `✅ 文件解析完成，請確認資料`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
            contents: [
              { type: 'text', text: '🤖 AI 文件解析完成', weight: 'bold', size: 'md', color: '#FFFFFF' },
              { type: 'text', text: `${docType === 'mydata' ? 'MYDATA 所得資料' : '土地建物謄本'}`, size: 'xs', color: '#78909C' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: M, paddingAll: '16px', spacing: 'sm',
            contents: rows.map((r) => ({
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: r.label, size: 'sm', color: '#90A4AE', flex: 4 },
                { type: 'text', text: r.value, size: 'sm', color: '#FFFFFF', weight: 'bold', flex: 6, wrap: true },
              ],
            })),
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '12px',
            contents: [
              { type: 'text', text: `請確認以上資料是否正確${nextHint}`, size: 'xs', color: '#78909C', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'primary', color: '#1B5E20', height: 'sm',
            action: { type: 'message', label: '✅ 確認資料正確', text: '確認文件資料' },
          },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '🔄 重新上傳', text: '重新上傳' },
          },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '✏️ 手動填寫', text: '手動填寫' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────────────────────
// 推薦海報
// ─────────────────────────────────────────────────────────────

/** 建構豐富推薦產品 Flex Message（含適用資格說明） */
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

  // 適用資格說明
  const eligibilityLines: string[] = [];
  if (isReverseAnnuity) eligibilityLines.push('年滿 60 歲以上屋主');
  else if (isMortgage) eligibilityLines.push('具合法不動產所有權');
  if (loanType === LoanType.PERSONAL) eligibilityLines.push('年收入 20 萬元以上');
  eligibilityLines.push('無不良信用紀錄');

  return {
    type: 'flex',
    altText: `🎯 AI 推薦：${product.name}（${product.rateRange}）`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          // 標題列
          {
            type: 'box', layout: 'horizontal', paddingAll: '16px', paddingBottom: '8px',
            alignItems: 'center', spacing: 'sm',
            contents: [
              { type: 'text', text: '🎯', size: 'sm', flex: 0 },
              { type: 'text', text: 'AI 智能推薦', size: 'xs', color: ACCENT, weight: 'bold', flex: 1 },
              { type: 'text', text: '最適合您的方案', size: 'xxs', color: '#546E7A', align: 'end' },
            ],
          },
          // 產品名稱
          {
            type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingBottom: '12px',
            contents: [{ type: 'text', text: product.name, weight: 'bold', size: 'lg', color: '#FFFFFF', wrap: true }],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          // 利率 + 月付金
          {
            type: 'box', layout: 'horizontal', backgroundColor: M, paddingAll: '16px',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                contents: [
                  { type: 'text', text: product.rateRange, weight: 'bold', size: 'md', color: ACCENT, wrap: true, align: 'center' },
                  { type: 'text', text: '利率範圍', size: 'xxs', color: '#78909C', align: 'center' },
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
          // 方案特色
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: '方案特色', size: 'xs', color: '#78909C', weight: 'bold' },
              ...product.features.slice(0, 3).map((f) => ({
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '◆', size: 'xs', color: ACCENT, flex: 0 },
                  { type: 'text', text: f, size: 'xs', color: '#B0BEC5', flex: 1, wrap: true },
                ],
              })),
              { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#1E3A5F', margin: 'sm', contents: [{ type: 'filler' }] },
              // 適用資格
              { type: 'text', text: '適用資格', size: 'xs', color: '#78909C', weight: 'bold', margin: 'sm' },
              ...eligibilityLines.map((e) => ({
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '✓', size: 'xs', color: '#69F0AE', flex: 0 },
                  { type: 'text', text: e, size: 'xs', color: '#B0BEC5', flex: 1, wrap: true },
                ],
              })),
              { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#1E3A5F', margin: 'sm', contents: [{ type: 'filler' }] },
              { type: 'text', text: `💡 ${product.savingsHighlight}`, size: 'xs', color: '#69F0AE', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'secondary',
            action: { type: 'message', label: '重新試算', text: '重新開始' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 建構交叉銷售小卡 Flex Message */
function buildCrossSellFlex(
  crossSell: NonNullable<RecommendedProduct['crossSell']>,
  loanType: LoanType | null,
): LineReplyMessage {
  const D = '#0D1B2A'; const B = '#0A1628';
  const isMortgage = loanType === LoanType.MORTGAGE || loanType === LoanType.REVERSE_ANNUITY;

  const bubbles: unknown[] = [];

  if (crossSell.insurance) {
    bubbles.push({
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: D, spacing: 'sm',
        contents: [
          { type: 'text', text: '🛡️ 搭配保險', size: 'xs', color: '#CE93D8', weight: 'bold' },
          { type: 'text', text: crossSell.insurance.name, size: 'sm', color: '#FFFFFF', weight: 'bold', wrap: true },
          { type: 'text', text: `月繳 ${crossSell.insurance.price}`, size: 'sm', color: '#FFD54F' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '8px', backgroundColor: B,
        contents: [{ type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'message', label: '了解更多', text: '我想洽詢' },
        }],
      },
    });
  }

  if (crossSell.creditCard) {
    bubbles.push({
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: D, spacing: 'sm',
        contents: [
          { type: 'text', text: '💳 搭配信用卡', size: 'xs', color: isMortgage ? '#4FC3F7' : '#69F0AE', weight: 'bold' },
          { type: 'text', text: crossSell.creditCard.name, size: 'sm', color: '#FFFFFF', weight: 'bold', wrap: true },
          { type: 'text', text: `回饋 ${crossSell.creditCard.cashback}`, size: 'sm', color: '#FFD54F' },
          { type: 'text', text: `年費 ${crossSell.creditCard.fee}`, size: 'xs', color: '#78909C' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '8px', backgroundColor: B,
        contents: [{ type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'message', label: '了解更多', text: '我想洽詢' },
        }],
      },
    });
  }

  if (bubbles.length === 0) {
    return { type: 'text', text: '' }; // 無交叉銷售
  }

  return {
    type: 'flex',
    altText: '🎁 搭配方案推薦',
    contents: bubbles.length === 1
      ? bubbles[0] as Record<string, unknown>
      : { type: 'carousel', contents: bubbles } as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────────────────────
// 訊息發送 helpers
// ─────────────────────────────────────────────────────────────

/** 將 LineReplyMessage 陣列轉為 LINE SDK 格式並 Reply */
async function replyMessages(
  replyToken: string,
  messages: LineReplyMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const valid = messages.filter((m) => m.type !== 'text' || (m.text && m.text.length > 0));
  if (valid.length === 0) return;

  const lineMessages = toLineMessages(valid);
  await lineClient.replyMessage({
    replyToken,
    messages: lineMessages as Parameters<typeof lineClient.replyMessage>[0]['messages'],
  });
}

/** 使用 Push 推送訊息（reply token 已用完時） */
async function pushMessages(
  userId: string,
  messages: LineReplyMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const valid = messages.filter((m) => m.type !== 'text' || (m.text && m.text.length > 0));
  if (valid.length === 0) return;

  const lineMessages = toLineMessages(valid);
  await lineClient.pushMessage({
    to: userId,
    messages: lineMessages as Parameters<typeof lineClient.pushMessage>[0]['messages'],
  });
}

/** 轉換 LineReplyMessage 為 LINE SDK 格式 */
function toLineMessages(messages: LineReplyMessage[]): Record<string, unknown>[] {
  return messages.map((msg) => {
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
}

// ─────────────────────────────────────────────────────────────
// 完整審核流程（Workflow Integration）
// ─────────────────────────────────────────────────────────────

/** 從 session 建構 FullReviewRequest（不完整資料補預設值） */
function buildWorkflowFromSession(session: UserSession): FullReviewRequest | null {
  const { basicInfo, propertyInfo, loanType } = session;
  if (
    !basicInfo.amount ||
    !basicInfo.termYears ||
    !basicInfo.income ||
    !basicInfo.age ||
    !basicInfo.occupation
  ) {
    return null; // 關鍵資料缺失，無法建構請求
  }

  const isMortgage = loanType === LoanType.MORTGAGE;
  const occupation = basicInfo.occupation as OccupationType;
  const isPublicServant = [
    OccupationType.CIVIL_SERVANT,
    OccupationType.MILITARY,
    OccupationType.TEACHER,
  ].includes(occupation);

  const req: FullReviewRequest = {
    loanType: isMortgage ? 'mortgage' : 'personal',
    loanAmount: basicInfo.amount,
    termYears: basicInfo.termYears,
    borrower: {
      name: session.applicantName ?? '申請人',
      age: basicInfo.age,
      occupation,
      isPublicServant,
      yearsEmployed: 3,
      hasMyData: session.mydataReady === true,
      monthlyIncome: basicInfo.income,
    },
  };

  if (isMortgage) {
    req.property = {
      region: '台北市',
      isFirstHome: true,
      isOwnerOccupied: true,
      purpose: '購屋',
    };
    req.valuationInput = {
      areaPing: propertyInfo.areaPing ?? 30,
      propertyAge: propertyInfo.propertyAge ?? 10,
      buildingType: (propertyInfo.buildingType as string) ?? '大樓',
      floor: propertyInfo.floor ?? 5,
      hasParking: propertyInfo.hasParking ?? false,
      layout: propertyInfo.layout ?? '3房2廳',
    };
  }

  return req;
}

/** 非同步觸發完整審核流程，完成後 Push 結果 */
async function triggerWorkflowAsync(userId: string, session: UserSession): Promise<void> {
  const workflowReq = buildWorkflowFromSession(session);
  if (!workflowReq) {
    console.warn('[conversationHandler] 申請資料不完整，略過 Workflow 觸發');
    return;
  }

  // 先 push 「審核中」提示
  await pushMessages(userId, [{
    type: 'text',
    text: '🔍 您的申請已送出！\n\nAI 審核小組正在進行三階段完整評估：\n① ML 鑑價分析\n② 5P 徵審引擎\n③ 授信審議小組\n\n預計需要 30~60 秒，請稍候...',
  }]);

  const result = await runFullReview(workflowReq);
  await pushMessages(userId, [buildAuditResultFlex(result)]);
}

/** 建構審核結果 Flex 卡片 */
function buildAuditResultFlex(result: FullReviewResponse): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const { finalSummary, applicationId, totalDurationMs } = result;
  const { decision, approvedAmount, approvedTermYears, interestRateHint, conditions, riskScore, fraudLevel } = finalSummary;

  const decisionColor =
    decision === '核准' ? '#69F0AE' : decision === '有條件核准' ? '#FFD54F' : '#EF5350';
  const decisionIcon =
    decision === '核准' ? '✅' : decision === '有條件核准' ? '⚠️' : '❌';
  const fraudIcon =
    fraudLevel === 'normal' ? '🟢 正常' : fraudLevel === 'caution' ? '🟡 注意' : '🔴 警示';

  const rows = [
    { label: '核准金額', value: `NT$ ${approvedAmount.toLocaleString()}` },
    { label: '核准年限', value: `${approvedTermYears} 年` },
    { label: '建議利率', value: interestRateHint },
    { label: '5P 風控評分', value: `${riskScore} / 100` },
    { label: '防詐查核', value: fraudIcon },
  ];

  if (finalSummary.estimatedValue) {
    rows.splice(2, 0, {
      label: '鑑估值',
      value: `NT$ ${finalSummary.estimatedValue.toLocaleString()}`,
    });
  }
  if (finalSummary.ltvRatio !== undefined) {
    rows.splice(3, 0, {
      label: '貸款成數',
      value: `${(finalSummary.ltvRatio * 100).toFixed(1)}%`,
    });
  }

  const conditionItems = conditions.length > 0
    ? conditions.map((c) => ({
        type: 'box', layout: 'horizontal', spacing: 'sm',
        contents: [
          { type: 'text', text: '•', size: 'xs', color: '#FFD54F', flex: 0 },
          { type: 'text', text: c, size: 'xs', color: '#B0BEC5', flex: 1, wrap: true },
        ],
      }))
    : [{ type: 'text', text: '無附加條件', size: 'xs', color: '#78909C' }];

  return {
    type: 'flex',
    altText: `${decisionIcon} AI 審核結果：${decision}`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          // 標題
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
            contents: [
              { type: 'text', text: `${decisionIcon} AI 授信審議結果`, weight: 'bold', size: 'md', color: '#FFFFFF' },
              { type: 'text', text: `案件編號：${applicationId}`, size: 'xxs', color: '#546E7A' },
            ],
          },
          // 決議橫幅
          {
            type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: M,
            contents: [
              { type: 'text', text: decision, weight: 'bold', size: 'xl', color: decisionColor, align: 'center' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: decisionColor, contents: [{ type: 'filler' }] },
          // 數字明細
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', backgroundColor: M,
            contents: rows.map((r) => ({
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: r.label, size: 'sm', color: '#90A4AE', flex: 4 },
                { type: 'text', text: r.value, size: 'sm', color: '#FFFFFF', weight: 'bold', flex: 6, wrap: true },
              ],
            })),
          },
          // 附加條件
          ...(conditions.length > 0 ? [{
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: '附加條件', size: 'xs', color: '#78909C', weight: 'bold' },
              ...conditionItems,
            ],
          } as Record<string, unknown>] : []),
          // 頁尾資訊
          {
            type: 'box', layout: 'vertical', paddingAll: '12px',
            contents: [
              { type: 'text', text: `⏱ 審核耗時：${(totalDurationMs / 1000).toFixed(1)} 秒`, size: 'xxs', color: '#546E7A' },
              { type: 'text', text: '本結果由 AI 模擬，實際核貸依行員審查為準', size: 'xxs', color: '#37474F', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '📋 法規問答', text: '法規問答' },
          },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '🔄 重新試算', text: '重新開始' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}
