/**
 * INPUT: 防詐評分結果 / 推薦結果 / PDF 批覆書路徑
 * OUTPUT: Teams 警示 / 推薦通知 / SharePoint 存檔（失敗靜默記錄）
 * POS: 服務層，M365 三條自動化流程串接
 *
 * 流程 1：PILOT CREW 完成 → Teams 推薦通知 + 行員話術
 * 流程 2：CREW 3 防詐 PILOT — fraud_score > 0.7 → Teams 高風險警示
 * 流程 3：三 Crew 完成後 → Microsoft Graph API 直接上傳 PDF 至 SharePoint
 *
 * 環境變數（.env）：
 *   POWER_AUTOMATE_FRAUD_WEBHOOK_URL   Teams Webhook URL（流程 1 & 2 共用）
 *   SHAREPOINT_SITE_ID                 SharePoint 站台 ID（流程 3）
 *   SHAREPOINT_TENANT_ID / CLIENT_ID / CLIENT_SECRET  AAD 應用程式認證（流程 3）
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

  // Teams Adaptive Card payload（Power Automate Workflows webhook 相容格式）
  // 注意：Container/FactSet/Separator 在部分 Teams 工作流程版本不支援，統一用 TextBlock
  const riskFactorLines = topRiskFactors.slice(0, 3).map((f, i) =>
    ({ type: 'TextBlock', text: `${i + 1}. ${f.label}（${(f.contribution * 100).toFixed(1)}%）`, wrap: true, spacing: 'None' })
  );

  const payload = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type:    'AdaptiveCard',
        version: '1.2',
        body: [
          { type: 'TextBlock', text: `🔴 高風險防詐警示｜個金 Co-Pilot`, weight: 'Bolder', size: 'Large', color: 'Attention' },
          { type: 'TextBlock', text: `📋 案件編號：${applicationId}`, wrap: true },
          { type: 'TextBlock', text: `👤 申請人：${customerName ?? '—'}`, wrap: true, spacing: 'None' },
          { type: 'TextBlock', text: `🏠 貸款類型：${loanTypeLabel}　申請金額：${loanAmountLabel}`, wrap: true, spacing: 'None' },
          { type: 'TextBlock', text: `🏦 受理分行：${branchName ?? '合庫分行'}`, wrap: true, spacing: 'None' },
          { type: 'TextBlock', text: `⚠️ 詐欺風險分數：**${scorePercent}**　等級：**${riskLevel}**`, weight: 'Bolder', color: 'Attention', wrap: true, spacing: 'Medium' },
          { type: 'TextBlock', text: '【風險因子】', weight: 'Bolder', spacing: 'Small' },
          ...riskFactorLines,
          { type: 'TextBlock', text: `請主管立即審查是否凍結案件 | ${ts}`, isSubtle: true, size: 'Small', wrap: true, spacing: 'Medium' },
        ],
      },
    }],
  };

  console.log(`[powerAutomate] 觸發防詐警示 applicationId=${applicationId} fraudScore=${fraudScore}`);
  return postWebhook(FRAUD_WEBHOOK_URL, payload);
}

// ─── 流程 1：推薦通知 + 行員話術 → Teams Webhook ──────────────────

/** 各商品行員銷售話術模板 */
const SALES_PITCH: Record<string, (p: { rateRange: string; monthlyPayment?: number; maxAmount: number }) => string> = {
  'young-safe-home':    ({ rateRange, monthlyPayment }) =>
    `您的客戶符合政府青安優惠方案！利率低至 ${rateRange}，每月只要 ${monthlyPayment ? monthlyPayment.toLocaleString() : '—'} 元，30 年輕鬆圓房夢，額度最高 1,000 萬，現在申辦最划算！`,
  'military-housing':   ({ rateRange, monthlyPayment }) =>
    `您的客戶享有軍公教專屬優惠！利率 ${rateRange}，比市場一般方案更低，每月 ${monthlyPayment ? monthlyPayment.toLocaleString() : '—'} 元，是最適合軍公教身份的購屋貸款！`,
  'next-loan':          ({ rateRange, monthlyPayment }) =>
    `依客戶條件推薦合庫 Next 貸！利率 ${rateRange}，彈性寬限期最長 3 年，月付 ${monthlyPayment ? monthlyPayment.toLocaleString() : '—'} 元，資金調度更靈活！`,
  'reverse-mortgage':   ({ rateRange, maxAmount }) =>
    `以房養老方案最適合退休規劃！每月穩定領取生活費，最高可貸 ${(maxAmount / 10_000).toFixed(0)} 萬，利率 ${rateRange}，讓不動產資產活化，退休更無後顧之憂！`,
  'military-civil-loan':({ rateRange, monthlyPayment, maxAmount }) =>
    `軍公教優惠信貸，利率 ${rateRange}，最高 ${(maxAmount / 10_000).toFixed(0)} 萬，手續簡便，3 個工作天快速撥款，月付 ${monthlyPayment ? monthlyPayment.toLocaleString() : '—'} 元！`,
  'elite-loan':         ({ rateRange, monthlyPayment, maxAmount }) =>
    `薪轉戶專屬優職優利信貸！比一般信貸利率更低，利率 ${rateRange}，最高 ${(maxAmount / 10_000).toFixed(0)} 萬，月付 ${monthlyPayment ? monthlyPayment.toLocaleString() : '—'} 元，立即可辦！`,
};

