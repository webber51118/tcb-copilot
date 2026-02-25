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
import { runFullReview } from './workflowService';
import { FullReviewRequest, FullReviewResponse } from '../models/workflow';

/** LINE Blob 客戶端（用於下載圖片內容） */
const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

/** 處理單一 webhook 事件 */
export async function handleEvent(event: WebhookEvent): Promise<void> {
  // ── 新用戶加入好友：先送介紹影片，再送主選單 ──
  if (event.type === 'follow') {
    const userId = event.source.userId;
    if (!userId) return;
    const session = getSession(userId);
    const menuResult = transition(session, '');
    session.state = menuResult.nextState;
    updateSession(session);
    await replyMessages(event.replyToken, [
      buildIntroVideoFlex(),
      ...menuResult.messages,
    ]);
    return;
  }

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

  // 全域貸款類型切換：任何狀態下輸入「房貸」或「信貸」都能重新進入產品介紹
  if (userText === '房貸' || userText === '信貸') {
    session.loanType = userText === '房貸' ? LoanType.MORTGAGE : LoanType.PERSONAL;
    session.state = ConversationState.CHOOSE_LOAN_TYPE;
    updateSession(session);
    const loanResult = transition(session, userText);
    session.state = loanResult.nextState;
    updateSession(session);
    return replyMessages(event.replyToken, loanResult.messages);
  }

  // 房貸壽險專區（全域可用）
  if (userText === '房貸壽險') {
    return replyMessages(event.replyToken, [{
      type: 'text',
      text: '🛡️ 房貸壽險專區\n\n房貸壽險是隨貸款餘額**遞減型定期壽險**，保障被保險人在貸款期間發生身故或全殘時，由保險理賠金償還剩餘貸款，讓家人不受債務壓力。\n\n✅ 主要優點：\n• 保費隨餘額遞減，越繳越少\n• 保障與貸款同步，不多繳不浪費\n• 萬一不幸，家人無需擔憂房貸\n\n📞 洽詢合庫房貸壽險方案，請至各分行諮詢，或繼續申辦房貸。',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '房貸試算', text: '房貸' } },
          { type: 'action', action: { type: 'message', label: '我想洽詢', text: '我想洽詢' } },
          { type: 'action', action: { type: 'message', label: '返回主選單', text: '返回主選單' } },
        ],
      },
    }]);
  }

  // 貸款常見問答入口（全域可用）
  if (userText === '常見問答' || userText === '貸款常見問答') {
    return replyMessages(event.replyToken, [{
      type: 'text',
      text: '❓ 貸款常見問答\n\n請選擇您想了解的問題：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '申請需要什麼文件', text: '問答:申請文件' } },
          { type: 'action', action: { type: 'message', label: '對保需要帶什麼', text: '問答:對保資料' } },
          { type: 'action', action: { type: 'message', label: '一定要有保證人嗎', text: '問答:保證人' } },
          { type: 'action', action: { type: 'message', label: '什麼是指標利率', text: '問答:指標利率' } },
        ],
      },
    }]);
  }

  // 貸款常見問答查詢（「問答:」前綴）
  if (userText.startsWith('問答:')) {
    const faqKey = userText.slice(3).trim();
    const faqMap: Record<string, string> = {
      '申請文件': '📋 申請貸款所需文件\n\n【基本文件】\n• 身分證正本 + 第二證件（健保卡／駕照）\n• 印章、戶籍謄本或戶口名簿\n• 買賣契約影本（房貸適用）\n\n【財力證明】\n• 最近一年綜合所得稅各類所得資料清單\n• 薪資轉帳存摺影本\n• 在職證明\n• 不動產所有權狀影本（房貸）\n• 最近一個月國稅局財產歸戶清單\n\n（資料來源：合庫銀行官網）',
      '對保資料': '📝 對保時需攜帶以下資料\n\n• 借款人身分證正本\n• 保證人身分證正本（如需保證人）\n• 第二證件：駕照或健保卡\n• 印章\n\n對保時間通常約 30 分鐘，建議提前預約。\n\n（資料來源：合庫銀行官網）',
      '保證人': '👥 關於保證人\n\n本行依據借款人的：\n• 個人信用狀況\n• 財資力狀況\n• 還款能力\n\n綜合審核後，再決定是否需要徵取保證人。\n\n信用狀況良好、收入穩定的客戶，通常不需要提供保證人。\n\n（資料來源：合庫銀行官網）',
      '指標利率': '📊 什麼是貸款指標利率？\n\n貸款利率 = 指標利率（浮動）＋ 利率加碼（固定）\n\n• **指標利率**：由央行政策決定，每月或每季調整\n• **利率加碼**：銀行依您的信用與條件個別訂定\n\n因此，當指標利率上升時，每月還款金額也會增加；反之則減少。建議在申辦前確認目前適用利率。\n\n（資料來源：合庫銀行官網）',
      '青安貸款': '🏠 青安貸款條件\n\n【申請資格】\n• 本人或配偶年齡 40 歲以下\n• 購買第一棟自住住宅\n• 無自有房屋（或配偶無自有房屋）\n\n【優惠條件】\n• 最低利率：2.275%\n• 最高貸款：1,000 萬元\n• 最長期間：40 年\n• 寬限期：最長 5 年\n\n🌟 為政策性優惠貸款，額度有限。',
      '房貸成數': '🏦 房貸最高可以貸幾成？\n\n【第一戶自住】\n• 一般：約 7～8 成\n• 青安貸款：最高 8 成\n\n【第二戶以上】\n• 受央行選擇性信用管制，最高 6 成\n• 台北市、新北市特定地區更嚴格\n\n【以房養老（反向抵押）】\n• 最高約 7 成估值\n• 按月撥付，無需還款',
      'DBR': '📏 DBR 上限是多少？\n\n DBR（Debt Burden Ratio）= 所有無擔保貸款月付金 ÷ 月收入\n\n依金融監管規定：\n• **無擔保貸款（信貸）DBR 不得超過 22 倍**\n  即月付金總額 ≤ 月收入 × 22\n\n例：月收入 50,000 元\n→ 信貸月付金上限約 50,000 × 22 / 12 ≈ 91,667 元\n\n房貸屬有擔保貸款，另以負債比率（負債比 ≤ 85%）計算。',
    };
    const answer = faqMap[faqKey] || `抱歉，找不到「${faqKey}」的相關問答，請嘗試其他問題。`;
    return replyMessages(event.replyToken, [{
      type: 'text',
      text: answer,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '青安貸款條件', text: '問答:青安貸款' } },
          { type: 'action', action: { type: 'message', label: '房貸可貸幾成', text: '問答:房貸成數' } },
          { type: 'action', action: { type: 'message', label: 'DBR上限', text: '問答:DBR' } },
          { type: 'action', action: { type: 'message', label: '返回主選單', text: '返回主選單' } },
        ],
      },
    }]);
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
            action: { type: 'message', label: '❓ 常見問答', text: '常見問答' },
          },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '🔄 重新試算', text: '重新開始' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 加入好友時顯示的 YouTube 介紹影片 Flex 卡片 */
