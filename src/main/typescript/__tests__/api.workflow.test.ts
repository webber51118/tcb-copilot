/**
 * POST /api/workflow/full-review — 欄位驗證 + 服務整合測試
 */

import request from 'supertest';
import express from 'express';

jest.mock('../services/workflowService');

import { workflowRouter } from '../api/workflow';
import { runFullReview } from '../services/workflowService';

const mockRunFullReview = runFullReview as jest.MockedFunction<typeof runFullReview>;

const MOCK_RESULT = {
  success: true as const,
  applicationId: 'WF-TEST-001',
  loanType: 'personal' as const,
  phases: {
    creditReview: { result: {} as never, durationMs: 100 },
    committeeReview: { result: {} as never, durationMs: 3000 },
  },
  finalSummary: {
    decision: '核准' as const,
    approvedAmount: 1_000_000,
    approvedTermYears: 3,
    interestRateHint: '機動利率5.5%起',
    conditions: [],
    riskScore: 72,
    fraudLevel: 'normal' as const,
  },
  totalDurationMs: 3100,
};

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
  borrower: VALID_BORROWER,
  property: {
    region: '台北市',
    isFirstHome: true,
    isOwnerOccupied: true,
    purpose: '購屋',
  },
  valuationInput: {
    areaPing: 35,
    propertyAge: 10,
    buildingType: '大樓',
    floor: 8,
    hasParking: true,
    layout: '3房2廳',
  },
};

const app = express();
app.use(express.json());
app.use('/api', workflowRouter);

// ─────────────────────────────────────────────────────────────────
describe('POST /api/workflow/full-review — 欄位驗證', () => {
  test('無 body → 400', async () => {
    const res = await request(app).post('/api/workflow/full-review').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('loanType 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send({ ...VALID_PERSONAL, loanType: 'business' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanType');
  });

  test('loanAmount 為負數 → 400', async () => {
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send({ ...VALID_PERSONAL, loanAmount: -1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanAmount');
  });

  test('termYears 超過 40 → 400', async () => {
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send({ ...VALID_PERSONAL, termYears: 50 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('termYears');
  });

  test('borrower 缺失 → 400', async () => {
    const { borrower: _, ...body } = VALID_PERSONAL;
    const res = await request(app).post('/api/workflow/full-review').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrower');
  });

  test('borrower.age 未滿 18 → 400', async () => {
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send({ ...VALID_PERSONAL, borrower: { ...VALID_BORROWER, age: 16 } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrower');
  });

  test('借款人職業不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send({ ...VALID_PERSONAL, borrower: { ...VALID_BORROWER, occupation: '無業' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrower');
  });

  test('房貸未提供 property → 400', async () => {
    const { property: _, ...body } = VALID_MORTGAGE;
    const res = await request(app).post('/api/workflow/full-review').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('property');
  });

  test('房貸未提供 valuationInput → 400', async () => {
    const { valuationInput: _, ...body } = VALID_MORTGAGE;
    const res = await request(app).post('/api/workflow/full-review').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('valuationInput');
  });
});

describe('POST /api/workflow/full-review — 成功與錯誤', () => {
  beforeEach(() => {
    mockRunFullReview.mockResolvedValue(MOCK_RESULT);
  });
  afterEach(() => jest.clearAllMocks());

  test('有效信貸請求 → 200 + finalSummary', async () => {
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send(VALID_PERSONAL);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.finalSummary.decision).toBe('核准');
    expect(mockRunFullReview).toHaveBeenCalledTimes(1);
  });

  test('有效房貸請求 → 200', async () => {
    mockRunFullReview.mockResolvedValue({
      ...MOCK_RESULT,
      loanType: 'mortgage',
      phases: {
        ...MOCK_RESULT.phases,
        valuation: { mode: 'demo', result: {} as never, durationMs: 50 },
      },
    });
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send(VALID_MORTGAGE);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('服務層拋出錯誤 → 500', async () => {
    mockRunFullReview.mockRejectedValue(new Error('流程異常'));
    const res = await request(app)
      .post('/api/workflow/full-review')
      .send(VALID_PERSONAL);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
