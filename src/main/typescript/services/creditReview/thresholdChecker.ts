/**
 * INPUT: CreditReviewRequest、RepaymentSourceResult
 * OUTPUT: ThresholdsResult（額度調整指標：DBR / 負債比 / 月還款比 + adjustedLoanAmount）
 * POS: 服務層，計算貸款合規指標，超標時建議調整金額
 */

import { calcMonthlyPayment } from '../recommendationEngine';
import {
  CreditReviewRequest,
  RepaymentSourceResult,
  ThresholdsResult,
} from '../../models/creditReview';

/** 台北市最低生活支出 */
const LIVING_EXPENSE_TAIPEI = 20000;
const LIVING_EXPENSE_OTHER = 15000;

/** Demo 模式利率 */
const DEMO_RATE_MORTGAGE = 2.06;
const DEMO_RATE_PERSONAL = 5.5;

/**
 * PMT 反函數：求可負擔的最大本金
 * maxPrincipal = monthlyPayment × ((1+r)^n - 1) / (r × (1+r)^n)
 */
function calcMaxPrincipal(monthlyPayment: number, annualRate: number, termYears: number): number {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round(monthlyPayment * n);
  const factor = (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  return Math.floor(monthlyPayment * factor / 10000) * 10000; // 無條件捨去至萬元
}

/**
 * 計算額度調整指標
 * 房貸：所得負債比 = 月總支出/月收入 ≤ 80%（含最低生活費 18,000 - 計畫使用 Q6 B 標準）
 * 信貸：DBR = (totalUnsecuredDebt + loanAmount) / monthlyIncome ≤ 22
 *       月還款比 = 信貸月付 / 月收入 ≤ 1/3
 */
export function checkThresholds(
  req: CreditReviewRequest,
  repayment: RepaymentSourceResult,
): { thresholds: ThresholdsResult; adjustedLoanAmount?: number } {
  const { loanType, loanAmount, termYears, borrower, property } = req;
  const { monthlyIncome, monthlyExpense } = repayment;

  // 月支出不含本行新貸月付（重新拆算出其他支出部分）
  const annualRate = loanType === 'mortgage' ? DEMO_RATE_MORTGAGE : DEMO_RATE_PERSONAL;
  const newLoanMonthly =
    loanAmount > 0 ? calcMonthlyPayment(loanAmount, annualRate, termYears) : 0;
  const otherMonthlyExpense = monthlyExpense - newLoanMonthly;

  if (loanType === 'mortgage') {
    // ── 房貸：所得負債比 ─────────────────────────────────────────
    const LIMIT = 80;
    const debtRatioValue = monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 100;
    const pass = debtRatioValue <= LIMIT;

    let adjustedLoanAmount: number | undefined;
    if (!pass && monthlyIncome > 0) {
      // 可用月付 = 月收入 × 0.79 - 其他月支出
      const livingExp =
        property?.region === '台北市' ? LIVING_EXPENSE_TAIPEI : LIVING_EXPENSE_OTHER;
      const availableMonthly = monthlyIncome * 0.79 - otherMonthlyExpense + livingExp;
      // 若扣除其他支出後可用月付仍為正，反推最大本金
      if (availableMonthly > 0) {
        adjustedLoanAmount = calcMaxPrincipal(availableMonthly, annualRate, termYears);
        adjustedLoanAmount = Math.max(adjustedLoanAmount, 0);
      }
    }

    return {
      thresholds: {
        debtIncomeRatio: {
          value: Math.round(debtRatioValue * 10) / 10,
          limit: LIMIT,
          pass,
        },
      },
      adjustedLoanAmount,
    };
  } else {
    // ── 信貸：DBR + 月還款比 ────────────────────────────────────
    const totalUnsecuredDebt = borrower.totalUnsecuredDebt ?? 0;

    // DBR = (現有無擔保總債務 + 本次申請金額) / 月收入
    const dbrValue =
      monthlyIncome > 0 ? (totalUnsecuredDebt + loanAmount) / monthlyIncome : 999;
    const dbrPass = dbrValue <= 22;

    // 月還款比 = 信貸月付 / 月收入
    const monthlyPaymentRatioValue =
      monthlyIncome > 0 ? (newLoanMonthly / monthlyIncome) * 100 : 100;
    const monthlyPaymentRatioPass = monthlyPaymentRatioValue <= 33.33;

    // 所得負債比（與房貸同口徑，供參考）
    const debtRatioValue = monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 100;

    let adjustedLoanAmount: number | undefined;
    if (!dbrPass && monthlyIncome > 0) {
      // DBR 超標：可申請金額 = 22 × 月收入 - 現有無擔保總債務
      const maxAllowed = 22 * monthlyIncome - totalUnsecuredDebt;
      adjustedLoanAmount = Math.max(Math.floor(maxAllowed / 10000) * 10000, 0);
    }

    return {
      thresholds: {
        debtIncomeRatio: {
          value: Math.round(debtRatioValue * 10) / 10,
          limit: 80,
          pass: debtRatioValue <= 80,
        },
        dbr: {
          value: Math.round(dbrValue * 100) / 100,
          limit: 22,
          pass: dbrPass,
        },
        monthlyPaymentRatio: {
          value: Math.round(monthlyPaymentRatioValue * 10) / 10,
          limit: 33.33,
          pass: monthlyPaymentRatioPass,
        },
      },
      adjustedLoanAmount,
    };
  }
}
