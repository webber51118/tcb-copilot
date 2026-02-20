/**
 * INPUT: UserSession（當前狀態）、使用者輸入文字
 * OUTPUT: TransitionResult（下一狀態 + 回覆訊息）
 * POS: 核心模組，對話狀態機，控制整個對話流程的狀態轉移
 */

import { ConversationState, LoanType } from '../models/enums';
import { UserSession, TransitionResult, LineReplyMessage } from '../models/types';
import {
  parseLoanType, parseAge, parseOccupation, parseIncome,
  parsePurpose, parseTerm, parseAmount, parsePropertyAge,
  parseArea, parseParking, parseLayout, parseFloor, parseBuildingType,
  parseName, parsePhone,
} from '../utils/validators';
import {
  loanTypeQuickReply, occupationQuickReply,
  mortgagePurposeQuickReply, personalPurposeQuickReply,
  mortgageTermQuickReply, personalTermQuickReply,
  reverseAnnuityTermQuickReply,
  parkingQuickReply, buildingTypeQuickReply, layoutQuickReply,
  prepareDocsQuickReply, mydataQuickReply, landRegQuickReply,
  aiSuggestQ1QuickReply, aiSuggestQ2QuickReply, confirmApplyQuickReply,
  uploadDocsQuickReply, docReviewQuickReply,
} from '../utils/quickReplyHelper';
import { createSessionToken } from '../config/sessionTokenStore';

/** 產生文字回覆（含可選 Quick Reply） */
function textMsg(text: string, quickReply?: { items: import('../models/types').QuickReplyItem[] }): LineReplyMessage {
  const msg: LineReplyMessage = { type: 'text', text };
  if (quickReply) msg.quickReply = quickReply;
  return msg;
}

/** 建構歡迎 Flex Carousel — 主選單 4 張：房貸/信貸/AI智能推薦/當期活動 */
function buildWelcomeCarousel(): LineReplyMessage {
  const D = '#0D1B2A';
  const M = '#0F2035';
  const B = '#0A1628';
  const cards = [
    { emoji: '🏠', title: '房屋貸款', sub: 'MORTGAGE', num: '4大方案', numLabel: '青安・國軍・Next貸・養老', accent: '#4FC3F7', btn: '#1565C0', text: '房貸' },
    { emoji: '💳', title: '信用貸款', sub: 'PERSONAL LOAN', num: '最快1天', numLabel: '線上申辦核貸', accent: '#69F0AE', btn: '#1B5E20', text: '信貸' },
    { emoji: '🤖', title: 'AI智能推薦', sub: 'AI RECOMMENDATION', num: '智能分析', numLabel: '精準推薦最適方案', accent: '#CE93D8', btn: '#6A1B9A', text: 'AI智能推薦' },
    { emoji: '🎁', title: '當期活動', sub: 'SPECIAL OFFERS', num: '限時專案', numLabel: '合庫最新優惠', accent: '#FF5252', btn: '#B71C1C', text: '當期活動' },
  ];

  const bubbles = cards.map((c) => ({
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingTop: '22px', paddingBottom: '4px',
          paddingStart: '16px', paddingEnd: '16px', spacing: 'xs',
          contents: [
            { type: 'text', text: c.emoji, size: '3xl', align: 'center' },
            { type: 'text', text: c.title, weight: 'bold', size: 'lg', color: '#FFFFFF', align: 'center', margin: 'sm' },
            { type: 'text', text: c.sub, size: 'xxs', color: '#546E7A', align: 'center' },
          ],
        },
        { type: 'box', layout: 'vertical', margin: 'md', height: '3px', backgroundColor: c.accent, contents: [{ type: 'filler' }] },
        {
          type: 'box', layout: 'vertical', backgroundColor: M,
          paddingTop: '14px', paddingBottom: '18px', paddingStart: '16px', paddingEnd: '16px', spacing: 'xs',
          contents: [
            { type: 'text', text: c.num, weight: 'bold', size: 'xxl', color: c.accent, align: 'center' },
            { type: 'text', text: c.numLabel, size: 'xxs', color: '#78909C', align: 'center' },
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
      contents: [{ type: 'button', style: 'primary', color: c.btn, height: 'sm',
        action: { type: 'message', label: '立即了解 →', text: c.text },
      }],
    },
  }));

  return {
    type: 'flex',
    altText: '歡迎使用合庫個金Co-Pilot領航員，請選擇服務項目',
    contents: { type: 'carousel', contents: bubbles } as unknown as Record<string, unknown>,
  };
}

/** 狀態處理函數型別 */
type StateHandler = (session: UserSession, input: string) => TransitionResult;

// ─────────────────────────────────────────────────────────────
// 產品介紹系列 Helper
// ─────────────────────────────────────────────────────────────

/** 月付金計算（年金公式） */
function calcMonthlyPayment(principal: number, annualRatePct: number, years: number): string {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const payment = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  return Math.round(payment).toLocaleString();
}

/** 產品介紹用 Quick Reply 項目 */
function qrItem(label: string, text?: string): import('../models/types').QuickReplyItem {
  return { type: 'action', action: { type: 'message', label, text: text ?? label } };
}

/**
 * 房貸產品介紹 Carousel — 4 張：青安/國軍/Next貸/以房養老
 * 前三張按鈕：開始線上申請；第四張：申請以房養老
 */
