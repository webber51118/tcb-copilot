/**
 * INPUT: FullReviewRequest（借款人 + 房產 + 鑑價輸入）
 * OUTPUT: FullReviewResponse（三階段結果 + 最終摘要）
 * POS: 服務層，串接 Phase1 ML鑑價 → Phase2 5P徵審 → Phase3 審議小組
 */

import {
  FullReviewRequest,
  FullReviewResponse,
  WorkflowPhase1,
  WorkflowFinalSummary,
} from '../models/workflow';
import { callValuationEngine } from './valuationClient';
import { performCreditReview } from './creditReviewService';
import { runCommitteeReview } from './committeeReviewService';
import { ValuationResult } from '../models/types';
import { CreditReviewResult } from '../models/creditReview';
import {
  CommitteeReviewRequest,
  CreditReviewSummary,
  ValuationSummary,
} from '../models/committeeReview';

// ─── Demo 鑑價回退（Python 服務不可用時） ─────────────────────────

function buildDemoValuation(req: FullReviewRequest): ValuationResult {
  const estimatedValue = Math.round((req.loanAmount * 1.25) / 10000) * 10000;
  const ltvRatio = req.loanAmount / estimatedValue;
  const region = req.property?.region ?? '台北市';
  const buildingType = req.valuationInput?.buildingType ?? '大樓';

  return {
    estimatedValue,
    confidenceInterval: {
      p5: Math.round(estimatedValue * 0.85),
      p50: estimatedValue,
      p95: Math.round(estimatedValue * 1.15),
    },
    ltvRatio,
    riskLevel: ltvRatio <= 0.6 ? '低風險' : ltvRatio <= 0.75 ? '中風險' : '高風險',
    lstmIndex: 1.02,
    sentimentScore: 0.05,
    baseValue: Math.round(estimatedValue / 1.02),
    breakdown: { area: 0.5, floor: 0.1, age: 0.2, location: 0.2 },
    mode: 'demo',
    region,
    buildingType,
  };
}

// ─── 將徵審結果轉換為審議摘要 ──────────────────────────────────────

function buildCreditReviewSummary(
  creditResult: CreditReviewResult,
  loanType: 'mortgage' | 'personal',
): CreditReviewSummary {
  const { riskFactors, thresholds, fraudCheck, overallAssessment, adjustedLoanAmount } =
    creditResult;

  // 5P 風控評分：六大因子平均等級 → 百分制
  const levels = [
    riskFactors.employmentStability.level,
    riskFactors.incomeGrowth.level,
    riskFactors.netWorthLevel.level,
    riskFactors.netWorthRatio.level,
    riskFactors.liquidityRatio.level,
    riskFactors.debtRatio.level,
  ];
  const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
  const riskScore = Math.round((avgLevel / 10) * 100);

  // 主要合規指標
  const isPersonal = loanType === 'personal';
  const primaryMetricValue = isPersonal
    ? (thresholds.dbr?.value ?? thresholds.debtIncomeRatio.value)
    : thresholds.debtIncomeRatio.value;
  const primaryMetricLabel = isPersonal
    ? `DBR ${primaryMetricValue.toFixed(1)} 倍`
    : `負債比 ${(primaryMetricValue * 100).toFixed(2)}%`;
  const thresholdPass = isPersonal
    ? (thresholds.dbr?.pass ?? thresholds.debtIncomeRatio.pass)
    : thresholds.debtIncomeRatio.pass;

  // 防詐通過數（未觸發 = 通過）
  const fraudPassCount = fraudCheck.items.filter((item) => !item.triggered).length;

  return {
    riskScore,
    fraudLevel: fraudCheck.overallLevel,
    thresholdPass,
    primaryMetricValue,
    primaryMetricLabel,
    fraudPassCount,
    overallAssessment,
    adjustedLoanAmount,
  };
}

// ─── 主服務函式 ────────────────────────────────────────────────────

