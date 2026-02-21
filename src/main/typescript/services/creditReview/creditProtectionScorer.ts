/**
 * INPUT: BorrowerInput、GuarantorInput（選填）、ValuationResult（選填）
 * OUTPUT: CreditProtectionResult（P4 資產負債表 + 淨值計算）
 * POS: 服務層，自動編製資產負債表（流動/固定資產，短期/長期負債，淨值）
 */

import { ValuationResult } from '../../models/types';
import {
  BorrowerInput,
  GuarantorInput,
  CreditProtectionResult,
} from '../../models/creditReview';

/**
 * 計算不動產估值
 * 1. 有鑑價結果（valuation.estimatedValue）: 直接使用 P50
 * 2. 以輸入的 existingRealEstate 為準（Demo 模式）
 */
function estimateRealEstateValue(
  borrower: BorrowerInput,
  valuation?: ValuationResult,
  loanAmount?: number,
): number {
  // 優先使用鑑價結果（P50）
  if (valuation?.estimatedValue) {
    return valuation.estimatedValue;
  }
  // 有抵押借款無鑑價：min(借款額度 × 1.25, 抵押設定金額 / 1.2)
  if (loanAmount && loanAmount > 0 && !borrower.existingRealEstate) {
    return loanAmount * 1.25;
  }
  // Demo：以輸入值為準
  return borrower.existingRealEstate ?? 0;
}

/**
 * 編製資產負債表
 * @param borrower 借款人資料
 * @param guarantor 保證人資料（選填，有填則合計計算）
 * @param valuation 鑑價結果（選填，房貸 P4 不動產估值）
 * @param loanAmount 申請貸款金額（用於 LTV 計算）
 */
export function scoreCreditProtection(
  borrower: BorrowerInput,
  guarantor: GuarantorInput | undefined,
  valuation?: ValuationResult,
  loanAmount?: number,
): CreditProtectionResult {
  // ── 資產計算 ────────────────────────────────────────────────────

  // 流動資產：存款 + 股票（上市）+ 基金 + 保單 + 債券
  const bankDeposit = (borrower.bankDepositHere ?? 0) + (borrower.bankDepositOther ?? 0);
  const stocks = borrower.stocks ?? 0;           // 上市股票市值
  const bonds = borrower.bonds ?? 0;
  const funds = borrower.funds ?? 0;
  const insurance = borrower.insuranceSurrenderValue ?? 0;
  // 未上市股票：計入總資產但流動性較低（不計入流動資產）
  const unlistedStocks = borrower.unlistedStocks ?? 0;

  // 加計保證人存款
  const guarantorDeposit = guarantor?.bankDepositHere ?? 0;

  const liquidAssets = bankDeposit + stocks + bonds + funds + insurance + guarantorDeposit;

  // 固定資產：汽車 + 不動產
  const vehicles = borrower.vehicles ?? 0;
  const realEstateValue = estimateRealEstateValue(borrower, valuation, loanAmount);
  const guarantorRealEstate = guarantor?.existingRealEstate ?? 0;

  const fixedAssets = vehicles + realEstateValue + guarantorRealEstate;

  const totalAssets = liquidAssets + fixedAssets + unlistedStocks + (borrower.otherAssets ?? 0);

  // ── 負債計算 ────────────────────────────────────────────────────

  // 短期負債：無擔保消費貸款總額（信貸/信用卡）
  const totalUnsecuredDebt = borrower.totalUnsecuredDebt ?? 0;
  const guarantorUnsecured = guarantor?.totalUnsecuredDebt ?? 0;
  const shortTermLiabilities = totalUnsecuredDebt + guarantorUnsecured;

  // 長期負債：現有房貸估計餘額（以月付 × 180 個月推估，Demo 模式）
  const existingMortgageEstimate = (borrower.existingMortgageMonthly ?? 0) * 180;
  const guarantorMortgageEstimate = (guarantor?.existingMortgageMonthly ?? 0) * 180;
  const longTermLiabilities = existingMortgageEstimate + guarantorMortgageEstimate;

  const totalLiabilities = shortTermLiabilities + longTermLiabilities;

  // ── 淨值 ────────────────────────────────────────────────────────
  const netWorth = totalAssets - totalLiabilities;

  // ── LTV（貸款成數） ─────────────────────────────────────────────
  let ltvRatio: number | undefined;
  if (valuation?.ltvRatio !== undefined) {
    ltvRatio = valuation.ltvRatio;
  } else if (loanAmount && realEstateValue > 0) {
    ltvRatio = loanAmount / realEstateValue;
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    liquidAssets,
    shortTermLiabilities,
    realEstateValue,
    ltvRatio,
  };
}
