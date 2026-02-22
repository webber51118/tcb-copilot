/**
 * 測試：riskFactorScorer — P5 六大風控因子評分
 */

import { scoreRiskFactors } from '../services/creditReview/riskFactorScorer';
import { BorrowerInput, RepaymentSourceResult, CreditProtectionResult } from '../models/creditReview';
import { OccupationType } from '../models/enums';

// ─── Fixture ────────────────────────────────────────────────────

function makeBorrower(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
  return {
    name: '測試',
    age: 35,
    occupation: OccupationType.OFFICE_WORKER,
    monthlyIncome: 60_000,
    yearsEmployed: 10,
    isPublicServant: false,
    hasMyData: true,
    totalUnsecuredDebt: 0,
    salaryIncome: 720_000,
    ...overrides,
  };
}

function makeRepayment(income: number, expense: number): RepaymentSourceResult {
  return {
    monthlyIncome: income,
    monthlyExpense: expense,
    monthlyBalance: income - expense,
    incomeBreakdown: { salary: income },
    expenseBreakdown: { loan: expense },
  };
}

function makeProtection(overrides: Partial<CreditProtectionResult> = {}): CreditProtectionResult {
  return {
    totalAssets: 10_000_000,
    totalLiabilities: 3_000_000,
    netWorth: 7_000_000,
    liquidAssets: 2_000_000,
    shortTermLiabilities: 500_000,
    realEstateValue: 8_000_000,
    ...overrides,
  };
}

// ─── employmentStability ────────────────────────────────────────

describe('scoreRiskFactors — employmentStability（職業穩定性）', () => {
  test('年資 10 年 → level 5', () => {
    const result = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 10 }),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.employmentStability.level).toBe(5);
  });

  test('軍公教 + 年資 10 年 → level 6（+1）', () => {
    const result = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 10, isPublicServant: true }),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.employmentStability.level).toBe(6);
  });

  test('軍人 + 年資 18 年 → level 10（9+1，上限 10）', () => {
    const result = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 18, occupation: OccupationType.MILITARY }),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.employmentStability.level).toBe(10);
  });

  test('年資 ≤ 2 → level 1', () => {
    const result = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 1 }),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.employmentStability.level).toBe(1);
  });
});

// ─── incomeGrowth ───────────────────────────────────────────────

describe('scoreRiskFactors — incomeGrowth（所得成長性）', () => {
  test('有 MY DATA + 高薪資所得 → level 高', () => {
    const result = scoreRiskFactors(
      makeBorrower({ salaryIncome: 1_800_000, hasMyData: true }), // 月薪 15 萬
      makeRepayment(150_000, 50_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBeGreaterThanOrEqual(9);
  });

  test('無 MY DATA 且無報稅 → level 上限 3', () => {
    const result = scoreRiskFactors(
      makeBorrower({ hasMyData: false, salaryIncome: undefined }),
      makeRepayment(40_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBeLessThanOrEqual(3);
  });

  test('近 1.2 年未調升 → level 降 1', () => {
    // 先取基準 level（有調升）
    const base = scoreRiskFactors(
      makeBorrower({ salaryIncome: 600_000, incomeRaisedRecently: true }),
      makeRepayment(50_000, 20_000), makeProtection(), 5_000_000,
    );
    // 再取未調升 level
    const noRaise = scoreRiskFactors(
      makeBorrower({ salaryIncome: 600_000, incomeRaisedRecently: false }),
      makeRepayment(50_000, 20_000), makeProtection(), 5_000_000,
    );
    expect(noRaise.incomeGrowth.level).toBeLessThan(base.incomeGrowth.level);
  });
});

// ─── debtRatio ──────────────────────────────────────────────────

describe('scoreRiskFactors — debtRatio（所得負債比）', () => {
  test('支出 30% 月收入 → level 高（≥7）', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 18_000), // ~30%
      makeProtection(),
      5_000_000,
    );
    expect(result.debtRatio.level).toBeGreaterThanOrEqual(7);
  });

  test('支出 90%+ 月收入 → level 1', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 55_000), // ~91.7%
      makeProtection(),
      5_000_000,
    );
    expect(result.debtRatio.level).toBe(1);
  });
});

// ─── liquidityRatio ─────────────────────────────────────────────

describe('scoreRiskFactors — liquidityRatio（流動比率）', () => {
  test('無流動負債 → level 10', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ shortTermLiabilities: 0 }),
      5_000_000,
    );
    expect(result.liquidityRatio.level).toBe(10);
  });

  test('流動資產 / 流動負債 = 200% → level 10', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ liquidAssets: 2_000_000, shortTermLiabilities: 1_000_000 }), // 200%
      5_000_000,
    );
    expect(result.liquidityRatio.level).toBe(10);
  });

  test('流動資產極少 → level 低', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ liquidAssets: 50_000, shortTermLiabilities: 1_000_000 }), // 5%
      5_000_000,
    );
    expect(result.liquidityRatio.level).toBeLessThanOrEqual(1);
  });
});

// ─── 回傳結構完整性 ─────────────────────────────────────────────

describe('scoreRiskFactors — 回傳結構', () => {
  test('回傳 6 個風控因子', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    const keys = Object.keys(result);
    expect(keys).toContain('employmentStability');
    expect(keys).toContain('incomeGrowth');
    expect(keys).toContain('netWorthLevel');
    expect(keys).toContain('netWorthRatio');
    expect(keys).toContain('liquidityRatio');
    expect(keys).toContain('debtRatio');
  });

  test('每個因子 level 介於 1-10', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    Object.values(result).forEach((factor) => {
      expect(factor.level).toBeGreaterThanOrEqual(1);
      expect(factor.level).toBeLessThanOrEqual(10);
    });
  });
});