export async function runFullReview(req: FullReviewRequest): Promise<FullReviewResponse> {
  const startMs = Date.now();
  const applicationId = req.applicationId ?? `WF-${Date.now()}`;
  const isMortgage = req.loanType === 'mortgage';

  // ── Phase 1：ML 鑑價（房貸專用）──────────────────────────────────
  let valuationPhase: WorkflowPhase1 | undefined;
  let valuationResult: ValuationResult | undefined;

  if (isMortgage) {
    const p1Start = Date.now();
    let mode: 'live' | 'demo' = 'live';

    if (req.valuationInput && req.property) {
      try {
        valuationResult = await callValuationEngine({
          areaPing: req.valuationInput.areaPing,
          propertyAge: req.valuationInput.propertyAge,
          buildingType: req.valuationInput.buildingType,
          floor: req.valuationInput.floor,
          hasParking: req.valuationInput.hasParking,
          layout: req.valuationInput.layout,
          region: req.property.region,
          loanAmount: req.loanAmount,
        });
      } catch {
        // Python 服務不可用 → Demo 估算
        mode = 'demo';
        valuationResult = buildDemoValuation(req);
      }
    } else {
      // 未提供鑑價輸入 → Demo 估算
      mode = 'demo';
      valuationResult = buildDemoValuation(req);
    }

    valuationPhase = {
      mode,
      result: valuationResult,
      durationMs: Date.now() - p1Start,
    };
  }

  // ── Phase 2：5P 徵審 ───────────────────────────────────────────
  const p2Start = Date.now();
  const creditResult = await performCreditReview({
    loanType: req.loanType,
    loanAmount: req.loanAmount,
    termYears: req.termYears,
    borrower: req.borrower,
    guarantor: req.guarantor,
    property: req.property,
    valuation: valuationResult,
  });
  const creditPhase = {
    result: creditResult,
    durationMs: Date.now() - p2Start,
  };

  // ── Phase 3：審議小組 ──────────────────────────────────────────
  const p3Start = Date.now();
  const creditSummary = buildCreditReviewSummary(creditResult, req.loanType);

  let valuationSummary: ValuationSummary | undefined;
  if (isMortgage && valuationResult) {
    valuationSummary = {
      estimatedValue: valuationResult.estimatedValue,
      ltvRatio: valuationResult.ltvRatio,
      riskLevel: valuationResult.riskLevel,
      sentimentScore: valuationResult.sentimentScore,
    };
  }

  const committeeReq: CommitteeReviewRequest = {
    applicationId,
    loanType: req.loanType,
    loanAmount: req.loanAmount,
    termYears: req.termYears,
    borrowerName: req.borrower.name,
    borrowerAge: req.borrower.age,
    occupation: String(req.borrower.occupation),
    purpose: req.property?.purpose ?? '個人信用貸款',
    creditReviewSummary: creditSummary,
    valuationSummary,
  };

  const committeeResult = await runCommitteeReview(committeeReq);
  const committeePhase = {
    result: committeeResult,
    durationMs: Date.now() - p3Start,
  };

  // ── 最終摘要 ──────────────────────────────────────────────────
  const finalSummary: WorkflowFinalSummary = {
    decision: committeeResult.finalDecision.decision,
    approvedAmount: committeeResult.finalDecision.approvedAmount,
    approvedTermYears: committeeResult.finalDecision.approvedTermYears,
    interestRateHint: committeeResult.finalDecision.interestRateHint,
    conditions: committeeResult.finalDecision.conditions,
    estimatedValue: valuationResult?.estimatedValue,
    ltvRatio: valuationResult?.ltvRatio,
    riskScore: creditSummary.riskScore,
    fraudLevel: creditResult.fraudCheck.overallLevel,
  };

  return {
    success: true,
    applicationId,
    loanType: req.loanType,
    phases: {
      valuation: valuationPhase,
      creditReview: creditPhase,
      committeeReview: committeePhase,
    },
    finalSummary,
    totalDurationMs: Date.now() - startMs,
  };
}
