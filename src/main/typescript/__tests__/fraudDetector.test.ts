/**
 * 測試：fraudDetector — 8 項防詐查核 + 警示等級
 */

import { detectFraud } from '../services/creditReview/fraudDetector';
import { BorrowerInput, RiskFactorsResult } from '../models/creditReview';
import { OccupationType } from '../models/enums';

// ─── Fixture ────────────────────────────────────────────────────

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
    documentMatchesMyData: true,
    livesInBranchCounty: true,
    hasSalaryTransferHere: true,
    creditInquiriesLast2Months: 1,
    hasExistingBankLoan: true,
    hasPropertyOwnership: true,
    ...overrides,
  };
}

function makeRiskFactors(overrides: Partial<RiskFactorsResult> = {}): RiskFactorsResult {
  const defaultScore = { level: 7, label: '良好（7 級）', notes: '' };
  return {
    employmentStability: defaultScore,
    incomeGrowth: defaultScore,
    netWorthLevel: defaultScore,
    netWorthRatio: defaultScore,
    liquidityRatio: defaultScore,
    debtRatio: defaultScore,
    ...overrides,
  };
}

// ─── 個別項目查核 ───────────────────────────────────────────────

describe('detectFraud — 項目 1：證件比對', () => {
  test('documentMatchesMyData=true → 項目 1 未觸發', () => {
    const { items } = detectFraud(makeBorrower({ documentMatchesMyData: true }), makeRiskFactors());
    expect(items[0].triggered).toBe(false);
  });

  test('documentMatchesMyData=false → 項目 1 觸發', () => {
    const { items } = detectFraud(makeBorrower({ documentMatchesMyData: false }), makeRiskFactors());
    expect(items[0].triggered).toBe(true);
  });
});

describe('detectFraud — 項目 2：公司及居住地', () => {
  test('livesInBranchCounty=false + hasSalaryTransferHere=false → 觸發', () => {
    const b = makeBorrower({ livesInBranchCounty: false, hasSalaryTransferHere: false });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[1].triggered).toBe(true);
  });

  test('hasSalaryTransferHere=true → 不觸發（即使不住在分行縣市）', () => {
    const b = makeBorrower({ livesInBranchCounty: false, hasSalaryTransferHere: true });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[1].triggered).toBe(false);
  });
});

describe('detectFraud — 項目 3：職業穩定性', () => {
  test('occupation=OTHER → 觸發', () => {
    const b = makeBorrower({ occupation: OccupationType.OTHER });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[2].triggered).toBe(true);
  });

  test('age=65 → 觸發', () => {
    const b = makeBorrower({ age: 65 });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[2].triggered).toBe(true);
  });

  test('employmentStability.level=1 → 觸發', () => {
    const rf = makeRiskFactors({ employmentStability: { level: 1, label: '極差', notes: '' } });
    const { items } = detectFraud(makeBorrower(), rf);
    expect(items[2].triggered).toBe(true);
  });
});

describe('detectFraud — 項目 6：聯徵查詢次數', () => {
  test('creditInquiriesLast2Months=3 → 不觸發（≤3 允許）', () => {
    const b = makeBorrower({ creditInquiriesLast2Months: 3 });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[5].triggered).toBe(false);
  });

  test('creditInquiriesLast2Months=4 → 觸發', () => {
    const b = makeBorrower({ creditInquiriesLast2Months: 4 });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[5].triggered).toBe(true);
  });
});

describe('detectFraud — 項目 7 & 8', () => {
  test('hasExistingBankLoan=false → 項目 7 觸發', () => {
    const b = makeBorrower({ hasExistingBankLoan: false });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[6].triggered).toBe(true);
  });

  test('hasPropertyOwnership=false → 項目 8 觸發', () => {
    const b = makeBorrower({ hasPropertyOwnership: false });
    const { items } = detectFraud(b, makeRiskFactors());
    expect(items[7].triggered).toBe(true);
  });
});

// ─── 警示等級判定 ───────────────────────────────────────────────

describe('detectFraud — 警示等級', () => {
  test('零觸發 → overallLevel = normal', () => {
    const { overallLevel } = detectFraud(makeBorrower(), makeRiskFactors());
    expect(overallLevel).toBe('normal');
  });

  test('僅 item7 觸發 → caution', () => {
    const b = makeBorrower({ hasExistingBankLoan: false });
    const { overallLevel } = detectFraud(b, makeRiskFactors());
    expect(overallLevel).toBe('caution');
  });

  test('1-6 中觸發 ≥2 項 → alert', () => {
    // 觸發項目 1（document mismatch）和項目 2（不在分行縣市）
    const b = makeBorrower({
      documentMatchesMyData: false,
      livesInBranchCounty: false,
      hasSalaryTransferHere: false,
    });
    const { overallLevel } = detectFraud(b, makeRiskFactors());
    expect(overallLevel).toBe('alert');
  });

  test('items 陣列長度為 8', () => {
    const { items } = detectFraud(makeBorrower(), makeRiskFactors());
    expect(items.length).toBe(8);
  });

  test('每個 item 有 id / description / triggered', () => {
    const { items } = detectFraud(makeBorrower(), makeRiskFactors());
    items.forEach((item) => {
      expect(typeof item.id).toBe('number');
      expect(typeof item.description).toBe('string');
      expect(typeof item.triggered).toBe('boolean');
    });
  });

  test('message 在 normal 時包含「正常」', () => {
    const { message } = detectFraud(makeBorrower(), makeRiskFactors());
    expect(message).toContain('正常');
  });

  test('message 在 alert 時包含「高度警示」', () => {
    const b = makeBorrower({
      documentMatchesMyData: false,
      livesInBranchCounty: false,
      hasSalaryTransferHere: false,
    });
    const { message } = detectFraud(b, makeRiskFactors());
    expect(message).toContain('高度警示');
  });
});
