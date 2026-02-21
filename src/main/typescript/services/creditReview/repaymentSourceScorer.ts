/**
 * INPUT: BorrowerInput、GuarantorInput（選填）、貸款參數
 * OUTPUT: RepaymentSourceResult（P3 個人收支平衡表）
 * POS: 服務層，自動編製個人收支平衡表（月收入/月支出/月結餘）
 */

import { calcMonthlyPayment } from '../recommendationEngine';
import {
  BorrowerInput,
  GuarantorInput,
  PropertyInput,
  RepaymentSourceResult,
} from '../../models/creditReview';

/** 台北市最低生活支出 20,000，其他縣市 15,000（Q6 B） */
function getLivingExpense(region?: string): number {
  return region === '台北市' ? 20000 : 15000;
}

/** 房貸示範利率（2.06%）與信貸示範利率（5.5%） */
const DEMO_RATE_MORTGAGE = 2.06;
const DEMO_RATE_PERSONAL = 5.5;

/**
 * 編製個人收支平衡表
 * @param borrower 借款人資料
 * @param guarantor 保證人資料（選填）
 * @param loanAmount 申請金額（元）
 * @param termYears 貸款年限
 * @param loanType 貸款類型
 * @param property 房貸標的物資料（房貸專用）
 */
export function scoreRepaymentSource(
  borrower: BorrowerInput,
  guarantor: GuarantorInput | undefined,
  loanAmount: number,
  termYears: number,
  loanType: 'mortgage' | 'personal',
  property?: PropertyInput,
): RepaymentSourceResult {
  // ── 月收入計算 ──────────────────────────────────────────────────
  // 月總收入 = (薪資 + 執行業務 + 租賃 + 股利 + 補充 + 非經常性) / 12
  const salaryMonthly = (borrower.salaryIncome ?? borrower.monthlyIncome * 12) / 12;
  const businessMonthly = (borrower.businessIncome ?? 0) / 12;
  const rentalMonthly = (borrower.rentalIncome ?? 0) / 12;
  const dividendMonthly = (borrower.dividendIncome ?? 0) / 12;
  const otherMonthly = (borrower.otherIncome ?? 0) / 12;
  const nonRecurringMonthly = (borrower.nonRecurringIncome ?? 0) / 12;

  // 加計保證人收入（若有）
  const guarantorMonthly = guarantor?.monthlyIncome ?? 0;

  const incomeBreakdown: Record<string, number> = {
    '薪資所得': Math.round(salaryMonthly),
    '執行業務/自營': Math.round(businessMonthly),
    '租賃所得': Math.round(rentalMonthly),
    '股利所得': Math.round(dividendMonthly),
    '其他所得': Math.round(otherMonthly),
    '非經常性所得': Math.round(nonRecurringMonthly),
  };
  if (guarantorMonthly > 0) {
    incomeBreakdown['保證人月收入'] = Math.round(guarantorMonthly);
  }

  const monthlyIncome = Math.round(
    salaryMonthly +
    businessMonthly +
    rentalMonthly +
    dividendMonthly +
    otherMonthly +
    nonRecurringMonthly +
    guarantorMonthly,
  );

  // ── 月支出計算 ──────────────────────────────────────────────────
  const region = property?.region;
  const livingExpense = getLivingExpense(region);

  // 聯徵他行現有月付
  const existingMortgageMonthly = borrower.existingMortgageMonthly ?? 0;
  const existingPersonalLoanMonthly = borrower.existingPersonalLoanMonthly ?? 0;
  const otherLoanMonthly = borrower.otherLoanMonthly ?? 0;
  const guarantorMortgageMonthly = guarantor?.existingMortgageMonthly ?? 0;
  const guarantorPersonalMonthly = guarantor?.existingPersonalLoanMonthly ?? 0;

  // 本行新貸月付（重用 recommendationEngine 的 calcMonthlyPayment）
  const annualRate = loanType === 'mortgage' ? DEMO_RATE_MORTGAGE : DEMO_RATE_PERSONAL;
  const newLoanMonthly = loanAmount > 0 ? calcMonthlyPayment(loanAmount, annualRate, termYears) : 0;

  const expenseBreakdown: Record<string, number> = {
    '最低生活支出': livingExpense,
    '他行房貸月付': Math.round(existingMortgageMonthly + guarantorMortgageMonthly),
    '他行信貸月付': Math.round(existingPersonalLoanMonthly + guarantorPersonalMonthly),
    '其他借款月付': Math.round(otherLoanMonthly),
    '本行新貸月付': Math.round(newLoanMonthly),
  };

  const monthlyExpense = Math.round(
    livingExpense +
    existingMortgageMonthly +
    existingPersonalLoanMonthly +
    otherLoanMonthly +
    guarantorMortgageMonthly +
    guarantorPersonalMonthly +
    newLoanMonthly,
  );

  const monthlyBalance = monthlyIncome - monthlyExpense;

  return {
    monthlyIncome,
    monthlyExpense,
    monthlyBalance,
    incomeBreakdown,
    expenseBreakdown,
  };
}
