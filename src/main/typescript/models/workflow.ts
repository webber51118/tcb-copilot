/**
 * INPUT: 無（純型別定義）
 * OUTPUT: 完整貸款審核工作流程 Full Pipeline 所需型別
 * POS: 型別層，供 workflowService / workflow API 共用
 */

import { ValuationResult } from './types';
import { CreditReviewRequest, CreditReviewResult } from './creditReview';
import { CommitteeReviewResponse } from './committeeReview';

// ─── 工作流程請求 ────────────────────────────────────────────────

/**
 * 完整審核請求：整合鑑價 + 徵審 + 審議 所需資料
 * 若 loanType = personal，property / valuationInput 可省略
 */
export interface FullReviewRequest {
  /** 案件識別碼（選填，系統自動產生） */
  applicationId?: string;
  /** 貸款類型 */
  loanType: 'mortgage' | 'personal';
  /** 申請金額（元） */
  loanAmount: number;
  /** 貸款年限（年） */
  termYears: number;
  /** 借款人基本資訊（與 credit-review 相同） */
  borrower: CreditReviewRequest['borrower'];
  /** 保證人（選填） */
  guarantor?: CreditReviewRequest['guarantor'];
  /** 房貸標的物（房貸必填） */
  property?: CreditReviewRequest['property'];
  /** 鑑價所需額外資訊（房貸必填） */
  valuationInput?: {
    areaPing: number;
    propertyAge: number;
    buildingType: string;
    floor: number;
    hasParking: boolean;
    layout: string;
  };
}

// ─── 工作流程各階段 ──────────────────────────────────────────────

export interface WorkflowPhase1 {
  /** 執行模式：live = Python 服務回應；demo = 本地估算 */
  mode: 'live' | 'demo';
  result: ValuationResult;
  durationMs: number;
}

export interface WorkflowPhase2 {
  result: CreditReviewResult;
  durationMs: number;
}

export interface WorkflowPhase3 {
  result: CommitteeReviewResponse;
  durationMs: number;
}

// ─── 最終摘要 ─────────────────────────────────────────────────────

export interface WorkflowFinalSummary {
  decision: '核准' | '有條件核准' | '婉拒';
  approvedAmount: number;
  approvedTermYears: number;
  interestRateHint: string;
  conditions: string[];
  /** 鑑估值（房貸） */
  estimatedValue?: number;
  /** 貸款成數（房貸） */
  ltvRatio?: number;
  /** 5P 風控評分 */
  riskScore: number;
  /** 防詐查核等級 */
  fraudLevel: 'normal' | 'caution' | 'alert';
}

// ─── 工作流程回應 ────────────────────────────────────────────────

export interface FullReviewResponse {
  success: true;
  applicationId: string;
  loanType: 'mortgage' | 'personal';
  phases: {
    /** Phase 1：ML 鑑價（僅房貸） */
    valuation?: WorkflowPhase1;
    /** Phase 2：5P 徵審 */
    creditReview: WorkflowPhase2;
    /** Phase 3：審議小組 */
    committeeReview: WorkflowPhase3;
  };
  finalSummary: WorkflowFinalSummary;
  totalDurationMs: number;
}

export interface FullReviewErrorResponse {
  success: false;
  message: string;
  phase?: 'valuation' | 'creditReview' | 'committeeReview';
}
