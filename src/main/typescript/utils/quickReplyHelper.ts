/**
 * INPUT: 對話狀態需要的選項清單
 * OUTPUT: LINE Quick Reply 按鈕物件
 * POS: 工具模組，產生各對話階段的 Quick Reply 按鈕
 */

import { QuickReplyItem } from '../models/types';
import { BuildingType, OccupationType } from '../models/enums';

/** 建立單一 Quick Reply 項目 */
function item(label: string, text?: string): QuickReplyItem {
  return {
    type: 'action',
    action: { type: 'message', label, text: text ?? label },
  };
}

/** 貸款類型選擇（主選單：房貸/信貸/AI智能推薦/當期活動） */
export function loanTypeQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('房屋貸款', '房貸'),
      item('信用貸款', '信貸'),
      item('AI智能推薦', 'AI智能推薦'),
      item('當期活動', '當期活動'),
    ],
  };
}

/** 職業選擇 */
export function occupationQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: Object.values(OccupationType).map((v) => item(v)),
  };
}

/** 貸款用途（房貸） */
export function mortgagePurposeQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('首購自住'),
      item('自住（已有房無貸款）', '自住'),
      item('資金週轉'),
      item('投資理財'),
      item('其他'),
    ],
  };
}

/** 貸款年限（以房養老） */
export function reverseAnnuityTermQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('10年', '10'),
      item('20年', '20'),
      item('30年', '30'),
      item('35年', '35'),
    ],
  };
}

/** 貸款用途（信貸） */
export function personalPurposeQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('資金周轉'),
      item('裝潢修繕'),
      item('投資理財'),
      item('醫療支出'),
      item('其他'),
    ],
  };
}

/** 貸款年限（房貸） */
export function mortgageTermQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('20年', '20'),
      item('30年', '30'),
      item('40年', '40'),
    ],
  };
}

/** 貸款年限（信貸） */
export function personalTermQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('3年', '3'),
      item('5年', '5'),
      item('7年', '7'),
    ],
  };
}

/** 是否有車位 */
export function parkingQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('有車位', '有'),
      item('無車位', '無'),
    ],
  };
}

/** 建物類型選擇 */
export function buildingTypeQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: Object.values(BuildingType).map((v) => item(v)),
  };
}

/** 格局選擇 */
export function layoutQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('1房1廳1衛'),
      item('2房1廳1衛'),
      item('3房2廳2衛'),
      item('4房2廳2衛'),
    ],
  };
}

/** 文件準備確認 */
export function prepareDocsQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('了解，開始填寫'),
      item('稍後再說'),
    ],
  };
}

/** MYDATA 所得資料確認 */
export function mydataQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('已備妥'),
      item('尚未取得'),
    ],
  };
}

/** 土地建物謄本確認 */
export function landRegQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('已備妥'),
      item('尚未取得'),
    ],
  };
}

/** AI 智能推薦第一題：主要需求 */
export function aiSuggestQ1QuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('購置房屋'),
      item('資金週轉'),
      item('退休養老'),
      item('個人資金需求'),
    ],
  };
}

/** AI 智能推薦第二題：有無房屋 */
export function aiSuggestQ2QuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('有房屋可抵押'),
      item('沒有房屋'),
    ],
  };
}

/** 確認送出申請 */
export function confirmApplyQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('確認送出申請', '確認送出'),
      item('取消', '重新開始'),
    ],
  };
}
