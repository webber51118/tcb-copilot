/**
 * 測試：recommendationEngine — calcMonthlyPayment 月付金計算
 */

import { calcMonthlyPayment } from '../services/recommendationEngine';

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
