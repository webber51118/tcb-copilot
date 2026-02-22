/**
 * 測試：repaymentSourceScorer — P3 個人收支平衡表
 */

import { scoreRepaymentSource } from '../services/creditReview/repaymentSourceScorer';
import { BorrowerInput } from '../models/creditReview';
import { OccupationType } from '../models/enums';

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
    ...overrides,
  };
}

describe('scoreRepaymentSource — 月收入計算', () => {
  test('僅有月薪時，月收入 = monthlyIncome', () => {
    const result = scoreRepaymentSource(makeBorrower(), undefined, 0, 0, 'personal');
    expect(result.monthlyIncome).toBe(60_000);
  });

  test('包含保證人月收入', () => {
    const guarantor = {
      name: '保人', age: 40,
      occupation: OccupationType.OFFICE_WORKER,
      isPublicServant: false,
      yearsEmployed: 10,
      monthlyIncome: 40_000,
    };
    const result = scoreRepaymentSource(makeBorrower(), guarantor, 0, 0, 'personal');
    expect(result.monthlyIncome).toBe(100_000);
  });

  test('nonRecurringIncome 加入月收入（年度 / 12）', () => {
    const b = makeBorrower({ nonRecurringIncome: 120_000 }); // 年收 12 萬
    const result = scoreRepaymentSource(b, undefined, 0, 0, 'personal');
    expect(result.monthlyIncome).toBe(60_000 + 10_000);
  });

  test('salaryIncome 優先於 monthlyIncome * 12', () => {
    // salaryIncome 為年薪，月薪化 = 840,000 / 12 = 70,000
    const b = makeBorrower({ salaryIncome: 840_000 });
    const result = scoreRepaymentSource(b, undefined, 0, 0, 'personal');
    expect(result.monthlyIncome).toBe(70_000);
  });
});

describe('scoreRepaymentSource — 月支出計算', () => {
  test('無貸款時最低生活支出（台北市 20,000）', () => {
    const result = scoreRepaymentSource(
      makeBorrower(), undefined, 0, 0, 'mortgage',
      { region: '台北市', purpose: '購屋', isFirstHome: true, isOwnerOccupied: true },
    );
    expect(result.monthlyExpense).toBe(20_000);
    expect(result.expenseBreakdown['最低生活支出']).toBe(20_000);
  });

  test('非台北市最低生活支出 15,000', () => {
    const result = scoreRepaymentSource(
      makeBorrower(), undefined, 0, 0, 'mortgage',
      { region: '高雄市', purpose: '購屋', isFirstHome: true, isOwnerOccupied: true },
    );
    expect(result.expenseBreakdown['最低生活支出']).toBe(15_000);
  });

  test('本行新貸月付加入月支出', () => {
    // 房貸 8,000,000 / 2.06% / 20年 → 月付約 ~49,000-51,000
    const result = scoreRepaymentSource(
      makeBorrower(), undefined, 8_000_000, 20, 'mortgage',
      { region: '台北市', purpose: '購屋', isFirstHome: true, isOwnerOccupied: true },
    );
    const newLoanPay = result.expenseBreakdown['本行新貸月付'];
    // 8,000,000 × 2.06% / 20年 等額攤還 ≈ 40,700
    expect(newLoanPay).toBeGreaterThan(38_000);
    expect(newLoanPay).toBeLessThan(44_000);
  });

  test('他行既有房貸月付加入支出', () => {
    const b = makeBorrower({ existingMortgageMonthly: 20_000 });
    const result = scoreRepaymentSource(b, undefined, 0, 0, 'personal');
    expect(result.expenseBreakdown['他行房貸月付']).toBe(20_000);
  });
});

describe('scoreRepaymentSource — 月結餘', () => {
  test('月結餘 = 月收入 - 月支出', () => {
    const result = scoreRepaymentSource(makeBorrower(), undefined, 0, 0, 'personal');
    expect(result.monthlyBalance).toBe(result.monthlyIncome - result.monthlyExpense);
  });

  test('高支出時月結餘可為負', () => {
    const b = makeBorrower({ existingMortgageMonthly: 80_000 });
    const result = scoreRepaymentSource(b, undefined, 0, 0, 'personal');
    expect(result.monthlyBalance).toBeLessThan(0);
  });
});

describe('scoreRepaymentSource — 收支明細結構', () => {
  test('incomeBreakdown 包含薪資所得欄位', () => {
    const result = scoreRepaymentSource(makeBorrower(), undefined, 0, 0, 'personal');
    expect(result.incomeBreakdown['薪資所得']).toBeDefined();
  });

  test('expenseBreakdown 包含本行新貸月付', () => {
    const result = scoreRepaymentSource(makeBorrower(), undefined, 500_000, 5, 'personal');
    expect(result.expenseBreakdown['本行新貸月付']).toBeGreaterThan(0);
  });
});
