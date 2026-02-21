/**
 * INPUT: 5P 徵審結果（partialResult）+ CreditReviewRequest
 * OUTPUT: 批覆書 JSON + PDF（data/credit-reviews/TCB-CR-YYYYMMDD-HHMMSS.pdf）
 * POS: 服務層，使用 pdf-lib 生成中文批覆書格式 PDF
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import {
  CreditReviewRequest,
  BorrowerProfileResult,
  CreditPurposeResult,
  RepaymentSourceResult,
  CreditProtectionResult,
  RiskFactorsResult,
  ThresholdsResult,
  FraudCheckResult,
} from '../models/creditReview';

/** 輸出目錄 */
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'credit-reviews');

/** 確保輸出目錄存在 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/** 產生批覆書案件編號 TCB-CR-YYYYMMDD-HHMMSS */
function generateReportId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `TCB-CR-${date}-${time}`;
}

// ─── 共用繪製輔助類型 ──────────────────────────────────────────

type DrawFn = (text: string, x: number, y: number, size?: number) => void;

// ─── PDF 生成 ─────────────────────────────────────────────────

/**
 * 生成批覆書 PDF
 * 使用 Helvetica（因 pdf-lib 不內建中文字型；中文值以 JSON 形式呈現，
 * 英文標籤 + 關鍵數字確保 PDF 可顯示）
 */
