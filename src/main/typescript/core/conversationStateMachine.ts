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

/** 建構歡迎主選單 Bubble — 單一 bubble 六宮格選單（白色金融風格） */
function buildWelcomeMenu(): LineReplyMessage {
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const TCB_BLUE_DARK = '#143D6B';
  const ACCENT_TEAL = '#0077B6';
  const GRAY_TEXT = '#64748B';
  const BORDER = '#E2E8F0';

  /** 單個圖示按鈕 */
  function iconBtn(emoji: string, label: string, sub: string, text: string) {
    return {
      type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', spacing: 'xs',
      paddingAll: '10px',
      action: { type: 'message', label, text },
      contents: [
        { type: 'text', text: emoji, size: 'xl', align: 'center' },
        { type: 'text', text: label, weight: 'bold', size: 'xs', color: TCB_BLUE, align: 'center', wrap: true },
        { type: 'text', text: sub, size: 'xxs', color: GRAY_TEXT, align: 'center', wrap: true },
      ],
    };
  }

  return {
    type: 'flex',
    altText: '歡迎使用合庫個金Co-Pilot領航員，請選擇服務項目',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: TCB_BLUE,
        paddingTop: '16px', paddingBottom: '14px', paddingStart: '18px', paddingEnd: '18px', spacing: 'xs',
        contents: [
          {
            type: 'box', layout: 'horizontal', alignItems: 'center',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                contents: [
                  { type: 'text', text: '合作金庫銀行', size: 'xs', color: '#BDD5F0', weight: 'bold' },
                  { type: 'text', text: '個金 Co-Pilot 領航員 🏦', weight: 'bold', size: 'md', color: WHITE },
                  { type: 'text', text: '您的專屬貸款智能助理', size: 'xs', color: '#BDD5F0' },
                ],
              },
            ],
          },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingTop: '14px', paddingBottom: '6px',
            paddingStart: '16px', paddingEnd: '16px', spacing: 'xs',
            contents: [
              { type: 'text', text: '貸款服務', weight: 'bold', size: 'sm', color: TCB_BLUE_DARK },
              { type: 'text', text: '謹慎理財，貸款先規劃', size: 'xxs', color: GRAY_TEXT },
              { type: 'separator', margin: 'sm', color: BORDER },
            ],
          },
          {
            type: 'box', layout: 'horizontal', paddingStart: '8px', paddingEnd: '8px', paddingBottom: '4px',
            contents: [
              iconBtn('🏠', '房貸試算', '與申辦', '房貸'),
              iconBtn('💳', '信貸試算', '與申辦', '信貸'),
              iconBtn('🛡️', '房貸壽險', '保障家人', '房貸壽險'),
            ],
          },
          {
            type: 'separator', margin: 'none', color: BORDER,
          },
          {
            type: 'box', layout: 'horizontal', paddingStart: '8px', paddingEnd: '8px',
            paddingTop: '4px', paddingBottom: '8px',
            contents: [
              iconBtn('🏡', 'AI自動鑑價', '即時估算', 'AI自動鑑價'),
              iconBtn('🎁', '優惠專案', '限時活動', '當期活動'),
              iconBtn('💬', 'AI 諮詢', '智能客服', 'AI諮詢'),
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'horizontal', backgroundColor: LIGHT,
        paddingTop: '10px', paddingBottom: '10px', paddingStart: '14px', paddingEnd: '14px',
        alignItems: 'center',
        contents: [
          { type: 'text', text: '📢 房貸最低 2.275% 起', size: 'xs', color: ACCENT_TEAL, flex: 1, wrap: true },
          {
            type: 'button', style: 'primary', color: TCB_BLUE, height: 'sm', flex: 0,
            action: { type: 'message', label: '立即試算', text: '房貸' },
          },
        ],
      },
    } as unknown as Record<string, unknown>,
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
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const BADGE_BG = '#EBF4FF';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  const BTN = TCB_BLUE;
  const ACCENT_RA = '#D97706';
  const BTN_RA = '#92400E';

  const mainCards = [
    { badge: '首購專屬', name: '青安貸款', sub: '財政部青年安心成家', rate: '2.275%', limit: '1,000萬', term: '40年', tags: ['寬限期最長5年', '首購族限定'] },
    { badge: '軍人限定', name: '國軍輔導', sub: '國軍輔導理財購屋貸款', rate: '2.23%', limit: '依估值', term: '30年', tags: ['現役軍人專屬', '業界最優惠'] },
    { badge: '週轉資金', name: 'Next 貸', sub: '幸福週轉金', rate: '2.35%起', limit: '依估值', term: '30年', tags: ['年所得80萬+', 'A區最低利率'] },
  ];

  const mainBubbles = mainCards.map((c) => ({
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingAll: '14px', paddingBottom: '10px', spacing: 'xs',
          backgroundColor: TCB_BLUE,
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'box', layout: 'vertical', flex: 0, paddingStart: '8px', paddingEnd: '8px',
                paddingTop: '3px', paddingBottom: '3px', backgroundColor: BADGE_BG, cornerRadius: '10px',
                contents: [{ type: 'text', text: c.badge, size: 'xxs', color: TCB_BLUE }] },
            ]},
            { type: 'text', text: c.name, weight: 'bold', size: 'xl', color: WHITE, margin: 'sm' },
            { type: 'text', text: c.sub, size: 'xxs', color: '#BDD5F0' },
          ],
        },
        {
          type: 'box', layout: 'vertical', backgroundColor: LIGHT,
          paddingStart: '14px', paddingEnd: '14px', paddingTop: '12px', paddingBottom: '12px', spacing: 'xs',
          contents: [
            { type: 'text', text: c.rate, weight: 'bold', size: 'xxl', color: TCB_BLUE },
            { type: 'text', text: '最低利率', size: 'xxs', color: GRAY_TEXT },
          ],
        },
        { type: 'separator', color: BORDER },
        {
          type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: WHITE,
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '💰', size: 'xs', flex: 0 },
              { type: 'text', text: `最高${c.limit}`, size: 'xs', color: '#1E293B', flex: 1, margin: 'sm' },
              { type: 'text', text: '📅', size: 'xs', flex: 0 },
              { type: 'text', text: `最長${c.term}`, size: 'xs', color: '#1E293B', flex: 1, margin: 'sm' },
            ]},
            ...c.tags.map((t) => ({ type: 'text', text: `✓ ${t}`, size: 'xxs', color: GRAY_TEXT })),
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: WHITE,
      contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
        action: { type: 'message', label: '開始線上申請', text: '開始線上申請' },
      }],
    },
  }));

  // 以房養老第四張
  const reverseBubble = {
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingAll: '14px', paddingBottom: '10px', spacing: 'xs',
          backgroundColor: '#7C3A00',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'box', layout: 'vertical', flex: 0, paddingStart: '8px', paddingEnd: '8px',
                paddingTop: '3px', paddingBottom: '3px', backgroundColor: '#FEF3C7', cornerRadius: '10px',
                contents: [{ type: 'text', text: '退休養老', size: 'xxs', color: ACCENT_RA }] },
            ]},
            { type: 'text', text: '以房養老', weight: 'bold', size: 'xl', color: WHITE, margin: 'sm' },
            { type: 'text', text: '幸福滿袋・反向年金', size: 'xxs', color: '#FDE68A' },
          ],
        },
        {
          type: 'box', layout: 'vertical', backgroundColor: '#FFF7ED',
          paddingStart: '14px', paddingEnd: '14px', paddingTop: '12px', paddingBottom: '12px', spacing: 'xs',
          contents: [
            { type: 'text', text: '分段2.338%', weight: 'bold', size: 'xxl', color: ACCENT_RA },
            { type: 'text', text: '最低利率', size: 'xxs', color: GRAY_TEXT },
          ],
        },
        { type: 'separator', color: BORDER },
        {
          type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: WHITE,
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🔑', size: 'xs', flex: 0 },
              { type: 'text', text: '年滿60歲', size: 'xs', color: '#1E293B', flex: 1, margin: 'sm' },
              { type: 'text', text: '📅', size: 'xs', flex: 0 },
              { type: 'text', text: '最長35年', size: 'xs', color: '#1E293B', flex: 1, margin: 'sm' },
            ]},
            { type: 'text', text: '✓ 月月定額撥付，無需還款', size: 'xxs', color: GRAY_TEXT },
            { type: 'text', text: '✓ 房屋繼續居住使用', size: 'xxs', color: GRAY_TEXT },
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: WHITE,
      contents: [{ type: 'button', style: 'primary', color: BTN_RA, height: 'sm',
        action: { type: 'message', label: '申請以房養老', text: '申請以房養老' },
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
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const BADGE_BG = '#EBF4FF';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  const BTN = TCB_BLUE;
  const cards = [
    { badge: '軍公教專屬', name: '軍公教優惠信貸', sub: '軍公教人員優惠信用貸款', rate: '1.78%起', limit: '300萬', term: '7年', tags: ['軍公教警消適用', '薪轉戶最優惠'] },
    { badge: '一般民眾', name: '優職優利信貸', sub: '優職優利信用貸款', rate: '2.228%起', limit: '300萬', term: '7年', tags: ['上市上櫃員工適用', '線上申辦快速核貸'] },
  ];

  const bubbles = cards.map((c) => ({
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
      contents: [
        {
          type: 'box', layout: 'vertical', paddingAll: '14px', paddingBottom: '10px', spacing: 'xs',
          backgroundColor: TCB_BLUE,
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'box', layout: 'vertical', flex: 0, paddingStart: '8px', paddingEnd: '8px',
                paddingTop: '3px', paddingBottom: '3px', backgroundColor: BADGE_BG, cornerRadius: '10px',
                contents: [{ type: 'text', text: c.badge, size: 'xxs', color: TCB_BLUE }] },
            ]},
            { type: 'text', text: c.name, weight: 'bold', size: 'xl', color: WHITE, margin: 'sm' },
            { type: 'text', text: c.sub, size: 'xxs', color: '#BDD5F0' },
          ],
        },
        {
          type: 'box', layout: 'vertical', backgroundColor: LIGHT,
          paddingStart: '14px', paddingEnd: '14px', paddingTop: '12px', paddingBottom: '12px', spacing: 'xs',
          contents: [
            { type: 'text', text: c.rate, weight: 'bold', size: 'xxl', color: TCB_BLUE },
            { type: 'text', text: '最低利率', size: 'xxs', color: GRAY_TEXT },
          ],
        },
        { type: 'separator', color: BORDER },
        {
          type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: WHITE,
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '💰', size: 'xs', flex: 0 },
              { type: 'text', text: `最高${c.limit}`, size: 'xs', color: '#1E293B', flex: 1, margin: 'sm' },
              { type: 'text', text: '📅', size: 'xs', flex: 0 },
              { type: 'text', text: `最長${c.term}`, size: 'xs', color: '#1E293B', flex: 1, margin: 'sm' },
            ]},
            ...c.tags.map((t) => ({ type: 'text', text: `✓ ${t}`, size: 'xxs', color: GRAY_TEXT })),
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: WHITE,
      contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
        action: { type: 'message', label: '開始線上申請', text: '開始線上申請' },
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
  const WHITE = '#FFFFFF';
  const LIGHT = '#FFF7ED';
  const HEADER_BG = '#7C3A00';
  const ACCENT = '#D97706';
  const BTN = '#92400E';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  return {
    type: 'flex',
    altText: '以房養老-幸福滿袋 產品介紹',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            backgroundColor: HEADER_BG,
            contents: [
              { type: 'text', text: '🏡', size: '3xl', align: 'center' },
              { type: 'text', text: '以房養老－幸福滿袋', weight: 'bold', size: 'lg', color: WHITE, align: 'center', margin: 'sm' },
              { type: 'text', text: 'REVERSE MORTGAGE', size: 'xxs', color: '#FDE68A', align: 'center' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '3px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: LIGHT, paddingAll: '16px', spacing: 'md',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '利率', size: 'sm', color: GRAY_TEXT, flex: 3 },
                { type: 'text', text: '分段2.338% / 一段2.608%', size: 'sm', weight: 'bold', color: ACCENT, flex: 7, wrap: true },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '年齡資格', size: 'sm', color: GRAY_TEXT, flex: 3 },
                { type: 'text', text: '年滿60歲以上', size: 'sm', weight: 'bold', color: '#1E293B', flex: 7 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '最高核貸', size: 'sm', color: GRAY_TEXT, flex: 3 },
                { type: 'text', text: '房屋估值 7成', size: 'sm', weight: 'bold', color: '#1E293B', flex: 7 },
              ]},
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '最長期間', size: 'sm', color: GRAY_TEXT, flex: 3 },
                { type: 'text', text: '35年', size: 'sm', weight: 'bold', color: '#1E293B', flex: 7 },
              ]},
            ],
          },
          { type: 'separator', color: BORDER },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', backgroundColor: WHITE,
            contents: [
              { type: 'text', text: '✓ 每月定額撥付，無需還款', size: 'sm', color: GRAY_TEXT },
              { type: 'text', text: '✓ 房屋繼續居住，照常使用', size: 'sm', color: GRAY_TEXT },
              { type: 'text', text: '✓ 保障晚年生活品質與尊嚴', size: 'sm', color: GRAY_TEXT },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: WHITE,
        contents: [{ type: 'button', style: 'primary', color: BTN,
          action: { type: 'message', label: '申請以房養老', text: '申請以房養老' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 月付試算表 — 白色金融風格 */
function buildRateTable(loanType: LoanType | null): LineReplyMessage {
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  const isMortgage = loanType !== LoanType.PERSONAL;
  const ACCENT = TCB_BLUE;
  const BTN = TCB_BLUE;
  const HDR = LIGHT;

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
        backgroundColor: i % 2 === 0 ? WHITE : '#F8FAFC',
        contents: [
          { type: 'text', text: `${t}年`, size: 'xxs', weight: 'bold', color: '#1E293B', flex: 3 },
          ...amounts.map((a) => ({ type: 'text', text: calcMonthlyPayment(a, rate, t), size: 'xxs', color: ACCENT, flex: 2, align: 'center' })),
        ],
      })),
    ];
    return {
      type: 'flex', altText: '信貸月付試算表',
      contents: {
        type: 'bubble', size: 'mega',
        body: {
          type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
          contents: [
            {
              type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
              backgroundColor: TCB_BLUE,
              contents: [
                { type: 'text', text: '💳 信貸月付試算表', weight: 'bold', size: 'md', color: WHITE },
                { type: 'text', text: `利率以 ${rate}% 試算 ｜ 最高可貸300萬`, size: 'xs', color: '#BDD5F0' },
              ],
            },
            { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
            { type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'none', contents: [
              { type: 'text', text: '每月應繳（元）', size: 'xxs', color: GRAY_TEXT, align: 'right', margin: 'none' },
              { type: 'box', layout: 'vertical', margin: 'sm', spacing: 'none', contents: rows },
              { type: 'separator', margin: 'md', color: BORDER },
              { type: 'text', text: '※ 實際利率依審核結果為準（1.78%~5.758%）', size: 'xxs', color: GRAY_TEXT, wrap: true, margin: 'md' },
            ]},
          ],
        },
        footer: {
          type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: WHITE,
          contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
            action: { type: 'message', label: '開始線上申請', text: '開始線上申請' },
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
      backgroundColor: i % 2 === 0 ? WHITE : '#F8FAFC',
      contents: [
        { type: 'text', text: `${t}年`, size: 'xxs', weight: 'bold', color: '#1E293B', flex: 3 },
        ...amounts.map((a) => ({ type: 'text', text: calcMonthlyPayment(a, rate, t), size: 'xxs', color: ACCENT, flex: 2, align: 'center' })),
      ],
    })),
  ];
  return {
    type: 'flex', altText: '房貸月付試算表',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
            backgroundColor: TCB_BLUE,
            contents: [
              { type: 'text', text: '🏠 房貸月付試算表', weight: 'bold', size: 'md', color: WHITE },
              { type: 'text', text: `利率以 ${rate}% 試算（青安方案）`, size: 'xs', color: '#BDD5F0' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          { type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'none', contents: [
            { type: 'text', text: '每月應繳（元）', size: 'xxs', color: GRAY_TEXT, align: 'right', margin: 'none' },
            { type: 'box', layout: 'vertical', margin: 'sm', spacing: 'none', contents: rows },
            { type: 'separator', margin: 'md', color: BORDER },
            { type: 'text', text: '※ 實際利率依審核結果為準（2.23%~2.45%）', size: 'xxs', color: GRAY_TEXT, wrap: true, margin: 'md' },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: WHITE,
        contents: [{ type: 'button', style: 'primary', color: BTN, height: 'sm',
          action: { type: 'message', label: '開始線上申請', text: '開始線上申請' },
        }],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** 申辦流程 — 白色金融風格 */
function buildApplicationSteps(loanType: LoanType | null): LineReplyMessage {
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  const isMortgage = loanType !== LoanType.PERSONAL;
  const ACCENT = TCB_BLUE;
  const BTN = TCB_BLUE;
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
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', paddingBottom: '12px', spacing: 'xs',
            backgroundColor: TCB_BLUE,
            contents: [
              { type: 'text', text: '📋 申辦流程', weight: 'bold', size: 'md', color: WHITE },
              { type: 'text', text: isMortgage ? '房屋貸款 5步驟輕鬆辦' : '信用貸款 5步驟快速核貸', size: 'xs', color: '#BDD5F0' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: LIGHT, paddingAll: '16px', spacing: 'lg',
            contents: steps.map((s, i) => ({
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'flex-start',
              contents: [
                {
                  type: 'box', layout: 'vertical', flex: 0, width: '28px', height: '28px',
                  backgroundColor: i === 0 ? ACCENT : BORDER, cornerRadius: '14px',
                  justifyContent: 'center', alignItems: 'center',
                  contents: [{ type: 'text', text: s.n, size: 'xs', color: i === 0 ? WHITE : ACCENT, align: 'center', weight: 'bold' }],
                },
                {
                  type: 'box', layout: 'vertical', flex: 1,
                  contents: [
                    { type: 'text', text: s.title, size: 'sm', weight: 'bold', color: '#1E293B' },
                    { type: 'text', text: s.desc, size: 'xs', color: GRAY_TEXT, wrap: true },
                  ],
                },
              ],
            })),
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: WHITE,
        contents: [{ type: 'button', style: 'primary', color: BTN,
          action: { type: 'message', label: '開始線上申請', text: '開始線上申請' },
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
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  const isMortgage = session.loanType === LoanType.MORTGAGE
    || session.loanType === LoanType.REVERSE_ANNUITY;
  const ACCENT = TCB_BLUE;
  const BTN = TCB_BLUE;

  const liffUploadId = process.env.LIFF_ID_UPLOAD;
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
  const uploadUrl = liffUploadId
    ? `https://liff.line.me/${liffUploadId}?token=${token}&loanType=${session.loanType ?? ''}`
    : `${frontendBase}/upload-docs?token=${token}&loanType=${session.loanType ?? ''}`;

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
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            backgroundColor: TCB_BLUE,
            contents: [
              { type: 'text', text: '📤 AI 文件辨識', weight: 'bold', size: 'lg', color: WHITE },
              { type: 'text', text: '上傳文件，AI 自動填入申請資料', size: 'xs', color: '#BDD5F0' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', backgroundColor: LIGHT, paddingAll: '16px', spacing: 'md',
            contents: docItems.map((d) => ({
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
              contents: [
                { type: 'text', text: d.icon, size: 'lg', flex: 0 },
                {
                  type: 'box', layout: 'vertical', flex: 1,
                  contents: [
                    { type: 'text', text: d.label, size: 'sm', weight: 'bold', color: '#1E293B' },
                    { type: 'text', text: d.desc, size: 'xxs', color: GRAY_TEXT },
                  ],
                },
              ],
            })),
          },
          { type: 'separator', color: BORDER },
          {
            type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: WHITE,
            contents: [
              { type: 'text', text: '✓ AI 自動辨識，節省填寫時間', size: 'xs', color: ACCENT },
              { type: 'text', text: '✓ 亦可選擇手動填寫', size: 'xs', color: GRAY_TEXT },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: WHITE,
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

/** IDLE → 歡迎訊息，以 Flex Bubble 選單呈現貸款類型入口 */
const handleIdle: StateHandler = (_session, _input) => ({
  nextState: ConversationState.CHOOSE_LOAN_TYPE,
  messages: [
    textMsg('👋 您好！歡迎使用合庫「個金Co-Pilot領航員」\n\n請從下方選單選擇您需要的服務：'),
    buildWelcomeMenu(),
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

  if (t === 'AI自動鑑價') {
    const liffValuateId = process.env.LIFF_ID_VALUATE;
    const frontendBase  = process.env.FRONTEND_URL || 'http://localhost:5173';
    const valuateUrl    = liffValuateId
      ? `https://liff.line.me/${liffValuateId}`
      : `${frontendBase}/valuate`;

    const TCB_BLUE_V = '#1B4F8A';
    const WHITE_V    = '#FFFFFF';

    return {
      nextState: ConversationState.CHOOSE_LOAN_TYPE,
      messages: [{
        type: 'flex',
        altText: '🏡 AI 自動鑑價 — 上傳謄本，即時估算房屋市值',
        contents: {
          type: 'bubble', size: 'mega',
          body: {
            type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE_V,
            contents: [
              {
                type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '16px',
                backgroundColor: TCB_BLUE_V, spacing: 'xs',
                contents: [
                  { type: 'text', text: '🏡 AI 自動鑑價', weight: 'bold', size: 'lg', color: WHITE_V },
                  { type: 'text', text: '上傳謄本 · AI 解析 · 即時鑑估', size: 'xs', color: '#BDD5F0' },
                ],
              },
              {
                type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
                contents: [
                  {
                    type: 'box', layout: 'horizontal', spacing: 'md',
                    contents: [
                      { type: 'text', text: '📄', size: 'xl', flex: 0 },
                      {
                        type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
                        contents: [
                          { type: 'text', text: 'Step 1 上傳謄本', weight: 'bold', size: 'sm', color: TCB_BLUE_V },
                          { type: 'text', text: '拍照或上傳土地建物謄本，AI 自動辨識坪數、屋齡等欄位', size: 'xs', color: '#64748B', wrap: true },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'box', layout: 'horizontal', spacing: 'md',
                    contents: [
                      { type: 'text', text: '🔍', size: 'xl', flex: 0 },
                      {
                        type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
                        contents: [
                          { type: 'text', text: 'Step 2 確認物件資訊', weight: 'bold', size: 'sm', color: TCB_BLUE_V },
                          { type: 'text', text: '確認縣市、建物類型、坪數等資料後送出鑑估', size: 'xs', color: '#64748B', wrap: true },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'box', layout: 'horizontal', spacing: 'md',
                    contents: [
                      { type: 'text', text: '📊', size: 'xl', flex: 0 },
                      {
                        type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
                        contents: [
                          { type: 'text', text: 'Step 3 查看鑑估結果', weight: 'bold', size: 'sm', color: TCB_BLUE_V },
                          { type: 'text', text: 'LSTM + RF+SDE 四層引擎，產出 P5/P50/P95 信心區間', size: 'xs', color: '#64748B', wrap: true },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: WHITE_V,
            contents: [
              {
                type: 'button', style: 'primary', color: TCB_BLUE_V,
                action: { type: 'uri', label: '🏡 開始 AI 自動鑑價', uri: valuateUrl },
              },
            ],
          },
        } as unknown as Record<string, unknown>,
      }],
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

  // 組合解析資料摘要
  const lines: string[] = ['📋 AI 文件辨識結果\n'];

  // MyData 資料
  if (session.applicantName) lines.push(`👤 姓名：${session.applicantName}`);
  if (session.idNumber) {
    const masked = session.idNumber.slice(0, 3) + '****' + session.idNumber.slice(-3);
    lines.push(`🪪 身分證：${masked}`);
  }
  if (session.basicInfo.income) {
    lines.push(`💰 月收入：NT$ ${session.basicInfo.income.toLocaleString()}`);
  }
  if (session.employer) lines.push(`🏢 就業單位：${session.employer}`);

  // 謄本資料（房貸/以房養老）
  const isMortgage = session.loanType !== LoanType.PERSONAL;
  if (isMortgage && session.landRegistryReady) {
    lines.push('');
    lines.push('🏠 土地建物謄本');
    if (session.propertyInfo.buildingType) lines.push(`  建物類型：${session.propertyInfo.buildingType}`);
    if (session.propertyInfo.floor) lines.push(`  樓層：${session.propertyInfo.floor} 樓`);
    if (session.propertyInfo.areaPing) lines.push(`  坪數：${session.propertyInfo.areaPing} 坪`);
    if (session.propertyInfo.propertyAge) lines.push(`  屋齡：${session.propertyInfo.propertyAge} 年`);
  }

  lines.push('\n請確認以上資料是否正確：');
  const summaryText = lines.join('\n');

  return {
    nextState: ConversationState.DOC_REVIEW,
    messages: [textMsg(summaryText, docReviewQuickReply())],
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

  return {
    nextState: ConversationState.COLLECT_EMPLOYER,
    messages: [textMsg('請問您目前任職的公司名稱？\n（例如：台積電、某某有限公司）')],
  };
};

/** 收集任職公司 */
const handleCollectEmployer: StateHandler = (session, input) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      nextState: ConversationState.COLLECT_EMPLOYER,
      messages: [textMsg('請輸入您目前任職的公司名稱')],
    };
  }
  session.employer = trimmed;

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
  const WHITE = '#FFFFFF';
  const LIGHT = '#F0F6FF';
  const TCB_BLUE = '#1B4F8A';
  const BORDER = '#E2E8F0';
  const GRAY_TEXT = '#64748B';
  const isMortgage = session.loanType === LoanType.MORTGAGE
    || session.loanType === LoanType.REVERSE_ANNUITY;
  const ACCENT = TCB_BLUE;
  const BTN = isMortgage ? TCB_BLUE : '#0F766E';

  const token = createSessionToken(session.userId);
  const liffAppId = process.env.LIFF_ID_APPLICATION;
  const frontendBaseApp = process.env.FRONTEND_URL || 'http://localhost:5173';
  const formUrl = liffAppId
    ? `https://liff.line.me/${liffAppId}?token=${token}`
    : `${frontendBaseApp}/application-form?token=${token}`;

  return {
    type: 'flex',
    altText: '📝 請填寫消費者貸款申請書並完成電子簽名',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: WHITE,
        contents: [
          {
            type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
            backgroundColor: TCB_BLUE,
            contents: [
              { type: 'text', text: '📝 填寫申請書', weight: 'bold', size: 'lg', color: WHITE },
              { type: 'text', text: '最後一步：完成電子申請書與簽名', size: 'xs', color: '#BDD5F0' },
            ],
          },
          { type: 'box', layout: 'vertical', height: '2px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
          {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', backgroundColor: LIGHT,
            contents: [
              { type: 'text', text: '申請書包含以下步驟：', size: 'xs', color: GRAY_TEXT },
              { type: 'text', text: '① 確認申貸資訊', size: 'sm', color: '#1E293B' },
              { type: 'text', text: '② 補充個人資料', size: 'sm', color: '#1E293B' },
              { type: 'text', text: '③ 閱讀並同意條款', size: 'sm', color: '#1E293B' },
              { type: 'text', text: '④ 手寫電子簽名', size: 'sm', color: '#1E293B' },
              { type: 'separator', margin: 'md', color: BORDER },
              { type: 'text', text: '⏱ 預計 2~3 分鐘完成', size: 'xs', color: ACCENT, margin: 'md' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm', backgroundColor: WHITE,
        contents: [
          { type: 'button', style: 'primary', color: BTN,
            action: { type: 'uri', label: '填寫申請書', uri: formUrl },
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

// ─────────────────────────────────────────────────────────────
// 以房養老獨立流程（RA Flow）
// ─────────────────────────────────────────────────────────────

const RA_GOLD  = '#92400E';
const RA_LIGHT = '#FEF3C7';

/** RA_INTRO：顯示以房養老介紹卡（由 conversationHandler 直接呼叫） */
export function buildRaIntroFlex(): LineReplyMessage {
  return {
    type: 'flex',
    altText: '🌸 以房養老幸福滿袋 — 讓房子養您一輩子',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: RA_GOLD, paddingAll: '20px', spacing: 'sm',
        contents: [
          { type: 'text', text: '🌸 以房養老', weight: 'bold', size: 'xxl', color: '#FFFFFF' },
          { type: 'text', text: '幸福滿袋 — 讓房子每月幫您賺生活費', size: 'sm', color: '#FDE68A', wrap: true },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'lg', backgroundColor: '#FFFBEB',
        contents: [
          { type: 'text', text: '什麼是以房養老？', weight: 'bold', size: 'lg', color: RA_GOLD },
          { type: 'text', size: 'md', color: '#374151', wrap: true,
            text: '您繼續住在自己的房子裡\n銀行每個月把錢匯給您\n不需要償還，讓房子成為您的退休收入' },
          { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#FCD34D', margin: 'md', contents: [{ type: 'filler' }] },
          ...([
            { icon: '🏠', text: '房子繼續住，安心有保障' },
            { icon: '💰', text: '每月固定撥付，安排生活費' },
            { icon: '📅', text: '最長 35 年，彈性選擇年限' },
          ].map((item) => ({
            type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
            contents: [
              { type: 'text', text: item.icon, size: 'xl', flex: 0 },
              { type: 'text', text: item.text, size: 'md', color: '#374151', flex: 1, wrap: true },
            ],
          }))),
          { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#FCD34D', margin: 'md', contents: [{ type: 'filler' }] },
          { type: 'text', text: '申請資格', weight: 'bold', size: 'md', color: RA_GOLD },
          { type: 'text', size: 'sm', color: '#374151', wrap: true,
            text: '✓ 年滿 60 歲以上\n✓ 名下有自有不動產\n✓ 房屋無查封或其他限制' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', backgroundColor: RA_LIGHT,
        contents: [
          { type: 'button', style: 'primary', color: RA_GOLD, height: 'md',
            action: { type: 'message', label: '🌸 開始試算', text: 'RA:開始申請' } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '返回主選單', text: '返回主選單' } },
        ],
      },
    } as unknown as Record<string, unknown>,
  };
}

/** RA_INTRO handler：等待「開始申請」指令 */
const handleRaIntro: StateHandler = (session, input) => {
  if (input.trim() === 'RA:開始申請') {
    return {
      nextState: ConversationState.RA_COLLECT_AGE,
      messages: [textMsg('🌸 好的，讓我們開始試算！\n\n請問您目前幾歲？\n\n（請直接輸入數字，例如：68）')],
    };
  }
  return { nextState: ConversationState.RA_INTRO, messages: [buildRaIntroFlex()] };
};

/** RA_COLLECT_AGE handler：確認 60~85 歲 */
const handleRaCollectAge: StateHandler = (session, input) => {
  const age = parseInt(input.trim(), 10);
  if (isNaN(age)) {
    return {
      nextState: ConversationState.RA_COLLECT_AGE,
      messages: [textMsg('請輸入您的年齡（例如：68）')],
    };
  }
  if (age < 60) {
    return {
      nextState: ConversationState.CHOOSE_LOAN_TYPE,
      messages: [textMsg(
        `您目前 ${age} 歲，以房養老申請資格為年滿 60 歲。\n\n如有需要，歡迎繼續試算房貸或信貸方案！`,
        { items: [
          { type: 'action', action: { type: 'message', label: '房貸試算', text: '房貸' } },
          { type: 'action', action: { type: 'message', label: '信貸試算', text: '信貸' } },
        ]},
      )],
    };
  }
  if (age > 85) {
    return {
      nextState: ConversationState.CHOOSE_LOAN_TYPE,
      messages: [textMsg(
        `您目前 ${age} 歲，建議您親洽合庫分行，由行員為您提供個別評估與建議。\n\n📞 客服：0800-054-599（週一至週五 09:00~17:30）`,
        { items: [
          { type: 'action', action: { type: 'message', label: '我想洽詢', text: '我想洽詢' } },
          { type: 'action', action: { type: 'message', label: '返回主選單', text: '返回主選單' } },
        ]},
      )],
    };
  }
  session.basicInfo.age = age;
  return {
    nextState: ConversationState.RA_COLLECT_AREA,
    messages: [textMsg(
      `✅ ${age} 歲，符合申請資格！\n\n請問您的房屋大約幾坪？`,
      { items: [
        { type: 'action', action: { type: 'message', label: '20坪以下', text: 'RA:坪數:15' } },
        { type: 'action', action: { type: 'message', label: '20～40坪', text: 'RA:坪數:30' } },
        { type: 'action', action: { type: 'message', label: '40～60坪', text: 'RA:坪數:50' } },
        { type: 'action', action: { type: 'message', label: '60坪以上', text: 'RA:坪數:70' } },
      ]},
    )],
  };
};

/** RA_COLLECT_AREA handler：收集坪數 */
const handleRaCollectArea: StateHandler = (session, input) => {
  const t = input.trim();
  let areaPing: number | null = null;
  if (t.startsWith('RA:坪數:')) areaPing = parseInt(t.slice('RA:坪數:'.length), 10);
  else { const n = parseFloat(t); if (!isNaN(n) && n > 0) areaPing = n; }

  if (!areaPing) {
    return {
      nextState: ConversationState.RA_COLLECT_AREA,
      messages: [textMsg('請選擇或輸入房屋坪數：',
        { items: [
          { type: 'action', action: { type: 'message', label: '20坪以下', text: 'RA:坪數:15' } },
          { type: 'action', action: { type: 'message', label: '20～40坪', text: 'RA:坪數:30' } },
          { type: 'action', action: { type: 'message', label: '40～60坪', text: 'RA:坪數:50' } },
          { type: 'action', action: { type: 'message', label: '60坪以上', text: 'RA:坪數:70' } },
        ]},
      )],
    };
  }
  session.propertyInfo.areaPing = areaPing;
  return {
    nextState: ConversationState.RA_COLLECT_PROP_AGE,
    messages: [textMsg('謝謝！\n\n請問房屋的屋齡大約幾年？',
      { items: [
        { type: 'action', action: { type: 'message', label: '10年以內', text: 'RA:屋齡:5' } },
        { type: 'action', action: { type: 'message', label: '10～20年', text: 'RA:屋齡:15' } },
        { type: 'action', action: { type: 'message', label: '20～30年', text: 'RA:屋齡:25' } },
        { type: 'action', action: { type: 'message', label: '30年以上', text: 'RA:屋齡:35' } },
      ]},
    )],
  };
};

/** RA_COLLECT_PROP_AGE handler：收集屋齡 */
const handleRaCollectPropAge: StateHandler = (session, input) => {
  const t = input.trim();
  let propAge: number | null = null;
  if (t.startsWith('RA:屋齡:')) propAge = parseInt(t.slice('RA:屋齡:'.length), 10);
  else { const n = parseInt(t, 10); if (!isNaN(n) && n >= 0) propAge = n; }

  if (propAge === null) {
    return {
      nextState: ConversationState.RA_COLLECT_PROP_AGE,
      messages: [textMsg('請選擇房屋屋齡：',
        { items: [
          { type: 'action', action: { type: 'message', label: '10年以內', text: 'RA:屋齡:5' } },
          { type: 'action', action: { type: 'message', label: '10～20年', text: 'RA:屋齡:15' } },
          { type: 'action', action: { type: 'message', label: '20～30年', text: 'RA:屋齡:25' } },
          { type: 'action', action: { type: 'message', label: '30年以上', text: 'RA:屋齡:35' } },
        ]},
      )],
    };
  }
  session.propertyInfo.propertyAge = propAge;
  return {
    nextState: ConversationState.RA_MONTHLY_WISH,
    messages: [textMsg(
      '最後一個問題 🌸\n\n您希望每個月大約領多少生活費？\n\n（不確定可以選「讓銀行幫我算」）',
      { items: [
        { type: 'action', action: { type: 'message', label: '3萬左右', text: 'RA:月領:30000' } },
        { type: 'action', action: { type: 'message', label: '5萬左右', text: 'RA:月領:50000' } },
        { type: 'action', action: { type: 'message', label: '8萬左右', text: 'RA:月領:80000' } },
        { type: 'action', action: { type: 'message', label: '讓銀行幫我算', text: 'RA:月領:0' } },
      ]},
    )],
  };
};

/** RA_MONTHLY_WISH handler：收集期望月領金額後進入推薦 */
const handleRaMonthlyWish: StateHandler = (session, input) => {
  const t = input.trim();
  if (t.startsWith('RA:月領:')) {
    const v = parseInt(t.slice('RA:月領:'.length), 10);
    if (v > 0) session.basicInfo.amount = v;
  }
  session.loanType = LoanType.REVERSE_ANNUITY;
  return {
    nextState: ConversationState.RECOMMEND,
    messages: [textMsg('🌸 資料收集完成！\n\n正在為您計算最適合的以房養老方案，請稍候...')],
  };
};

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
  [ConversationState.COLLECT_EMPLOYER]: handleCollectEmployer,
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
  // ── 以房養老獨立流程 ──
  [ConversationState.RA_INTRO]:           handleRaIntro,
  [ConversationState.RA_COLLECT_AGE]:     handleRaCollectAge,
  [ConversationState.RA_COLLECT_AREA]:    handleRaCollectArea,
  [ConversationState.RA_COLLECT_PROP_AGE]: handleRaCollectPropAge,
  [ConversationState.RA_MONTHLY_WISH]:    handleRaMonthlyWish,
  // AI 諮詢模式（實際處理在 conversationHandler.ts，此處為 fallback）
  [ConversationState.AI_CONSULTING]: (session) => ({
    nextState: ConversationState.AI_CONSULTING,
    messages: [{ type: 'text', text: '請輸入您的問題，或輸入「返回主選單」結束諮詢。' }],
  }),
};

/** 執行狀態轉移 */
export function transition(session: UserSession, input: string): TransitionResult {
  const handler = stateHandlers[session.state];
  return handler(session, input);
}
