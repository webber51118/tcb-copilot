/**
 * INPUT: 防詐評分結果 / PDF 批覆書路徑
 * OUTPUT: Teams 警示 / SharePoint 存檔（失敗靜默記錄）
 * POS: 服務層，M365 兩條自動化流程串接
 *
 * 流程 1：CREW 3 防詐 PILOT — fraud_score > 0.7 → Teams Incoming Webhook 警示
 * 流程 2：三 Crew 完成後 → Microsoft Graph API 直接上傳 PDF 至 SharePoint
 *
 * 環境變數（.env）：
 *   POWER_AUTOMATE_FRAUD_WEBHOOK_URL   Teams Incoming Webhook URL（流程 1）
 *   SHAREPOINT_SITE_ID                 SharePoint 站台 ID（流程 2）
 *   SHAREPOINT_TENANT_ID / CLIENT_ID / CLIENT_SECRET  AAD 應用程式認證（流程 2）
 *   （未設定時自動 fallback 至 POWER_BI_TENANT_ID / CLIENT_ID / CLIENT_SECRET）
 */

import * as fs from 'fs';

const FRAUD_WEBHOOK_URL = process.env['POWER_AUTOMATE_FRAUD_WEBHOOK_URL'] ?? '';

// ─── SharePoint Graph API 認證 ────────────────────────────────────────
const SP_TENANT_ID     = process.env['SHAREPOINT_TENANT_ID']     ?? process.env['POWER_BI_TENANT_ID']     ?? '';
const SP_CLIENT_ID     = process.env['SHAREPOINT_CLIENT_ID']     ?? process.env['POWER_BI_CLIENT_ID']     ?? '';
const SP_CLIENT_SECRET = process.env['SHAREPOINT_CLIENT_SECRET'] ?? process.env['POWER_BI_CLIENT_SECRET'] ?? '';
const SP_SITE_ID       = process.env['SHAREPOINT_SITE_ID']       ?? '';

// ─── 共用 HTTP POST ────────────────────────────────────────────────

async function postWebhook(url: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!url) {
    console.warn('[powerAutomate] Webhook URL 未設定，跳過觸發。');
    return false;
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    if (resp.ok) {
      console.log(`[powerAutomate] 觸發成功 status=${resp.status}`);
      return true;
    }
    console.warn(`[powerAutomate] 觸發失敗 status=${resp.status}`);
    return false;
  } catch (err) {
    console.error('[powerAutomate] 觸發例外：', err);
    return false;
  }
}

// ─── 流程 1：防詐高風險警示 → Teams Workflows Webhook ────────────

/**
 * 防詐警示觸發（fraud_score > 0.7 Level 3）
 *
 * 使用 Teams「將 webhook 警示傳送到頻道」工作流程
 * Payload 格式：Teams Adaptive Card（application/vnd.microsoft.card.adaptive）
 */
