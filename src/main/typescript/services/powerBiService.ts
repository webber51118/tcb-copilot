/**
 * INPUT: PilotCrewResult（三 Crew 並行審核結果）
 * OUTPUT: Power BI Push Dataset REST API 推送（void）
 * POS: 服務層，TypeScript 直接呼叫 Power BI REST API（無需 Python 層）
 *
 * 需要環境變數（.env）：
 *   POWER_BI_PUSH_URL   Power BI 串流資料集 Push URL（含 Key，從平台直接取得）
 *
 * 黑客松模式：Push Key（免 Service Principal / Azure AD）
 */

import { PilotCrewResult } from '../models/workflow';

// ─── 設定 ─────────────────────────────────────────────────────────────────────

const PUSH_URL = process.env['POWER_BI_PUSH_URL'] ?? '';

// ─── Push Dataset Row ────────────────────────────────────────────────────────

/**
 * 推送三 Crew 審核結果到 Power BI Push Dataset
 * Dataset Schema 對應 docs/powerbi-dataset-schema.json
 */
export async function pushPilotCrewResultToPbi(
  result: PilotCrewResult,
  applicantName?: string,
  loanAmount?: number,
): Promise<boolean> {
  if (!PUSH_URL) {
    console.warn('[powerBi] POWER_BI_PUSH_URL 未設定，跳過 Power BI 推送');
    return false;
  }

  try {

    const rec  = result.crew1.recommendation.primary;
    const ml   = result.crew3.mlScore;
    const val  = result.crew2?.result;

    const row = {
      ApplicationId:     result.applicationId,
      CustomerName:      applicantName ?? '（未提供）',
      LoanType:          result.loanType === 'mortgage' ? '房屋貸款' : '信用貸款',
      LoanAmount:        loanAmount ?? 0,
      RecommendedProduct: rec.name,
      InterestRate:      parseFloat(rec.rateRange.split('~')[0]?.replace('%', '') ?? '0'),
      MonthlyPayment:    rec.monthlyPayment ?? 0,
      ValuationP50:      val?.confidenceInterval?.p50 ?? val?.estimatedValue ?? 0,
      ValuationP5:       val?.confidenceInterval?.p5  ?? 0,
      ValuationP95:      val?.confidenceInterval?.p95 ?? 0,
      FraudScore:        ml.fraudScore,
      AlertLevel:        ml.alertLevel,
      TopRiskFactor1:    ml.topRiskFactors[0]?.label ?? '',
      TopRiskFactor2:    ml.topRiskFactors[1]?.label ?? '',
      TopRiskFactor3:    ml.topRiskFactors[2]?.label ?? '',
      ReviewTimestamp:   new Date().toISOString(),
    };

    const resp = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([row]),
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.ok) {
      console.log(`[powerBi] 推送成功 applicationId=${result.applicationId}`);
      return true;
    }
    console.warn(`[powerBi] 推送失敗 status=${resp.status}`);
    return false;
  } catch (err) {
    console.error('[powerBi] 推送例外：', err);
    return false;
  }
}
