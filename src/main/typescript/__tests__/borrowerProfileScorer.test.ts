/**
 * 測試：borrowerProfileScorer — P1 借保戶概況評估
 */

import { scoreBorrowerProfile } from '../services/creditReview/borrowerProfileScorer';
import { BorrowerInput, PropertyInput } from '../models/creditReview';
import { OccupationType } from '../models/enums';

// ─── 共用 fixture ───────────────────────────────────────────────

function makeBorrower(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
  return {
    name: '測試人',
    age: 35,
    occupation: OccupationType.OFFICE_WORKER,
    monthlyIncome: 60000,
    yearsEmployed: 5,
    isPublicServant: false,
    hasMyData: true,
    totalUnsecuredDebt: 0,
    ...overrides,
  };
}

function makeMortgageProperty(overrides: Partial<PropertyInput> = {}): PropertyInput {
  return {
    region: '台北市',
    purpose: '購屋',
    isFirstHome: true,
    isOwnerOccupied: true,
    ...overrides,
  };
}

// ─── 首購資格 ───────────────────────────────────────────────────

describe('scoreBorrowerProfile — 首購資格', () => {
  test('isFirstHome=true + purpose=購屋 → firstHomePurchaseEligible=true', () => {
    const result = scoreBorrowerProfile(makeBorrower(), makeMortgageProperty());
    expect(result.firstHomePurchaseEligible).toBe(true);
  });

  test('isFirstHome=false → firstHomePurchaseEligible=false', () => {
    const result = scoreBorrowerProfile(
      makeBorrower(),
      makeMortgageProperty({ isFirstHome: false }),
    );
    expect(result.firstHomePurchaseEligible).toBe(false);
  });

  test('purpose!=購屋 → firstHomePurchaseEligible=false', () => {
    const result = scoreBorrowerProfile(
      makeBorrower(),
      makeMortgageProperty({ purpose: '週轉金' }),
    );
    expect(result.firstHomePurchaseEligible).toBe(false);
  });

  test('無 property → firstHomePurchaseEligible=false', () => {
    const result = scoreBorrowerProfile(makeBorrower());
    expect(result.firstHomePurchaseEligible).toBe(false);
  });
});

// ─── 青安資格 ───────────────────────────────────────────────────

describe('scoreBorrowerProfile — 青安資格', () => {
  test('首購 + 自住 + age≤45 → greenHousingEligible=true', () => {
    const result = scoreBorrowerProfile(
      makeBorrower({ age: 35 }),
      makeMortgageProperty({ isFirstHome: true, isOwnerOccupied: true }),
    );
    expect(result.greenHousingEligible).toBe(true);
  });

  test('age=45（邊界）→ greenHousingEligible=true', () => {
    const result = scoreBorrowerProfile(
      makeBorrower({ age: 45 }),
      makeMortgageProperty({ isFirstHome: true, isOwnerOccupied: true }),
    );
    expect(result.greenHousingEligible).toBe(true);
  });

  test('age=46 → greenHousingEligible=false', () => {
    const result = scoreBorrowerProfile(
      makeBorrower({ age: 46 }),
      makeMortgageProperty({ isFirstHome: true, isOwnerOccupied: true }),
    );
    expect(result.greenHousingEligible).toBe(false);
  });

  test('非自住 (isOwnerOccupied=false) → greenHousingEligible=false', () => {
    const result = scoreBorrowerProfile(
      makeBorrower({ age: 35 }),
      makeMortgageProperty({ isFirstHome: true, isOwnerOccupied: false }),
    );
    expect(result.greenHousingEligible).toBe(false);
  });

  test('非首購 → greenHousingEligible=false', () => {
    const result = scoreBorrowerProfile(
      makeBorrower({ age: 35 }),
      makeMortgageProperty({ isFirstHome: false }),
    );
    expect(result.greenHousingEligible).toBe(false);
  });

  test('無 property → greenHousingEligible=false', () => {
    const result = scoreBorrowerProfile(makeBorrower({ age: 30 }));
    expect(result.greenHousingEligible).toBe(false);
  });
});

// ─── 利害關係人（Demo 固定 false）───────────────────────────────

describe('scoreBorrowerProfile — 利害關係人', () => {
  test('Demo 模式 isRelatedParty 固定為 false', () => {
    const result = scoreBorrowerProfile(makeBorrower(), makeMortgageProperty());
    expect(result.isRelatedParty).toBe(false);
  });
});

// ─── MY DATA ───────────────────────────────────────────────────

describe('scoreBorrowerProfile — MY DATA', () => {
  test('hasMyData=true → myDataProvided=true', () => {
    const result = scoreBorrowerProfile(makeBorrower({ hasMyData: true }));
    expect(result.myDataProvided).toBe(true);
  });

  test('hasMyData=false → myDataProvided=false', () => {
    const result = scoreBorrowerProfile(makeBorrower({ hasMyData: false }));
    expect(result.myDataProvided).toBe(false);
  });
});