async function generatePdf(
  reportId: string,
  req: CreditReviewRequest,
  partial: PartialResult,
): Promise<string> {
  ensureOutputDir();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595; // A4 width pt
  const H = 842; // A4 height pt
  const MARGIN = 50;
  const COL2 = MARGIN + 250;

  // 建立第一頁
  let page = pdfDoc.addPage([W, H]);
  let cursorY = H - MARGIN;

  /** 寫文字（左上角為原點 y 向下） */
  const draw: DrawFn = (text, x, y, size = 10) => {
    page.drawText(text, { x, y: H - y, size, font, color: rgb(0, 0, 0) });
  };

  const drawBold: DrawFn = (text, x, y, size = 10) => {
    page.drawText(text, { x, y: H - y, size, font: boldFont, color: rgb(0, 0, 0.6) });
  };

  const drawLine = (y: number) => {
    page.drawLine({
      start: { x: MARGIN, y: H - y },
      end: { x: W - MARGIN, y: H - y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  };

  const nextLine = (step = 16) => { cursorY += step; };

  // ── 標題區 ──────────────────────────────────────────────────
  drawBold('TCB Credit Review Report', MARGIN, (cursorY += 10), 14);
  draw('Taiwan Cooperative Bank - Individual Finance Co-Pilot', MARGIN, (cursorY += 20), 9);
  drawLine((cursorY += 8));

  draw(`Report ID: ${reportId}`, MARGIN, (cursorY += 16), 9);
  draw(`Loan Type: ${req.loanType === 'mortgage' ? 'Mortgage' : 'Personal Loan'}`, COL2, cursorY, 9);
  draw(`Applicant: ${req.borrower.name}`, MARGIN, (cursorY += 14), 9);
  draw(`Date: ${new Date().toLocaleDateString('en-US')}`, COL2, cursorY, 9);
  draw(`Loan Amount: NT$ ${req.loanAmount.toLocaleString()}`, MARGIN, (cursorY += 14), 9);
  draw(`Term: ${req.termYears} Years`, COL2, cursorY, 9);
  drawLine((cursorY += 10));

  // ── P1 借保戶概況 ────────────────────────────────────────────
  drawBold('P1 - Borrower Profile', MARGIN, (cursorY += 16), 11);
  nextLine(4);

  const bp = partial.borrowerProfile;
  draw(`MY Data Provided: ${bp.myDataProvided ? 'Yes' : 'No'}`, MARGIN, (cursorY += 14), 9);
  draw(`Related Party: ${bp.isRelatedParty ? 'Yes (Review Required)' : 'No'}`, COL2, cursorY, 9);
  draw(`First Home Eligible: ${bp.firstHomePurchaseEligible ? 'Yes' : 'No'}`, MARGIN, (cursorY += 14), 9);
  draw(`Green Housing (Qing-An): ${bp.greenHousingEligible ? 'Eligible' : 'Not Eligible'}`, COL2, cursorY, 9);

  // ── P2 授信用途 ──────────────────────────────────────────────
  drawLine((cursorY += 12));
  drawBold('P2 - Credit Purpose', MARGIN, (cursorY += 16), 11);

  const cp = partial.creditPurpose;
  draw(`Purpose: ${cp.purpose}`, MARGIN, (cursorY += 14), 9);
  draw(`Investor Flag: ${cp.isInvestorDetected ? 'Detected' : 'None'}`, COL2, cursorY, 9);
  draw(
    `Term Check: ${cp.loanTermCheck.pass ? 'Pass' : 'FAIL'} ` +
    `(Requested ${cp.loanTermCheck.requested}Y / Max ${cp.loanTermCheck.maxAllowed}Y)`,
    MARGIN, (cursorY += 14), 9,
  );
  draw(
    `Builder Background: ${cp.builderBackgroundDetected ? 'Detected' : 'None'}`,
    COL2, cursorY, 9,
  );

  // ── P3 個人收支平衡表 ─────────────────────────────────────────
  drawLine((cursorY += 12));
  drawBold('P3 - Repayment Source (Monthly, NT$)', MARGIN, (cursorY += 16), 11);

  const rs = partial.repaymentSource;
  draw(`Monthly Income:  ${rs.monthlyIncome.toLocaleString()}`, MARGIN, (cursorY += 14), 9);
  draw(`Monthly Expense: ${rs.monthlyExpense.toLocaleString()}`, COL2, cursorY, 9);
  draw(`Monthly Balance: ${rs.monthlyBalance.toLocaleString()} ${rs.monthlyBalance >= 0 ? '(Positive)' : '(DEFICIT)'}`, MARGIN, (cursorY += 14), 9);

  // 收入明細
  Object.entries(rs.incomeBreakdown).forEach(([k, v]) => {
    if (v > 0) {
      draw(`  Income - ${k}: ${v.toLocaleString()}`, MARGIN, (cursorY += 12), 8);
    }
  });

  // 支出明細
  Object.entries(rs.expenseBreakdown).forEach(([k, v]) => {
    if (v > 0) {
      draw(`  Expense - ${k}: ${v.toLocaleString()}`, MARGIN, (cursorY += 12), 8);
    }
  });

  // ── P4 資產負債表 ─────────────────────────────────────────────
  // 若接近頁底，換頁
  if (cursorY > H - 200) {
    page = pdfDoc.addPage([W, H]);
    cursorY = MARGIN + 20;
  }

  drawLine((cursorY += 12));
  drawBold('P4 - Balance Sheet (NT$)', MARGIN, (cursorY += 16), 11);

  const cr = partial.creditProtection;
  draw(`Total Assets:      ${cr.totalAssets.toLocaleString()}`, MARGIN, (cursorY += 14), 9);
  draw(`Total Liabilities: ${cr.totalLiabilities.toLocaleString()}`, COL2, cursorY, 9);
  draw(`Net Worth:         ${cr.netWorth.toLocaleString()} ${cr.netWorth >= 0 ? '' : '(Negative)'}`, MARGIN, (cursorY += 14), 9);
  draw(`Liquid Assets:     ${cr.liquidAssets.toLocaleString()}`, MARGIN, (cursorY += 14), 9);
  draw(`Short-term Liab:   ${cr.shortTermLiabilities.toLocaleString()}`, COL2, cursorY, 9);
  if (cr.realEstateValue > 0) {
    draw(`Real Estate Value: ${cr.realEstateValue.toLocaleString()}`, MARGIN, (cursorY += 14), 9);
    if (cr.ltvRatio !== undefined) {
      draw(`LTV Ratio: ${(cr.ltvRatio * 100).toFixed(2)}%`, COL2, cursorY, 9);
    }
  }

  // ── P5 六大風控因子 ───────────────────────────────────────────
  if (cursorY > H - 250) {
    page = pdfDoc.addPage([W, H]);
    cursorY = MARGIN + 20;
  }

  drawLine((cursorY += 12));
  drawBold('P5 - Risk Factors (Level 1-10)', MARGIN, (cursorY += 16), 11);

  const rf = partial.riskFactors;
  const rfItems: [string, (typeof rf.employmentStability)][] = [
    ['Employment Stability', rf.employmentStability],
    ['Income Growth',       rf.incomeGrowth],
    ['Net Worth Level',     rf.netWorthLevel],
    ['Net Worth Ratio',     rf.netWorthRatio],
    ['Liquidity Ratio',     rf.liquidityRatio],
    ['Debt Ratio',          rf.debtRatio],
  ];

  rfItems.forEach(([name, score]) => {
    const barWidth = Math.round((score.level / 10) * 100);
    const bar = '|'.repeat(Math.max(1, Math.floor(barWidth / 7))) + ` Lv.${score.level}`;
    draw(`${name.padEnd(22)} ${bar}  ${score.notes.slice(0, 50)}`, MARGIN, (cursorY += 16), 8);
  });

  // ── 合規指標 ─────────────────────────────────────────────────
  drawLine((cursorY += 12));
  drawBold('Compliance Thresholds', MARGIN, (cursorY += 16), 11);

  const th = partial.thresholds;
  draw(
    `Debt-Income Ratio: ${th.debtIncomeRatio.value}% / Limit ${th.debtIncomeRatio.limit}%  [${th.debtIncomeRatio.pass ? 'PASS' : 'FAIL'}]`,
    MARGIN, (cursorY += 14), 9,
  );
  if (th.dbr) {
    draw(
      `DBR: ${th.dbr.value}x / Limit 22x  [${th.dbr.pass ? 'PASS' : 'FAIL'}]`,
      MARGIN, (cursorY += 14), 9,
    );
  }
  if (th.monthlyPaymentRatio) {
    draw(
      `Monthly Payment Ratio: ${th.monthlyPaymentRatio.value}% / Limit 33.33%  [${th.monthlyPaymentRatio.pass ? 'PASS' : 'FAIL'}]`,
      MARGIN, (cursorY += 14), 9,
    );
  }
  if (partial.adjustedLoanAmount !== undefined) {
    draw(
      `Suggested Adjusted Loan: NT$ ${partial.adjustedLoanAmount.toLocaleString()}`,
      MARGIN, (cursorY += 14), 9,
    );
  }

  // ── 防詐模型 ─────────────────────────────────────────────────
  if (cursorY > H - 200) {
    page = pdfDoc.addPage([W, H]);
    cursorY = MARGIN + 20;
  }

  drawLine((cursorY += 12));
  drawBold(`Fraud Check - Level: ${partial.fraudCheck.overallLevel.toUpperCase()}`, MARGIN, (cursorY += 16), 11);
  draw(partial.fraudCheck.message, MARGIN, (cursorY += 14), 9);

  partial.fraudCheck.items.forEach((item) => {
    const flag = item.triggered ? '[!]' : '[ ]';
    draw(`${flag} Item ${item.id}: ${item.description.slice(0, 55)}`, MARGIN, (cursorY += 12), 8);
  });

  // ── 綜合評估 ─────────────────────────────────────────────────
  drawLine((cursorY += 12));
  drawBold('Overall Assessment', MARGIN, (cursorY += 16), 11);
  draw(`Manual Review Required: ${partial.requiresManualReview ? 'YES' : 'No'}`, MARGIN, (cursorY += 14), 9);

  // 評估結論（英文化）
  const assessmentEn = partial.overallAssessment
    .replace('【應特別注意審慎辦理】', '[CAUTION REQUIRED] ')
    .replace('【應評估後辦理】', '[EVALUATE BEFORE PROCEEDING] ')
    .replace('【尚屬正常】', '[NORMAL] ');
  // 分段顯示（每 70 字換行）
  const words = assessmentEn.split(/\s+/);
  let line = '';
  let lineY = cursorY + 14;
  words.forEach((w) => {
    if ((line + ' ' + w).length > 70) {
      draw(line.trim(), MARGIN, lineY, 9);
      lineY += 14;
      line = w;
    } else {
      line += ' ' + w;
    }
  });
  if (line.trim()) draw(line.trim(), MARGIN, lineY, 9);
  cursorY = lineY + 4;

  partial.suggestedActions.forEach((action, i) => {
    const actionEn = action
      .replace('NT$', 'NT$')
      .replace(/[\u4e00-\u9fa5]/g, (c) => c); // keep Chinese as-is
    draw(`${i + 1}. ${actionEn.slice(0, 80)}`, MARGIN, (cursorY += 14), 8);
  });

  // ── 頁尾 ─────────────────────────────────────────────────────
  drawLine((cursorY += 16));
  draw(`Mode: DEMO | Generated: ${new Date().toISOString()}`, MARGIN, (cursorY += 14), 8);
  draw('** This report is for demo purposes only. **', MARGIN, (cursorY += 12), 8);

  // 儲存
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(OUTPUT_DIR, `${reportId}.pdf`);
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`[creditReportGenerator] 批覆書已生成：${outputPath}`);
  return outputPath;
}

// ─── 型別：半完成結果（未含 reportJson/reportPdfPath） ────────

type PartialResult = {
  loanType: 'mortgage' | 'personal';
  borrowerProfile: BorrowerProfileResult;
  creditPurpose: CreditPurposeResult;
  repaymentSource: RepaymentSourceResult;
  creditProtection: CreditProtectionResult;
  riskFactors: RiskFactorsResult;
  thresholds: ThresholdsResult;
  fraudCheck: FraudCheckResult;
  requiresManualReview: boolean;
  adjustedLoanAmount?: number;
  overallAssessment: string;
  suggestedActions: string[];
  mode: 'demo';
  timestamp: string;
};

// ─── 主函數 ────────────────────────────────────────────────────

/**
 * 生成批覆書（JSON + PDF）
 * @returns reportJson（結構化 JSON）、reportPdfPath（PDF 路徑）
 */
export async function generateCreditReport(
  partial: PartialResult,
  req: CreditReviewRequest,
): Promise<{ reportJson: object; reportPdfPath: string }> {
  const reportId = generateReportId();

  // JSON 批覆書（5P 結構完整輸出）
  const reportJson = {
    reportId,
    loanType: partial.loanType,
    applicant: {
      name: req.borrower.name,
      age: req.borrower.age,
      occupation: req.borrower.occupation,
      yearsEmployed: req.borrower.yearsEmployed,
    },
    loanRequest: {
      amount: req.loanAmount,
      termYears: req.termYears,
      gracePeriodYears: req.gracePeriodYears,
    },
    p1_borrowerProfile: partial.borrowerProfile,
    p2_creditPurpose: partial.creditPurpose,
    p3_repaymentSource: partial.repaymentSource,
    p4_creditProtection: partial.creditProtection,
    p5_riskFactors: partial.riskFactors,
    thresholds: partial.thresholds,
    adjustedLoanAmount: partial.adjustedLoanAmount,
    fraudCheck: partial.fraudCheck,
    conclusion: {
      requiresManualReview: partial.requiresManualReview,
      overallAssessment: partial.overallAssessment,
      suggestedActions: partial.suggestedActions,
    },
    meta: {
      mode: partial.mode,
      timestamp: partial.timestamp,
      reportGeneratedAt: new Date().toISOString(),
    },
  };

  // PDF 批覆書
  const reportPdfPath = await generatePdf(reportId, req, partial);

  return { reportJson, reportPdfPath };
}
