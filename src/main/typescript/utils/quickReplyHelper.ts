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

/** 貸款類型選擇 */
export function loanTypeQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: [
      item('房屋貸款', '房貸'),
      item('信用貸款', '信貸'),
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
      item('投資理財'),
      item('消費性'),
      item('其他'),
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
