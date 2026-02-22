/**
 * POST /api/valuate — 欄位驗證 + 服務整合測試
 */

import request from 'supertest';
import express from 'express';

jest.mock('../services/valuationClient');

import { valuateRouter } from '../api/valuate';
import { callValuationEngine } from '../services/valuationClient';

const mockCall = callValuationEngine as jest.MockedFunction<typeof callValuationEngine>;

const MOCK_RESULT = {
  estimatedValue: 15_000_000,
  confidenceInterval: { p5: 12_000_000, p50: 15_000_000, p95: 18_000_000 },
  ltvRatio: 0.667,
  riskLevel: '中風險' as const,
  lstmIndex: 1.02,
  sentimentScore: 0.05,
  baseValue: 14_706_000,
  breakdown: { area: 0.5, floor: 0.1, age: 0.2, location: 0.2 },
  mode: 'demo' as const,
  region: '台北市',
  buildingType: '大樓',
};

const VALID_BODY = {
  areaPing: 35,
  propertyAge: 10,
  buildingType: '大樓',
  floor: 8,
  hasParking: true,
  layout: '3房2廳',
  region: '台北市',
  loanAmount: 8_000_000,
};

const app = express();
app.use(express.json());
app.use('/api', valuateRouter);

// ─────────────────────────────────────────────────────────────────
describe('POST /api/valuate — 欄位驗證', () => {
  test('缺少 areaPing → 400', async () => {
    const { areaPing: _, ...body } = VALID_BODY;
    const res = await request(app).post('/api/valuate').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('areaPing');
  });

  test('缺少 region → 400', async () => {
    const { region: _, ...body } = VALID_BODY;
    const res = await request(app).post('/api/valuate').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('region');
  });

  test('缺少 loanAmount → 400', async () => {
    const { loanAmount: _, ...body } = VALID_BODY;
    const res = await request(app).post('/api/valuate').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanAmount');
  });

  test('缺少 buildingType → 400', async () => {
    const { buildingType: _, ...body } = VALID_BODY;
    const res = await request(app).post('/api/valuate').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('buildingType');
  });

  test('缺少多個欄位 → 400 且列出所有缺少欄位', async () => {
    const res = await request(app).post('/api/valuate').send({});
    expect(res.status).toBe(400);
    // 應包含多個缺失欄位
    const missing: string = res.body.message;
    expect(missing).toContain('areaPing');
    expect(missing).toContain('region');
  });
});

describe('POST /api/valuate — 成功與錯誤', () => {
  afterEach(() => jest.clearAllMocks());

  test('有效請求 → 200 + data', async () => {
    mockCall.mockResolvedValue(MOCK_RESULT);
    const res = await request(app).post('/api/valuate').send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estimatedValue).toBe(15_000_000);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  test('Python 服務不可用 → 503', async () => {
    const err = new Error('service unavailable') as NodeJS.ErrnoException;
    err.code = 'VALUATION_SERVICE_UNAVAILABLE';
    mockCall.mockRejectedValue(err);
    const res = await request(app).post('/api/valuate').send(VALID_BODY);
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  test('服務層拋出未預期錯誤 → 500', async () => {
    mockCall.mockRejectedValue(new Error('計算失敗'));
    const res = await request(app).post('/api/valuate').send(VALID_BODY);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
