/**
 * INPUT: UserSession（對話收集完成的客戶資訊）
 * OUTPUT: RecommendationResult（推薦產品清單含月付金額）
 * POS: 服務層，推薦引擎，依客戶條件媒合最適貸款方案
 */

import { LoanType, OccupationType, ProductId } from '../models/enums';
import {
  UserSession, ProductDefinition, RecommendedProduct,
  RecommendationResult,
} from '../models/types';
import { PRODUCT_CATALOG } from '../config/productCatalog';

// ─── 月付金額計算 ─────────────────────────────────────────────

/**
 * 等額攤還月付計算（一般房貸 / 信貸）
 * P = 本金, r = 月利率, n = 期數（月）
 */
function calcMonthlyPayment(principal: number, annualRate: number, termYears: number): number {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round(principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}

/**
 * 以房養老每月撥付金額（反向年金）
 * 銀行按月給付客戶，直到達到貸款總額度
 */
function calcReverseAnnuityMonthlyPayout(
  totalCredit: number,
  annualRate: number,
  termYears: number,
): number {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round(totalCredit / n);
  // 年金現值公式反推月給付：PV = PMT × (1-(1+r)^-n)/r
  return Math.round(totalCredit * r / (1 - Math.pow(1 + r, -n)));
}

// ─── 資格篩選 ─────────────────────────────────────────────────

function isEligible(product: ProductDefinition, session: UserSession): boolean {
  const { eligibility } = product;
  const { basicInfo } = session;
  const age = basicInfo.age ?? 0;
  const annualIncome = (basicInfo.income ?? 0) * 12;
  const occupation = basicInfo.occupation;
  const purpose = basicInfo.purpose ?? '';

  // 以房養老：限定 isReverseAnnuity 類型
  if (eligibility.isReverseAnnuity) {
    return session.loanType === LoanType.REVERSE_ANNUITY && age >= 60;
  }

  // 最低年齡
  if (eligibility.minAge !== undefined && age < eligibility.minAge) return false;

  // 最高年齡
  if (eligibility.maxAge !== undefined && age > eligibility.maxAge) return false;

  // 最低年收入
  if (eligibility.minAnnualIncome !== undefined && annualIncome < eligibility.minAnnualIncome) {
    return false;
  }

  // 限定職業
  if (eligibility.occupations && eligibility.occupations.length > 0) {
    if (!occupation || !eligibility.occupations.includes(occupation)) return false;
  }

  // 限定房貸用途
  if (eligibility.mortgagePurposes && eligibility.mortgagePurposes.length > 0) {
    if (!eligibility.mortgagePurposes.includes(purpose)) return false;
  }

  // 首購限定
  if (eligibility.isFirstHomeBuyer) {
    if (purpose !== '首購自住') return false;
  }

  return true;
}

// ─── 推薦產品組建 ─────────────────────────────────────────────

function buildRecommended(
  product: ProductDefinition,
  session: UserSession,
  rank: number,
): RecommendedProduct {
  const amount = session.basicInfo.amount ?? 5_000_000;
  const termYears = session.basicInfo.termYears ?? product.maxTermYears;

  let monthlyPayment: number | undefined;
  if (product.id === ProductId.REVERSE_MORTGAGE) {
    // 以房養老：月撥付金額
    monthlyPayment = calcReverseAnnuityMonthlyPayout(amount, product.rateValue, termYears);
  } else if (amount > 0) {
    monthlyPayment = calcMonthlyPayment(amount, product.rateValue, termYears);
  }

  return {
    id: product.id,
    name: product.name,
    rank,
    rateRange: product.rateRange,
    rateValue: product.rateValue,
    maxAmount: product.maxAmount,
    maxTermYears: product.maxTermYears,
    gracePeriodYears: product.gracePeriodYears,
    features: product.features,
    savingsHighlight: product.savingsHighlight,
    monthlyPayment,
    crossSell: product.crossSell,
  };
}

// ─── 主推薦函數 ───────────────────────────────────────────────

/**
 * 依 UserSession 媒合最適貸款產品
 * 房貸優先順序：以房養老 > 國軍輔導 > 青安 > Next貸 > 一般
 * 信貸優先順序：軍公教優惠 > 優職優利
 */
export function recommendProducts(session: UserSession): RecommendationResult {
  const loanType = session.loanType;

  let pool: ProductDefinition[];
  if (loanType === LoanType.REVERSE_ANNUITY) {
    pool = PRODUCT_CATALOG.mortgage;
  } else if (loanType === LoanType.MORTGAGE) {
    pool = PRODUCT_CATALOG.mortgage;
  } else {
    pool = PRODUCT_CATALOG.personal;
  }

  // 篩選符合資格的產品
  const eligible = pool.filter((p) => isEligible(p, session));

  // 排序：以房養老 → 軍人 → 青安 → Next貸 → 其他
  const priorityOrder: string[] = [
    ProductId.REVERSE_MORTGAGE,
    ProductId.MILITARY_HOUSING,
    ProductId.YOUNG_SAFE_HOME,
    ProductId.NEXT_LOAN,
    ProductId.MILITARY_CIVIL,
    ProductId.ELITE_LOAN,
  ];

  eligible.sort((a, b) => {
    const ai = priorityOrder.indexOf(a.id);
    const bi = priorityOrder.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // 若無符合產品，回傳最適合的 fallback
  const fallback = pool[pool.length - 1];
  const ranked = eligible.length > 0 ? eligible : [fallback];

  const primary = buildRecommended(ranked[0], session, 1);
  const alternatives = ranked.slice(1, 3).map((p, i) => buildRecommended(p, session, i + 2));

  return { primary, alternatives, activePromotionIds: [] };
}
