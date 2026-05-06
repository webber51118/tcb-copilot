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
  PilotCrewRequest,
  PilotCrewResult,
  FraudMlScore,
} from '../models/workflow';
import { callValuationEngine } from './valuationClient';
import { performCreditReview } from './creditReviewService';
import { runCommitteeReview } from './committeeReviewService';
import { recommendProducts } from './recommendationEngine';
import { recordAgentCall } from '../config/agentMonitorStore';
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
        recordAgentCall('ML鑑價引擎', true, Date.now() - p1Start);
      } catch {
        // Python 服務不可用 → Demo 估算
        mode = 'demo';
        valuationResult = buildDemoValuation(req);
        recordAgentCall('ML鑑價引擎', false);
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
  recordAgentCall('5P徵審引擎', true, Date.now() - p2Start);
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
  recordAgentCall('委員會審議', true, Date.now() - p3Start);
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

// ─── 三位一體 PILOT CREW（並行架構）────────────────────────────────

/**
 * 呼叫 CREW 3 防詐 PILOT ML 評分服務（Python FastAPI port 8002）
 * FRAUD_SCORING_API_URL 未設定時使用 Demo 規則評分。
 */
async function callFraudScoringService(
  input: PilotCrewRequest['fraudInput'],
): Promise<FraudMlScore> {
  const baseUrl = process.env['FRAUD_SCORING_API_URL'] ?? 'http://localhost:8002';
  try {
    const resp = await fetch(`${baseUrl}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age:                    input.age,
        occupation_code:        input.occupationCode,
        monthly_income:         input.monthlyIncome,
        credit_inquiry_count:   input.creditInquiryCount,
        existing_bank_loans:    input.existingBankLoans,
        has_real_estate:        input.hasRealEstate,
        document_match:         input.documentMatch,
        lives_in_branch_county: input.livesInBranchCounty,
        has_salary_transfer:    input.hasSalaryTransfer,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as {
      fraud_score: number;
      risk_level: string;
      top_risk_factors: Array<{ feature: string; label: string; contribution: number }>;
      mode: string;
    };
    const score = data.fraud_score;
    const alertLevel: 1 | 2 | 3 = score <= 0.4 ? 1 : score <= 0.7 ? 2 : 3;
    return {
      fraudScore: score,
      riskLevel: data.risk_level as 'low' | 'medium' | 'high',
      topRiskFactors: data.top_risk_factors,
      alertLevel,
      mode: data.mode as 'live' | 'demo',
    };
  } catch {
    // Demo 降級：規則加權評分（對應 Python fraudScoringService.py 的 _demo_score 邏輯）
    let score = 0;
    const factors: Array<{ feature: string; label: string; contribution: number }> = [];

    if (!input.documentMatch) {
      score += 0.35;
      factors.push({ feature: 'document_match', label: '證件比對不一致', contribution: 0.35 });
    }
    const inquiryContrib = Math.min(input.creditInquiryCount * 0.06, 0.25);
    if (inquiryContrib > 0) {
      score += inquiryContrib;
      factors.push({ feature: 'credit_inquiry_count', label: '聯徵查詢次數過高', contribution: inquiryContrib });
    }
    if (input.occupationCode === 0 || input.occupationCode === 4) {
      score += 0.15;
      factors.push({ feature: 'occupation_code', label: '職業穩定性不足', contribution: 0.15 });
    }
    if (!input.livesInBranchCounty) {
      score += 0.10;
      factors.push({ feature: 'lives_in_branch_county', label: '非服務縣市居民', contribution: 0.10 });
    }
    if (!input.hasSalaryTransfer) {
      score += 0.08;
      factors.push({ feature: 'has_salary_transfer', label: '無薪轉往來', contribution: 0.08 });
    }
    const loanContrib = Math.min(input.existingBankLoans * 0.04, 0.15);
    if (loanContrib > 0) {
      score += loanContrib;
      factors.push({ feature: 'existing_bank_loans', label: '現有借款筆數多', contribution: loanContrib });
    }
    if (!input.hasRealEstate) {
      score += 0.05;
      factors.push({ feature: 'has_real_estate', label: '無不動產擔保', contribution: 0.05 });
    }
    if (input.monthlyIncome < 3) {
      score += 0.08;
      factors.push({ feature: 'monthly_income', label: '月收入偏低', contribution: 0.08 });
    } else if (input.monthlyIncome < 5) {
      score += 0.04;
      factors.push({ feature: 'monthly_income', label: '月收入偏低', contribution: 0.04 });
    }
    score = Math.min(Math.round(score * 100) / 100, 0.99);
    const alertLevel: 1 | 2 | 3 = score <= 0.4 ? 1 : score <= 0.7 ? 2 : 3;
    const topRiskFactors = factors
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);
    return {
      fraudScore: score,
      riskLevel: score <= 0.4 ? 'low' : score <= 0.7 ? 'medium' : 'high',
      topRiskFactors,
      alertLevel,
      mode: 'demo',
    };
  }
}

/**
 * 三位一體 PILOT CREW 並行審核
 *
 * - CREW 1 行銷 PILOT：InstructRec 三層推薦（recommendationEngine）
 * - CREW 2 鑑估 PILOT：XGBoost + Monte Carlo 鑑價（valuationClient，房貸限定）
 * - CREW 3 防詐 PILOT：ML 異常評分（fraudScoringService，Python port 8002）
 *
 * 三 Crew 同時啟動（Promise.all），總流程時間壓縮至最慢單 Crew 時間。
 * 推論完成後，呼叫 powerBIClient.py 推送行員個案即時儀表板（選配）。
 */
export async function runPilotCrewReview(req: PilotCrewRequest): Promise<PilotCrewResult> {
  const startMs = Date.now();
  const applicationId = req.applicationId ?? `PILOT-${Date.now()}`;
  const isMortgage = req.loanType === 'mortgage';

  // ── 三 Crew 並行啟動 ─────────────────────────────────────────────

  const crew1Promise = (async () => {
    const t = Date.now();
    const recommendation = recommendProducts(req.session);
    recordAgentCall('CREW1-行銷PILOT', true, Date.now() - t);
    return { recommendation, durationMs: Date.now() - t };
  })();

  const crew2Promise = isMortgage
    ? (async () => {
        const t = Date.now();
        let mode: 'live' | 'demo' = 'live';
        let result: ValuationResult;
        if (req.valuationInput && req.property) {
          try {
            result = await callValuationEngine({
              areaPing:     req.valuationInput.areaPing,
              propertyAge:  req.valuationInput.propertyAge,
              buildingType: req.valuationInput.buildingType,
              floor:        req.valuationInput.floor,
              hasParking:   req.valuationInput.hasParking,
              layout:       req.valuationInput.layout,
              region:       req.property.region,
              loanAmount:   (req.session.basicInfo.amount ?? 0),
            });
            recordAgentCall('CREW2-鑑估PILOT', true, Date.now() - t);
          } catch {
            mode = 'demo';
            const est = Math.round((req.session.basicInfo.amount ?? 5_000_000) * 1.25);
            result = {
              estimatedValue: est,
              confidenceInterval: { p5: Math.round(est * 0.85), p50: est, p95: Math.round(est * 1.15) },
              ltvRatio: (req.session.basicInfo.amount ?? 0) / est,
              riskLevel: '中風險',
              lstmIndex: 1.0,
              sentimentScore: 0,
              baseValue: est,
              breakdown: { area: 0.5, floor: 0.1, age: 0.2, location: 0.2 },
              mode: 'demo',
              region: req.property.region,
              buildingType: req.valuationInput.buildingType,
            };
            recordAgentCall('CREW2-鑑估PILOT', false);
          }
        } else {
          mode = 'demo';
          const est = Math.round((req.session.basicInfo.amount ?? 5_000_000) * 1.25);
          result = {
            estimatedValue: est,
            confidenceInterval: { p5: Math.round(est * 0.85), p50: est, p95: Math.round(est * 1.15) },
            ltvRatio: (req.session.basicInfo.amount ?? 0) / est,
            riskLevel: '中風險',
            lstmIndex: 1.0,
            sentimentScore: 0,
            baseValue: est,
            breakdown: { area: 0.5, floor: 0.1, age: 0.2, location: 0.2 },
            mode: 'demo',
            region: '',
            buildingType: '',
          };
        }
        return { mode, result, durationMs: Date.now() - t };
      })()
    : Promise.resolve(undefined);

  const crew3Promise = (async () => {
    const t = Date.now();
    const mlScore = await callFraudScoringService(req.fraudInput);
    recordAgentCall('CREW3-防詐PILOT', true, Date.now() - t);
    return { mlScore, durationMs: Date.now() - t };
  })();

  // ── 等待三 Crew 全部完成 ──────────────────────────────────────────
  const [crew1, crew2Raw, crew3] = await Promise.all([crew1Promise, crew2Promise, crew3Promise]);

  return {
    success: true,
    applicationId,
    loanType: req.loanType,
    crew1,
    crew2: crew2Raw ?? undefined,
    crew3,
    totalDurationMs: Date.now() - startMs,
  };
}
