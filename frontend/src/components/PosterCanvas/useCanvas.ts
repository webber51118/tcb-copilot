import { useEffect, RefObject } from 'react';
import QRCode from 'qrcode';
import type { RecommendedProduct, Promotion, LoanType } from '../../types';

const W = 1080;
const H = 1920;

const TCB_BLUE = '#1B4F8A';
const TCB_GOLD = '#C9A84C';
const TCB_RED  = '#C0392B';
const WHITE    = '#FFFFFF';
const LIGHT_BG = '#EBF2FA';

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 'normal', color = '#333333') {
  ctx.font = `${weight} ${size}px "Noto Sans TC", sans-serif`;
  ctx.fillStyle = color;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fillColor: string,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxWidth: number, lineHeight: number,
): number {
  const words = text.split('');
  let line = '';
  let curY = y;
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, curY);
      line = ch;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, curY); curY += lineHeight; }
  return curY;
}

interface DrawOptions {
  product: RecommendedProduct;
  loanType: LoanType;
  formData: any;
  activePromotion?: Promotion;
}

export function useCanvas(
  canvasRef: RefObject<HTMLCanvasElement>,
  opts: DrawOptions,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawPoster(ctx, opts).catch(console.error);
  }, [opts.product.id, opts.activePromotion?.id]);
}

