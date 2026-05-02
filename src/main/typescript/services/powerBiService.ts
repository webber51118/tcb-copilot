/**
 * INPUT: PilotCrewResult（三 Crew 並行審核結果）
 * OUTPUT: Power BI Push Dataset REST API 推送（void）
 * POS: 服務層，TypeScript 直接呼叫 Power BI REST API（無需 Python 層）
 *
 * 需要環境變數（.env）：
 *   POWER_BI_TENANT_ID      Azure AD 租戶 ID
 *   POWER_BI_CLIENT_ID      Service Principal App ID
 *   POWER_BI_CLIENT_SECRET  Service Principal 密碼
 *   POWER_BI_WORKSPACE_ID   Power BI 工作區 ID
 *   POWER_BI_DATASET_ID     Push Dataset ID
 */

import { PilotCrewResult } from '../models/workflow';

// ─── 設定 ─────────────────────────────────────────────────────────────────────

const TENANT_ID    = process.env['POWER_BI_TENANT_ID']    ?? '';
const CLIENT_ID    = process.env['POWER_BI_CLIENT_ID']    ?? '';
const CLIENT_SECRET = process.env['POWER_BI_CLIENT_SECRET'] ?? '';
const WORKSPACE_ID = process.env['POWER_BI_WORKSPACE_ID'] ?? '';
const DATASET_ID   = process.env['POWER_BI_DATASET_ID']   ?? '';
const TABLE_NAME   = 'ReviewResults';

// ─── OAuth2 Token（Service Principal Client Credentials）─────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         'https://analysis.windows.net/powerbi/api/.default',
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    throw new Error(`[powerBi] Token 取得失敗 status=${resp.status}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

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
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !WORKSPACE_ID || !DATASET_ID) {
    console.warn('[powerBi] 環境變數未設定，跳過 Power BI 推送');
    return false;
  }

  try {
    const token = await getAccessToken();

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

    const url = `https://api.powerbi.com/v1.0/myorg/groups/${WORKSPACE_ID}/datasets/${DATASET_ID}/tables/${TABLE_NAME}/rows`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ rows: [row] }),
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
