import { useState, useMemo } from 'react';

interface MonthlyCalculatorProps {
  initialAmount?: number;
  initialTerm?: number;
  rateValue: number;
  isReverseAnnuity?: boolean;
}

function calcMonthly(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0 || n === 0) return Math.round(principal / Math.max(n, 1));
  return Math.round(principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}

function calcReverseAnnuity(totalCredit: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0 || n === 0) return Math.round(totalCredit / Math.max(n, 1));
  return Math.round(totalCredit * r / (1 - Math.pow(1 + r, -n)));
}

export default function MonthlyCalculator({
  initialAmount = 5_000_000,
  initialTerm = 30,
  rateValue,
  isReverseAnnuity = false,
}: MonthlyCalculatorProps) {
  const [amount, setAmount] = useState(initialAmount);
  const [term, setTerm] = useState(initialTerm);

  const monthly = useMemo(() => {
    return isReverseAnnuity
      ? calcReverseAnnuity(amount, rateValue, term)
      : calcMonthly(amount, rateValue, term);
  }, [amount, term, rateValue, isReverseAnnuity]);

  const maxAmount = isReverseAnnuity ? 20_000_000 : 30_000_000;
  const maxTerm = isReverseAnnuity ? 35 : 40;

  return (
    <div className="card">
      <h4 className="font-bold text-gray-800 mb-3">
        {isReverseAnnuity ? '月撥付試算' : '月付試算器'}
      </h4>

      <div className="space-y-4">
        {/* 金額滑桿 */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">
              {isReverseAnnuity ? '預計核貸金額' : '貸款金額'}
            </span>
            <span className="font-bold text-tcb-blue">
              NT$ {(amount / 10000).toFixed(0)}萬
            </span>
          </div>
          <input
            type="range"
            min={500_000}
            max={maxAmount}
            step={100_000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-tcb-blue"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>50萬</span><span>{(maxAmount / 10000).toFixed(0)}萬</span>
          </div>
        </div>

        {/* 年限滑桿 */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">還款年限</span>
            <span className="font-bold text-tcb-blue">{term} 年</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxTerm}
            step={1}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full accent-tcb-blue"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1年</span><span>{maxTerm}年</span>
          </div>
        </div>

        {/* 試算結果 */}
        <div className="bg-tcb-light rounded-xl p-3 text-center">
          <p className="text-sm text-gray-500">
            {isReverseAnnuity ? '預估每月撥付' : '預估月付金額'}
          </p>
          <p className="text-3xl font-black text-tcb-blue mt-1">
            NT$ {monthly.toLocaleString('zh-TW')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            利率 {rateValue}%・{term}年・{(amount / 10000).toFixed(0)}萬
          </p>
        </div>
      </div>
    </div>
  );
}
