/**
 * INPUT: 無（純型別定義）
 * OUTPUT: 授信審議小組 Multi-Agent 系統所需的所有 TypeScript 型別
 * POS: 型別層，供 committeeReviewService / committeeReview API 共用
 */

// ─── 代辦（Agent）識別 ─────────────────────────────────────────

export type CommitteeAgent =
  | '授信規定領航員'
  | '徵信領航員'
  | '鑑價領航員';

export type AgentRecommendation =
  | '強烈建議核准'
  | '建議核准'
  | '有條件核准'
  | '需補件'
  | '建議婉拒';

// ─── Request ────────────────────────────────────────────────────

/** 徵審關鍵指標摘要（來自 credit-review API 回應） */
export interface CreditReviewSummary {
  /** 5P 綜合風控評分（0-100） */
  riskScore: number;
  /** 防詐查核等級 */
  fraudLevel: 'normal' | 'caution' | 'alert';
  /** 合規門檻是否通過（DBR 或負債比） */
  thresholdPass: boolean;
  /** 主要合規指標值（負債比%或DBR倍數） */
  primaryMetricValue: number;
  /** 主要合規指標說明（如「負債比 53.75%」） */
  primaryMetricLabel: string;
  /** 防詐通過項目數/8 */
  fraudPassCount: number;
  /** 整體評估說明（來自 overallAssessment） */
  overallAssessment: string;
  /** 建議調整後金額（若有超標） */
  adjustedLoanAmount?: number;
}

/** 鑑價摘要（房貸專用） */
export interface ValuationSummary {
  /** 建議鑑估值（元） */
  estimatedValue: number;
  /** 貸款成數 */
  ltvRatio: number;
  /** 風險等級 */
  riskLevel: '低風險' | '中風險' | '高風險';
  /** 市場情緒分數（-1 ~ 1） */
  sentimentScore: number;
}

/** 審議小組請求 */
export interface CommitteeReviewRequest {
  /** 案件識別碼（選填） */
  applicationId?: string;
  /** 貸款類型 */
  loanType: 'mortgage' | 'personal';
  /** 申請金額（元） */
  loanAmount: number;
  /** 貸款年限（年） */
  termYears: number;
  /** 借款人姓名 */
  borrowerName: string;
  /** 借款人年齡 */
  borrowerAge: number;
  /** 職業 */
  occupation: string;
  /** 貸款用途 */
  purpose: string;
  /** 徵審關鍵指標摘要 */
  creditReviewSummary: CreditReviewSummary;
  /** 鑑價摘要（房貸時必填） */
  valuationSummary?: ValuationSummary;
}

// ─── 討論輪次 ────────────────────────────────────────────────────

/** 單一代辦意見 */
export interface AgentOpinion {
  agent: CommitteeAgent;
  /** 代辦發言摘要 */
  opinion: string;
  /** 建議 */
  recommendation: AgentRecommendation;
  /** 關鍵依據（1-3 點） */
  keyPoints: string[];
}

/** 一輪討論 */
export interface CommitteeRound {
  roundNumber: 1 | 2 | 3;
  roundTitle: string;
  opinions: AgentOpinion[];
}

// ─── 最終決議 ────────────────────────────────────────────────────

export type FinalDecision = '核准' | '有條件核准' | '婉拒';

export interface CommitteeFinalDecision {
  decision: FinalDecision;
  /** 核准金額（元） */
  approvedAmount: number;
  /** 核准年限 */
  approvedTermYears: number;
  /** 建議利率說明 */
  interestRateHint: string;
  /** 附加條件（若有條件核准） */
  conditions: string[];
  /** 決議摘要（1-2 句） */
  summary: string;
  /** 票決結果（各代辦最終建議） */
  votes: { agent: CommitteeAgent; recommendation: AgentRecommendation }[];
}

// ─── Response ────────────────────────────────────────────────────

export interface CommitteeReviewResponse {
  success: true;
  applicationId: string;
  rounds: CommitteeRound[];
  finalDecision: CommitteeFinalDecision;
  /** 執行時間（毫秒） */
  durationMs: number;
}

export interface CommitteeReviewErrorResponse {
  success: false;
  message: string;
}
