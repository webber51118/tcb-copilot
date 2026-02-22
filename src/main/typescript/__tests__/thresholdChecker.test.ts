/**
 * 測試：thresholdChecker — DBR / 負債比 / 月還款比 合規門檻
 */

import { checkThresholds } from '../services/creditReview/thresholdChecker';
import { CreditReviewRequest, RepaymentSourceResult } from '../models/creditReview';
import { OccupationType } from '../models/enums';

// ─── Fixture helpers ────────────────────────────────────────────

function makePersonalReq(overrides: Partial<CreditReviewRequest> = {}): CreditReviewRequest {
  return {
    loanType: 'personal',
    loanAmount: 500_000,
    termYears: 5,
    borrower: {
      name: '測試',
      age: 35,
      occupation: OccupationType.OFFICE_WORKER,
      monthlyIncome: 60_000,
      yearsEmployed: 5,
      isPublicServant: false,
      hasMyData: true,
      totalUnsecuredDebt: 200_000,
    },
    ...overrides,
  };
}

function makeMortgageReq(overrides: Partial<CreditReviewRequest> = {}): CreditReviewRequest {
  return {
    loanType: 'mortgage',
    loanAmount: 8_000_000,
    termYears: 20,
    borrower: {
      name: '測試',
      age: 35,
      occupation: OccupationType.OFFICE_WORKER,
      monthlyIncome: 80_000,
      yearsEmployed: 5,
      isPublicServant: false,
      hasMyData: true,
      totalUnsecuredDebt: 0,
    },
    property: {
      region: '台北市',
      purpose: '購屋',
      isFirstHome: true,
      isOwnerOccupied: true,
    },
    ...overrides,
  };
}

function makeRepayment(monthly: number, expense: number): RepaymentSourceResult {
  return {
    monthlyIncome: monthly,
    monthlyExpense: expense,
    monthlyBalance: monthly - expense,
    incomeBreakdown: { salary: monthly },
    expenseBreakdown: { loan: expense },
  };
}

// ─── 信貸：DBR ─────────────────────────────────────────────────

describe('checkThresholds — 信貸 DBR', () => {
  test('DBR = (200,000 + 500,000) / 60,000 ≈ 11.67 → 通過（≤22）', () => {
    const req = makePersonalReq();
    const repayment = makeRepayment(60_000, 10_000);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.dbr).toBeDefined();
    expect(thresholds.dbr!.pass).toBe(true);
    expect(thresholds.dbr!.value).toBeCloseTo(11.67, 0);
  });

  test('DBR > 22 → 不通過，且提供 adjustedLoanAmount', () => {
    // totalUnsecuredDebt=1,000,000 + loanAmount=400,000 = 1,400,000 / 60,000 ≈ 23.3
    const req = makePersonalReq({ loanAmount: 400_000, borrower: {
      name: '測試', age: 35, occupation: OccupationType.OFFICE_WORKER,
      monthlyIncome: 60_000, yearsEmployed: 5, isPublicServant: false,
      hasMyData: true, totalUnsecuredDebt: 1_000_000,
    }});
    const repayment = makeRepayment(60_000, 15_000);
    const { thresholds, adjustedLoanAmount } = checkThresholds(req, repayment);
    expect(thresholds.dbr!.pass).toBe(false);
    expect(adjustedLoanAmount).toBeDefined();
    expect(adjustedLoanAmount).toBeGreaterThanOrEqual(0);
  });

  test('月收入 0 → DBR = 999（超標）', () => {
    const req = makePersonalReq({ borrower: {
      name: '測試', age: 35, occupation: OccupationType.OFFICE_WORKER,
      monthlyIncome: 0, yearsEmployed: 0, isPublicServant: false,
      hasMyData: false, totalUnsecuredDebt: 0,
    }});
    const repayment = makeRepayment(0, 0);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.dbr!.pass).toBe(false);
  });

  test('信貸包含 monthlyPaymentRatio 結果', () => {
    const req = makePersonalReq();
    const repayment = makeRepayment(60_000, 10_000);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.monthlyPaymentRatio).toBeDefined();
    expect(typeof thresholds.monthlyPaymentRatio!.value).toBe('number');
  });

  test('信貸月還款超逾 1/3 月收入 → monthlyPaymentRatio 不通過', () => {
    // loanAmount=1,200,000 / 5.5% / 5yr → 月付 ~23,000 > 60,000/3 = 20,000
    const req = makePersonalReq({ loanAmount: 1_200_000 });
    const repayment = makeRepayment(60_000, 25_000);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.monthlyPaymentRatio!.pass).toBe(false);
  });
});

// ─── 房貸：所得負債比 ───────────────────────────────────────────

describe('checkThresholds — 房貸負債比', () => {
  test('月支出 / 月收入 = 40,000 / 80,000 = 50% → 通過（≤80%）', () => {
    const req = makeMortgageReq();
    const repayment = makeRepayment(80_000, 40_000);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.debtIncomeRatio.pass).toBe(true);
    expect(thresholds.debtIncomeRatio.value).toBeCloseTo(50, 0);
  });

  test('負債比 > 80% → 不通過', () => {
    const req = makeMortgageReq();
    const repayment = makeRepayment(50_000, 45_000); // 90%
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.debtIncomeRatio.pass).toBe(false);
  });

  test('負債比超標時提供 adjustedLoanAmount', () => {
    const req = makeMortgageReq();
    const repayment = makeRepayment(50_000, 48_000); // 96%
    const { adjustedLoanAmount } = checkThresholds(req, repayment);
    expect(adjustedLoanAmount).toBeDefined();
  });

  test('房貸不包含 dbr 欄位', () => {
    const req = makeMortgageReq();
    const repayment = makeRepayment(80_000, 40_000);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.dbr).toBeUndefined();
  });

  test('負債比上限固定為 80', () => {
    const req = makeMortgageReq();
    const repayment = makeRepayment(80_000, 40_000);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.debtIncomeRatio.limit).toBe(80);
  });

  test('月收入 0 → 負債比 100（超標）', () => {
    const req = makeMortgageReq({ borrower: {
      name: '測試', age: 35, occupation: OccupationType.OFFICE_WORKER,
      monthlyIncome: 0, yearsEmployed: 0, isPublicServant: false,
      hasMyData: false, totalUnsecuredDebt: 0,
    }});
    const repayment = makeRepayment(0, 0);
    const { thresholds } = checkThresholds(req, repayment);
    expect(thresholds.debtIncomeRatio.pass).toBe(false);
  });
});

// ─── adjustedLoanAmount 精度 ────────────────────────────────────

describe('checkThresholds — 調整後貸款額度精度', () => {
  test('adjustedLoanAmount 無條件捨去至萬元', () => {
    const req = makePersonalReq({ loanAmount: 2_000_000, borrower: {
      name: '測試', age: 35, occupation: OccupationType.OFFICE_WORKER,
      monthlyIncome: 60_000, yearsEmployed: 5, isPublicServant: false,
      hasMyData: true, totalUnsecuredDebt: 1_000_000,
    }});
    const repayment = makeRepayment(60_000, 20_000);
    const { adjustedLoanAmount } = checkThresholds(req, repayment);
    if (adjustedLoanAmount !== undefined) {
      expect(adjustedLoanAmount % 10_000).toBe(0); // 萬元整數
    }
  });
});
