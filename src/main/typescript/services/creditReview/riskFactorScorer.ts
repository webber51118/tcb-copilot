/**
 * INPUT: BorrowerInput、RepaymentSourceResult、CreditProtectionResult
 * OUTPUT: RiskFactorsResult（P5 六大風控因子，各 1-10 級）
 * POS: 服務層，依文件「自動徵審模型架構」P5-P6 實作六大風控因子評分
 */

import { OccupationType } from '../../models/enums';
import {
  BorrowerInput,
  PropertyInput,
  RepaymentSourceResult,
  CreditProtectionResult,
  RiskFactorsResult,
  RiskFactorScore,
} from '../../models/creditReview';

// ─── 工具函數 ──────────────────────────────────────────────────────

/** 取得等級標籤 */
function levelLabel(level: number): string {
  if (level === 1) return '極差（1 級）';
  if (level <= 3) return `偏低（${level} 級）`;
  if (level <= 5) return `尚可（${level} 級）`;
  if (level <= 7) return `良好（${level} 級）`;
  if (level <= 9) return `優良（${level} 級）`;
  return '最佳（10 級）';
}

// ─── 一、職業穩定性（1-10）─────────────────────────────────────

/**
 * 依年資評定等級，軍公教加 1
 * 年資 ≤2: 1 | 2.1-4: 2 | 4.1-6: 3 | 6.1-8: 4 | 8.1-10: 5
 * 10.1-12: 6 | 12.1-14: 7 | 14.1-16: 8 | 16.1-18: 9 | 18.1+: 10
 */
function scoreEmploymentStability(borrower: BorrowerInput): RiskFactorScore {
  const { yearsEmployed, isPublicServant, occupation } = borrower;

  let level: number;
  if (yearsEmployed <= 2) level = 1;
  else if (yearsEmployed <= 4) level = 2;
  else if (yearsEmployed <= 6) level = 3;
  else if (yearsEmployed <= 8) level = 4;
  else if (yearsEmployed <= 10) level = 5;
  else if (yearsEmployed <= 12) level = 6;
  else if (yearsEmployed <= 14) level = 7;
  else if (yearsEmployed <= 16) level = 8;
  else if (yearsEmployed <= 18) level = 9;
  else level = 10;

  // 軍公教或優質職業 +1
  const isElite =
    isPublicServant ||
    occupation === OccupationType.MILITARY ||
    occupation === OccupationType.CIVIL_SERVANT ||
    occupation === OccupationType.TEACHER;
  if (isElite) level = Math.min(level + 1, 10);

  const notes =
    `任職年資 ${yearsEmployed} 年` +
    (isElite ? '，軍公教加 1 級' : '') +
    (occupation === OccupationType.OTHER ? '，職業類別為「其他」，請注意' : '');

  return { level, label: levelLabel(level), notes };
}

// ─── 二、所得及成長性（1-10）──────────────────────────────────

/**
 * 依勞保投保薪資級距評定等級
 * 級距 1-4: 1 | 5-6: 2 | 7-8: 3 | 9-10: 4 | 11-12: 5
 * 13-14: 6 | 15-16: 7 | 17-18: 8 | 19-20: 9 | 21: 10
 * 近 1.2 年未調升: max(level-1, 1)
 * 無 MY DATA + 無報稅: 最高 3 段
 */
