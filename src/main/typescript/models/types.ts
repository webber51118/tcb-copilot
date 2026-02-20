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
  applicantName: string | null;
  applicantPhone: string | null;
  recommendedProductId: string | null;
  mydataReady: boolean | null;
  landRegistryReady: boolean | null;
  createdAt: number;
  updatedAt: number;
}

/** 貸款申請案件 */
export interface LoanApplication {
  /** 案件編號 TCB-YYYYMMDD-0001 */
  id: string;
  lineUserId: string;
  applicantName: string;
  applicantPhone: string;
  loanType: LoanType;
  basicInfo: BasicInfo;
  /** 信貸欄位皆為 null */
  propertyInfo: PropertyInfo;
  recommendedProductId: string;
  /** MYDATA 所得資料是否已備妥 */
  mydataReady: boolean;
  /** 土地建物謄本（信貸為 null） */
  landRegistryReady: boolean | null;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  appliedAt: string;
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

/** 產品資格條件 */
export interface ProductEligibility {
  /** 最低年齡（以房養老=60） */
  minAge?: number;
  /** 最高年齡 */
  maxAge?: number;
  /** 最低年收入（Next貸=800000） */
  minAnnualIncome?: number;
  /** 限定職業 */
  occupations?: OccupationType[];
  /** 限定房貸用途（Next貸=['資金週轉']） */
  mortgagePurposes?: string[];
  /** 首購限定（青安=true） */
  isFirstHomeBuyer?: boolean;
  /** 以房養老模式 */
  isReverseAnnuity?: boolean;
  /** 需薪轉帳戶 */
  hasSalaryAccount?: boolean;
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
  eligibility: ProductEligibility;
  features: string[];
  savingsHighlight: string;
  crossSell?: {
    insurance?: { name: string; price: string };
    creditCard?: { name: string; cashback: string; fee: string };
  };
}

/** 推薦結果 */
export interface RecommendationResult {
  primary: RecommendedProduct;
  alternatives: RecommendedProduct[];
  activePromotionIds: string[];
}
