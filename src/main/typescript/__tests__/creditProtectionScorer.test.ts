/**
 * 測試：creditProtectionScorer — P4 資產負債表
 */

import { scoreCreditProtection } from '../services/creditReview/creditProtectionScorer';
import { BorrowerInput, GuarantorInput } from '../models/creditReview';
import { OccupationType } from '../models/enums';
import { ValuationResult } from '../models/types';

function makeValuation(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    estimatedValue: 12_000_000,
    ltvRatio: 0.6,
    riskLevel: '低風險',
    lstmIndex: 180,
    sentimentScore: 0,
    baseValue: 12_000_000,
    breakdown: {},
    mode: 'demo',
    region: '台北市',
    buildingType: '電梯大樓',
    confidenceInterval: { p5: 10_000_000, p50: 12_000_000, p95: 14_000_000 },
    ...overrides,
  };
}

function makeBorrower(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
  return {
    name: '測試',
    age: 35,
    occupation: OccupationType.OFFICE_WORKER,
    monthlyIncome: 60_000,
    yearsEmployed: 5,
    isPublicServant: false,
    hasMyData: true,
    totalUnsecuredDebt: 0,
    bankDepositHere: 1_000_000,
    bankDepositOther: 500_000,
    stocks: 200_000,
    existingRealEstate: 8_000_000,
    ...overrides,
  };
}

// ─── 流動資產 ───────────────────────────────────────────────────

describe('scoreCreditProtection — 流動資產', () => {
  test('存款 + 股票計入流動資產', () => {
    const result = scoreCreditProtection(
      makeBorrower({ bankDepositHere: 1_000_000, bankDepositOther: 500_000, stocks: 200_000 }),
      undefined,
    );
    expect(result.liquidAssets).toBe(1_700_000);
  });

  test('保單現金價值計入流動資產', () => {
    const result = scoreCreditProtection(
      makeBorrower({ insuranceSurrenderValue: 300_000 }),
      undefined,
    );
    expect(result.liquidAssets).toBeGreaterThanOrEqual(300_000);
  });

  test('未上市股票不計入流動資產（但計入總資產）', () => {
    const borrower = makeBorrower({
      bankDepositHere: 1_000_000,
      bankDepositOther: 0,
      stocks: 0,
      unlistedStocks: 500_000,
    });
    const result = scoreCreditProtection(borrower, undefined);
    // 流動資產不包含未上市股票
    expect(result.liquidAssets).toBe(1_000_000);
    // 總資產包含未上市股票
    expect(result.totalAssets).toBeGreaterThan(result.liquidAssets);
  });

  test('保證人存款加入流動資產', () => {
    const guarantor: GuarantorInput = {
      name: '保人', age: 45, occupation: OccupationType.OFFICE_WORKER,
      isPublicServant: false, yearsEmployed: 15, monthlyIncome: 50_000,
      bankDepositHere: 800_000,
    };
    const result = scoreCreditProtection(makeBorrower(), guarantor);
    expect(result.liquidAssets).toBeGreaterThanOrEqual(800_000);
  });
});

// ─── 不動產估值 ─────────────────────────────────────────────────

describe('scoreCreditProtection — 不動產估值', () => {
  test('無鑑價時使用 existingRealEstate', () => {
    const result = scoreCreditProtection(
      makeBorrower({ existingRealEstate: 8_000_000 }),
      undefined,
    );
    expect(result.realEstateValue).toBe(8_000_000);
  });

  test('有鑑價結果時優先使用 estimatedValue', () => {
    const result = scoreCreditProtection(
      makeBorrower({ existingRealEstate: 8_000_000 }),
      undefined,
      makeValuation({ estimatedValue: 12_000_000, ltvRatio: 0.6 }),
    );
    expect(result.realEstateValue).toBe(12_000_000);
  });

  test('無 existingRealEstate 且無鑑價時，使用 loanAmount × 1.25', () => {
    const result = scoreCreditProtection(
      makeBorrower({ existingRealEstate: undefined }),
      undefined,
      undefined,
      8_000_000,
    );
    expect(result.realEstateValue).toBe(10_000_000);
  });
});

// ─── 負債 & 淨值 ────────────────────────────────────────────────

describe('scoreCreditProtection — 負債與淨值', () => {
  test('無擔保債務加入短期負債', () => {
    const result = scoreCreditProtection(
      makeBorrower({ totalUnsecuredDebt: 500_000 }),
      undefined,
    );
    expect(result.shortTermLiabilities).toBe(500_000);
  });

  test('淨值 = 總資產 - 總負債', () => {
    const result = scoreCreditProtection(makeBorrower(), undefined);
    expect(result.netWorth).toBe(result.totalAssets - result.totalLiabilities);
  });

  test('保證人有既有房貸 → 長期負債增加', () => {
    const guarantor: GuarantorInput = {
      name: '保人', age: 45, occupation: OccupationType.OFFICE_WORKER,
      isPublicServant: false, yearsEmployed: 15, monthlyIncome: 50_000,
      existingMortgageMonthly: 20_000,
    };
    const withGuarantor = scoreCreditProtection(makeBorrower(), guarantor);
    const withoutGuarantor = scoreCreditProtection(makeBorrower(), undefined);
    expect(withGuarantor.totalLiabilities).toBeGreaterThan(withoutGuarantor.totalLiabilities);
  });
});

// ─── LTV 計算 ───────────────────────────────────────────────────

describe('scoreCreditProtection — LTV 貸款成數', () => {
  test('有鑑價 ltvRatio 時直接使用', () => {
    const result = scoreCreditProtection(
      makeBorrower(),
      undefined,
      makeValuation({ estimatedValue: 15_000_000, ltvRatio: 0.65 }),
      8_000_000,
    );
    expect(result.ltvRatio).toBe(0.65);
  });

  test('無鑑價時以 loanAmount / realEstateValue 計算', () => {
    const result = scoreCreditProtection(
      makeBorrower({ existingRealEstate: 10_000_000 }),
      undefined,
      undefined,
      7_000_000,
    );
    expect(result.ltvRatio).toBeCloseTo(0.7, 2);
  });

  test('無貸款金額時 ltvRatio 為 undefined', () => {
    const result = scoreCreditProtection(makeBorrower(), undefined);
    expect(result.ltvRatio).toBeUndefined();
  });
});
