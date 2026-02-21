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

/** AI 文件解析結果（MyData + 土地建物謄本） */
export interface DocumentParseResult {
  /** MYDATA 解析結果 */
  mydata?: {
    name?: string;
    idNumber?: string;
    annualIncome?: number;
    employer?: string;
    phone?: string;
  };
  /** 土地建物謄本解析結果 */
  landRegistry?: {
    buildingType?: string;
    floor?: number;
    areaPing?: number;
    propertyAge?: number;
  };
  /** 解析是否成功 */
  success: boolean;
  /** 失敗原因（如解析失敗） */
  error?: string;
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
  /** 身分證字號（從 MyData 解析） */
  idNumber: string | null;
  /** 雇主/就業單位（從 MyData 解析） */
  employer: string | null;
  /** 年所得總額（從 MyData 解析，單位：元） */
  annualIncome: number | null;
  /** 是否已透過文件解析預填資料 */
  parsedFromDoc: boolean;
  /** 文件解析摘要是否已確認 */
  docReviewConfirmed: boolean;
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

// ─────────────────────────────────────────────────────────────────
// ML 鑑價 SubAgent（POST /api/valuate）
// ─────────────────────────────────────────────────────────────────

/** 鑑價請求（camelCase，由 Node.js 轉 snake_case 後傳給 Python） */
export interface ValuationRequest {
  /** 坪數（大於 0） */
  areaPing: number;
  /** 屋齡（年，0~80） */
  propertyAge: number;
  /** 建物類型：大樓 / 華廈 / 公寓 / 透天 / 別墅 */
  buildingType: string;
  /** 樓層（1~99） */
  floor: number;
  /** 是否含車位 */
  hasParking: boolean;
  /** 格局（例：3房2廳） */
  layout: string;
  /** 縣市（例：台北市） */
  region: string;
  /** 申請貸款金額（元） */
  loanAmount: number;
}

/** 蒙地卡羅信心區間 */
export interface ValuationConfidenceInterval {
  /** P5 悲觀估值（元） */
  p5: number;
  /** P50 中位估值（元，建議鑑估值） */
  p50: number;
  /** P95 樂觀估值（元） */
  p95: number;
}

/** 鑑價結果（Python 服務回傳，camelCase 轉換後） */
export interface ValuationResult {
  /** 建議鑑估值（P50，元） */
  estimatedValue: number;
  /** 蒙地卡羅信心區間 */
  confidenceInterval: ValuationConfidenceInterval;
  /** 貸款成數（loanAmount / estimatedValue） */
  ltvRatio: number;
  /** 風險等級：低風險 / 中風險 / 高風險 */
  riskLevel: '低風險' | '中風險' | '高風險';
  /** LSTM 市場指數 */
  lstmIndex: number;
  /** RF+SDE 情緒分數（-1 ~ 1） */
  sentimentScore: number;
  /** 基準估值（未套用市場指數，元） */
  baseValue: number;
  /** 各係數明細 */
  breakdown: Record<string, number>;
  /** 運算模式：demo / production */
  mode: 'demo' | 'production';
  /** 縣市 */
  region: string;
  /** 建物類型 */
  buildingType: string;
}