function scoreIncomeGrowth(borrower: BorrowerInput): RiskFactorScore {
  const {
    laborInsuranceGrade,
    incomeRaisedRecently,
    hasMyData,
    monthlyIncome,
    salaryIncome,
  } = borrower;

  const notes: string[] = [];
  let level: number;

  if (laborInsuranceGrade !== undefined) {
    // 有投保級距
    const g = laborInsuranceGrade;
    if (g <= 4) level = 1;
    else if (g <= 6) level = 2;
    else if (g <= 8) level = 3;
    else if (g <= 10) level = 4;
    else if (g <= 12) level = 5;
    else if (g <= 14) level = 6;
    else if (g <= 16) level = 7;
    else if (g <= 18) level = 8;
    else if (g <= 20) level = 9;
    else level = 10;
    notes.push(`勞保投保薪資級距第 ${g} 級`);
  } else if (hasMyData || (salaryIncome !== undefined && salaryIncome > 0)) {
    // 無級距但有報稅所得：月收入 × 12 換算年薪，對應薪資級距
    const annualSalary = salaryIncome ?? monthlyIncome * 12;
    const monthlyForGrade = annualSalary / 12;
    // 勞保級距對應月薪（簡化映射）
    if (monthlyForGrade <= 26400) level = 1;
    else if (monthlyForGrade <= 29600) level = 2;
    else if (monthlyForGrade <= 33300) level = 3;
    else if (monthlyForGrade <= 36300) level = 4;
    else if (monthlyForGrade <= 40100) level = 5;
    else if (monthlyForGrade <= 43900) level = 6;
    else if (monthlyForGrade <= 48200) level = 7;
    else if (monthlyForGrade <= 53000) level = 8;
    else if (monthlyForGrade <= 58500) level = 9;
    else level = 10;
    notes.push(`依報稅月收入 ${monthlyForGrade.toLocaleString()} 元換算`);
  } else {
    // 無 MY DATA 且無報稅：最高 3 段
    level = Math.min(3, Math.ceil((monthlyIncome / 20000) * 1.5));
    level = Math.max(1, Math.min(level, 3));
    notes.push('無 MY DATA 且無報稅，評定等級上限 3');
  }

  // 近 1.2 年未調升：-1
  if (incomeRaisedRecently === false) {
    level = Math.max(level - 1, 1);
    notes.push('近 1.2 年未調升，扣 1 級');
  } else if (incomeRaisedRecently === true) {
    notes.push('近 1.2 年有調升');
  }

  return { level, label: levelLabel(level), notes: notes.join('；') };
}

// ─── 三、資產淨值（1-10）──────────────────────────────────────

/**
 * 依淨值金額（萬元）評定等級
 * ≤25萬(或負): 1 | 26-50: 2 | 51-100: 3 | 101-200: 4 | 201-400: 5
 * 401-800: 6 | 801-1600: 7 | 1601-3200: 8 | 3201-6400: 9 | 6401+: 10
 */
function scoreNetWorthLevel(
  protection: CreditProtectionResult,
  borrower: BorrowerInput,
  loanAmount: number,
): RiskFactorScore {
  const { netWorth, totalAssets, realEstateValue } = protection;
  const { unlistedStocks } = borrower;

  const netWorthWan = netWorth / 10000;
  const notes: string[] = [`淨值 ${Math.round(netWorthWan).toLocaleString()} 萬元`];

  let level: number;
  if (netWorthWan <= 25) level = 1;
  else if (netWorthWan <= 50) level = 2;
  else if (netWorthWan <= 100) level = 3;
  else if (netWorthWan <= 200) level = 4;
  else if (netWorthWan <= 400) level = 5;
  else if (netWorthWan <= 800) level = 6;
  else if (netWorthWan <= 1600) level = 7;
  else if (netWorthWan <= 3200) level = 8;
  else if (netWorthWan <= 6400) level = 9;
  else level = 10;

  // 有未上市股票且其價值 > 淨值：降至最高 3
  const unlistedVal = unlistedStocks ?? 0;
  if (unlistedVal > 0 && unlistedVal > netWorth) {
    level = Math.min(level, 3);
    notes.push('未上市股票價值超過淨值，上限 3 級');
  }

  // 無不動產：降至最高 3
  if (realEstateValue === 0 && !borrower.existingRealEstate) {
    level = Math.min(level, 3);
    notes.push('無不動產，上限 3 級');
  }

  // 不動產成數（借款/估值）< 60%：+1
  if (realEstateValue > 0 && loanAmount > 0) {
    const ltv = loanAmount / realEstateValue;
    if (ltv < 0.6) {
      level = Math.min(level + 1, 10);
      notes.push(`成數 ${(ltv * 100).toFixed(1)}% < 60%，加 1 級`);
    }
  }

  return { level, label: levelLabel(level), notes: notes.join('；') };
}

