/**
 * INPUT: enums.ts（ConversationState, LoanType, BuildingType, OccupationType）
 * OUTPUT: UserSession, BasicInfo, PropertyInfo 等介面定義
 * POS: 資料模型層，定義全系統共用的 TypeScript 介面
 */

import { ConversationState, LoanType, BuildingType, OccupationType } from './enums';

/** 使用者基本資訊 */
export interface BasicInfo {
  age: number | null;
  occupation: OccupationType | null;
  income: number | null;
  purpose: string | null;
  termYears: number | null;
  amount: number | null;
}

/** 房貸標的物資訊 */
export interface PropertyInfo {
  propertyAge: number | null;
  areaPing: number | null;
  hasParking: boolean | null;
  layout: string | null;
  floor: number | null;
  buildingType: BuildingType | null;
}

/** 使用者對話 Session */
export interface UserSession {
  userId: string;
  state: ConversationState;
  loanType: LoanType | null;
  basicInfo: BasicInfo;
  propertyInfo: PropertyInfo;
  createdAt: number;
  updatedAt: number;
}

/** 狀態轉移結果 */
export interface TransitionResult {
  nextState: ConversationState;
  messages: LineReplyMessage[];
}

/** LINE 回覆訊息 */
export interface LineReplyMessage {
  type: 'text' | 'flex' | 'image';
  text?: string;
  altText?: string;
  contents?: Record<string, unknown>;
  originalContentUrl?: string;
  previewImageUrl?: string;
  quickReply?: {
    items: QuickReplyItem[];
  };
}

/** Quick Reply 項目 */
export interface QuickReplyItem {
  type: 'action';
  action: {
    type: 'message';
    label: string;
    text: string;
  };
}

/** 推薦產品 */
export interface RecommendedProduct {
  id: string;
  name: string;
  rank: number;
  rateRange: string;
  rateValue: number;
  maxAmount: number;
  maxTermYears: number;
  gracePeriodYears?: number;
  features: string[];
  savingsHighlight: string;
  monthlyPayment?: number;
  crossSell?: {
    insurance?: { name: string; price: string };
    creditCard?: { name: string; cashback: string; fee: string };
  };
}

/** 產品資料庫結構 */
export interface ProductCatalog {
  mortgage: ProductDefinition[];
  personal: ProductDefinition[];
}

/** 產品定義 */
export interface ProductDefinition {
  id: string;
  name: string;
  rank: number;
  rateRange: string;
  rateValue: number;
  maxAmount: number;
  maxTermYears: number;
  gracePeriodYears?: number;
  eligibility: {
    maxAge?: number;
    firstTimeBuyer?: boolean;
    occupations?: OccupationType[];
    hasSalaryAccount?: boolean;
  };
  features: string[];
  savingsHighlight: string;
  crossSell?: {
    insurance?: { name: string; price: string };
    creditCard?: { name: string; cashback: string; fee: string };
  };
}
