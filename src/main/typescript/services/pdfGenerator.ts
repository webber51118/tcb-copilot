/**
 * INPUT: 申請案件資料 + 簽名圖片（base64）+ 案件編號
 * OUTPUT: 生成 PDF 申請書檔案，存至 data/applications/{caseId}.pdf
 * POS: 服務層，使用 pdf-lib 在消費者貸款申請書模板上疊加申請資料
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { LoanApplication } from '../models/types';

/** 模板 PDF 路徑 */
const TEMPLATE_PATH = path.join(process.cwd(), '消費者貸款申請書11407.pdf');
/** 輸出目錄 */
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'applications');

/** 確保輸出目錄存在 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/** 將簽名 base64 轉為 Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  const buf = Buffer.from(data, 'base64');
  return new Uint8Array(buf);
}

/**
 * 生成申請書 PDF
 * @param application 申請案件資料
 * @param signatureBase64 簽名圖片（base64 PNG/JPEG）
 * @param extraInfo 補充資料（LIFF 表單 Step 2 資料）
 * @returns 生成的 PDF 檔案路徑
 */
export async function generateApplicationPdf(
  application: LoanApplication,
  signatureBase64: string,
  extraInfo: {
    birthDate?: string;
    maritalStatus?: string;
    education?: string;
    address?: string;
  } = {},
): Promise<string> {
  ensureOutputDir();

  // 載入模板 PDF（若不存在則建立空白 PDF）
  let pdfDoc: PDFDocument;
  if (fs.existsSync(TEMPLATE_PATH)) {
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
  }

  const page = pdfDoc.getPage(0);
  const { height } = page.getSize();

  // 嵌入字型（使用 Helvetica，中文需另外嵌入，此處先用英文替代標注）
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const color = rgb(0, 0, 0);

  /** 在指定位置寫入文字（座標系從左下角起算） */
  function drawText(text: string, x: number, yFromTop: number): void {
    page.drawText(text, {
      x,
      y: height - yFromTop,
      size: fontSize,
      font,
      color,
    });
  }

  // ── 申請人基本資料（座標為估算值，需依實際 PDF 調整）──
  drawText(application.applicantName || '', 150, 135);
  drawText(application.applicantPhone || '', 380, 135);

  if (extraInfo.birthDate) drawText(extraInfo.birthDate, 150, 155);
  if (extraInfo.maritalStatus) drawText(extraInfo.maritalStatus, 320, 155);
  if (extraInfo.education) drawText(extraInfo.education, 460, 155);
  if (extraInfo.address) drawText(extraInfo.address, 150, 175);

  // ── 貸款資訊 ──
  const loanTypeLabel =
    application.loanType === 'mortgage' ? '房屋貸款'
    : application.loanType === 'reverse_annuity' ? '以房養老'
    : '信用貸款';
  drawText(loanTypeLabel, 150, 215);

  const amount = application.basicInfo?.amount
    ? `NT$ ${application.basicInfo.amount.toLocaleString()}`
    : '';
  drawText(amount, 320, 215);

  const term = application.basicInfo?.termYears
    ? `${application.basicInfo.termYears} 年`
    : '';
  drawText(term, 460, 215);

  // ── 案件編號 ──
  drawText(application.id, 380, 100);

  // ── 申辦日期 ──
  drawText(new Date(application.appliedAt).toLocaleDateString('zh-TW'), 460, 100);

  // ── 嵌入簽名圖片（右下角簽名欄） ──
  if (signatureBase64 && signatureBase64.length > 100) {
    try {
      const sigBytes = base64ToUint8Array(signatureBase64);
      let sigImage;
      if (signatureBase64.startsWith('data:image/png') || signatureBase64.includes('image/png')) {
        sigImage = await pdfDoc.embedPng(sigBytes);
      } else {
        sigImage = await pdfDoc.embedJpg(sigBytes);
      }
      // 簽名放置於第一頁右下角簽名欄（座標估算）
      const sigDims = sigImage.scale(0.4);
      page.drawImage(sigImage, {
        x: 380,
        y: height - 720,
        width: sigDims.width,
        height: sigDims.height,
      });
    } catch (err) {
      console.warn('[pdfGenerator] 簽名圖片嵌入失敗:', err);
    }
  }

  // 儲存 PDF
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(OUTPUT_DIR, `${application.id}.pdf`);
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`[pdfGenerator] 申請書已生成：${outputPath}`);
  return outputPath;
}
