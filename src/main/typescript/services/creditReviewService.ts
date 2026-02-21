/**
 * INPUT: CreditReviewRequest
 * OUTPUT: CreditReviewResult（完整 5P 徵審結果）
 * POS: 服務層，整合六大 scorer 與 fraudDetector，回傳批覆書所需全部資料
 */

import {
  CreditReviewRequest,
  CreditReviewResult,
  CreditPurposeResult,
} from '../models/creditReview';
import { scoreBorrowerProfile } from './creditReview/borrowerProfileScorer';
import { scoreRepaymentSource } from './creditReview/repaymentSourceScorer';
import { scoreCreditProtection } from './creditReview/creditProtectionScorer';
import { scoreRiskFactors } from './creditReview/riskFactorScorer';
import { checkThresholds } from './creditReview/thresholdChecker';
import { detectFraud } from './creditReview/fraudDetector';
import { generateCreditReport } from './creditReportGenerator';

// ─── P2 授信用途分析 ───────────────────────────────────────────

function analyzeCreditPurpose(req: CreditReviewRequest): CreditPurposeResult {
  const { loanType, loanAmount, termYears, property } = req;

  const purpose =
    loanType === 'mortgage'
      ? property?.purpose ?? '購屋'
      : '個人信用貸款';

  const isInvestorDetected = property?.isInvestor === true;
  const builderBackgroundDetected = property?.isBuilderBackground === true;

  // 貸款年限檢核
  let maxAllowed: number;
  if (loanType === 'mortgage') {
    // 房貸：依年齡 + 年限 ≤ 75 歲，且最長 30 年
    const ageAtMaturity = req.borrower.age + termYears;
    maxAllowed = Math.min(30, 75 - req.borrower.age);
    if (isInvestorDetected) maxAllowed = Math.min(maxAllowed, 20); // 投資客限 20 年
  } else {
    maxAllowed = 7; // 信貸最長 7 年
  }

  const loanTermCheck = {
    pass: termYears <= maxAllowed,
    maxAllowed,
    requested: termYears,
  };

  return {
    purpose,
    isInvestorDetected,
    loanTermCheck,
    builderBackgroundDetected,
  };
}

// ─── 綜合評估邏輯 ─────────────────────────────────────────────

/**
 * 依六大風控因子等級產生綜合評估結論
 * level=1: 應特別注意審慎辦理
 * ≥2 個 level 2-3: 應評估後辦理
 * 其餘: 尚屬正常
 */
function buildOverallAssessment(
  riskFactors: ReturnType<typeof scoreRiskFactors>,
  thresholdResult: ReturnType<typeof checkThresholds>,
  fraudResult: ReturnType<typeof detectFraud>,
): { assessment: string; requiresManualReview: boolean; actions: string[] } {
  const levels = [
    riskFactors.employmentStability.level,
    riskFactors.incomeGrowth.level,
    riskFactors.netWorthLevel.level,
    riskFactors.netWorthRatio.level,
    riskFactors.liquidityRatio.level,
    riskFactors.debtRatio.level,
  ];

  const hasLevel1 = levels.some((l) => l === 1);
  const lowLevelCount = levels.filter((l) => l >= 2 && l <= 3).length;
  const thresholdFail =
    !thresholdResult.thresholds.debtIncomeRatio.pass ||
    (thresholdResult.thresholds.dbr !== undefined && !thresholdResult.thresholds.dbr.pass);
  const isAlert = fraudResult.overallLevel === 'alert';

  let assessment: string;
  let requiresManualReview = false;
  const actions: string[] = [];

  if (hasLevel1 || isAlert) {
    assessment = '【應特別注意審慎辦理】風控因子出現 1 級或防詐查核警示，請主管核示';
    requiresManualReview = true;
    if (hasLevel1) actions.push('至少一項風控因子評等為 1 級，須專案審查');
    if (isAlert) actions.push('防詐查核結果為高度警示，建議拒絕或呈報主管');
  } else if (lowLevelCount >= 2 || thresholdFail) {
    assessment = '【應評估後辦理】部分風控因子偏低或合規指標超標，需綜合評估';
    requiresManualReview = true;
    if (lowLevelCount >= 2) actions.push(`${lowLevelCount} 項風控因子評等偏低（2-3 級），請謹慎評估`);
    if (thresholdFail) actions.push('貸款合規指標（DBR/負債比）超出上限，建議調整金額');
  } else {
    assessment = '【尚屬正常】整體財務狀況良好，可依常規程序辦理';
    if (fraudResult.overallLevel === 'caution') {
      actions.push('防詐查核有注意事項，請行員確認相關資料');
    }
  }

  if (thresholdResult.adjustedLoanAmount !== undefined && thresholdFail) {
    actions.push(
      `建議調整貸款金額至 NT$ ${thresholdResult.adjustedLoanAmount.toLocaleString()} 元以符合合規指標`,
    );
  }

  return { assessment, requiresManualReview, actions };
}

// ─── 主服務函數 ──────────────────────────────────────────────

/**
 * 執行完整 5P 徵審
 */
export async function performCreditReview(
  req: CreditReviewRequest,
): Promise<CreditReviewResult> {
  const { loanType, loanAmount, termYears, borrower, guarantor, property, valuation } = req;

  // P1 借保戶概況
  const borrowerProfile = scoreBorrowerProfile(borrower, property);

  // P2 授信用途
  const creditPurpose = analyzeCreditPurpose(req);

  // P3 個人收支平衡表
  const repaymentSource = scoreRepaymentSource(
    borrower,
    guarantor,
    loanAmount,
    termYears,
    loanType,
    property,
  );

  // P4 資產負債表
  const creditProtection = scoreCreditProtection(
    borrower,
    guarantor,
    valuation,
    loanAmount,
  );

  // P5 六大風控因子
  const riskFactors = scoreRiskFactors(
    borrower,
    repaymentSource,
    creditProtection,
    loanAmount,
    property,
  );

  // 額度調整指標
  const thresholdResult = checkThresholds(req, repaymentSource);

  // 防詐模型
  const fraudCheck = detectFraud(borrower, riskFactors);

  // 綜合評估
  const { assessment, requiresManualReview, actions } = buildOverallAssessment(
    riskFactors,
    thresholdResult,
    fraudCheck,
  );

  // 批覆書 JSON + PDF
  const partialResult = {
    loanType,
    borrowerProfile,
    creditPurpose,
    repaymentSource,
    creditProtection,
    riskFactors,
    thresholds: thresholdResult.thresholds,
    fraudCheck,
    requiresManualReview,
    adjustedLoanAmount: thresholdResult.adjustedLoanAmount,
    overallAssessment: assessment,
    suggestedActions: actions,
    mode: 'demo' as const,
    timestamp: new Date().toISOString(),
  };

  const { reportJson, reportPdfPath } = await generateCreditReport(
    partialResult,
    req,
  );

  return {
    ...partialResult,
    reportJson,
    reportPdfPath,
  };
}
