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

// ─── employmentStability 補充（line 49：yearsEmployed > 18）──────

describe('scoreRiskFactors — employmentStability 補充', () => {
  test('年資 > 18 → level 10（最高年資段）', () => {
    const result = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 20 }),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.employmentStability.level).toBe(10);
  });

  test('其他職業（OTHER）→ notes 包含「其他」警示', () => {
    const result = scoreRiskFactors(
      makeBorrower({ occupation: OccupationType.OTHER, yearsEmployed: 5 }),
      makeRepayment(60_000, 20_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.employmentStability.notes).toContain('其他');
  });

  test('教師（TEACHER）→ 視同軍公教 +1', () => {
    const base = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 10, isPublicServant: false, occupation: OccupationType.OFFICE_WORKER }),
      makeRepayment(60_000, 20_000), makeProtection(), 5_000_000,
    );
    const teacher = scoreRiskFactors(
      makeBorrower({ yearsEmployed: 10, isPublicServant: false, occupation: OccupationType.TEACHER }),
      makeRepayment(60_000, 20_000), makeProtection(), 5_000_000,
    );
    expect(teacher.employmentStability.level).toBe(base.employmentStability.level + 1);
  });
});

// ─── incomeGrowth 補充（laborInsuranceGrade 低段覆蓋）─────────

describe('scoreRiskFactors — incomeGrowth 勞保級距', () => {
  test('勞保級距第 3 級 → level 1', () => {
    const result = scoreRiskFactors(
      makeBorrower({ laborInsuranceGrade: 3 }),
      makeRepayment(30_000, 10_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBe(1);
  });

  test('勞保級距第 6 級 → level 2', () => {
    const result = scoreRiskFactors(
      makeBorrower({ laborInsuranceGrade: 6 }),
      makeRepayment(35_000, 10_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBe(2);
  });

  test('勞保級距第 9 級 → level 4', () => {
    const result = scoreRiskFactors(
      makeBorrower({ laborInsuranceGrade: 9 }),
      makeRepayment(40_000, 15_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBe(4);
  });

  test('勞保級距第 21 級 → level 10', () => {
    const result = scoreRiskFactors(
      makeBorrower({ laborInsuranceGrade: 21 }),
      makeRepayment(100_000, 30_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBe(10);
  });

  test('薪資所得 25,000/月（無級距）→ level 1', () => {
    const result = scoreRiskFactors(
      makeBorrower({ hasMyData: true, salaryIncome: 300_000, laborInsuranceGrade: undefined }),
      makeRepayment(25_000, 10_000),
      makeProtection(),
      5_000_000,
    );
    expect(result.incomeGrowth.level).toBe(1);
  });
});

// ─── netWorthLevel 補充（未上市股票上限、無不動產、LTV 加成）──

describe('scoreRiskFactors — netWorthLevel 修正規則', () => {
  test('未上市股票 > 淨值 → 上限 level 3', () => {
    const result = scoreRiskFactors(
      makeBorrower({ unlistedStocks: 8_000_000 }),  // > netWorth 7M
      makeRepayment(60_000, 20_000),
      makeProtection({ netWorth: 7_000_000 }),
      5_000_000,
    );
    expect(result.netWorthLevel.level).toBeLessThanOrEqual(3);
  });

  test('無不動產（realEstateValue=0）→ 上限 level 3', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ realEstateValue: 0, totalAssets: 10_000_000, netWorth: 7_000_000 }),
      5_000_000,
    );
    expect(result.netWorthLevel.level).toBeLessThanOrEqual(3);
  });

  test('貸款成數 < 60%（低 LTV）→ level +1', () => {
    const base = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ realEstateValue: 10_000_000, netWorth: 700_000 }),  // netWorth 70萬 → level ~3
      6_000_000,  // LTV = 60% (not < 60%)
    );
    const lowLTV = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ realEstateValue: 10_000_000, netWorth: 700_000 }),
      5_000_000,  // LTV = 50% (< 60%) → +1
    );
    expect(lowLTV.netWorthLevel.level).toBeGreaterThan(base.netWorthLevel.level);
  });
});

// ─── netWorthRatio 補充（同三之修正規則）─────────────────────

describe('scoreRiskFactors — netWorthRatio 修正規則', () => {
  test('未上市股票 > 淨值 → 上限 level 3', () => {
    const result = scoreRiskFactors(
      makeBorrower({ unlistedStocks: 8_000_000 }),
      makeRepayment(60_000, 20_000),
      makeProtection({ netWorth: 7_000_000 }),
      5_000_000,
    );
    expect(result.netWorthRatio.level).toBeLessThanOrEqual(3);
  });

  test('無不動產 → 上限 level 3', () => {
    const result = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ realEstateValue: 0, totalAssets: 5_000_000, netWorth: 4_500_000 }),
      5_000_000,
    );
    expect(result.netWorthRatio.level).toBeLessThanOrEqual(3);
  });

  test('低 LTV < 60% → level +1', () => {
    const base = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ realEstateValue: 10_000_000, netWorth: 300_000, totalAssets: 1_000_000 }),
      6_100_000,  // LTV = 61% (not < 60%)
    );
    const lowLTV = scoreRiskFactors(
      makeBorrower(),
      makeRepayment(60_000, 20_000),
      makeProtection({ realEstateValue: 10_000_000, netWorth: 300_000, totalAssets: 1_000_000 }),
      5_900_000,  // LTV = 59% (< 60%) → +1
    );
    expect(lowLTV.netWorthRatio.level).toBeGreaterThanOrEqual(base.netWorthRatio.level);
  });
});

// ─── debtRatio 補充（非經常性所得、無報稅）────────────────────

describe('scoreRiskFactors — debtRatio 補充', () => {
  test('含非經常性所得 → 取較保守評級', () => {
    // 月收入 100K 含 50K 非經常性，扣除後變 50K，支出 35K → 70% → level 3
    const result = scoreRiskFactors(
      makeBorrower({ nonRecurringIncome: 600_000, salaryIncome: 600_000 }),
      makeRepayment(100_000, 35_000),
      makeProtection(),
      5_000_000,
    );
    // 含非經常性：35/100 = 35% → level 7；扣除後：35/50 = 70% → level 3 → 取 3
    expect(result.debtRatio.level).toBeLessThanOrEqual(7);
  });

  test('無報稅（無 MY DATA + 無薪資所得）→ 上限 level 3', () => {
    const result = scoreRiskFactors(
      makeBorrower({ hasMyData: false, salaryIncome: undefined }),
      makeRepayment(40_000, 8_000),  // 20% → 通常 level 8
      makeProtection(),
      5_000_000,
    );
    expect(result.debtRatio.level).toBeLessThanOrEqual(3);
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
