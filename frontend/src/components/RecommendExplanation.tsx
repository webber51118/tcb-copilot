import { useState } from 'react';
import type { LoanType, RecommendedProduct } from '../types';

interface FormSnapshot {
  income: number;
  amount: number;
  termYears: number;
  occupation: string;
  age: number;
}

interface Props {
  loanType: LoanType;
  form: FormSnapshot;
  primary: RecommendedProduct;
  alternatives: RecommendedProduct[];
}

/** 計算等額本息月付金額 */
function calcMonthly(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0 || n === 0) return Math.round(principal / Math.max(n, 1));
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

/** 依職業、金額、收入動態產生推薦理由 */
function buildReasons(loanType: LoanType, form: FormSnapshot, product: RecommendedProduct): string[] {
  const reasons: string[] = [];
  const amountW = Math.round(form.amount / 10000);
  const incomeW = (form.income / 10000).toFixed(1);
  const maxAmountW = Math.round(product.maxAmount / 10000);

  // 職業優惠
  const preferredOcc = ['軍人', '公務員', '教師'];
  if (preferredOcc.includes(form.occupation)) {
    reasons.push(`您的職業（${form.occupation}）屬優質徵信族群，可優先申辦利率較低的專屬方案`);
  }

  // 收入能力
  if (form.income >= 80000) {
    reasons.push(`月收入 ${incomeW} 萬，還款能力充裕，符合高成數核貸條件`);
  } else if (form.income >= 40000) {
    reasons.push(`月收入 ${incomeW} 萬，符合核貸基本門檻，還款負擔在合理範圍`);
  } else {
    reasons.push(`月收入 ${incomeW} 萬，建議搭配薪轉帳戶設定可提高核貸機率`);
  }

  // 申貸金額與上限比較
  if (form.amount <= product.maxAmount * 0.6) {
    reasons.push(`申貸 ${amountW} 萬低於產品上限 ${maxAmountW} 萬的 60%，核貸空間充裕`);
  } else if (form.amount <= product.maxAmount * 0.85) {
    reasons.push(`申貸 ${amountW} 萬在產品上限 ${maxAmountW} 萬的合理範圍內`);
  }

  // 寬限期
  if (product.gracePeriodYears && product.gracePeriodYears > 0) {
    reasons.push(`提供最長 ${product.gracePeriodYears} 年寬限期，初期只繳息，月付壓力較低`);
  }

  // 年齡適配
  if (loanType === 'reverse_annuity' && form.age >= 60) {
    reasons.push(`年齡 ${form.age} 歲符合以房養老申請資格（須年滿 55 歲）`);
  } else if (loanType === 'mortgage' && form.age <= 40) {
    reasons.push(`年齡 ${form.age} 歲，可申請較長還款年限，分散每月還款壓力`);
  }

  // 產品特色補充（最多取第一項）
  if (product.features.length > 0 && reasons.length < 4) {
    reasons.push(`產品亮點：${product.features[0]}`);
  }

  return reasons.slice(0, 4);
}