/**
 * 推薦通知推送至 Teams（PILOT CREW 審核完成後觸發）
 *
 * 包含推薦方案摘要 + 方案特色 + 量身定制行員話術
 */
export async function triggerRecommendationAlert(params: {
  applicationId: string;
  customerName?: string;
  loanType: string;
  loanAmount?: number;
  product: {
    id: string;
    name: string;
    rateRange: string;
    monthlyPayment?: number;
    maxAmount: number;
    features: string[];
    savingsHighlight: string;
    crossSell?: {
      insurance?: { name: string; price: string };
      creditCard?: { name: string; cashback: string };
      wealthManagement?: { name: string; currency: string; paymentYears: string; coverage: string; highlight: string };
    };
  };
  wealthProduct?: { name: string; currency: string; paymentYears: string; coverage: string; highlight: string };
}): Promise<boolean> {
  const { applicationId, customerName, loanType, loanAmount, product, wealthProduct } = params;

  const loanTypeLabel   = loanType === 'mortgage' ? '房屋貸款' : '信用貸款';
  const loanAmountLabel = loanAmount ? `${(loanAmount / 10_000).toFixed(0)} 萬` : '—';
  const monthlyLabel    = product.monthlyPayment ? `${product.monthlyPayment.toLocaleString()} 元` : '—';
  const ts              = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  const pitchFn  = SALES_PITCH[product.id];
  const salesPitch = pitchFn
    ? pitchFn({ rateRange: product.rateRange, monthlyPayment: product.monthlyPayment, maxAmount: product.maxAmount })
    : `推薦方案：${product.name}，利率 ${product.rateRange}，${product.savingsHighlight}`;

  const featureLines = product.features.slice(0, 3).map((f) =>
    ({ type: 'TextBlock', text: `• ${f}`, wrap: true, spacing: 'None' })
  );

  // 房貸壽險行
  const insuranceLine = product.crossSell?.insurance
    ? [{ type: 'TextBlock', text: `🛡️ 房貸壽險推薦：${product.crossSell.insurance.name}（${product.crossSell.insurance.price}）`, wrap: true, spacing: 'None', isSubtle: true }]
    : [];

  // 合家保行（優先使用動態計算的 wealthProduct，fallback 到 crossSell.wealthManagement）
  const wealth = wealthProduct ?? product.crossSell?.wealthManagement;
  const wealthLine = wealth
    ? [{ type: 'TextBlock', text: `💰 合家保推薦：${wealth.name}（${wealth.currency}｜${wealth.paymentYears}｜${wealth.coverage}）`, wrap: true, spacing: 'None', isSubtle: true }]
    : [];

  const crossSellLine = [...insuranceLine, ...wealthLine];

  const payload = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type:    'AdaptiveCard',
        version: '1.2',
        body: [
          { type: 'TextBlock', text: `💼 新案件推薦通知｜個金 Co-Pilot`, weight: 'Bolder', size: 'Large', color: 'Accent' },
          { type: 'TextBlock', text: `📋 案件：${applicationId}　👤 ${customerName ?? '客戶'}`, wrap: true },
          { type: 'TextBlock', text: `🏠 ${loanTypeLabel}　申貸：${loanAmountLabel}`, wrap: true, spacing: 'None' },
          { type: 'TextBlock', text: `✅ 推薦方案：${product.name}`, weight: 'Bolder', spacing: 'Medium' },
          { type: 'TextBlock', text: `💹 利率：${product.rateRange}　月付：${monthlyLabel}`, wrap: true, spacing: 'None' },
          { type: 'TextBlock', text: `📣【行員話術】`, weight: 'Bolder', spacing: 'Medium' },
          { type: 'TextBlock', text: `「${salesPitch}」`, wrap: true, spacing: 'None', isSubtle: false },
          { type: 'TextBlock', text: `✨ 方案亮點：`, weight: 'Bolder', spacing: 'Small' },
          ...featureLines,
          ...crossSellLine,
          { type: 'TextBlock', text: `${ts}`, isSubtle: true, size: 'Small', wrap: true, spacing: 'Medium' },
        ],
      },
    }],
  };

  console.log(`[powerAutomate] 推薦通知 applicationId=${applicationId} product=${product.id}`);
  return postWebhook(FRAUD_WEBHOOK_URL, payload);
}

// ─── 流程 2：防詐高風險警示 → Teams Webhook（原流程 1）────────────

// ─── 流程 3：PDF 批覆書 → SharePoint（Microsoft Graph API）─────────

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
    const loanLabel = loanType === 'mortgage' ? '房貸' : '信貸';
    const safeName  = (applicantName ?? '申請人').replace(/[/\\?%*:|"<>]/g, '_');
    const demoFile  = `${applicationId}_${loanLabel}_${safeName}.pdf`;
    console.log(`[sharePoint][DEMO] PDF 歸檔模擬成功 applicationId=${applicationId} fileName=${demoFile}`);
    return true;
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
