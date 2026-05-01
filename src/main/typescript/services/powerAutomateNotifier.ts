/**
 * INPUT: 防詐評分結果 / PDF 批覆書路徑
 * OUTPUT: Power Automate HTTP trigger 回應（void，失敗靜默記錄）
 * POS: 服務層，Power Automate 兩條自動化流程串接
 *
 * 流程 1：CREW 3 防詐 PILOT — fraud_score > 0.7 → Teams 主管警示
 * 流程 2：三 Crew 完成後 → PDF 批覆書自動存至 SharePoint
 *
 * 環境變數（.env）：
 *   POWER_AUTOMATE_FRAUD_WEBHOOK_URL   防詐警示 HTTP trigger URL
 *   POWER_AUTOMATE_PDF_WEBHOOK_URL     PDF 批覆書 HTTP trigger URL
 */

const FRAUD_WEBHOOK_URL = process.env['POWER_AUTOMATE_FRAUD_WEBHOOK_URL'] ?? '';
const PDF_WEBHOOK_URL   = process.env['POWER_AUTOMATE_PDF_WEBHOOK_URL'] ?? '';

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

// ─── 流程 2：PDF 批覆書自動化 → SharePoint ────────────────────────

/**
 * PDF 批覆書 SharePoint 存檔觸發
 *
 * Power Automate 流程預期 payload：
 *   applicationId, pdfUrl, loanType, applicantName, timestamp
 *
 * SharePoint 動作：將 PDF 存至指定文件庫的案件資料夾
 */
export async function triggerPdfWebhook(params: {
  applicationId: string;
  pdfUrl: string;
  loanType: 'mortgage' | 'personal';
  applicantName?: string;
}): Promise<boolean> {
  const { applicationId, pdfUrl, loanType, applicantName } = params;

  const payload: Record<string, unknown> = {
    applicationId,
    pdfUrl,
    loanType,
    applicantName:    applicantName ?? '',
    loanTypeLabel:    loanType === 'mortgage' ? '房屋貸款' : '個人信用貸款',
    timestamp:        new Date().toISOString(),
    sharepointFolder: `批覆書/${new Date().getFullYear()}/${applicationId}`,
  };

  console.log(`[powerAutomate] 觸發 PDF 批覆書 applicationId=${applicationId}`);
  return postWebhook(PDF_WEBHOOK_URL, payload);
}
