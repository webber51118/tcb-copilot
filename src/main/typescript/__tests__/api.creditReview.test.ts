/**
 * POST /api/credit-review — 欄位驗證 + 服務整合測試
 */

import request from 'supertest';
import express from 'express';

jest.mock('../services/creditReviewService');

import { creditReviewRouter } from '../api/creditReview';
import { performCreditReview } from '../services/creditReviewService';
import { CreditReviewResult } from '../models/creditReview';

const mockPerform = performCreditReview as jest.MockedFunction<typeof performCreditReview>;

// ── 最小化 mock 回傳值 ────────────────────────────────────────────
const MOCK_RESULT = {
  loanType: 'personal' as const,
  borrowerProfile: {
    isRelatedParty: false,
    firstHomePurchaseEligible: true,
    greenHousingEligible: false,
    myDataProvided: false,
  },
  creditPurpose: {
    purpose: '個人信用貸款',
    isInvestorDetected: false,
    loanTermCheck: { pass: true, maxAllowed: 7, requested: 3 },
    builderBackgroundDetected: false,
  },
  repaymentSource: {
    monthlyIncome: 60000,
    monthlyExpense: 35000,
    monthlyBalance: 25000,
    incomeBreakdown: {},
    expenseBreakdown: {},
  },
  creditProtection: {
    totalAssets: 500000,
    totalLiabilities: 100000,
    netWorth: 400000,
    liquidAssets: 300000,
    shortTermLiabilities: 50000,
    realEstateValue: 0,
  },
  riskFactors: {
    employmentStability: { level: 7, label: '穩定', notes: '' },
    incomeGrowth: { level: 6, label: '一般', notes: '' },
    netWorthLevel: { level: 7, label: '良好', notes: '' },
    netWorthRatio: { level: 6, label: '一般', notes: '' },
    liquidityRatio: { level: 8, label: '充足', notes: '' },
    debtRatio: { level: 7, label: '良好', notes: '' },
  },
  thresholds: {
    debtIncomeRatio: { value: 0.45, limit: 0.85, pass: true },
    dbr: { value: 8.0, limit: 22 as const, pass: true },
  },
  fraudCheck: { items: [], overallLevel: 'normal' as const, message: '查核正常' },
  requiresManualReview: false,
  overallAssessment: '【尚屬正常】整體財務狀況良好',
  suggestedActions: [],
  reportJson: {},
  mode: 'demo' as const,
  timestamp: '2024-01-01T00:00:00.000Z',
};

// ── 最小有效請求體 ───────────────────────────────────────────────
const VALID_BORROWER = {
  name: '測試員',
  age: 35,
  occupation: '上班族',
  isPublicServant: false,
  yearsEmployed: 5,
  hasMyData: false,
  monthlyIncome: 60000,
};

const VALID_PERSONAL = {
  loanType: 'personal',
  loanAmount: 1_000_000,
  termYears: 3,
  borrower: VALID_BORROWER,
};

const VALID_MORTGAGE = {
  loanType: 'mortgage',
  loanAmount: 8_000_000,
  termYears: 20,
  borrower: { ...VALID_BORROWER },
  property: { region: '台北市', isFirstHome: true, isOwnerOccupied: true, purpose: '購屋' },
};

// ── Express 測試 App ─────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api', creditReviewRouter);

// ─────────────────────────────────────────────────────────────────
describe('POST /api/credit-review — 欄位驗證', () => {
  test('無 body → 400', async () => {
    const res = await request(app).post('/api/credit-review').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('loanType 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send({ ...VALID_PERSONAL, loanType: 'business' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanType');
  });

  test('loanAmount 為零 → 400', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send({ ...VALID_PERSONAL, loanAmount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanAmount');
  });

  test('termYears 超過 40 → 400', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send({ ...VALID_PERSONAL, termYears: 41 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('termYears');
  });

  test('borrower 缺失 → 400', async () => {
    const { borrower: _, ...body } = VALID_PERSONAL;
    const res = await request(app).post('/api/credit-review').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrower');
  });

  test('borrower.age 未滿 18 → 400', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send({ ...VALID_PERSONAL, borrower: { ...VALID_BORROWER, age: 17 } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrower.age');
  });

  test('borrower.occupation 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send({ ...VALID_PERSONAL, borrower: { ...VALID_BORROWER, occupation: '無業' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('occupation');
  });

  test('房貸未提供 property → 400', async () => {
    const { property: _, ...body } = VALID_MORTGAGE;
    const res = await request(app).post('/api/credit-review').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('property');
  });

  test('房貸 property.purpose 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send({
        ...VALID_MORTGAGE,
        property: { ...VALID_MORTGAGE.property, purpose: '投機' },
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('purpose');
  });
});

describe('POST /api/credit-review — 成功與錯誤', () => {
  beforeEach(() => {
    mockPerform.mockResolvedValue(MOCK_RESULT as unknown as CreditReviewResult);
  });
  afterEach(() => jest.clearAllMocks());

  test('有效信貸請求 → 200 + success:true', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send(VALID_PERSONAL);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(mockPerform).toHaveBeenCalledTimes(1);
  });

  test('有效房貸請求 → 200 + success:true', async () => {
    const res = await request(app)
      .post('/api/credit-review')
      .send(VALID_MORTGAGE);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('服務層拋出錯誤 → 500', async () => {
    mockPerform.mockRejectedValue(new Error('內部錯誤'));
    const res = await request(app)
      .post('/api/credit-review')
      .send(VALID_PERSONAL);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