function buildMortgageProductCarousel(): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const ACCENT = '#4FC3F7'; const BTN = '#1565C0';
  const ACCENT_RA = '#FFB74D'; const BTN_RA = '#BF360C';

  const mainCards = [
    { badge: '首購專屬', name: '青安貸款', sub: '財政部青年安心成家', rate: '2.275%', limit: '1,000萬', term: '40年', tags: ['寬限期最長5年', '首購族限定'], accent: ACCENT, btn: BTN },
    { badge: '軍人限定', name: '國軍輔導', sub: '國軍輔導理財購屋貸款', rate: '2.23%', limit: '依估值', term: '30年', tags: ['現役軍人專屬', '業界最優惠'], accent: ACCENT, btn: BTN },
    { badge: '週轉資金', name: 'Next 貸', sub: '幸福週轉金', rate: '2.35%起', limit: '依估值', term: '30年', tags: ['年所得80萬+', 'A區最低利率'], accent: ACCENT, btn: BTN },
  ];

  const mainBubbles = mainCards.map((c) => ({
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingAll: '14px', paddingBottom: '10px', spacing: 'xs',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'box', layout: 'vertical', flex: 0, paddingStart: '8px', paddingEnd: '8px',
                paddingTop: '3px', paddingBottom: '3px', backgroundColor: '#1A3A6B', cornerRadius: '10px',
                contents: [{ type: 'text', text: c.badge, size: 'xxs', color: c.accent }] },
            ]},
            { type: 'text', text: c.name, weight: 'bold', size: 'xl', color: '#FFFFFF', margin: 'sm' },
            { type: 'text', text: c.sub, size: 'xxs', color: '#78909C' },
          ],
        },
        { type: 'box', layout: 'vertical', height: '2px', backgroundColor: c.accent, contents: [{ type: 'filler' }] },
        {
          type: 'box', layout: 'vertical', backgroundColor: M,
          paddingStart: '14px', paddingEnd: '14px', paddingTop: '12px', paddingBottom: '12px', spacing: 'xs',
          contents: [
            { type: 'text', text: c.rate, weight: 'bold', size: 'xxl', color: c.accent },
            { type: 'text', text: '優惠利率', size: 'xxs', color: '#78909C' },
          ],
        },
        {
          type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '💰', size: 'xs', flex: 0 },
              { type: 'text', text: `最高${c.limit}`, size: 'xs', color: '#B0BEC5', flex: 1, margin: 'sm' },
              { type: 'text', text: '📅', size: 'xs', flex: 0 },
              { type: 'text', text: `最長${c.term}`, size: 'xs', color: '#B0BEC5', flex: 1, margin: 'sm' },
            ]},
            ...c.tags.map((t) => ({ type: 'text', text: `✦ ${t}`, size: 'xxs', color: '#69F0AE' })),
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: B,
      contents: [{ type: 'button', style: 'primary', color: c.btn, height: 'sm',
        action: { type: 'message', label: '開始線上申請 →', text: '開始線上申請' },
      }],
    },
  }));

  // 以房養老第四張
  const reverseBubble = {
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingAll: '14px', paddingBottom: '10px', spacing: 'xs',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'box', layout: 'vertical', flex: 0, paddingStart: '8px', paddingEnd: '8px',
                paddingTop: '3px', paddingBottom: '3px', backgroundColor: '#3E2200', cornerRadius: '10px',
                contents: [{ type: 'text', text: '退休養老', size: 'xxs', color: ACCENT_RA }] },
            ]},
            { type: 'text', text: '以房養老', weight: 'bold', size: 'xl', color: '#FFFFFF', margin: 'sm' },
            { type: 'text', text: '幸福滿袋・反向年金', size: 'xxs', color: '#78909C' },
          ],
        },
        { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT_RA, contents: [{ type: 'filler' }] },
        {
          type: 'box', layout: 'vertical', backgroundColor: M,
          paddingStart: '14px', paddingEnd: '14px', paddingTop: '12px', paddingBottom: '12px', spacing: 'xs',
          contents: [
            { type: 'text', text: '分段2.338%', weight: 'bold', size: 'xxl', color: ACCENT_RA },
            { type: 'text', text: '優惠利率', size: 'xxs', color: '#78909C' },
          ],
        },
        {
          type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🔑', size: 'xs', flex: 0 },
              { type: 'text', text: '年滿60歲', size: 'xs', color: '#B0BEC5', flex: 1, margin: 'sm' },
              { type: 'text', text: '📅', size: 'xs', flex: 0 },
              { type: 'text', text: '最長35年', size: 'xs', color: '#B0BEC5', flex: 1, margin: 'sm' },
            ]},
            { type: 'text', text: '✦ 月月定額撥付，無需還款', size: 'xxs', color: '#69F0AE' },
            { type: 'text', text: '✦ 房屋繼續居住使用', size: 'xxs', color: '#69F0AE' },
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: B,
      contents: [{ type: 'button', style: 'primary', color: BTN_RA, height: 'sm',
        action: { type: 'message', label: '申請以房養老 →', text: '申請以房養老' },
      }],
    },
  };

  return {
    type: 'flex',
    altText: '房屋貸款產品介紹，滑動查看更多方案（含以房養老）',
    contents: { type: 'carousel', contents: [...mainBubbles, reverseBubble] } as unknown as Record<string, unknown>,
  };
}

/** 信貸產品介紹 Carousel — 按鈕改為「開始線上申請」 */
function buildPersonalProductCarousel(): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const ACCENT = '#69F0AE'; const BTN = '#1B5E20';
  const cards = [
    { badge: '軍公教專屬', name: '軍公教優惠信貸', sub: '軍公教人員優惠信用貸款', rate: '1.78%起', limit: '300萬', term: '7年', tags: ['軍公教警消適用', '薪轉戶最優惠'] },
    { badge: '一般民眾', name: '優職優利信貸', sub: '優職優利信用貸款', rate: '2.228%起', limit: '300萬', term: '7年', tags: ['上市上櫃員工適用', '線上申辦快速核貸'] },
  ];

  const bubbles = cards.map((c) => ({
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingAll: '14px', paddingBottom: '10px', spacing: 'xs',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'box', layout: 'vertical', flex: 0, paddingStart: '8px', paddingEnd: '8px',
                paddingTop: '3px', paddingBottom: '3px', backgroundColor: '#1A3D2B', cornerRadius: '10px',
                contents: [{ type: 'text', text: c.badge, size: 'xxs', color: ACCENT }] },
            ]},
            { type: 'text', text: c.name, weight: 'bold', size: 'xl', color: '#FFFFFF', margin: 'sm' },
            { type: 'text', text: c.sub, size: 'xxs', color: '#78909C' },
          ],
        },
        { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
        {
          type: 'box', layout: 'vertical', backgroundColor: M,
          paddingStart: '14px', paddingEnd: '14px', paddingTop: '12px', paddingBottom: '12px', spacing: 'xs',
          contents: [
            { type: 'text', text: c.rate, weight: 'bold', size: 'xxl', color: ACCENT },
            { type: 'text', text: '優惠利率', size: 'xxs', color: '#78909C' },
          ],
        },
        {
          type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '💰', size: 'xs', flex: 0 },
              { type: 'text', text: `最高${c.limit}`, size: 'xs', color: '#B0BEC5', flex: 1, margin: 'sm' },
              { type: 'text', text: '📅', size: 'xs', flex: 0 },
              { type: 'text', text: `最長${c.term}`, size: 'xs', color: '#B0BEC5', flex: 1, margin: 'sm' },
            ]},
            ...c.tags.map((t) => ({ type: 'text', text: `✦ ${t}`, size: 'xxs', color: '#4FC3F7' })),
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: B,
      contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
        action: { type: 'message', label: '開始線上申請 →', text: '開始線上申請' },
      }],
    },
  }));

  return {
    type: 'flex',
    altText: '信用貸款產品介紹，滑動查看更多方案',
    contents: { type: 'carousel', contents: bubbles } as unknown as Record<string, unknown>,
  };
}

