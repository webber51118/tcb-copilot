/**
 * INPUT: enums.ts（OccupationType）、types.ts（ValuationResult）
 * OUTPUT: 徵審引擎所有類型定義（CreditReviewRequest, CreditReviewResult, 子介面）
 * POS: 資料模型層，定義 5P 徵審系統共用 TypeScript 介面
 */

import { OccupationType } from './enums';
import { ValuationResult } from './types';

// ─────────────────────────────────────────────────────────────────
// 請求介面
// ─────────────────────────────────────────────────────────────────

/** 借款人資料 */
export interface BorrowerInput {
  name: string;
  age: number;
  occupation: OccupationType;
  isPublicServant: boolean;
  yearsEmployed: number;
  hasMyData: boolean;

  // 所得（月/年）
  monthlyIncome: number;
  laborInsuranceGrade?: number;
  incomeRaisedRecently?: boolean;
  salaryIncome?: number;
  businessIncome?: number;
  rentalIncome?: number;
  dividendIncome?: number;
  otherIncome?: number;
  nonRecurringIncome?: number;

  // 資產（元）
  bankDepositHere?: number;
  bankDepositOther?: number;
  stocks?: number;
  unlistedStocks?: number;
  bonds?: number;
  funds?: number;
  insuranceSurrenderValue?: number;
  vehicles?: number;
  existingRealEstate?: number;
  otherAssets?: number;

  // 負債（聯徵，月付額）
  existingMortgageMonthly?: number;
  existingPersonalLoanMonthly?: number;
  otherLoanMonthly?: number;
  totalUnsecuredDebt?: number;

  // 防詐查核
  creditInquiriesLast2Months?: number;
  hasExistingBankLoan?: boolean;
  hasPropertyOwnership?: boolean;
  livesInBranchCounty?: boolean;
  hasSalaryTransferHere?: boolean;
  hasBadCreditHistory?: boolean;
  hasBankBadRecord?: boolean;
  documentMatchesMyData?: boolean;
}

/** 保證人資料（選填） */
export interface GuarantorInput {
  name: string;
  age: number;
  occupation: OccupationType;
  isPublicServant: boolean;
  yearsEmployed: number;
  monthlyIncome: number;
  laborInsuranceGrade?: number;
  bankDepositHere?: number;
  existingRealEstate?: number;
  existingMortgageMonthly?: number;
  existingPersonalLoanMonthly?: number;
  totalUnsecuredDebt?: number;
}

/** 房貸標的物資料（房貸專用） */
export interface PropertyInput {
  region: string;
  isFirstHome: boolean;
  isOwnerOccupied: boolean;
  purpose: '購屋' | '週轉金' | '其他';
  isInvestor?: boolean;
  isBuilderBackground?: boolean;
}

/** 徵審請求 */
export interface CreditReviewRequest {
  loanType: 'mortgage' | 'personal';
  loanAmount: number;
  termYears: number;
  gracePeriodYears?: number;
  borrower: BorrowerInput;
  guarantor?: GuarantorInput;
  property?: PropertyInput;
  valuation?: ValuationResult;
}

// ─────────────────────────────────────────────────────────────────
// 回應介面
// ─────────────────────────────────────────────────────────────────

/** P1 借保戶概況 */
export interface BorrowerProfileResult {
  isRelatedParty: boolean;
  firstHomePurchaseEligible: boolean;
  greenHousingEligible: boolean;
  myDataProvided: boolean;
}

/** P2 授信用途 */
export interface CreditPurposeResult {
  purpose: string;
  isInvestorDetected: boolean;
  loanTermCheck: { pass: boolean; maxAllowed: number; requested: number };
  builderBackgroundDetected: boolean;
}

/** P3 個人收支平衡表 */
export interface RepaymentSourceResult {
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyBalance: number;
  incomeBreakdown: Record<string, number>;
  expenseBreakdown: Record<string, number>;
}

/** P4 資產負債表 */
export interface CreditProtectionResult {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidAssets: number;
  shortTermLiabilities: number;
  realEstateValue: number;
  ltvRatio?: number;
}

/** 風控因子評分（1-10 級） */
export interface RiskFactorScore {
  level: number;
  label: string;
  notes: string;
}

/** P5 六大風控因子 */
export interface RiskFactorsResult {
  employmentStability: RiskFactorScore;
  incomeGrowth: RiskFactorScore;
  netWorthLevel: RiskFactorScore;
  netWorthRatio: RiskFactorScore;
  liquidityRatio: RiskFactorScore;
  debtRatio: RiskFactorScore;
}

/** 額度調整指標 */
export interface ThresholdsResult {
  debtIncomeRatio: { value: number; limit: number; pass: boolean };
  dbr?: { value: number; limit: 22; pass: boolean };
  monthlyPaymentRatio?: { value: number; limit: number; pass: boolean };
}

/** 防詐查核項目 */
export interface FraudCheckItem {
  id: number;
  description: string;
  triggered: boolean;
}

/** 防詐模型結果 */
export interface FraudCheckResult {
  items: FraudCheckItem[];
  overallLevel: 'normal' | 'caution' | 'alert';
  message: string;
}

/** 徵審完整結果 */
export interface CreditReviewResult {
  loanType: 'mortgage' | 'personal';
  borrowerProfile: BorrowerProfileResult;
  creditPurpose: CreditPurposeResult;
  repaymentSource: RepaymentSourceResult;
  creditProtection: CreditProtectionResult;
  riskFactors: RiskFactorsResult;
  thresholds: ThresholdsResult;
  fraudCheck: FraudCheckResult;
  requiresManualReview: boolean;
  adjustedLoanAmount?: number;
  overallAssessment: string;
  suggestedActions: string[];
  reportJson: object;
  reportPdfPath?: string;
  mode: 'demo';
  timestamp: string;
}