export async function triggerFraudAlert(params: {
  applicationId: string;
  fraudScore: number;
  riskLevel: string;
  topRiskFactors: Array<{ label: string; contribution: number }>;
  customerName?: string;
  loanType?: string;
  loanAmount?: number;
  branchName?: string;
}): Promise<boolean> {
  const { applicationId, fraudScore, riskLevel, topRiskFactors,
          customerName, loanType, loanAmount, branchName } = params;

  const loanTypeLabel  = loanType === 'mortgage' ? '房屋貸款' : loanType === 'personal' ? '信用貸款' : loanType ?? '—';
  const loanAmountLabel = loanAmount ? `${(loanAmount / 10_000).toFixed(0)} 萬元` : '—';
  const scorePercent   = `${(fraudScore * 100).toFixed(1)}%`;
  const ts             = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  // Teams Adaptive Card payload（符合 Workflows webhook 格式）
  const payload = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type:    'AdaptiveCard',
        version: '1.4',
        body: [
          // 標題列
          {
            type:                'Container',
            style:               'attention',
            bleed:               true,
            items: [{
              type:   'TextBlock',
              text:   `🔴 高風險防詐警示`,
              weight: 'Bolder',
              size:   'Large',
              color:  'Light',
            }],
          },
          // 案件資訊
          {
            type:    'FactSet',
            spacing: 'Medium',
            facts: [
              { title: '案件編號', value: applicationId },
              { title: '申請人',   value: customerName ?? '—' },
              { title: '貸款類型', value: loanTypeLabel },
              { title: '申請金額', value: loanAmountLabel },
              { title: '受理分行', value: branchName ?? '合庫分行' },
            ],
          },
          { type: 'Separator' },
          // 風險評分
          {
            type:  'TextBlock',
            text:  `⚠️ 詐欺風險分數：**${scorePercent}**　風險等級：**${riskLevel}**`,
            wrap:  true,
            color: 'Attention',
          },
          // 前三大風險因子
          {
            type:  'TextBlock',
            text:  '主要風險因子：',
            weight: 'Bolder',
            spacing: 'Small',
          },
          ...topRiskFactors.slice(0, 3).map((f, i) => ({
            type:  'TextBlock',
            text:  `${i + 1}. ${f.label}（貢獻 ${(f.contribution * 100).toFixed(1)}%）`,
            wrap:  true,
            spacing: 'None',
          })),
          { type: 'Separator' },
          {
            type:    'TextBlock',
            text:    `請主管立即審查並決定是否凍結案件。\n${ts}`,
            wrap:    true,
            isSubtle: true,
            size:    'Small',
          },
        ],
      },
    }],
  };

  console.log(`[powerAutomate] 觸發防詐警示 applicationId=${applicationId} fraudScore=${fraudScore}`);
  return postWebhook(FRAUD_WEBHOOK_URL, payload);
}

// ─── 流程 2：PDF 批覆書 → SharePoint（Microsoft Graph API）─────────

async function getGraphAccessToken(): Promise<string> {
  if (!SP_TENANT_ID || !SP_CLIENT_ID || !SP_CLIENT_SECRET) {
    throw new Error('SharePoint AAD 認證環境變數未設定');
  }
  const url = `https://login.microsoftonline.com/${SP_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     SP_CLIENT_ID,
    client_secret: SP_CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  });
  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    signal:  AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`AAD token 取得失敗 status=${resp.status}`);
  const data = await resp.json() as { access_token: string };
  return data.access_token;
}

/**
 * PDF 批覆書上傳至 SharePoint（Microsoft Graph API）
 *
 * 存放路徑：批覆書/{年份}/{applicationId}/{fileName}
 * 需要 AAD 應用程式具備 Sites.ReadWrite.All 權限
 */
export async function triggerPdfWebhook(params: {
  applicationId: string;
  pdfUrl: string;
  pdfPath?: string;
  loanType: 'mortgage' | 'personal';
  applicantName?: string;
}): Promise<boolean> {
  const { applicationId, pdfPath, loanType, applicantName } = params;

  if (!SP_SITE_ID) {
    console.warn('[sharePoint] SHAREPOINT_SITE_ID 未設定，跳過 PDF 上傳。');
    return false;
  }
  if (!pdfPath) {
    console.warn('[sharePoint] pdfPath 未提供，跳過 PDF 上傳。');
    return false;
  }

  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const year       = new Date().getFullYear();
    const loanLabel  = loanType === 'mortgage' ? '房貸' : '信貸';
    const safeName   = (applicantName ?? '申請人').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName   = `${applicationId}_${loanLabel}_${safeName}.pdf`;
    const folderPath = encodeURIComponent(`批覆書/${year}/${applicationId}`);

    const token     = await getGraphAccessToken();
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SP_SITE_ID}/drive/items/root:/${folderPath}/${encodeURIComponent(fileName)}:/content`;

    const resp = await fetch(uploadUrl, {
      method:  'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/pdf',
      },
      body:   fileBuffer,
      signal: AbortSignal.timeout(30_000),
    });

    if (resp.ok) {
      console.log(`[sharePoint] PDF 上傳成功 applicationId=${applicationId} fileName=${fileName}`);
      return true;
    }
    const errText = await resp.text().catch(() => '');
    console.warn(`[sharePoint] PDF 上傳失敗 status=${resp.status} ${errText}`);
    return false;
  } catch (err) {
    console.error('[sharePoint] PDF 上傳例外：', err);
    return false;
  }
}
