/**
 * 測試：recommendationEngine — calcMonthlyPayment + recommendProducts
 */

import { calcMonthlyPayment, recommendProducts } from '../services/recommendationEngine';
import { UserSession, BasicInfo, PropertyInfo } from '../models/types';
import { LoanType, ConversationState, OccupationType, BuildingType, ProductId } from '../models/enums';

// ─── Session 工廠函式 ─────────────────────────────────────────────

function makeSession(overrides: {
  loanType?: LoanType | null;
  age?: number;
  occupation?: OccupationType | null;
  income?: number;
  purpose?: string;
  termYears?: number;
  amount?: number;
} = {}): UserSession {
  return {
    userId: 'test-user',
    state: ConversationState.RECOMMEND,
    loanType: overrides.loanType ?? LoanType.MORTGAGE,
    basicInfo: {
      age: overrides.age ?? 35,
      occupation: overrides.occupation ?? OccupationType.OFFICE_WORKER,
      income: overrides.income ?? 60_000,
      purpose: overrides.purpose ?? '首購自住',
      termYears: overrides.termYears ?? 20,
      amount: overrides.amount ?? 8_000_000,
    } as BasicInfo,
    propertyInfo: {
      propertyAge: null,
      areaPing: null,
      hasParking: null,
      layout: null,
      floor: null,
      buildingType: null,
    } as PropertyInfo,
    applicantName: null,
    applicantPhone: null,
    recommendedProductId: null,
    mydataReady: null,
    landRegistryReady: null,
    idNumber: null,
    employer: null,
    annualIncome: null,
    parsedFromDoc: false,
    docReviewConfirmed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('calcMonthlyPayment — 等額攤還月付金', () => {
  test('標準房貸（10,000,000 / 2.06% / 20年）', () => {
    // 等額本息公式驗算：約 51,027
    const result = calcMonthlyPayment(10_000_000, 2.06, 20);
    expect(result).toBeGreaterThan(49_000);
    expect(result).toBeLessThan(53_000);
  });

  test('信貸（500,000 / 5.5% / 5年）', () => {
    // 月利率 = 5.5/12/100 ≈ 0.004583；n = 60；月付 ≈ 9,581
    const result = calcMonthlyPayment(500_000, 5.5, 5);
    expect(result).toBeGreaterThan(9_000);
    expect(result).toBeLessThan(10_500);
  });

  test('零利率（返回本金/期數）', () => {
    const result = calcMonthlyPayment(1_200_000, 0, 10);
    // 120 期，每期 10,000
    expect(result).toBe(10_000);
  });

  test('短期高額信貸（1,000,000 / 8% / 1年）', () => {
    const result = calcMonthlyPayment(1_000_000, 8, 1);
    expect(result).toBeGreaterThan(85_000);
    expect(result).toBeLessThan(90_000);
  });

  test('青安長期貸款（8,000,000 / 1.775% / 40年）', () => {
    // 月付金應低於純利息攤 20 年版本
    const monthly40y = calcMonthlyPayment(8_000_000, 1.775, 40);
    const monthly20y = calcMonthlyPayment(8_000_000, 1.775, 20);
    expect(monthly40y).toBeLessThan(monthly20y);
    expect(monthly40y).toBeGreaterThan(15_000);
    expect(monthly40y).toBeLessThan(30_000);
  });

  test('傳回整數（無小數點）', () => {
    const result = calcMonthlyPayment(5_000_000, 2.5, 30);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('本金 0 → 月付金 0', () => {
    const result = calcMonthlyPayment(0, 2.06, 20);
    expect(result).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// recommendProducts — 產品推薦邏輯
// ─────────────────────────────────────────────────────────────────

describe('recommendProducts — 房貸產品推薦', () => {
  test('首購自住 → 青安貸款（YOUNG_SAFE_HOME）優先', () => {
    const session = makeSession({ loanType: LoanType.MORTGAGE, purpose: '首購自住' });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.YOUNG_SAFE_HOME);
  });

  test('軍人 + 房貸 → 國軍輔導房貸（MILITARY_HOUSING）優先', () => {
    const session = makeSession({
      loanType: LoanType.MORTGAGE,
      occupation: OccupationType.MILITARY,
      purpose: '購屋',
    });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.MILITARY_HOUSING);
  });

  test('資金週轉 + 月收入 ≥ 67K → Next貸（NEXT_LOAN）', () => {
    // NEXT_LOAN 條件：purpose='資金週轉' + minAnnualIncome 800,000
    const session = makeSession({
      loanType: LoanType.MORTGAGE,
      purpose: '資金週轉',
      income: 100_000,   // 年收入 120 萬 ≥ 80 萬
    });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.NEXT_LOAN);
  });

  test('年收入不足 800,000 + 資金週轉 → Next貸不符資格（fallback）', () => {
    const session = makeSession({
      loanType: LoanType.MORTGAGE,
      purpose: '資金週轉',
      income: 30_000,   // 年收入 36 萬 < 80 萬
    });
    const result = recommendProducts(session);
    expect(result.primary.id).not.toBe(ProductId.NEXT_LOAN);
  });
});

describe('recommendProducts — 信貸產品推薦', () => {
  test('軍公教（MILITARY）信貸 → 軍公教優惠信貸（MILITARY_CIVIL）', () => {
    const session = makeSession({
      loanType: LoanType.PERSONAL,
      occupation: OccupationType.MILITARY,
      income: 40_000,   // 年收入 48 萬 ≥ 30 萬門檻
    });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.MILITARY_CIVIL);
  });

  test('上班族（OFFICE_WORKER）信貸 → 優職優利（ELITE_LOAN）', () => {
    const session = makeSession({
      loanType: LoanType.PERSONAL,
      occupation: OccupationType.OFFICE_WORKER,
    });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.ELITE_LOAN);
  });

  test('自營商（SELF_EMPLOYED）信貸 → 優職優利（ELITE_LOAN）', () => {
    const session = makeSession({
      loanType: LoanType.PERSONAL,
      occupation: OccupationType.SELF_EMPLOYED,
    });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.ELITE_LOAN);
  });
});

describe('recommendProducts — 以房養老', () => {
  test('以房養老 age ≥ 60 → REVERSE_MORTGAGE', () => {
    const session = makeSession({
      loanType: LoanType.REVERSE_ANNUITY,
      age: 65,
      amount: 5_000_000,
      termYears: 20,
    });
    const result = recommendProducts(session);
    expect(result.primary.id).toBe(ProductId.REVERSE_MORTGAGE);
  });

  test('以房養老 age < 60 → 不符資格，使用 fallback', () => {
    const session = makeSession({
      loanType: LoanType.REVERSE_ANNUITY,
      age: 55,
    });
    const result = recommendProducts(session);
    expect(result.primary.id).not.toBe(ProductId.REVERSE_MORTGAGE);
  });

  test('以房養老 → monthlyPayment 代表月撥付金額（正整數）', () => {
    const session = makeSession({
      loanType: LoanType.REVERSE_ANNUITY,
      age: 65,
      amount: 5_000_000,
      termYears: 20,
    });
    const result = recommendProducts(session);
    expect(result.primary.monthlyPayment).toBeGreaterThan(0);
    expect(Number.isInteger(result.primary.monthlyPayment)).toBe(true);
  });
});

describe('recommendProducts — 回傳結構', () => {
  test('primary rank 為 1', () => {
    const session = makeSession({ loanType: LoanType.PERSONAL });
    const result = recommendProducts(session);
    expect(result.primary.rank).toBe(1);
  });

  test('alternatives 為陣列', () => {
    const session = makeSession({ loanType: LoanType.PERSONAL });
    const result = recommendProducts(session);
    expect(Array.isArray(result.alternatives)).toBe(true);
  });

  test('月付金為正整數（房貸）', () => {
    const session = makeSession({
      loanType: LoanType.MORTGAGE,
      purpose: '首購自住',
      amount: 8_000_000,
      termYears: 20,
    });
    const result = recommendProducts(session);
    expect(result.primary.monthlyPayment).toBeGreaterThan(0);
    expect(Number.isInteger(result.primary.monthlyPayment!)).toBe(true);
  });

  test('activePromotionIds 為陣列', () => {
    const session = makeSession({ loanType: LoanType.MORTGAGE, purpose: '首購自住' });
    const result = recommendProducts(session);
    expect(Array.isArray(result.activePromotionIds)).toBe(true);
  });
});