// ─── 四、淨值比（淨值/資產，1-10）────────────────────────────

/**
 * 依淨值佔總資產比例（%）評定
 * ≤10%: 1 | 10.1-20: 2 | 20.1-30: 3 | 30.1-40: 4 | 40.1-50: 5
 * 50.1-60: 6 | 60.1-70: 7 | 70.1-80: 8 | 80.1-90: 9 | 90.1-100: 10
 */
function scoreNetWorthRatio(
  protection: CreditProtectionResult,
  borrower: BorrowerInput,
  loanAmount: number,
): RiskFactorScore {
  const { netWorth, totalAssets, realEstateValue } = protection;
  const { unlistedStocks } = borrower;

  const ratio = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;
  const notes: string[] = [`淨值比 ${ratio.toFixed(1)}%`];

  let level: number;
  if (ratio <= 10) level = 1;
  else if (ratio <= 20) level = 2;
  else if (ratio <= 30) level = 3;
  else if (ratio <= 40) level = 4;
  else if (ratio <= 50) level = 5;
  else if (ratio <= 60) level = 6;
  else if (ratio <= 70) level = 7;
  else if (ratio <= 80) level = 8;
  else if (ratio <= 90) level = 9;
  else level = 10;

  // 同三的修正規則
  const unlistedVal = unlistedStocks ?? 0;
  if (unlistedVal > 0 && unlistedVal > netWorth) {
    level = Math.min(level, 3);
    notes.push('未上市股票佔比過高，上限 3 級');
  }
  if (realEstateValue === 0 && !borrower.existingRealEstate) {
    level = Math.min(level, 3);
    notes.push('無不動產，上限 3 級');
  }
  if (realEstateValue > 0 && loanAmount > 0) {
    const ltv = loanAmount / realEstateValue;
    if (ltv < 0.6) {
      level = Math.min(level + 1, 10);
      notes.push(`成數 ${(ltv * 100).toFixed(1)}% < 60%，加 1 級`);
    }
  }

  return { level, label: levelLabel(level), notes: notes.join('；') };
}

// ─── 五、流動比率（流動資產/流動負債，1-10）───────────────────

/**
 * 流動資產 / 流動負債 × 100%
 * 0-20%: 1 | 20.1-40: 2 | 40.1-60: 3 | 60.1-80: 4 | 80.1-100: 5
 * 100.1-120: 6 | 120.1-140: 7 | 140.1-160: 8 | 160.1-180: 9 | 180.1+: 10
 */
function scoreLiquidityRatio(protection: CreditProtectionResult): RiskFactorScore {
  const { liquidAssets, shortTermLiabilities } = protection;

  const ratio = shortTermLiabilities > 0 ? (liquidAssets / shortTermLiabilities) * 100 : 999;
  const notes: string[] = [
    `流動資產 ${Math.round(liquidAssets / 10000).toLocaleString()} 萬 / ` +
    `流動負債 ${Math.round(shortTermLiabilities / 10000).toLocaleString()} 萬 = ${ratio.toFixed(1)}%`,
  ];

  let level: number;
  if (ratio <= 20) level = 1;
  else if (ratio <= 40) level = 2;
  else if (ratio <= 60) level = 3;
  else if (ratio <= 80) level = 4;
  else if (ratio <= 100) level = 5;
  else if (ratio <= 120) level = 6;
  else if (ratio <= 140) level = 7;
  else if (ratio <= 160) level = 8;
  else if (ratio <= 180) level = 9;
  else level = 10;

  // 無流動負債視為最佳
  if (shortTermLiabilities === 0) {
    level = 10;
    notes.push('無流動負債');
  }

  return { level, label: levelLabel(level), notes: notes.join('；') };
}

// ─── 六、所得負債比（支出/收入，1-10）────────────────────────

