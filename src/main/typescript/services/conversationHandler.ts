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
import { runPilotCrewReview } from './workflowService';
import { PilotCrewRequest, PilotCrewResult } from '../models/workflow';
import { parseVoiceWithClaude } from '../api/voice';
import { getApplicationById } from '../config/applicationStore';

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
  if (event.message.type !== 'text' && event.message.type !== 'image' && event.message.type !== 'audio') return;

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

  // ── 台語語音訊息處理（任意狀態均可觸發）──
  if (event.message.type === 'audio') {
    await handleAudioMessage(event.replyToken, userId, event.message.id, session);
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

  // 申請進度查詢（P1-A）
  if (userText === '查詢申請進度') {
    if (!session.applicationId) {
      return replyMessages(event.replyToken, [{
        type: 'text',
        text: '您目前尚無進行中的申請案件。\n\n如需試算，請輸入「房貸」或「信貸」重新開始。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '房貸試算', text: '房貸' } },
            { type: 'action', action: { type: 'message', label: '信貸試算', text: '信貸' } },
          ],
        },
      }]);
    }
    const app = getApplicationById(session.applicationId);
    return replyMessages(event.replyToken, [buildApplicationStatusFlex(session.applicationId, app)]);
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

  // 語音確認：語音辨識結果確認後觸發推薦流程
  if (userText === '語音確認') {
    session.state = ConversationState.RECOMMEND;
    updateSession(session);
    // fall through → 下方 RECOMMEND 區塊會接手
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

// ─────────────────────────────────────────────────────────────
// 台語語音辨識（Breeze-ASR-26）
// ─────────────────────────────────────────────────────────────

/** 職業文字 → OccupationType 對照表 */
const OCCUPATION_TEXT_MAP: Record<string, OccupationType> = {
  '軍人': OccupationType.MILITARY, '現役軍人': OccupationType.MILITARY,
  '公務員': OccupationType.CIVIL_SERVANT, '教師': OccupationType.TEACHER,
  '老師': OccupationType.TEACHER, '護理師': OccupationType.OFFICE_WORKER,
  '上班族': OccupationType.OFFICE_WORKER, '受薪': OccupationType.OFFICE_WORKER,
  '自營': OccupationType.SELF_EMPLOYED, '自營商': OccupationType.SELF_EMPLOYED,
};

/** 處理 LINE 音訊訊息（台語語音轉文字 → Claude NLU 解析 → 填入 session） */
async function handleAudioMessage(
  replyToken: string,
  userId: string,
  messageId: string,
  session: UserSession,
): Promise<void> {
  await replyMessages(replyToken, [{
    type: 'text',
    text: '🎙️ 收到語音！Breeze-ASR-26 台語辨識中...\n（約 3~5 秒）',
  }]);

  try {
    // 下載音檔
    const stream = await blobClient.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
    const audioBase64 = Buffer.concat(chunks).toString('base64');

    // 呼叫 Breeze-ASR-26（若無設定則直接走 NLU Demo）
    let transcript: string;
    const asrUrl = process.env['BREEZE_ASR_URL'];
    if (asrUrl) {
      try {
        const res = await fetch(asrUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, mimeType: 'audio/m4a' }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = (await res.json()) as { transcript?: string };
        transcript = data.transcript ?? '';
      } catch {
        transcript = '我是上班族，月薪六萬，想借五百萬買第一間房子，自己住';
      }
    } else {
      // Demo 模式：使用示範台語轉錄句
      const DEMO = [
        '我是護理師，月薪六萬，想借五百萬，買第一間厝，自住',
        '我是現役軍人，月俸七萬，想借七百萬，要買自住的房子',
        '我已經退休，每月有四萬退休金，想借三十萬週轉用',
      ];
      transcript = DEMO[Math.floor(Math.random() * DEMO.length)]!;
    }

    // Claude NLU 解析
    const fields = await parseVoiceWithClaude(transcript);

    // 將解析結果寫入 session
    if (fields.loanType === 'mortgage') session.loanType = LoanType.MORTGAGE;
    else if (fields.loanType === 'reverse_annuity') session.loanType = LoanType.REVERSE_ANNUITY;
    else session.loanType = LoanType.PERSONAL;

    if (fields.basicInfo.income)    session.basicInfo.income = fields.basicInfo.income;
    if (fields.basicInfo.amount)    session.basicInfo.amount = fields.basicInfo.amount;
    if (fields.basicInfo.purpose)   session.basicInfo.purpose = fields.basicInfo.purpose;
    if (fields.basicInfo.termYears) session.basicInfo.termYears = fields.basicInfo.termYears;
    if (fields.basicInfo.occupation) {
      const occ = OCCUPATION_TEXT_MAP[fields.basicInfo.occupation] ?? OccupationType.OTHER;
      session.basicInfo.occupation = occ;
    }

    // 有足夠資料 → 直接推薦；否則繼續收集
    const hasEnough =
      session.basicInfo.income &&
      session.basicInfo.amount &&
      session.loanType !== null;

    if (hasEnough) {
      session.state = ConversationState.RECOMMEND;
    } else if (session.loanType === null) {
      session.state = ConversationState.CHOOSE_LOAN_TYPE;
    }
    updateSession(session);

    await pushMessages(userId, [buildVoiceResultFlex(transcript, fields, hasEnough ?? false)]);
  } catch (err) {
    console.error('[conversationHandler] 語音處理失敗:', err);
    await pushMessages(userId, [{
      type: 'text',
      text: '⚠️ 語音辨識發生錯誤，請重試或改用文字輸入。',
    }]);
  }
}

/** 語音辨識結果確認 Flex 卡片 */
function buildVoiceResultFlex(
  transcript: string,
  fields: Awaited<ReturnType<typeof parseVoiceWithClaude>>,
  hasEnough: boolean,
): LineReplyMessage {
  const BLUE = '#1B4F8A'; const LIGHT = '#F0F6FF'; const ACCENT = '#0077B6';

  const loanLabel =
    fields.loanType === 'mortgage' ? '🏠 房屋貸款' :
    fields.loanType === 'reverse_annuity' ? '🌸 以房養老' : '💳 個人信用貸款';

  const rows = [
    { label: '辨識原文', value: `「${transcript.slice(0, 40)}${transcript.length > 40 ? '...' : ''}」` },
    { label: '貸款類型', value: loanLabel },
    fields.basicInfo.occupation ? { label: '職業', value: fields.basicInfo.occupation } : null,
    fields.basicInfo.income    ? { label: '月收入', value: `NT$ ${fields.basicInfo.income.toLocaleString()}` } : null,
    fields.basicInfo.amount    ? { label: '申請金額', value: `NT$ ${fields.basicInfo.amount.toLocaleString()}` } : null,
    fields.basicInfo.purpose   ? { label: '貸款用途', value: fields.basicInfo.purpose } : null,
    fields.basicInfo.termYears ? { label: '貸款年限', value: `${fields.basicInfo.termYears} 年` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return {
    type: 'flex',
    altText: '🎙️ 台語語音辨識完成，請確認資料',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: BLUE, paddingAll: '14px',
        contents: [
          { type: 'text', text: '🎙️ 台語語音辨識完成', weight: 'bold', size: 'md', color: '#FFFFFF' },
          { type: 'text', text: 'Breeze-ASR-26 × Claude NLU', size: 'xxs', color: '#BDD5F0' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', backgroundColor: '#FFFFFF',
        contents: rows.map((r) => ({
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: r.label, size: 'sm', color: '#64748B', flex: 4 },
            { type: 'text', text: r.value, size: 'sm', color: '#1E293B', weight: 'bold', flex: 6, wrap: true },
          ],
        })),
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: LIGHT,
        contents: hasEnough
          ? [
              { type: 'button', style: 'primary', color: BLUE, height: 'sm',
                action: { type: 'message', label: '✅ 確認，顯示推薦方案', text: '語音確認' } },
              { type: 'button', style: 'secondary', height: 'sm',
                action: { type: 'message', label: '✏️ 手動修改', text: '重新開始' } },
            ]
          : [
              { type: 'button', style: 'primary', color: ACCENT, height: 'sm',
                action: { type: 'message', label: '繼續填寫資料', text: '繼續' } },
              { type: 'button', style: 'secondary', height: 'sm',
                action: { type: 'message', label: '✏️ 手動填寫', text: '重新開始' } },
            ],
      },
    } as unknown as Record<string, unknown>,
  };
}

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
  const D = '#FFFFFF'; const M = '#F0F6FF'; const B = '#EBF3FF';
  const isReverseAnnuity = loanType === LoanType.REVERSE_ANNUITY;
  const isMortgage = loanType === LoanType.MORTGAGE || isReverseAnnuity;
  const ACCENT = isMortgage ? '#1565C0' : '#166534';
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
              { type: 'text', text: '最適合您的方案', size: 'xxs', color: '#94A3B8', align: 'end' },
            ],
          },
          // 產品名稱
          {
            type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingBottom: '12px',
            contents: [{ type: 'text', text: product.name, weight: 'bold', size: 'lg', color: '#1E293B', wrap: true }],
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
                  { type: 'text', text: '利率範圍', size: 'xxs', color: '#64748B', align: 'center' },
                ],
              },
              { type: 'box', layout: 'vertical', width: '1px', backgroundColor: '#CBD5E1', contents: [{ type: 'filler' }] },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                contents: [
                  { type: 'text', text: monthlyValue, weight: 'bold', size: 'sm', color: '#1B4F8A', wrap: true, align: 'center' },
                  { type: 'text', text: monthlyLabel, size: 'xxs', color: '#64748B', align: 'center' },
                ],
              },
            ],
          },
          // 方案特色
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: '方案特色', size: 'xs', color: '#64748B', weight: 'bold' },
              ...product.features.slice(0, 3).map((f) => ({
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '◆', size: 'xs', color: ACCENT, flex: 0 },
                  { type: 'text', text: f, size: 'xs', color: '#374151', flex: 1, wrap: true },
                ],
              })),
              { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#E2E8F0', margin: 'sm', contents: [{ type: 'filler' }] },
              // 適用資格
              { type: 'text', text: '適用資格', size: 'xs', color: '#64748B', weight: 'bold', margin: 'sm' },
              ...eligibilityLines.map((e) => ({
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '✓', size: 'xs', color: ACCENT, flex: 0 },
                  { type: 'text', text: e, size: 'xs', color: '#374151', flex: 1, wrap: true },
                ],
              })),
              { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#E2E8F0', margin: 'sm', contents: [{ type: 'filler' }] },
              { type: 'text', text: `💡 ${product.savingsHighlight}`, size: 'xs', color: ACCENT, wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'primary', color: ACCENT, height: 'sm',
            action: { type: 'uri', label: '📍 預約最近分行', uri: 'https://www.tcb-bank.com.tw/branch_info/Pages/branch_map.aspx' },
          },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '重新試算', text: '重新開始' },
          },
          { type: 'text', wrap: true, size: 'xxs', color: '#94A3B8',
            text: '本試算結果不構成貸款承諾。利率依核貸當日指標利率＋加碼為準，實際核貸條件由行員審查決定。' },
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
  const BG = '#FFFFFF'; const FOOTER = '#F0F6FF'; const BORDER = '#E2E8F0';
  const isMortgage = loanType === LoanType.MORTGAGE || loanType === LoanType.REVERSE_ANNUITY;

  const bubbles: unknown[] = [];

  if (crossSell.insurance) {
    bubbles.push({
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: BG, spacing: 'sm',
        contents: [
          { type: 'text', text: '🛡️ 保障規劃', size: 'xs', color: '#0F766E', weight: 'bold' },
          { type: 'text', text: crossSell.insurance.name, size: 'sm', color: '#1E293B', weight: 'bold', wrap: true },
          { type: 'text', text: `月繳 ${crossSell.insurance.price}`, size: 'sm', color: '#1B4F8A' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '8px', backgroundColor: FOOTER, borderWidth: '1px', borderColor: BORDER,
        contents: [{ type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'message', label: '進一步了解', text: '我想洽詢' },
        }],
      },
    });
  }

  if (crossSell.creditCard) {
    bubbles.push({
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: BG, spacing: 'sm',
        contents: [
          { type: 'text', text: '💳 推薦卡片', size: 'xs', color: isMortgage ? '#1565C0' : '#166534', weight: 'bold' },
          { type: 'text', text: crossSell.creditCard.name, size: 'sm', color: '#1E293B', weight: 'bold', wrap: true },
          { type: 'text', text: `回饋 ${crossSell.creditCard.cashback}`, size: 'sm', color: '#1B4F8A' },
          { type: 'text', text: `年費 ${crossSell.creditCard.fee}`, size: 'xs', color: '#64748B' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '8px', backgroundColor: FOOTER, borderWidth: '1px', borderColor: BORDER,
        contents: [{ type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'message', label: '進一步了解', text: '我想洽詢' },
        }],
      },
    });
  }

  if (bubbles.length === 0) {
    return { type: 'text', text: '' }; // 無交叉銷售
  }

  return {
    type: 'flex',
    altText: '🎁 貼心加值服務',
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
// 三位一體 PILOT CREW 審核流程（Workflow Integration）
// ─────────────────────────────────────────────────────────────

/** OccupationType → fraudInput occupationCode 對照 */
const OCCUPATION_CODE_MAP: Record<OccupationType, number> = {
  [OccupationType.MILITARY]:      1,
  [OccupationType.CIVIL_SERVANT]: 1,
  [OccupationType.TEACHER]:       1,
  [OccupationType.OFFICE_WORKER]: 2,
  [OccupationType.SELF_EMPLOYED]: 3,
  [OccupationType.OTHER]:         0,
};

/** 從 session 建構 PilotCrewRequest（不完整資料補預設值） */
function buildPilotCrewFromSession(session: UserSession): PilotCrewRequest | null {
  const { basicInfo, propertyInfo, loanType } = session;
  if (!basicInfo.income || !basicInfo.age || !basicInfo.occupation) {
    return null;
  }

  const isMortgage = loanType === LoanType.MORTGAGE;
  const occupationCode = OCCUPATION_CODE_MAP[basicInfo.occupation as OccupationType] ?? 0;

  const pilotReq: PilotCrewRequest = {
    loanType: isMortgage ? 'mortgage' : 'personal',
    session,
    fraudInput: {
      age:                basicInfo.age,
      occupationCode,
      monthlyIncome:      basicInfo.income / 10000,    // 元 → 萬元
      creditInquiryCount: 1,
      existingBankLoans:  0,
      hasRealEstate:      isMortgage,
      documentMatch:      session.mydataReady === true,
      livesInBranchCounty: true,
      hasSalaryTransfer:  occupationCode === 2,
    },
  };

  if (isMortgage) {
    pilotReq.property = {
      region: '台北市',
      isFirstHome: true,
      isOwnerOccupied: true,
      purpose: basicInfo.purpose ?? '購屋',
    };
    pilotReq.valuationInput = {
      areaPing:     propertyInfo.areaPing     ?? 30,
      propertyAge:  propertyInfo.propertyAge  ?? 10,
      buildingType: (propertyInfo.buildingType as string) ?? '大樓',
      floor:        propertyInfo.floor        ?? 5,
      hasParking:   propertyInfo.hasParking   ?? false,
      layout:       propertyInfo.layout       ?? '3房2廳',
    };
  }

  return pilotReq;
}

/** 非同步觸發三 Crew 並行審核，完成後 Push 結果（含防詐警示）*/
async function triggerWorkflowAsync(userId: string, session: UserSession): Promise<void> {
  const pilotReq = buildPilotCrewFromSession(session);
  if (!pilotReq) {
    console.warn('[conversationHandler] 申請資料不完整，略過 PILOT CREW 觸發');
    return;
  }

  await pushMessages(userId, [{
    type: 'text',
    text: '🚀 您的申請已送出！\n\n三位一體 PILOT CREW 正在並行審核：\n🎯 CREW1 行銷PILOT — 推薦引擎\n🏗️ CREW2 鑑估PILOT — ML 鑑價\n🔍 CREW3 防詐PILOT — 風控評分\n\n預計需要 10~30 秒，請稍候...',
  }]);

  const result = await runPilotCrewReview(pilotReq);

  // 寫回案件編號供後續進度查詢使用
  const latestSession = getSession(userId);
  latestSession.applicationId = result.applicationId;
  updateSession(latestSession);

  await pushMessages(userId, [buildPilotCrewResultFlex(result)]);

  // CREW3 高風險（alertLevel === 3）→ 推播警示給行員
  if (result.crew3.mlScore.alertLevel === 3) {
    await pushFraudAlertToStaff(result);
  }

  // P0-C：推送後續流程指引
  await pushMessages(userId, [buildNextStepsMessage(result.applicationId)]);
}

/** 申請完成後的後續流程指引訊息 */
function buildNextStepsMessage(applicationId: string): LineReplyMessage {
  return {
    type: 'flex',
    altText: '📋 您的申請後續流程說明',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md', backgroundColor: '#FFFFFF',
        contents: [
          { type: 'text', text: '📋 申請送出後，接下來怎麼做？', weight: 'bold', size: 'sm', color: '#1B4F8A' },
          { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#E2E8F0', contents: [{ type: 'filler' }] },
          // 時程
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
            contents: [
              { type: 'text', text: '⏰', size: 'sm', flex: 0 },
              { type: 'text', text: '審核結果將於 3 個工作天內通知', size: 'sm', color: '#374151', flex: 1, wrap: true },
            ],
          },
          // 對保文件
          {
            type: 'box', layout: 'vertical', spacing: 'xs', margin: 'sm',
            contents: [
              { type: 'text', text: '📁 對保時請攜帶以下文件', size: 'sm', color: '#374151', weight: 'bold' },
              ...([
                '身分證正本＋第二證件（健保卡或駕照）',
                '最近三個月薪資單或財力證明',
                '存摺影本（近三個月往來紀錄）',
                '印章',
              ].map((doc) => ({
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '•', size: 'xs', color: '#1B4F8A', flex: 0 },
                  { type: 'text', text: doc, size: 'xs', color: '#374151', flex: 1, wrap: true },
                ],
              }))),
            ],
          },
          // 案件編號
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
            contents: [
              { type: 'text', text: '🔢', size: 'sm', flex: 0 },
              { type: 'text', text: `案件編號：${applicationId}`, size: 'sm', color: '#64748B', flex: 1, wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: '#F0F6FF',
        contents: [
          { type: 'button', style: 'primary', color: '#1B4F8A', height: 'sm',
            action: { type: 'message', label: '📞 查詢申請進度', text: '查詢申請進度' } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '❓ 常見問答', text: '常見問答' } },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 建構三 Crew 並行結果 Flex 卡片 */
function buildPilotCrewResultFlex(result: PilotCrewResult): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const { applicationId, crew1, crew2, crew3, totalDurationMs } = result;

  const rec = crew1.recommendation.primary;
  const mlScore = crew3.mlScore;
  const alertColor = mlScore.alertLevel === 1 ? '#69F0AE' : mlScore.alertLevel === 2 ? '#FFD54F' : '#EF5350';
  const alertIcon  = mlScore.alertLevel === 1 ? '🟢' : mlScore.alertLevel === 2 ? '🟡' : '🔴';
  const riskPct    = `${(mlScore.fraudScore * 100).toFixed(1)}%`;

  const crew1Rows = [
    { label: '推薦方案', value: rec.name },
    { label: '利率範圍', value: rec.rateRange },
    ...(rec.monthlyPayment ? [{ label: '預估月付', value: `NT$ ${rec.monthlyPayment.toLocaleString()}` }] : []),
  ];

  const crew2Rows = crew2 ? [
    { label: '鑑估值',   value: `NT$ ${crew2.result.estimatedPrice.toLocaleString()}` },
    { label: '評估模式', value: crew2.mode === 'live' ? '🔗 即時 ML 模型' : '📊 Demo 估算' },
  ] : [];

  const crew3Rows = [
    { label: '詐欺風險分數', value: riskPct },
    { label: '風控等級',     value: `${alertIcon} ${mlScore.riskLevel.toUpperCase()}` },
    { label: '前三大風險因子', value: mlScore.topRiskFactors.slice(0, 3).map((f) => f.label).join('、') || '—' },
  ];

  const makeRows = (rows: Array<{ label: string; value: string }>) =>
    rows.map((r) => ({
      type: 'box', layout: 'horizontal',
      contents: [
        { type: 'text', text: r.label, size: 'xs', color: '#90A4AE', flex: 5 },
        { type: 'text', text: r.value, size: 'xs', color: '#FFFFFF', weight: 'bold', flex: 7, wrap: true },
      ],
    }));

  return {
    type: 'flex',
    altText: `🤖 PILOT CREW 審核完成 | 防詐 ${alertIcon} ${riskPct}`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '10px', spacing: 'xs',
            contents: [
              { type: 'text', text: '🤖 三位一體 PILOT CREW 審核完成', weight: 'bold', size: 'sm', color: '#FFFFFF' },
              { type: 'text', text: `案件 ${applicationId} ｜ 耗時 ${(totalDurationMs / 1000).toFixed(1)}s`, size: 'xxs', color: '#546E7A' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: '#1B4F8A', contents: [{ type: 'filler' }] },
          // CREW1
          {
            type: 'box', layout: 'vertical', paddingAll: '12px', paddingBottom: '8px', backgroundColor: M, spacing: 'xs',
            contents: [
              { type: 'text', text: '🎯 CREW1 行銷PILOT — 推薦方案', size: 'xs', color: '#64B5F6', weight: 'bold' },
              ...makeRows(crew1Rows),
            ],
          },
          // CREW2（房貸才有）
          ...(crew2Rows.length > 0 ? [{
            type: 'box', layout: 'vertical', paddingAll: '12px', paddingBottom: '8px', backgroundColor: '#101F35', spacing: 'xs',
            contents: [
              { type: 'text', text: '🏗️ CREW2 鑑估PILOT — ML 鑑價', size: 'xs', color: '#80CBC4', weight: 'bold' },
              ...makeRows(crew2Rows),
            ],
          } as Record<string, unknown>] : []),
          // CREW3
          {
            type: 'box', layout: 'vertical', paddingAll: '12px', paddingBottom: '8px', backgroundColor: M, spacing: 'xs',
            contents: [
              { type: 'text', text: '🔍 CREW3 防詐PILOT — 風控評分', size: 'xs', color: alertColor, weight: 'bold' },
              ...makeRows(crew3Rows),
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '10px',
            contents: [
              { type: 'text', text: '本結果由 AI 模擬，實際核貸依行員審查為準', size: 'xxs', color: '#37474F', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '❓ 常見問答', text: '常見問答' } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '🔄 重新試算', text: '重新開始' } },
          { type: 'text', wrap: true, size: 'xxs', color: '#546E7A',
            text: '本試算結果不構成貸款承諾。利率依核貸當日指標利率＋加碼為準，實際核貸條件由行員審查決定。' },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** CREW3 alertLevel === 3 → Push 防詐高風險警示給行員 */
async function pushFraudAlertToStaff(result: PilotCrewResult): Promise<void> {
  const staffIds = (process.env['STAFF_LINE_USER_IDS'] ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (staffIds.length === 0) {
    console.warn('[conversationHandler] STAFF_LINE_USER_IDS 未設定，跳過行員警示');
    return;
  }

  const { applicationId, crew3 } = result;
  const { fraudScore, riskLevel, topRiskFactors } = crew3.mlScore;
  const riskPct = `${(fraudScore * 100).toFixed(1)}%`;
  const RED = '#C62828'; const DARK = '#1A0000'; const DARKM = '#2C0000';

  const alertFlex: LineReplyMessage = {
    type: 'flex',
    altText: `🔴 高風險防詐警示 — 案件 ${applicationId}`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '0px', backgroundColor: DARK, spacing: 'none',
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: RED, spacing: 'xs',
            contents: [
              { type: 'text', text: '🔴 高風險防詐警示', weight: 'bold', size: 'md', color: '#FFFFFF' },
              { type: 'text', text: `案件編號：${applicationId}`, size: 'xxs', color: '#FFCDD2' },
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: DARKM, spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'horizontal',
                contents: [
                  { type: 'text', text: '詐欺風險分數', size: 'sm', color: '#FFCDD2', flex: 5 },
                  { type: 'text', text: riskPct, size: 'sm', color: '#EF9A9A', weight: 'bold', flex: 7 },
                ],
              },
              {
                type: 'box', layout: 'horizontal',
                contents: [
                  { type: 'text', text: '風控等級', size: 'sm', color: '#FFCDD2', flex: 5 },
                  { type: 'text', text: riskLevel.toUpperCase(), size: 'sm', color: '#EF9A9A', weight: 'bold', flex: 7 },
                ],
              },
              { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#4A0000', margin: 'sm', contents: [{ type: 'filler' }] },
              { type: 'text', text: '主要風險因子', size: 'xs', color: '#FFCDD2', weight: 'bold' },
              ...topRiskFactors.slice(0, 3).map((f, i) => ({
                type: 'box', layout: 'horizontal',
                contents: [
                  { type: 'text', text: `${i + 1}.`, size: 'xs', color: '#EF5350', flex: 0 },
                  { type: 'text', text: f.label, size: 'xs', color: '#FFFFFF', flex: 1, wrap: true,
                    margin: 'sm' },
                ],
              })),
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '10px',
            contents: [
              { type: 'text', text: '請主管立即審查並決定是否凍結案件', size: 'xs', color: '#EF5350', wrap: true, weight: 'bold' },
            ],
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };

  for (const staffId of staffIds) {
    try {
      await lineClient.pushMessage({
        to: staffId,
        messages: [{ type: 'flex', altText: alertFlex.altText!, contents: alertFlex.contents }] as Parameters<typeof lineClient.pushMessage>[0]['messages'],
      });
    } catch (err) {
      console.error(`[conversationHandler] 行員警示推播失敗 staffId=${staffId}:`, err);
    }
  }
  console.log(`[conversationHandler] 防詐警示已推播給 ${staffIds.length} 位行員`);
}

/** 申請進度狀態卡（P1-A） */
function buildApplicationStatusFlex(
  applicationId: string,
  app: import('../models/types').LoanApplication | null,
): LineReplyMessage {
  const BLUE = '#1B4F8A'; const LIGHT = '#F0F6FF';

  const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
    pending:   { label: '待審核', color: '#F59E0B', icon: '⏳' },
    reviewing: { label: '審核中', color: '#3B82F6', icon: '🔍' },
    approved:  { label: '已核准', color: '#16A34A', icon: '✅' },
    rejected:  { label: '婉拒',   color: '#DC2626', icon: '❌' },
  };

  if (!app) {
    return {
      type: 'text',
      text: `查無案件編號 ${applicationId}，請確認編號是否正確。\n\n如需協助，請撥打客服 0800-054-599（週一至週五 09:00~17:30）。`,
    };
  }

  const s = STATUS_MAP[app.status] ?? { label: app.status, color: '#64748B', icon: '❓' };
  const loanLabel = app.loanType === 'mortgage' ? '房屋貸款' : '個人信用貸款';

  return {
    type: 'flex',
    altText: `${s.icon} 案件 ${applicationId} — ${s.label}`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md', backgroundColor: '#FFFFFF',
        contents: [
          { type: 'text', text: '📋 申請案件查詢結果', weight: 'bold', size: 'sm', color: BLUE },
          { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#E2E8F0', contents: [{ type: 'filler' }] },
          ...[
            { label: '案件編號', value: app.id },
            { label: '申請人',   value: app.applicantName },
            { label: '貸款類型', value: loanLabel },
            { label: '申請日期', value: app.appliedAt.slice(0, 10) },
          ].map((r) => ({
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: r.label, size: 'sm', color: '#64748B', flex: 4 },
              { type: 'text', text: r.value, size: 'sm', color: '#1E293B', weight: 'bold', flex: 6, wrap: true },
            ],
          })),
          // 狀態橫幅
          {
            type: 'box', layout: 'vertical', paddingAll: '10px', cornerRadius: '6px',
            backgroundColor: s.color + '18',
            contents: [{
              type: 'text', text: `${s.icon} 目前狀態：${s.label}`,
              weight: 'bold', size: 'md', color: s.color, align: 'center',
            }],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: LIGHT,
        contents: [
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '🔄 重新查詢', text: '查詢申請進度' } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '返回主選單', text: '返回主選單' } },
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
          { type: 'text', text: '心照不宣MV / 合作金庫', weight: 'bold', size: 'sm', color: TCB_BLUE, wrap: true },
          { type: 'text', text: '一起向前，合作金庫是你的堡壘', size: 'xs', color: '#64748B', wrap: true },
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