async function drawPoster(ctx: CanvasRenderingContext2D, opts: DrawOptions) {
  const { product, loanType, formData, activePromotion } = opts;
  const isReverseAnnuity = loanType === 'reverse_annuity';

  // ── 背景 ────────────────────────────────────────────
  ctx.fillStyle = '#F5F7FA';
  ctx.fillRect(0, 0, W, H);

  // ── 節日標籤（條件顯示） ────────────────────────────
  let yOffset = 0;
  if (activePromotion) {
    ctx.fillStyle = TCB_RED;
    ctx.fillRect(0, 0, W, 90);
    setFont(ctx, 38, 'bold', WHITE);
    ctx.textAlign = 'center';
    ctx.fillText(`🎉 ${activePromotion.holiday}限定活動`, W / 2, 58);
    yOffset = 90;
  }

  // ── 品牌 Header ──────────────────────────────────────
  const headerH = 240;
  const grad = ctx.createLinearGradient(0, yOffset, 0, yOffset + headerH);
  grad.addColorStop(0, TCB_BLUE);
  grad.addColorStop(1, '#0E3160');
  ctx.fillStyle = grad;
  ctx.fillRect(0, yOffset, W, headerH);

  // Logo 圓形
  ctx.beginPath();
  ctx.arc(120, yOffset + 100, 60, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  setFont(ctx, 28, 'black', TCB_BLUE);
  ctx.textAlign = 'center';
  ctx.fillText('合庫', 120, yOffset + 95);
  ctx.fillText('銀行', 120, yOffset + 125);

  // 品牌文字
  setFont(ctx, 42, 'bold', WHITE);
  ctx.textAlign = 'left';
  ctx.fillText('合作金庫銀行', 220, yOffset + 85);
  setFont(ctx, 28, 'normal', 'rgba(255,255,255,0.8)');
  ctx.fillText('個金 Co-Pilot 領航員', 220, yOffset + 130);
  setFont(ctx, 22, 'normal', 'rgba(255,255,255,0.6)');
  ctx.fillText('為您量身打造的貸款方案', 220, yOffset + 165);

  yOffset += headerH + 60;

  // ── 產品名稱與利率 ─────────────────────────────────
  setFont(ctx, 28, 'normal', '#888');
  ctx.textAlign = 'center';
  ctx.fillText('為您主推', W / 2, yOffset);
  yOffset += 50;

  setFont(ctx, 52, 'black', TCB_BLUE);
  ctx.fillText(product.name, W / 2, yOffset);
  yOffset += 70;

  // 利率大字
  drawRoundRect(ctx, 100, yOffset, W - 200, 120, 20, TCB_BLUE);
  setFont(ctx, 36, 'normal', 'rgba(255,255,255,0.7)');
  ctx.textAlign = 'center';
  ctx.fillText('優惠利率', W / 2, yOffset + 42);
  setFont(ctx, 56, 'black', WHITE);
  ctx.fillText(product.rateRange, W / 2, yOffset + 100);
  yOffset += 160;

  // ── 客戶個人化資訊 ─────────────────────────────────
  drawRoundRect(ctx, 60, yOffset, W - 120, 260, 24, WHITE);
  // 標題
  setFont(ctx, 28, 'bold', TCB_BLUE);
  ctx.textAlign = 'left';
  ctx.fillText('您的個人化試算', 100, yOffset + 48);

  const infoItems = [
    { label: '貸款金額', value: `NT$ ${((formData?.amount ?? 5000000) / 10000).toFixed(0)}萬` },
    { label: '還款年限', value: `${formData?.termYears ?? 30} 年` },
    {
      label: isReverseAnnuity ? '預估每月撥付' : '預估月付金額',
      value: product.monthlyPayment
        ? `NT$ ${product.monthlyPayment.toLocaleString()}`
        : '依核貸核定',
    },
    {
      label: '職業優惠',
      value: formData?.occupation || '一般優惠適用',
    },
  ];

  infoItems.forEach((item, i) => {
    const row = yOffset + 80 + i * 48;
    setFont(ctx, 24, 'normal', '#888');
    ctx.textAlign = 'left';
    ctx.fillText(item.label, 100, row);
    setFont(ctx, 26, 'bold', '#333');
    ctx.textAlign = 'right';
    ctx.fillText(item.value, W - 100, row);
  });
  yOffset += 300;

  // ── 產品亮點 ───────────────────────────────────────
  drawRoundRect(ctx, 60, yOffset, W - 120, 280, 24, LIGHT_BG);
  setFont(ctx, 28, 'bold', TCB_BLUE);
  ctx.textAlign = 'left';
  ctx.fillText('方案亮點', 100, yOffset + 48);

  product.features.slice(0, 4).forEach((feat, i) => {
    const row = yOffset + 85 + i * 54;
    // 勾號圓形
    ctx.beginPath();
    ctx.arc(108, row + 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = TCB_BLUE;
    ctx.fill();
    setFont(ctx, 20, 'bold', WHITE);
    ctx.textAlign = 'center';
    ctx.fillText('✓', 108, row + 8);
    setFont(ctx, 26, 'normal', '#333');
    ctx.textAlign = 'left';
    ctx.fillText(feat, 132, row + 8);
  });
  yOffset += 320;

  // 節日加碼（若有）
  if (activePromotion?.bonusDescription) {
    drawRoundRect(ctx, 60, yOffset, W - 120, 100, 20, '#FFF3F3');
    setFont(ctx, 26, 'bold', TCB_RED);
    ctx.textAlign = 'center';
    ctx.fillText(`🎉 ${activePromotion.holiday}加碼：${activePromotion.bonusDescription}`, W / 2, yOffset + 58);
    yOffset += 140;
  }

  // ── QR Code ──────────────────────────────────────────
  const applyUrl = import.meta.env.VITE_TCB_APPLY_URL || 'https://www.tcb-bank.com.tw';
  const qrDataUrl = await QRCode.toDataURL(applyUrl, { width: 220, margin: 1 });
  const qrImg = new Image();
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
    qrImg.src = qrDataUrl;
  });

  drawRoundRect(ctx, (W - 280) / 2, yOffset, 280, 310, 20, WHITE);
  ctx.drawImage(qrImg, (W - 220) / 2, yOffset + 20, 220, 220);
  setFont(ctx, 24, 'bold', TCB_BLUE);
  ctx.textAlign = 'center';
  ctx.fillText('掃碼立即申辦', W / 2, yOffset + 270);
  yOffset += 350;

  // ── 底部免責聲明 ─────────────────────────────────────
  setFont(ctx, 20, 'normal', '#aaa');
  ctx.textAlign = 'center';
  ctx.fillText('本試算僅供參考，實際核貸以合庫銀行審核為準', W / 2, yOffset + 20);
  ctx.fillText(`合作金庫銀行 © ${new Date().getFullYear()}`, W / 2, yOffset + 50);
}
