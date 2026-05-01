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

// ─── 流程 1：防詐高風險警示 → Teams ──────────────────────────────

/**
 * 防詐警示觸發（fraud_score > 0.7 Level 3）
 *
 * Power Automate 流程預期 payload：
 *   applicationId, fraudScore, riskLevel, alertLevel,
 *   topFactor1, topFactor2, topFactor3, timestamp
 *
 * Teams 推播內容：主管群組接到警示卡片，含案件摘要 + 前三大風險因子
 */
export async function triggerFraudAlert(params: {
  applicationId: string;
  fraudScore: number;
  riskLevel: string;
  topRiskFactors: Array<{ label: string; contribution: number }>;
  /** 申請人姓名（供 Teams Adaptive Card 顯示） */
  customerName?: string;
  /** 貸款類型（'mortgage' | 'personal'） */
  loanType?: string;
  /** 申請金額（元） */
  loanAmount?: number;
  /** 受理分行（Demo 固定值）*/
  branchName?: string;
}): Promise<boolean> {
  const { applicationId, fraudScore, riskLevel, topRiskFactors,
          customerName, loanType, loanAmount, branchName } = params;

  const loanTypeLabel = loanType === 'mortgage' ? '房屋貸款' : loanType === 'personal' ? '信用貸款' : loanType ?? '';
  const loanAmountLabel = loanAmount ? `${(loanAmount / 10_000).toFixed(0)} 萬元` : '—';

  const payload: Record<string, unknown> = {
    applicationId,
    customerName:  customerName ?? '（未提供）',
    loanType:      loanTypeLabel,
    loanAmount:    loanAmount ? Math.round(loanAmount / 10_000) : 0,  // 萬元，供 PA 卡片顯示
    fraudScore:    Number(fraudScore.toFixed(4)),
    riskLevel,
    alertLevel:    3,
    branchName:    branchName ?? '合庫分行',
    topFactor1:    topRiskFactors[0]?.label ?? '',
    topFactor2:    topRiskFactors[1]?.label ?? '',
    topFactor3:    topRiskFactors[2]?.label ?? '',
    // 結構化 riskFactors（供 Adaptive Card 動態渲染）
    riskFactors: topRiskFactors.slice(0, 3).map((f) => ({
      factor:      f.label,
      score:       Number(f.contribution.toFixed(4)),
      description: `貢獻分數 ${(f.contribution * 100).toFixed(1)}%`,
    })),
    timestamp:     new Date().toISOString(),
    // Teams Adaptive Card 標題用
    alertTitle:    `🔴 高風險防詐警示 — 案件 ${applicationId}`,
    alertBody:     [
      `客戶：${customerName ?? '—'}　貸款：${loanTypeLabel} ${loanAmountLabel}`,
      `詐欺風險分數：${(fraudScore * 100).toFixed(1)}%`,
      `主要風險因子：${topRiskFactors.slice(0, 3).map((f) => f.label).join('、')}`,
      `請主管立即審查並決定是否凍結案件。`,
    ].join('\n'),
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