/**
 * 月總支出 / 月收入 × 100%
 * 90.1%+: 1 | 80.1-90: 2 | 70.1-80: 3 | 60.1-70: 4 | 50.1-60: 5
 * 40.1-50: 6 | 30.1-40: 7 | 20.1-30: 8 | 10.1-20: 9 | ≤10: 10
 * 有非經常性所得：另計（加計後另行調整）
 * 無報稅：最高 3 級
 */
function scoreDebtRatio(
  repayment: RepaymentSourceResult,
  borrower: BorrowerInput,
): RiskFactorScore {
  const { monthlyIncome, monthlyExpense } = repayment;
  const { nonRecurringIncome, hasMyData, salaryIncome } = borrower;

  const hasNoTaxRecord =
    !hasMyData && (salaryIncome === undefined || salaryIncome === 0);

  const ratio = monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 100;
  const notes: string[] = [`支出比 ${ratio.toFixed(1)}%`];

  let level: number;
  if (ratio > 90) level = 1;
  else if (ratio > 80) level = 2;
  else if (ratio > 70) level = 3;
  else if (ratio > 60) level = 4;
  else if (ratio > 50) level = 5;
  else if (ratio > 40) level = 6;
  else if (ratio > 30) level = 7;
  else if (ratio > 20) level = 8;
  else if (ratio > 10) level = 9;
  else level = 10;

  // 有非經常性所得：加計扣除後另計等級（扣回非經常性後重算）
  if (nonRecurringIncome && nonRecurringIncome > 0) {
    const nonRecurringMonthly = nonRecurringIncome / 12;
    const baseIncome = monthlyIncome - nonRecurringMonthly;
    const ratioWithout = baseIncome > 0 ? (monthlyExpense / baseIncome) * 100 : 100;
    // 加計扣除後另計等級（取較保守的那個）
    let levelWithout: number;
    if (ratioWithout > 90) levelWithout = 1;
    else if (ratioWithout > 80) levelWithout = 2;
    else if (ratioWithout > 70) levelWithout = 3;
    else if (ratioWithout > 60) levelWithout = 4;
    else if (ratioWithout > 50) levelWithout = 5;
    else if (ratioWithout > 40) levelWithout = 6;
    else if (ratioWithout > 30) levelWithout = 7;
    else if (ratioWithout > 20) levelWithout = 8;
    else if (ratioWithout > 10) levelWithout = 9;
    else levelWithout = 10;
    level = Math.min(level, levelWithout);
    notes.push(
      `含非經常性所得 ${Math.round(nonRecurringMonthly / 1000)}K/月；` +
      `扣除後支出比 ${ratioWithout.toFixed(1)}%，取較保守評級`,
    );
  }

  // 無報稅：最高 3 級
  if (hasNoTaxRecord) {
    level = Math.min(level, 3);
    notes.push('無報稅資料，上限 3 級');
  }

  return { level, label: levelLabel(level), notes: notes.join('；') };
}

// ─── 主函數 ────────────────────────────────────────────────────

/**
 * 評分 P5 六大風控因子
 */
export function scoreRiskFactors(
  borrower: BorrowerInput,
  repaymentSource: RepaymentSourceResult,
  creditProtection: CreditProtectionResult,
  loanAmount: number,
  _property?: PropertyInput,
): RiskFactorsResult {
  const employmentStability = scoreEmploymentStability(borrower);
  const incomeGrowth = scoreIncomeGrowth(borrower);
  const netWorthLevel = scoreNetWorthLevel(creditProtection, borrower, loanAmount);
  const netWorthRatio = scoreNetWorthRatio(creditProtection, borrower, loanAmount);
  const liquidityRatio = scoreLiquidityRatio(creditProtection);
  const debtRatio = scoreDebtRatio(repaymentSource, borrower);

  return {
    employmentStability,
    incomeGrowth,
    netWorthLevel,
    netWorthRatio,
    liquidityRatio,
    debtRatio,
  };
}
