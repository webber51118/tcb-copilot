/**
 * INPUT: BorrowerInput、RiskFactorsResult
 * OUTPUT: FraudCheckResult（防詐模型 8 項查核）
 * POS: 服務層，依文件「防詐模型」實作 8 項異常查核與警示等級判定
 */

import { OccupationType } from '../../models/enums';
import {
  BorrowerInput,
  FraudCheckItem,
  FraudCheckResult,
  RiskFactorsResult,
} from '../../models/creditReview';

/** 8 項查核項目說明 */
const ITEM_DESCRIPTIONS: Record<number, string> = {
  1: '證件掃描比對（MY DATA 與申請書一致性）',
  2: '公司及居住地（是否在分行服務縣市或薪轉客戶）',
  3: '職業穩定性（職業類別/年齡/就業穩定性評估）',
  4: '所得成長性（所得資料完整性）',
  5: '資產淨值（資產淨值水準）',
  6: '聯徵查詢次數（近 2 個月查詢次數）',
  7: '銀行借款情形（是否有本行現有往來）',
  8: '有無不動產（不動產擁有情形，供參考）',
};

/**
 * 評估 8 項防詐查核
 * @param borrower 借款人資料
 * @param riskFactors 六大風控因子（已評分）
 */
export function detectFraud(
  borrower: BorrowerInput,
  riskFactors: RiskFactorsResult,
): FraudCheckResult {
  const items: FraudCheckItem[] = [];

  // 項目 1：證件掃描比對
  // 觸發條件：documentMatchesMyData === false
  const item1 = borrower.documentMatchesMyData === false;
  items.push({ id: 1, description: ITEM_DESCRIPTIONS[1]!, triggered: item1 });

  // 項目 2：公司及居住地
  // 觸發條件：!livesInBranchCounty && !hasSalaryTransferHere
  const item2 =
    borrower.livesInBranchCounty === false &&
    borrower.hasSalaryTransferHere === false;
  items.push({ id: 2, description: ITEM_DESCRIPTIONS[2]!, triggered: item2 });

  // 項目 3：職業穩定性
  // 觸發條件：occupation='其他' 或 age≥65 或 employmentStability level=1
  const item3 =
    borrower.occupation === OccupationType.OTHER ||
    borrower.age >= 65 ||
    riskFactors.employmentStability.level === 1;
  items.push({ id: 3, description: ITEM_DESCRIPTIONS[3]!, triggered: item3 });

  // 項目 4：所得成長性
  // 觸發條件：!hasMyData && 無報稅（salaryIncome 未提供）或 incomeGrowth level=1
  const hasNoTaxRecord =
    !borrower.hasMyData &&
    (borrower.salaryIncome === undefined || borrower.salaryIncome === 0);
  const item4 = hasNoTaxRecord || riskFactors.incomeGrowth.level === 1;
  items.push({ id: 4, description: ITEM_DESCRIPTIONS[4]!, triggered: item4 });

  // 項目 5：資產淨值
  // 觸發條件：netWorthLevel=1
  const item5 = riskFactors.netWorthLevel.level === 1;
  items.push({ id: 5, description: ITEM_DESCRIPTIONS[5]!, triggered: item5 });

  // 項目 6：聯徵查詢次數
  // 觸發條件：creditInquiriesLast2Months > 3
  const item6 = (borrower.creditInquiriesLast2Months ?? 0) > 3;
  items.push({ id: 6, description: ITEM_DESCRIPTIONS[6]!, triggered: item6 });

  // 項目 7：銀行借款情形
  // 觸發條件：hasExistingBankLoan === false（無本行往來）
  const item7 = borrower.hasExistingBankLoan === false;
  items.push({ id: 7, description: ITEM_DESCRIPTIONS[7]!, triggered: item7 });

  // 項目 8：有無不動產（供參考）
  // 觸發條件：hasPropertyOwnership === false（無不動產）
  const item8 = borrower.hasPropertyOwnership === false;
  items.push({ id: 8, description: ITEM_DESCRIPTIONS[8]!, triggered: item8 });

  // ─── 判定警示等級 ───────────────────────────────────────────

  const triggered16 = items.filter((i) => i.id >= 1 && i.id <= 6 && i.triggered);
  const count16 = triggered16.length;
  const trigger7 = item7;
  const trigger8 = item8;

  let overallLevel: 'normal' | 'caution' | 'alert';
  let message: string;

  if (count16 === 0 && !trigger7 && !trigger8) {
    overallLevel = 'normal';
    message = '查核結果正常，未發現異常事項';
  } else if (count16 >= 2 || (trigger7 && trigger8 && count16 >= 1)) {
    // alert：1-6 同時 ≥ 2 項，或 7+8 同時觸發且 1-6 有任一
    overallLevel = 'alert';
    const reasons: string[] = [];
    if (count16 >= 2) reasons.push(`風控因子 1-6 共 ${count16} 項異常`);
    if (trigger7 && trigger8) reasons.push('銀行無往來且無不動產');
    message = `【高度警示】${reasons.join('；')}，建議拒絕或呈報主管核示`;
  } else {
    // caution：1-6 任一觸發，或 7/8 個別觸發
    overallLevel = 'caution';
    const reasons: string[] = [];
    if (count16 >= 1) reasons.push(`風控因子 ${triggered16.map((i) => i.id).join('、')} 項異常`);
    if (trigger7) reasons.push('無本行借款往來');
    if (trigger8) reasons.push('無不動產（供參考）');
    message = `【注意】${reasons.join('；')}，應評估後辦理`;
  }

  return { items, overallLevel, message };
}
