/**
 * INPUT: BorrowerInput、PropertyInput（選填）
 * OUTPUT: BorrowerProfileResult（P1 借保戶概況）
 * POS: 服務層，評估利害關係人、首購/青安資格
 */

import {
  BorrowerInput,
  PropertyInput,
  BorrowerProfileResult,
} from '../../models/creditReview';

/**
 * 評估 P1 借保戶概況
 * - 利害關係人：Demo 模式無法自動判定，預設 false（應由行員核實）
 * - 首購資格：isFirstHome === true
 * - 青安資格：首購 + 自住 + 年齡 ≤ 45 + 房貸用途 = 購屋
 * - MY DATA：hasMyData
 */
export function scoreBorrowerProfile(
  borrower: BorrowerInput,
  property?: PropertyInput,
): BorrowerProfileResult {
  // 利害關係人（Demo 模式預設 false，實際應由行員查核）
  const isRelatedParty = false;

  // 首購資格
  const firstHomePurchaseEligible =
    property?.isFirstHome === true && property?.purpose === '購屋';

  // 青安資格：首購 + 自住 + 年齡 ≤ 45 + 目的為購屋
  const greenHousingEligible =
    firstHomePurchaseEligible &&
    property?.isOwnerOccupied === true &&
    borrower.age <= 45;

  return {
    isRelatedParty,
    firstHomePurchaseEligible,
    greenHousingEligible,
    myDataProvided: borrower.hasMyData,
  };
}