function buildIntroVideoFlex(): LineReplyMessage {
  const YOUTUBE_URL = 'https://www.youtube.com/watch?v=fFw6cGiyl58';
  const THUMBNAIL = 'https://img.youtube.com/vi/fFw6cGiyl58/hqdefault.jpg';
  const TCB_BLUE = '#1B4F8A';
  const WHITE = '#FFFFFF';

  return {
    type: 'flex',
    altText: '🎬 歡迎加入！先看看我們的服務介紹影片',
    contents: {
      type: 'bubble', size: 'mega',
      hero: {
        type: 'image',
        url: THUMBNAIL,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        action: { type: 'uri', label: '播放影片', uri: YOUTUBE_URL },
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: WHITE, paddingAll: '16px',
        contents: [
          { type: 'text', text: '🎬 合庫個金Co-Pilot 服務介紹', weight: 'bold', size: 'sm', color: TCB_BLUE, wrap: true },
          { type: 'text', text: '點擊影片，快速了解 AI 如何為您打造最適貸款方案！', size: 'xs', color: '#64748B', wrap: true },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: WHITE, paddingAll: '12px',
        contents: [{
          type: 'button', style: 'primary', color: TCB_BLUE,
          action: { type: 'uri', label: '▶ 立即觀看影片', uri: YOUTUBE_URL },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}