/** 以房養老產品介紹（SHOW_PRODUCT_INTRO 後備頁面） */
function buildReverseAnnuityIntro(): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const ACCENT = '#FFB74D'; const BTN = '#BF360C';
  return {
    type: 'flex',
    altText: '以房養老-幸福滿袋 產品介紹',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '🏡', size: '3xl', align: 'center' },
              { type: 'text', text: '以房養老－幸福滿袋', weight: 'bold', size: 'lg', color: '#FFFFFF', align: 'center', margin: 'sm' },
              { type: 'text', text: 'REVERSE MORTGAGE', size: 'xxs', color: '#546E7A', align: 'center' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '3px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: M, paddingAll: '16px', spacing: 'md',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '利率', size: 'sm', color: '#90A4AE', flex: 3 },
                { type: 'text', text: '分段2.338% / 一段2.608%', size: 'sm', weight: 'bold', color: ACCENT, flex: 7, wrap: true },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '年齡資格', size: 'sm', color: '#90A4AE', flex: 3 },
                { type: 'text', text: '年滿60歲以上', size: 'sm', weight: 'bold', color: '#FFFFFF', flex: 7 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '最高核貸', size: 'sm', color: '#90A4AE', flex: 3 },
                { type: 'text', text: '房屋估值 7成', size: 'sm', weight: 'bold', color: '#FFFFFF', flex: 7 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '最長期間', size: 'sm', color: '#90A4AE', flex: 3 },
                { type: 'text', text: '35年', size: 'sm', weight: 'bold', color: '#FFFFFF', flex: 7 },
              ]},
            ],
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: '✦ 每月定額撥付，無需還款', size: 'sm', color: '#69F0AE' },
              { type: 'text', text: '✦ 房屋繼續居住，照常使用', size: 'sm', color: '#69F0AE' },
              { type: 'text', text: '✦ 保障晚年生活品質與尊嚴', size: 'sm', color: '#69F0AE' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
        contents: [{ type: 'button', style: 'primary', color: BTN,
          action: { type: 'message', label: '申請以房養老 →', text: '申請以房養老' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 月付試算表 — 深色科技風格 */
function buildRateTable(loanType: LoanType | null): LineReplyMessage {
  const D = '#0D1B2A'; const B = '#0A1628';
  const isMortgage = loanType !== LoanType.PERSONAL;
  const ACCENT = isMortgage ? '#4FC3F7' : '#69F0AE';
  const BTN = isMortgage ? '#1565C0' : '#1B5E20';
  const HDR = isMortgage ? '#152535' : '#0F2A1A';

  if (!isMortgage) {
    const rate = 2.228;
    const amounts = [500000, 1000000, 2000000];
    const amtLabels = ['50萬', '100萬', '200萬'];
    const terms = [3, 5, 7];
    const rows = [
      { type: 'box', layout: 'horizontal', backgroundColor: HDR, paddingAll: '8px',
        contents: [
          { type: 'text', text: '年期╲金額', size: 'xxs', color: ACCENT, weight: 'bold', flex: 3 },
          ...amtLabels.map((l) => ({ type: 'text', text: l, size: 'xxs', color: ACCENT, weight: 'bold', flex: 2, align: 'center' })),
        ],
      },
      ...terms.map((t, i) => ({
        type: 'box', layout: 'horizontal', paddingAll: '9px',
        backgroundColor: i % 2 === 0 ? '#0D1B2A' : '#111F2E',
        contents: [
          { type: 'text', text: `${t}年`, size: 'xxs', weight: 'bold', color: '#FFFFFF', flex: 3 },
          ...amounts.map((a) => ({ type: 'text', text: calcMonthlyPayment(a, rate, t), size: 'xxs', color: ACCENT, flex: 2, align: 'center' })),
        ],
      })),
    ];
    return {
      type: 'flex', altText: '信貸月付試算表',
      contents: {
        type: 'bubble', size: 'mega',
        body: {
          type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
          contents: [
            {
              type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
              contents: [
                { type: 'text', text: '💳 信貸月付試算表', weight: 'bold', size: 'md', color: '#FFFFFF' },
                { type: 'text', text: `利率以 ${rate}% 試算 ｜ 最高可貸300萬`, size: 'xs', color: '#78909C' },
              ],
            },
            { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
            { type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'none', contents: [
              { type: 'text', text: '每月應繳（元）', size: 'xxs', color: '#546E7A', align: 'right', margin: 'none' },
              { type: 'box', layout: 'vertical', margin: 'sm', spacing: 'none', contents: rows },
              { type: 'text', text: '※ 實際利率依審核結果為準（1.78%~5.758%）', size: 'xxs', color: '#546E7A', wrap: true, margin: 'md' },
            ]},
          ],
        },
        footer: {
          type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
          contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
            action: { type: 'message', label: '開始線上申請 →', text: '開始線上申請' },
          }],
        },
      } as unknown as Record<string, unknown>,
    };
  }

  const rate = 2.275;
  const amounts = [5000000, 8000000, 10000000];
  const amtLabels = ['500萬', '800萬', '1,000萬'];
  const terms = [20, 30, 40];
  const rows = [
    { type: 'box', layout: 'horizontal', backgroundColor: HDR, paddingAll: '8px',
      contents: [
        { type: 'text', text: '年期╲金額', size: 'xxs', color: ACCENT, weight: 'bold', flex: 3 },
        ...amtLabels.map((l) => ({ type: 'text', text: l, size: 'xxs', color: ACCENT, weight: 'bold', flex: 2, align: 'center' })),
      ],
    },
    ...terms.map((t, i) => ({
      type: 'box', layout: 'horizontal', paddingAll: '9px',
      backgroundColor: i % 2 === 0 ? '#0D1B2A' : '#111F2E',
      contents: [
        { type: 'text', text: `${t}年`, size: 'xxs', weight: 'bold', color: '#FFFFFF', flex: 3 },
        ...amounts.map((a) => ({ type: 'text', text: calcMonthlyPayment(a, rate, t), size: 'xxs', color: ACCENT, flex: 2, align: 'center' })),
      ],
    })),
  ];
  return {
    type: 'flex', altText: '房貸月付試算表',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
            contents: [
              { type: 'text', text: '🏠 房貸月付試算表', weight: 'bold', size: 'md', color: '#FFFFFF' },
              { type: 'text', text: `利率以 ${rate}% 試算（青安方案）`, size: 'xs', color: '#78909C' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          { type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'none', contents: [
            { type: 'text', text: '每月應繳（元）', size: 'xxs', color: '#546E7A', align: 'right', margin: 'none' },
            { type: 'box', layout: 'vertical', margin: 'sm', spacing: 'none', contents: rows },
            { type: 'text', text: '※ 實際利率依審核結果為準（2.23%~2.45%）', size: 'xxs', color: '#546E7A', wrap: true, margin: 'md' },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
        contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
          action: { type: 'message', label: '開始線上申請 →', text: '開始線上申請' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 申辦流程 — 深色科技風格 */
function buildApplicationSteps(loanType: LoanType | null): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const isMortgage = loanType !== LoanType.PERSONAL;
  const ACCENT = isMortgage ? '#4FC3F7' : '#69F0AE';
  const BTN = isMortgage ? '#1565C0' : '#1B5E20';
  const steps = isMortgage
    ? [
        { n: '1', title: '線上試算申請', desc: 'AI 推薦最適方案，填寫基本資料' },
        { n: '2', title: '備齊申請文件', desc: '身分證、財力證明、不動產謄本' },
        { n: '3', title: '估價審核', desc: '合庫派員估價，約3~5個工作天' },
        { n: '4', title: '核貸通知', desc: '通知核貸金額、利率及條件' },
        { n: '5', title: '簽約撥款', desc: '完成抵押設定後資金入帳' },
      ]
    : [
        { n: '1', title: '線上填寫申請', desc: '最快3分鐘完成基本資料填寫' },
        { n: '2', title: '上傳文件', desc: '身分證正反面、最近3個月薪資單' },
        { n: '3', title: '系統審核', desc: '最快1個工作天得知審核結果' },
        { n: '4', title: '核貸通知', desc: '簡訊通知核貸金額及利率條件' },
        { n: '5', title: '線上簽約撥款', desc: '最快2小時完成撥款入帳' },
      ];

  return {
    type: 'flex', altText: '申辦流程說明',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
            contents: [
              { type: 'text', text: '📋 申辦流程', weight: 'bold', size: 'md', color: '#FFFFFF' },
              { type: 'text', text: isMortgage ? '房屋貸款 5步驟輕鬆辦' : '信用貸款 5步驟快速核貸', size: 'xs', color: '#78909C' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: M, paddingAll: '16px', spacing: 'lg',
            contents: steps.map((s, i) => ({
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'flex-start',
              contents: [
                {
                  type: 'box', layout: 'vertical', flex: 0, width: '28px', height: '28px',
                  backgroundColor: i === 0 ? ACCENT : '#1E3A5F', cornerRadius: '14px',
                  justifyContent: 'center', alignItems: 'center',
                  contents: [{ type: 'text', text: s.n, size: 'xs', color: i === 0 ? '#0D1B2A' : ACCENT, align: 'center', weight: 'bold' }],
                },
                {
                  type: 'box', layout: 'vertical', flex: 1,
                  contents: [
                    { type: 'text', text: s.title, size: 'sm', weight: 'bold', color: '#FFFFFF' },
                    { type: 'text', text: s.desc, size: 'xs', color: '#90A4AE', wrap: true },
                  ],
                },
              ],
            })),
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
        contents: [{ type: 'button', style: 'primary', color: BTN,
          action: { type: 'message', label: '開始線上申請 →', text: '開始線上申請' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 產品介紹 TransitionResult 組合器（供多個 handler 共用） */
function buildProductIntroResult(session: UserSession): TransitionResult {
  const { loanType } = session;

  if (loanType === LoanType.MORTGAGE) {
    return {
      nextState: ConversationState.SHOW_PRODUCT_INTRO,
      messages: [
        textMsg('🏠 房屋貸款專區\n\n合庫提供多元購屋方案，左右滑動查看各項產品（含以房養老）：'),
        buildMortgageProductCarousel(),
        textMsg('請選擇您想了解的功能：', { items: [
          qrItem('開始線上申請'), qrItem('利率試算'), qrItem('申辦流程'), qrItem('返回主選單'),
        ]}),
      ],
    };
  }

  if (loanType === LoanType.PERSONAL) {
    return {
      nextState: ConversationState.SHOW_PRODUCT_INTRO,
      messages: [
        textMsg('💳 信用貸款專區\n\n合庫提供多元信貸方案，最快一天核貸：'),
        buildPersonalProductCarousel(),
        textMsg('請選擇您想了解的功能：', { items: [
          qrItem('開始線上申請'), qrItem('月付試算', '利率試算'), qrItem('申辦流程'), qrItem('返回主選單'),
        ]}),
      ],
    };
  }

  // REVERSE_ANNUITY（後備路徑）
  return {
    nextState: ConversationState.SHOW_PRODUCT_INTRO,
    messages: [
      textMsg('🏡 以房養老專區\n\n安心享受退休生活，房屋化為養老金：'),
      buildReverseAnnuityIntro(),
      textMsg('請選擇您想了解的功能：', { items: [
        qrItem('申請以房養老'), qrItem('申辦流程'), qrItem('返回主選單'),
      ]}),
    ],
  };
}

/** 建構文件上傳 LIFF Flex 卡片 */
function buildUploadDocsFlex(session: UserSession, token: string): LineReplyMessage {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const isMortgage = session.loanType === LoanType.MORTGAGE
    || session.loanType === LoanType.REVERSE_ANNUITY;
  const ACCENT = isMortgage ? '#4FC3F7' : '#69F0AE';
  const BTN = isMortgage ? '#1565C0' : '#1B5E20';

  const liffUploadId = process.env.LIFF_ID_UPLOAD || 'YOUR_LIFF_ID_UPLOAD';
  const uploadUrl = `https://liff.line.me/${liffUploadId}?token=${token}&loanType=${session.loanType ?? ''}`;

  const docItems = isMortgage
    ? [
        { icon: '📊', label: 'MYDATA 所得資料', desc: '最近一年所得證明' },
        { icon: '🏡', label: '土地建物謄本', desc: '最新謄本（3個月內）' },
      ]
    : [
        { icon: '📊', label: 'MYDATA 所得資料', desc: '最近一年所得證明' },
      ];

  return {
    type: 'flex',
    altText: '📤 請上傳申請文件，AI 將自動辨識資料',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '📤 AI 文件辨識', weight: 'bold', size: 'lg', color: '#FFFFFF' },
              { type: 'text', text: '上傳文件，AI 自動填入申請資料', size: 'xs', color: '#78909C' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: M, paddingAll: '16px', spacing: 'md',
            contents: docItems.map((d) => ({
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
              contents: [
                { type: 'text', text: d.icon, size: 'lg', flex: 0 },
                {
                  type: 'box', layout: 'vertical', flex: 1,
                  contents: [
                    { type: 'text', text: d.label, size: 'sm', weight: 'bold', color: '#FFFFFF' },
                    { type: 'text', text: d.desc, size: 'xxs', color: '#90A4AE' },
                  ],
                },
              ],
            })),
          },
          {
            type: 'box', layout: 'vertical', paddingAll: '12px',
            contents: [
              { type: 'text', text: '✦ AI 自動辨識，節省填寫時間', size: 'xs', color: ACCENT },
              { type: 'text', text: '✦ 亦可選擇手動填寫', size: 'xs', color: '#78909C' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'primary', color: BTN,
            action: { type: 'uri', label: '📤 上傳文件（建議）', uri: uploadUrl },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 建構「備妥文件」說明 TransitionResult（重設計：Flex + LIFF 上傳按鈕） */
function buildPrepareDocsResult(session: UserSession): TransitionResult {
  const isMortgageType = session.loanType === LoanType.MORTGAGE
    || session.loanType === LoanType.REVERSE_ANNUITY;

  // 產生 session token 供 LIFF 使用
  const token = createSessionToken(session.userId);

  const docsIntro = isMortgageType
    ? '📋 申請前請準備以下文件：\n\n① MYDATA 所得資料（mydata.nat.gov.tw）\n② 土地建物謄本（eland.nat.gov.tw）\n\n💡 建議使用 AI 上傳辨識，自動填入資料省時省力！'
    : '📋 申請前請準備以下文件：\n\n① MYDATA 所得資料（mydata.nat.gov.tw）\n\n💡 建議使用 AI 上傳辨識，自動填入資料省時省力！';

  return {
    nextState: ConversationState.UPLOAD_DOCS,
    messages: [
      textMsg(docsIntro),
      buildUploadDocsFlex(session, token),
      textMsg('請上傳文件，或選擇手動填寫：', uploadDocsQuickReply()),
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// State Handlers
// ─────────────────────────────────────────────────────────────

/** IDLE → 歡迎訊息，以 Flex Carousel 呈現貸款類型入口 */
const handleIdle: StateHandler = (_session, _input) => ({
  nextState: ConversationState.CHOOSE_LOAN_TYPE,
  messages: [
    textMsg('您好！歡迎使用合庫「個金Co-Pilot領航員」👋\n\n請選擇您需要的服務：'),
    buildWelcomeCarousel(),
  ],
});

/** 選擇貸款類型 → 進入產品介紹或 AI 推薦 */
const handleChooseLoanType: StateHandler = (session, input) => {
  const t = input.trim();

  if (t === '當期活動') {
    return {
      nextState: ConversationState.CHOOSE_LOAN_TYPE,
      messages: [textMsg(
        '🎁 當期優惠活動\n\n目前合庫個金貸款方案持續受理中！\n\n詳細活動內容請洽合庫各分行專員，或繼續選擇貸款類型由 AI 為您試算最適方案。',
        loanTypeQuickReply(),
      )],
    };
  }

  if (t === 'AI智能推薦') {
    return {
      nextState: ConversationState.AI_SUGGEST_Q1,
      messages: [textMsg('🤖 AI 智能推薦\n\n請問您的主要需求是？', aiSuggestQ1QuickReply())],
    };
  }

  const loanType = parseLoanType(input);
  if (!loanType) {
    return {
      nextState: ConversationState.CHOOSE_LOAN_TYPE,
      messages: [textMsg('請選擇貸款類型', loanTypeQuickReply())],
    };
  }
  session.loanType = loanType;

  return buildProductIntroResult(session);
};

/** 產品介紹專區：處理「開始線上申請」/「申請以房養老」/「利率試算」/「申辦流程」 */
const handleShowProductIntro: StateHandler = (session, input) => {
  const t = input.trim();

  if (t === '開始線上申請') {
    return buildPrepareDocsResult(session);
  }

  if (t === '申請以房養老') {
    session.loanType = LoanType.REVERSE_ANNUITY;
    return buildPrepareDocsResult(session);
  }

  if (t === '利率試算') {
    const qr = { items: [qrItem('開始線上申請'), qrItem('申辦流程'), qrItem('返回主選單')] };
    return {
      nextState: ConversationState.SHOW_PRODUCT_INTRO,
      messages: [buildRateTable(session.loanType), textMsg('如需進一步諮詢，請選擇：', qr)],
    };
  }

  if (t === '申辦流程') {
    const qr = { items: [qrItem('開始線上申請'), qrItem('返回主選單')] };
    return {
      nextState: ConversationState.SHOW_PRODUCT_INTRO,
      messages: [buildApplicationSteps(session.loanType), textMsg('如需進一步諮詢，請選擇：', qr)],
    };
  }

  return buildProductIntroResult(session);
};

// ─── AI 智能推薦 ───

/** AI_SUGGEST_Q1：詢問主要需求 */
const handleAiSuggestQ1: StateHandler = (session, input) => {
  const t = input.trim();

  switch (t) {
    case '購置房屋':
      session.loanType = LoanType.MORTGAGE;
      return buildPrepareDocsResult(session);
    case '退休養老':
      session.loanType = LoanType.REVERSE_ANNUITY;
      return buildPrepareDocsResult(session);
    case '個人資金需求':
      session.loanType = LoanType.PERSONAL;
      return buildPrepareDocsResult(session);
    case '資金週轉':
      return {
        nextState: ConversationState.AI_SUGGEST_Q2,
        messages: [textMsg('請問您是否有房屋可抵押？', aiSuggestQ2QuickReply())],
      };
    default:
      return {
        nextState: ConversationState.AI_SUGGEST_Q1,
        messages: [textMsg('請選擇您的主要需求：', aiSuggestQ1QuickReply())],
      };
  }
};

/** AI_SUGGEST_Q2：詢問有無房屋（週轉情境） */
const handleAiSuggestQ2: StateHandler = (session, input) => {
  const t = input.trim();

  if (t === '有房屋可抵押') {
    session.loanType = LoanType.MORTGAGE;
    return buildPrepareDocsResult(session);
  }

  if (t === '沒有房屋') {
    session.loanType = LoanType.PERSONAL;
    return buildPrepareDocsResult(session);
  }

  return {
    nextState: ConversationState.AI_SUGGEST_Q2,
    messages: [textMsg('請選擇：', aiSuggestQ2QuickReply())],
  };
};

// ─── 文件確認 ───

/** PREPARE_DOCS：已重設計為 buildPrepareDocsResult 直接轉入 UPLOAD_DOCS */
const handlePrepareDocs: StateHandler = (session, _input) => {
  return buildPrepareDocsResult(session);
};

/** UPLOAD_DOCS：等待使用者上傳文件或手動跳過 */
const handleUploadDocs: StateHandler = (session, input) => {
  const t = input.trim();

  // 手動跳過 → 進入原始問答流程（MYDATA/謄本手動確認）
  if (t === '手動填寫') {
    const hint = session.loanType === LoanType.REVERSE_ANNUITY
      ? '請問您的年齡是？（60~75 歲）'
      : '請問您的年齡是？（20~75 歲）';
    return { nextState: ConversationState.COLLECT_AGE, messages: [textMsg(hint)] };
  }

  // 圖片訊息由 conversationHandler 攔截，此處只處理文字回應
  // 若收到文件解析完成通知（由 conversationHandler push DOC_REVIEW 後改 state）
  if (t === '文件解析完成') {
    return {
      nextState: ConversationState.DOC_REVIEW,
      messages: [textMsg('系統正在整理解析結果，請稍候...')],
    };
  }

  return {
    nextState: ConversationState.UPLOAD_DOCS,
    messages: [textMsg('請透過上方連結上傳文件，或選擇手動填寫：', uploadDocsQuickReply())],
  };
};

/** DOC_REVIEW：顯示文件解析摘要，等待使用者確認 */
const handleDocReview: StateHandler = (session, input) => {
  const t = input.trim();

  if (t === '確認文件資料') {
    session.docReviewConfirmed = true;
    // 已從文件預填 → 跳過已知欄位，直接進入年齡收集
    const hint = session.loanType === LoanType.REVERSE_ANNUITY
      ? '請問您的年齡是？（60~75 歲）'
      : '請問您的年齡是？（20~75 歲）';
    return {
      nextState: ConversationState.COLLECT_AGE,
      messages: [textMsg(`✅ 已確認文件資料！\n\n${hint}`)],
    };
  }

  if (t === '重新上傳') {
    return buildPrepareDocsResult(session);
  }

  if (t === '手動填寫') {
    // 清除文件解析資料，進入原始問答流程
    session.parsedFromDoc = false;
    session.basicInfo.income = null;
    session.propertyInfo.buildingType = null;
    session.propertyInfo.floor = null;
    session.propertyInfo.areaPing = null;
    session.propertyInfo.propertyAge = null;
    const hint = session.loanType === LoanType.REVERSE_ANNUITY
      ? '請問您的年齡是？（60~75 歲）'
      : '請問您的年齡是？（20~75 歲）';
    return { nextState: ConversationState.COLLECT_AGE, messages: [textMsg(hint)] };
  }

  return {
    nextState: ConversationState.DOC_REVIEW,
    messages: [textMsg('請確認解析出的資料是否正確：', docReviewQuickReply())],
  };
};

// ─── 基本資料收集 ───

/** 收集年齡 */
const handleCollectAge: StateHandler = (session, input) => {
  const age = parseAge(input, session.loanType ?? undefined);
  if (age === null) {
    const hint = session.loanType === LoanType.REVERSE_ANNUITY
      ? '以房養老方案需年滿60歲，請輸入有效的年齡（60~75 歲）'
      : '請輸入有效的年齡（20~75 歲）';
    return { nextState: ConversationState.COLLECT_AGE, messages: [textMsg(hint)] };
  }
  session.basicInfo.age = age;

  if (session.loanType === LoanType.REVERSE_ANNUITY) {
    // 若已從 MyData 預填月收入 → 直接跳 COLLECT_TERM
    if (session.parsedFromDoc && session.basicInfo.income !== null) {
      const incomeDisplay = `${Math.round(session.basicInfo.income / 10000)}萬`;
      session.basicInfo.purpose = '以房養老';
      return {
        nextState: ConversationState.COLLECT_TERM,
        messages: [textMsg(`📊 已從 MyData 取得月收入：${incomeDisplay}\n\n請問您希望的撥付年限？`, reverseAnnuityTermQuickReply())],
      };
    }
    return {
      nextState: ConversationState.COLLECT_INCOME,
      messages: [textMsg('請問您目前每月大約有多少退休金或其他收入？\n（可輸入如：3萬、25000）')],
    };
  }

  return {
    nextState: ConversationState.COLLECT_OCCUPATION,
    messages: [textMsg('請問您的職業是？', occupationQuickReply())],
  };
};

/** 收集職業 */
const handleCollectOccupation: StateHandler = (session, input) => {
  const occupation = parseOccupation(input);
  if (occupation === null) {
    return {
      nextState: ConversationState.COLLECT_OCCUPATION,
      messages: [textMsg('請從以下選項中選擇您的職業', occupationQuickReply())],
    };
  }
  session.basicInfo.occupation = occupation;

  // 若已從 MyData 預填月收入 → 直接跳 COLLECT_PURPOSE
  if (session.parsedFromDoc && session.basicInfo.income !== null) {
    const incomeDisplay = `${Math.round(session.basicInfo.income / 10000)}萬`;
    const qr = session.loanType === LoanType.MORTGAGE
      ? mortgagePurposeQuickReply()
      : personalPurposeQuickReply();
    return {
      nextState: ConversationState.COLLECT_PURPOSE,
      messages: [textMsg(`📊 已從 MyData 取得月收入：${incomeDisplay}\n\n請問您的貸款用途是？`, qr)],
    };
  }

  return {
    nextState: ConversationState.COLLECT_INCOME,
    messages: [textMsg('請問您的月收入大約多少？\n（可輸入如：5萬、3.5萬、50000）')],
  };
};

/** 收集月收入 */
const handleCollectIncome: StateHandler = (session, input) => {
  // 若已從文件預填月收入，自動跳過
  if (session.parsedFromDoc && session.basicInfo.income !== null) {
    const incomeDisplay = `${Math.round((session.basicInfo.income) / 10000)}萬`;
    if (session.loanType === LoanType.REVERSE_ANNUITY) {
      session.basicInfo.purpose = '以房養老';
      return {
        nextState: ConversationState.COLLECT_TERM,
        messages: [textMsg(`📊 已從 MyData 取得月收入：${incomeDisplay}\n\n請問您希望的撥付年限？`, reverseAnnuityTermQuickReply())],
      };
    }
    const qr = session.loanType === LoanType.MORTGAGE
      ? mortgagePurposeQuickReply()
      : personalPurposeQuickReply();
    return {
      nextState: ConversationState.COLLECT_PURPOSE,
      messages: [textMsg(`📊 已從 MyData 取得月收入：${incomeDisplay}\n\n請問您的貸款用途是？`, qr)],
    };
  }

  const income = parseIncome(input);
  if (income === null) {
    return {
      nextState: ConversationState.COLLECT_INCOME,
      messages: [textMsg('請輸入有效的月收入（至少 1 萬元）\n例如：5萬、35000')],
    };
  }
  session.basicInfo.income = income;

  if (session.loanType === LoanType.REVERSE_ANNUITY) {
    session.basicInfo.purpose = '以房養老';
    return {
      nextState: ConversationState.COLLECT_TERM,
      messages: [textMsg('請問您希望的撥付年限？', reverseAnnuityTermQuickReply())],
    };
  }

  const qr = session.loanType === LoanType.MORTGAGE
    ? mortgagePurposeQuickReply()
    : personalPurposeQuickReply();
  return {
    nextState: ConversationState.COLLECT_PURPOSE,
    messages: [textMsg('請問您的貸款用途是？', qr)],
  };
};

/** 收集貸款用途 */
const handleCollectPurpose: StateHandler = (session, input) => {
  const purpose = parsePurpose(input);
  if (purpose === null) {
    const qr = session.loanType === LoanType.MORTGAGE
      ? mortgagePurposeQuickReply()
      : personalPurposeQuickReply();
    return {
      nextState: ConversationState.COLLECT_PURPOSE,
      messages: [textMsg('請選擇或輸入貸款用途', qr)],
    };
  }
  session.basicInfo.purpose = purpose;
  const qr = session.loanType === LoanType.MORTGAGE
    ? mortgageTermQuickReply()
    : personalTermQuickReply();
  return {
    nextState: ConversationState.COLLECT_TERM,
    messages: [textMsg('請問您希望的貸款年限？', qr)],
  };
};

/** 收集貸款年限 */
const handleCollectTerm: StateHandler = (session, input) => {
  const term = parseTerm(input);
  if (term === null) {
    const qr = session.loanType === LoanType.REVERSE_ANNUITY
      ? reverseAnnuityTermQuickReply()
      : session.loanType === LoanType.MORTGAGE
        ? mortgageTermQuickReply()
        : personalTermQuickReply();
    return {
      nextState: ConversationState.COLLECT_TERM,
      messages: [textMsg('請選擇有效的貸款年限', qr)],
    };
  }
  session.basicInfo.termYears = term;
  const hint = session.loanType === LoanType.MORTGAGE
    ? '請問您希望的貸款金額？\n（例如：800萬、5000000）'
    : '請問您希望的貸款金額？\n（例如：50萬、500000）';
  return {
    nextState: ConversationState.COLLECT_AMOUNT,
    messages: [textMsg(hint)],
  };
};

/** 收集貸款金額 */
const handleCollectAmount: StateHandler = (session, input) => {
  const amount = parseAmount(input);
  if (amount === null) {
    return {
      nextState: ConversationState.COLLECT_AMOUNT,
      messages: [textMsg('請輸入有效的貸款金額（至少 10 萬元）\n例如：500萬、1500000')],
    };
  }
  session.basicInfo.amount = amount;

  // 信貸：已上傳文件 → 直接推薦；否則確認 MYDATA
  if (session.loanType === LoanType.PERSONAL) {
    if (session.parsedFromDoc) {
      return {
        nextState: ConversationState.RECOMMEND,
        messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
      };
    }
    return {
      nextState: ConversationState.CONFIRM_MYDATA,
      messages: [textMsg('請問您是否已透過 MyData 取得所得資料？', mydataQuickReply())],
    };
  }

  // 房貸：已上傳謄本且有坪數/屋齡 → 跳過部分標的物問題
  if (session.parsedFromDoc && session.propertyInfo.propertyAge !== null) {
    return {
      nextState: ConversationState.COLLECT_PARKING,
      messages: [textMsg(
        `🏡 已從謄本取得屋齡：${session.propertyInfo.propertyAge}年、坪數：${session.propertyInfo.areaPing ?? '?'}坪\n\n請問是否有車位？`,
        parkingQuickReply(),
      )],
    };
  }

  // 房貸：繼續收集標的物資訊
  return {
    nextState: ConversationState.COLLECT_PROPERTY_AGE,
    messages: [textMsg('接下來需要了解房屋標的物資訊。\n\n請問房屋屋齡大約幾年？（0~60 年）')],
  };
};

/** 收集屋齡 */
const handleCollectPropertyAge: StateHandler = (session, input) => {
  const propertyAge = parsePropertyAge(input);
  if (propertyAge === null) {
    return { nextState: ConversationState.COLLECT_PROPERTY_AGE, messages: [textMsg('請輸入有效的屋齡（0~60 年）')] };
  }
  session.propertyInfo.propertyAge = propertyAge;
  return { nextState: ConversationState.COLLECT_AREA, messages: [textMsg('請問房屋坪數？（1~200 坪）')] };
};

/** 收集坪數 */
const handleCollectArea: StateHandler = (session, input) => {
  const area = parseArea(input);
  if (area === null) {
    return { nextState: ConversationState.COLLECT_AREA, messages: [textMsg('請輸入有效的坪數（1~200 坪）')] };
  }
  session.propertyInfo.areaPing = area;
  return { nextState: ConversationState.COLLECT_PARKING, messages: [textMsg('請問是否有車位？', parkingQuickReply())] };
};

/** 收集車位 */
const handleCollectParking: StateHandler = (session, input) => {
  const parking = parseParking(input);
  if (parking === null) {
    return { nextState: ConversationState.COLLECT_PARKING, messages: [textMsg('請回答「有」或「無」', parkingQuickReply())] };
  }
  session.propertyInfo.hasParking = parking;
  return { nextState: ConversationState.COLLECT_LAYOUT, messages: [textMsg('請問房屋格局？', layoutQuickReply())] };
};

/** 收集格局 */
const handleCollectLayout: StateHandler = (session, input) => {
  const layout = parseLayout(input);
  if (layout === null) {
    return { nextState: ConversationState.COLLECT_LAYOUT, messages: [textMsg('請輸入房屋格局（如：3房2廳2衛）', layoutQuickReply())] };
  }
  session.propertyInfo.layout = layout;

  // 若已從謄本預填樓層與建物類型 → 全部已知，直接 RECOMMEND（文件路徑）
  if (session.parsedFromDoc) {
    if (session.propertyInfo.floor !== null && session.propertyInfo.buildingType !== null) {
      return {
        nextState: ConversationState.RECOMMEND,
        messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
      };
    }
    // 只有樓層已知
    if (session.propertyInfo.floor !== null) {
      return {
        nextState: ConversationState.COLLECT_BUILDING_TYPE,
        messages: [textMsg(`🏡 已從謄本取得樓層：${session.propertyInfo.floor}樓\n\n請問建物類型？`, buildingTypeQuickReply())],
      };
    }
  }

  return { nextState: ConversationState.COLLECT_FLOOR, messages: [textMsg('請問所在樓層？（1~99 樓）')] };
};

/** 收集樓層 */
const handleCollectFloor: StateHandler = (session, input) => {
  const floor = parseFloor(input);
  if (floor === null) {
    return { nextState: ConversationState.COLLECT_FLOOR, messages: [textMsg('請輸入有效的樓層數（1~99）')] };
  }
  session.propertyInfo.floor = floor;

  // 若已從謄本預填建物類型 → 直接 RECOMMEND（文件路徑）
  if (session.parsedFromDoc && session.propertyInfo.buildingType !== null) {
    return {
      nextState: ConversationState.RECOMMEND,
      messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
    };
  }

  return { nextState: ConversationState.COLLECT_BUILDING_TYPE, messages: [textMsg('請問建物類型？', buildingTypeQuickReply())] };
};

/** 收集建物類型 → 轉入 MYDATA 確認（或若文件已解析則直接 RECOMMEND） */
const handleCollectBuildingType: StateHandler = (session, input) => {
  // 若已從謄本預填建物類型，自動跳過並前往 RECOMMEND（文件路徑）
  if (session.parsedFromDoc && session.propertyInfo.buildingType !== null) {
    return {
      nextState: ConversationState.RECOMMEND,
      messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
    };
  }

  const buildingType = parseBuildingType(input);
  if (buildingType === null) {
    return { nextState: ConversationState.COLLECT_BUILDING_TYPE, messages: [textMsg('請選擇建物類型', buildingTypeQuickReply())] };
  }
  session.propertyInfo.buildingType = buildingType;

  // 文件路徑（已上傳文件）→ 直接推薦
  if (session.parsedFromDoc) {
    return {
      nextState: ConversationState.RECOMMEND,
      messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
    };
  }

  // 手動路徑 → CONFIRM_MYDATA
  return {
    nextState: ConversationState.CONFIRM_MYDATA,
    messages: [textMsg('請問您是否已透過 MyData 取得所得資料？', mydataQuickReply())],
  };
};

// ─── 文件備妥確認 ───

/** CONFIRM_MYDATA：確認 MYDATA 所得資料 */
const handleConfirmMydata: StateHandler = (session, input) => {
  const t = input.trim();

  if (t !== '已備妥' && t !== '尚未取得') {
    return {
      nextState: ConversationState.CONFIRM_MYDATA,
      messages: [textMsg('請確認您的 MYDATA 所得資料狀況：', mydataQuickReply())],
    };
  }

  session.mydataReady = t === '已備妥';
  const messages: LineReplyMessage[] = [];

  if (!session.mydataReady) {
    messages.push(textMsg(
      '💡 MyData 所得資料取得方式：\n'
      + '請至「MyData 臺灣通用」平台（mydata.nat.gov.tw）下載最近一年所得資料，申辦時請備妥電子檔。\n\n'
      + '您仍可繼續填寫，後續再補件。',
    ));
  }

  if (session.loanType === LoanType.PERSONAL) {
    messages.push(textMsg('資料收集完成！正在為您分析最適合的貸款方案...'));
    return { nextState: ConversationState.RECOMMEND, messages };
  }

  messages.push(textMsg('請問您是否已備妥土地建物謄本？', landRegQuickReply()));
  return { nextState: ConversationState.CONFIRM_LAND_REG, messages };
};

/** CONFIRM_LAND_REG：確認土地建物謄本（房貸/以房養老） */
const handleConfirmLandReg: StateHandler = (session, input) => {
  const t = input.trim();

  if (t !== '已備妥' && t !== '尚未取得') {
    return {
      nextState: ConversationState.CONFIRM_LAND_REG,
      messages: [textMsg('請確認您的土地建物謄本狀況：', landRegQuickReply())],
    };
  }

  session.landRegistryReady = t === '已備妥';
  const messages: LineReplyMessage[] = [];

  if (!session.landRegistryReady) {
    messages.push(textMsg(
      '💡 土地建物謄本取得方式：\n'
      + '請至「e-謄本」平台（https://eland.nat.gov.tw）或地政事務所申請，可取得電子謄本存檔備用。\n\n'
      + '您仍可繼續填寫，後續再補件。',
    ));
  }

  messages.push(textMsg('資料收集完成！正在為您分析最適合的貸款方案...'));
  return { nextState: ConversationState.RECOMMEND, messages };
};

// ─── 推薦 & 確認申請 ───

/**
 * RECOMMEND 狀態：保持不動，等待外層 conversationHandler 產生推薦結果。
 * 外層在處理完推薦後設 state=CONFIRM_APPLY。
 */
const handleRecommend: StateHandler = (_session, _input) => ({
  nextState: ConversationState.RECOMMEND,
  messages: [textMsg('系統正在處理中，請稍候...')],
});

/** 建構 LIFF 申請書連結 Flex 卡片 */
function buildApplicationFormFlex(session: UserSession): LineReplyMessage {
  const D = '#0D1B2A'; const B = '#0A1628';
  const isMortgage = session.loanType === LoanType.MORTGAGE
    || session.loanType === LoanType.REVERSE_ANNUITY;
  const ACCENT = isMortgage ? '#4FC3F7' : '#69F0AE';
  const BTN = isMortgage ? '#1565C0' : '#1B5E20';

  const token = createSessionToken(session.userId);
  const liffAppId = process.env.LIFF_ID_APPLICATION || 'YOUR_LIFF_ID_APPLICATION';
  const formUrl = `https://liff.line.me/${liffAppId}?token=${token}`;

  return {
    type: 'flex',
    altText: '📝 請填寫消費者貸款申請書並完成電子簽名',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            contents: [
              { type: 'text', text: '📝 填寫申請書', weight: 'bold', size: 'lg', color: '#FFFFFF' },
              { type: 'text', text: '最後一步：完成電子申請書與簽名', size: 'xs', color: '#78909C' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: '申請書包含以下步驟：', size: 'xs', color: '#78909C' },
              { type: 'text', text: '① 確認申貸資訊', size: 'sm', color: '#B0BEC5' },
              { type: 'text', text: '② 補充個人資料', size: 'sm', color: '#B0BEC5' },
              { type: 'text', text: '③ 閱讀並同意條款', size: 'sm', color: '#B0BEC5' },
              { type: 'text', text: '④ 手寫電子簽名', size: 'sm', color: '#B0BEC5' },
              { type: 'text', text: '⏱ 預計 2~3 分鐘完成', size: 'xs', color: ACCENT, margin: 'md' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: B,
        contents: [
          { type: 'button', style: 'primary', color: BTN,
            action: { type: 'uri', label: '填寫申請書 →', uri: formUrl },
          },
          { type: 'button', style: 'secondary',
            action: { type: 'message', label: '重新試算', text: '重新開始' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** CONFIRM_APPLY：顯示 LIFF 申請書連結（由 conversationHandler 攔截產生） */
const handleConfirmApply: StateHandler = (session, _input) => {
  return {
    nextState: ConversationState.CONFIRM_APPLY,
    messages: [buildApplicationFormFlex(session)],
  };
};

// ─── 收集申請人資料 ───

/** COLLECT_NAME：收集申請人姓名 */
const handleCollectName: StateHandler = (session, input) => {
  const name = parseName(input);
  if (name === null) {
    return {
      nextState: ConversationState.COLLECT_NAME,
      messages: [textMsg('請輸入有效的姓名（1~10 字，限中英文）')],
    };
  }
  session.applicantName = name;
  return {
    nextState: ConversationState.COLLECT_PHONE,
    messages: [textMsg('請輸入您的聯絡電話（格式：09XXXXXXXX）')],
  };
};

/** COLLECT_PHONE：收集聯絡電話 */
const handleCollectPhone: StateHandler = (session, input) => {
  const phone = parsePhone(input);
  if (phone === null) {
    return {
      nextState: ConversationState.COLLECT_PHONE,
      messages: [textMsg('請輸入有效的手機號碼（格式：09XXXXXXXX）')],
    };
  }
  session.applicantPhone = phone;
  return {
    nextState: ConversationState.APPLY_DONE,
    messages: [textMsg('正在提交您的申請，請稍候...')],
  };
};

/** APPLY_DONE：申請完成（實際由 conversationHandler 攔截處理） */
const handleApplyDone: StateHandler = (_session, _input) => ({
  nextState: ConversationState.APPLY_DONE,
  messages: [textMsg('您的申請已完成。')],
});

/** 狀態處理函數對照表 */
const stateHandlers: Record<ConversationState, StateHandler> = {
  [ConversationState.IDLE]: handleIdle,
  [ConversationState.CHOOSE_LOAN_TYPE]: handleChooseLoanType,
  [ConversationState.SHOW_PRODUCT_INTRO]: handleShowProductIntro,
  [ConversationState.AI_SUGGEST_Q1]: handleAiSuggestQ1,
  [ConversationState.AI_SUGGEST_Q2]: handleAiSuggestQ2,
  [ConversationState.PREPARE_DOCS]: handlePrepareDocs,
  [ConversationState.UPLOAD_DOCS]: handleUploadDocs,
  [ConversationState.DOC_REVIEW]: handleDocReview,
  [ConversationState.COLLECT_AGE]: handleCollectAge,
  [ConversationState.COLLECT_OCCUPATION]: handleCollectOccupation,
  [ConversationState.COLLECT_INCOME]: handleCollectIncome,
  [ConversationState.COLLECT_PURPOSE]: handleCollectPurpose,
  [ConversationState.COLLECT_TERM]: handleCollectTerm,
  [ConversationState.COLLECT_AMOUNT]: handleCollectAmount,
  [ConversationState.COLLECT_PROPERTY_AGE]: handleCollectPropertyAge,
  [ConversationState.COLLECT_AREA]: handleCollectArea,
  [ConversationState.COLLECT_PARKING]: handleCollectParking,
  [ConversationState.COLLECT_LAYOUT]: handleCollectLayout,
  [ConversationState.COLLECT_FLOOR]: handleCollectFloor,
  [ConversationState.COLLECT_BUILDING_TYPE]: handleCollectBuildingType,
  [ConversationState.CONFIRM_MYDATA]: handleConfirmMydata,
  [ConversationState.CONFIRM_LAND_REG]: handleConfirmLandReg,
  [ConversationState.RECOMMEND]: handleRecommend,
  [ConversationState.CONFIRM_APPLY]: handleConfirmApply,
  [ConversationState.COLLECT_NAME]: handleCollectName,
  [ConversationState.COLLECT_PHONE]: handleCollectPhone,
  [ConversationState.APPLY_DONE]: handleApplyDone,
};

/** 執行狀態轉移 */
export function transition(session: UserSession, input: string): TransitionResult {
  const handler = stateHandlers[session.state];
  return handler(session, input);
}