export default function RecommendExplanation({ loanType, form, primary, alternatives }: Props) {
  const [open, setOpen] = useState(false);

  const monthly = calcMonthly(form.amount, primary.rateValue, form.termYears);
  const isMortgage = loanType !== 'personal';

  // 負債比計算
  const debtRatio = isMortgage
    ? ((monthly + 18000) / form.income) * 100   // 房貸負債比 %
    : form.amount / form.income;                  // 信貸 DBR 倍數

  const debtMax = isMortgage ? 85 : 22;
  const debtBarPct = Math.min((debtRatio / debtMax) * 100, 100);
  const debtLabel = isMortgage ? '負債比' : 'DBR 倍數';
  const debtDisplay = isMortgage ? `${debtRatio.toFixed(1)}%` : `${debtRatio.toFixed(1)} 倍`;
  const debtLimitDisplay = isMortgage ? `上限 ${debtMax}%` : `上限 ${debtMax} 倍`;

  const isGreen = debtBarPct < 70;
  const isYellow = debtBarPct >= 70 && debtBarPct < 90;
  const debtStatus = isGreen ? '安全' : isYellow ? '注意' : '偏高';
  const debtColor = isGreen ? 'text-green-600' : isYellow ? 'text-yellow-600' : 'text-red-600';
  const barColor = isGreen ? 'bg-green-500' : isYellow ? 'bg-yellow-500' : 'bg-red-500';

  const reasons = buildReasons(loanType, form, primary);
  const bestAlt = alternatives[0];

  const showGracePeriodRow =
    (primary.gracePeriodYears !== undefined && primary.gracePeriodYears !== null) ||
    (bestAlt?.gracePeriodYears !== undefined && bestAlt?.gracePeriodYears !== null);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 折疊按鈕 */}
      <button
        className="w-full flex items-center justify-between px-4 py-3.5"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-bold text-tcb-blue text-sm">🔍 查看推薦理由分析</span>
        <span
          className="text-gray-400 text-xs transition-transform duration-200"
          style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-5 space-y-5">
          {/* ── 負債比分析 ── */}
          <section className="pt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3">📊 負債比分析</h4>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">{debtLabel}</span>
                <span className={`text-sm font-black ${debtColor}`}>
                  {debtDisplay}
                  <span className="text-xs font-normal text-gray-400 ml-1">（{debtLimitDisplay}）</span>
                </span>
              </div>

              {/* 進度條 */}
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${debtBarPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">0</span>
                <span className={`text-xs font-bold ${debtColor}`}>{debtStatus}</span>
                <span className="text-xs text-gray-400">{debtLimitDisplay}</span>
              </div>

              {/* 計算說明 */}
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                {isMortgage
                  ? `計算：(月付 ${monthly.toLocaleString()} + 基本生活費 18,000) ÷ 月收入 ${form.income.toLocaleString()} × 100%`
                  : `計算：申貸金額 ${Math.round(form.amount / 10000)} 萬 ÷ 月收入 ${form.income.toLocaleString()}`}
              </p>
            </div>
          </section>

          {/* ── 推薦理由 ── */}
          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-3">🎯 為什麼推薦這個方案</h4>
            <ul className="space-y-2">
              {reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="text-tcb-blue font-bold mt-0.5 shrink-0">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── 方案比較表（有備選才顯示） ── */}
          {bestAlt && (
            <section>
              <h4 className="text-sm font-bold text-gray-700 mb-3">⚖️ 方案比較</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-center">
                      <th className="text-left text-gray-400 font-normal pb-2 w-20">項目</th>
                      <th className="pb-2">
                        <span className="bg-tcb-blue text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          主推
                        </span>
                        <p className="text-gray-700 font-bold mt-0.5 leading-tight">{primary.name}</p>
                      </th>
                      <th className="pb-2 text-gray-500">
                        備選
                        <p className="font-semibold mt-0.5 leading-tight">{bestAlt.name}</p>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-2 text-gray-400">利率範圍</td>
                      <td className="py-2 text-center font-bold text-tcb-blue">{primary.rateRange}</td>
                      <td className="py-2 text-center text-gray-600">{bestAlt.rateRange}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-400">最高額度</td>
                      <td className="py-2 text-center font-bold">
                        {Math.round(primary.maxAmount / 10000)} 萬
                      </td>
                      <td className="py-2 text-center text-gray-600">
                        {Math.round(bestAlt.maxAmount / 10000)} 萬
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-400">最長年限</td>
                      <td className="py-2 text-center font-bold">{primary.maxTermYears} 年</td>
                      <td className="py-2 text-center text-gray-600">{bestAlt.maxTermYears} 年</td>
                    </tr>
                    {showGracePeriodRow && (
                      <tr>
                        <td className="py-2 text-gray-400">寬限期</td>
                        <td className="py-2 text-center font-bold">
                          {primary.gracePeriodYears ?? 0} 年
                        </td>
                        <td className="py-2 text-center text-gray-600">
                          {bestAlt.gracePeriodYears ?? 0} 年
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
