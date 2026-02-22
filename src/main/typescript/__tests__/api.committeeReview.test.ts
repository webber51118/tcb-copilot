/**
 * POST /api/committee-review — 欄位驗證 + 服務整合測試
 */

import request from 'supertest';
import express from 'express';

jest.mock('../services/committeeReviewService');

import { committeeReviewRouter } from '../api/committeeReview';
import { runCommitteeReview } from '../services/committeeReviewService';

const mockRun = runCommitteeReview as jest.MockedFunction<typeof runCommitteeReview>;

const MOCK_RESULT = {
  success: true as const,
  applicationId: 'CR-TEST-001',
  rounds: [],
  finalDecision: {
    decision: '核准' as const,
    approvedAmount: 1_000_000,
    approvedTermYears: 3,
    interestRateHint: '機動利率5.5%起',
    conditions: [],
    summary: '審議小組核准通過',
    votes: [],
  },
  durationMs: 3000,
};

// ── 合法 creditReviewSummary ──────────────────────────────────────
const VALID_CRS = {
  riskScore: 72,
  fraudLevel: 'normal',
  thresholdPass: true,
  primaryMetricValue: 8.5,
  primaryMetricLabel: 'DBR 8.5 倍',
  fraudPassCount: 7,
  overallAssessment: '【尚屬正常】整體財務狀況良好',
};

const VALID_PERSONAL_BODY = {
  loanType: 'personal',
  loanAmount: 1_000_000,
  termYears: 3,
  borrowerName: '測試員',
  borrowerAge: 35,
  occupation: '上班族',
  purpose: '個人消費',
  creditReviewSummary: VALID_CRS,
};

const VALID_MORTGAGE_BODY = {
  ...VALID_PERSONAL_BODY,
  loanType: 'mortgage',
  loanAmount: 8_000_000,
  termYears: 20,
  valuationSummary: {
    estimatedValue: 12_000_000,
    ltvRatio: 0.667,
    riskLevel: '中風險',
    sentimentScore: 0.05,
  },
};

const app = express();
app.use(express.json());
app.use('/api', committeeReviewRouter);

// ─────────────────────────────────────────────────────────────────
describe('POST /api/committee-review — 欄位驗證', () => {
  test('loanType 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/committee-review')
      .send({ ...VALID_PERSONAL_BODY, loanType: 'xxx' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanType');
  });

  test('borrowerAge 超過 90 → 400', async () => {
    const res = await request(app)
      .post('/api/committee-review')
      .send({ ...VALID_PERSONAL_BODY, borrowerAge: 91 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrowerAge');
  });

  test('creditReviewSummary 缺 riskScore → 400', async () => {
    const { riskScore: _, ...crs } = VALID_CRS;
    const res = await request(app)
      .post('/api/committee-review')
      .send({ ...VALID_PERSONAL_BODY, creditReviewSummary: crs });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('creditReviewSummary');
  });

  test('creditReviewSummary.fraudLevel 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/committee-review')
      .send({
        ...VALID_PERSONAL_BODY,
        creditReviewSummary: { ...VALID_CRS, fraudLevel: 'unknown' },
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('creditReviewSummary');
  });

  test('房貸未提供 valuationSummary → 400', async () => {
    const { valuationSummary: _, ...body } = VALID_MORTGAGE_BODY;
    const res = await request(app)
      .post('/api/committee-review')
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('valuationSummary');
  });

  test('borrowerName 空白 → 400', async () => {
    const res = await request(app)
      .post('/api/committee-review')
      .send({ ...VALID_PERSONAL_BODY, borrowerName: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('borrowerName');
  });
});

describe('POST /api/committee-review — 成功與錯誤', () => {
  beforeEach(() => {
    mockRun.mockResolvedValue(MOCK_RESULT);
  });
  afterEach(() => jest.clearAllMocks());

  test('有效信貸請求 → 200 + finalDecision', async () => {
    const res = await request(app)
      .post('/api/committee-review')
      .send(VALID_PERSONAL_BODY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.finalDecision.decision).toBe('核准');
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  test('有效房貸請求 → 200', async () => {
    const res = await request(app)
      .post('/api/committee-review')
      .send(VALID_MORTGAGE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('服務層拋出錯誤 → 500', async () => {
    mockRun.mockRejectedValue(new Error('Claude API 超時'));
    const res = await request(app)
      .post('/api/committee-review')
      .send(VALID_PERSONAL_BODY);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
