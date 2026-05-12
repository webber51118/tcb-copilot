/**
 * INPUT: UserSession（對話記憶 + 客戶資料）、使用者訊息
 * OUTPUT: AI 生成的客服回覆文字
 * POS: 服務層，AI 諮詢模式核心邏輯（RAG + Memory Augmentation）
 */

import Anthropic from '@anthropic-ai/sdk';
import { UserSession, ChatMessage, LineReplyMessage } from '../models/types';
import { ragQuery } from './ragService';
import { LoanType, OccupationType } from '../models/enums';
import { getApplicationById } from '../config/applicationStore';

const MODEL = 'claude-sonnet-4-6';
const MAX_HISTORY = 10;

/** 職業中文對應 */
const OCCUPATION_LABEL: Record<string, string> = {
  [OccupationType.MILITARY]: '軍人',
  [OccupationType.CIVIL_SERVANT]: '公務員',
  [OccupationType.TEACHER]: '教師',
  [OccupationType.OFFICE_WORKER]: '上班族',
  [OccupationType.SELF_EMPLOYED]: '自營商',
  [OccupationType.OTHER]: '其他',
};

/** 貸款類型中文對應 */
const LOAN_TYPE_LABEL: Record<string, string> = {
  [LoanType.MORTGAGE]: '房屋貸款',
  [LoanType.PERSONAL]: '信用貸款',
  [LoanType.REVERSE_ANNUITY]: '以房養老',
};

/** 組裝客戶資料摘要 */
function buildClientSummary(session: UserSession): string {
  const lines: string[] = [];

  if (session.applicantName) lines.push(`姓名：${session.applicantName}`);
  if (session.loanType) lines.push(`有意申辦：${LOAN_TYPE_LABEL[session.loanType] ?? session.loanType}`);
  if (session.basicInfo.age) lines.push(`年齡：${session.basicInfo.age} 歲`);
  if (session.basicInfo.occupation) lines.push(`職業：${OCCUPATION_LABEL[session.basicInfo.occupation] ?? session.basicInfo.occupation}`);
  if (session.basicInfo.income) lines.push(`月收入：約 ${Math.round(session.basicInfo.income / 10000)} 萬元`);
  if (session.basicInfo.amount) lines.push(`有意申貸：${Math.round(session.basicInfo.amount / 10000)} 萬元`);
  if (session.basicInfo.termYears) lines.push(`貸款年限：${session.basicInfo.termYears} 年`);
  if (session.applicationId) {
    const app = getApplicationById(session.applicationId);
    if (app) {
      const STATUS_LABEL: Record<string, string> = {
        pending:   '待審核（剛送出，等待系統處理）',
        reviewing: '審核中（行員複核中，預計 3 個工作天完成）',
        approved:  '已核准（準備撥款，請洽分行確認撥款事宜）',
        rejected:  '未通過',
      };
      const statusText = STATUS_LABEL[app.status] ?? app.status;
      const rejectionNote = app.status === 'rejected' && app.rejectionReason
        ? `，原因：${app.rejectionReason}`
        : '';
      lines.push(`案件編號：${session.applicationId}`);
      lines.push(`案件狀態：${statusText}${rejectionNote}`);
      if (app.basicInfo.amount) lines.push(`申請金額：${Math.round(app.basicInfo.amount / 10000)} 萬元`);
    } else {
      lines.push(`案件編號：${session.applicationId}（查無資料，可能已逾期）`);
    }
  }
  if (session.recommendedProductId) lines.push(`已推薦方案：${session.recommendedProductId}`);

  return lines.length > 0
    ? lines.join('\n')
    : '（尚未填寫個人資料）';
}

/** 組裝對話歷史摘要（最近 5 輪） */
function buildHistorySummary(history: ChatMessage[]): string {
  if (history.length === 0) return '（本次對話剛開始）';
  return history
    .slice(-10)
    .map(m => `${m.role === 'user' ? '客戶' : 'AI'}：${m.content}`)
    .join('\n');
}

/** 核心函式：生成 AI 諮詢回覆 */
export async function buildAiConsultingResponse(
  session: UserSession,
  userMessage: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // 1. 知識庫 RAG 查詢
  let ragContext = '';
  try {
    const loanTypeForRag = session.loanType === LoanType.MORTGAGE ? 'mortgage'
      : session.loanType === LoanType.PERSONAL ? 'personal'
      : undefined;
    const ragResult = await ragQuery({
      question: userMessage,
      loanType: loanTypeForRag,
    });
    if (ragResult.success && ragResult.answer) {
      ragContext = ragResult.answer;
    }
  } catch {
    // RAG 失敗不中斷，繼續用 LLM 知識回答
  }

  // 2. 組 system prompt
  const systemPrompt = `你是合作金庫銀行個金 Co-Pilot 智能客服，以親切、專業的繁體中文協助客戶解答個人金融問題。

【客戶本次資料】
${buildClientSummary(session)}

【本次對話紀錄】
${buildHistorySummary(session.chatHistory)}

【相關法規知識】
${ragContext || '（無相關知識庫命中，請依一般金融知識回答）'}

回覆原則：
1. 使用繁體中文，語氣親切但專業
2. 如有知識庫資料，優先引用並標註依據
3. 涉及具體數字（利率、成數、額度）需精確
4. 最終信貸決策建議客戶洽詢分行行員確認
5. 回答簡潔，不超過 200 字`;

  // 3. 呼叫 LLM
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('AI 回應格式異常');
  return content.text;
}

/** 建構 AI 諮詢歡迎 Flex 訊息 */
export function buildAiConsultingWelcome(): LineReplyMessage {
  return {
    type: 'flex',
    altText: '💬 AI 諮詢模式已啟動，請輸入您的問題',
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          { type: 'text', text: '💬 AI 智能客服', weight: 'bold', size: 'lg', color: '#1B4F8A' },
          { type: 'text', text: '您好！我是個金 Co-Pilot 智能客服，能為您解答貸款相關問題。', size: 'sm', color: '#334155', wrap: true },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md',
            contents: [
              { type: 'text', text: '您可以問我：', size: 'xs', color: '#64748B', weight: 'bold' },
              { type: 'text', text: '• 青安貸款利率是多少？', size: 'xs', color: '#475569', wrap: true },
              { type: 'text', text: '• 我的條件符合房貸資格嗎？', size: 'xs', color: '#475569', wrap: true },
              { type: 'text', text: '• 我的申請案件進度如何？', size: 'xs', color: '#475569', wrap: true },
              { type: 'text', text: '• DBR 怎麼計算？', size: 'xs', color: '#475569', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{
          type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'message', label: '返回主選單', text: '返回主選單' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 更新 session 對話歷史（append + 截斷至 MAX_HISTORY 輪） */
export function appendChatHistory(
  session: UserSession,
  userMsg: string,
  assistantMsg: string,
): void {
  if (!session.chatHistory) session.chatHistory = [];
  session.chatHistory.push({ role: 'user', content: userMsg });
  session.chatHistory.push({ role: 'assistant', content: assistantMsg });
  if (session.chatHistory.length > MAX_HISTORY * 2) {
    session.chatHistory = session.chatHistory.slice(-(MAX_HISTORY * 2));
  }
}
