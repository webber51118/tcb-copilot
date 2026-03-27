/**
 * POST /api/valuate/xgboost — 欄位驗證 + 成功/錯誤情境測試
 */

import request from 'supertest';
import express from 'express';

jest.mock('../services/valuationClient');
jest.mock('../services/documentParser');

import { valuateXgboostRouter } from '../api/valuateXgboost';
import { callXGBoostValuate } from '../services/valuationClient';
import { parseLandRegistryDoc } from '../services/documentParser';

const mockCallXGBoost  = callXGBoostValuate  as jest.MockedFunction<typeof callXGBoostValuate>;
const mockParseDoc     = parseLandRegistryDoc as jest.MockedFunction<typeof parseLandRegistryDoc>;

const MOCK_RESULT = {
  estimatedValue:     18_000_000,
  confidenceInterval: { p5: 15_000_000, p50: 18_000_000, p95: 21_000_000 },
  ltvRatio:           0.444,
  riskLevel:          '低風險' as const,
  pricePerPing:       600_000,
  model:              'demo' as const,
};

/** 手動模式完整欄位 */
const VALID_MANUAL = {
  district:     '大安區',
  buildingType: '大樓',
  areaPing:     30.0,
  propertyAge:  10,
  floor:        8,
  totalFloors:  12,
  hasParking:   false,
  layout:       '3房2廳1衛',
  loanAmount:   8_000_000,
};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api', valuateXgboostRouter);

// ─────────────────────────────────────────────────────────────────
describe('POST /api/valuate/xgboost — 手動模式欄位驗證', () => {
  test('缺少 loanAmount → 400', async () => {
    const { loanAmount: _, ...body } = VALID_MANUAL;
    const res = await request(app).post('/api/valuate/xgboost').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanAmount');
  });

  test('缺少 hasParking → 400', async () => {
    const { hasParking: _, ...body } = VALID_MANUAL;
    const res = await request(app).post('/api/valuate/xgboost').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('hasParking');
  });

  test('缺少 district（手動模式）→ 400', async () => {
    const { district: _, ...body } = VALID_MANUAL;
    const res = await request(app).post('/api/valuate/xgboost').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('district');
  });

  test('缺少 areaPing（手動模式）→ 400', async () => {
    const { areaPing: _, ...body } = VALID_MANUAL;
    const res = await request(app).post('/api/valuate/xgboost').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('areaPing');
  });

  test('缺少 totalFloors（手動模式）→ 400', async () => {
    const { totalFloors: _, ...body } = VALID_MANUAL;
    const res = await request(app).post('/api/valuate/xgboost').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('totalFloors');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('POST /api/valuate/xgboost — 手動模式成功與錯誤', () => {
  afterEach(() => jest.clearAllMocks());

  test('有效請求 → 200 + valuation data', async () => {
    mockCallXGBoost.mockResolvedValue(MOCK_RESULT);
    const res = await request(app).post('/api/valuate/xgboost').send(VALID_MANUAL);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valuation.estimatedValue).toBe(18_000_000);
    expect(res.body.data.parseSuccess).toBe(false);
    expect(mockCallXGBoost).toHaveBeenCalledTimes(1);
  });

  test('格局「3房2廳1衛」→ rooms 傳入 3', async () => {
    mockCallXGBoost.mockResolvedValue(MOCK_RESULT);
    await request(app).post('/api/valuate/xgboost').send({ ...VALID_MANUAL, layout: '3房2廳1衛' });
    const calledWith = mockCallXGBoost.mock.calls[0][0];
    expect(calledWith.rooms).toBe(3);
  });

  test('格局「2房1廳」→ rooms 傳入 2', async () => {
    mockCallXGBoost.mockResolvedValue(MOCK_RESULT);
    await request(app).post('/api/valuate/xgboost').send({ ...VALID_MANUAL, layout: '2房1廳' });
    const calledWith = mockCallXGBoost.mock.calls[0][0];
    expect(calledWith.rooms).toBe(2);
  });

  test('Python 服務不可用 → 503', async () => {
    const err = new Error('service unavailable') as NodeJS.ErrnoException;
    err.code = 'VALUATION_SERVICE_UNAVAILABLE';
    mockCallXGBoost.mockRejectedValue(err);
    const res = await request(app).post('/api/valuate/xgboost').send(VALID_MANUAL);
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  test('服務層拋出未預期錯誤 → 500', async () => {
    mockCallXGBoost.mockRejectedValue(new Error('鑑價計算失敗'));
    const res = await request(app).post('/api/valuate/xgboost').send(VALID_MANUAL);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('POST /api/valuate/xgboost — 圖片模式', () => {
  afterEach(() => jest.clearAllMocks());

  const IMAGE_BODY = {
    imageBase64: 'data:image/jpeg;base64,/9j/4AAQ==', // 假 base64
    totalFloors: 12,
    hasParking: false,
    layout: '3房2廳1衛',
    loanAmount: 8_000_000,
  };

  const PARSED_LR = {
    district:     '大安區',
    region:       '台北市',
    buildingType: '大樓',
    areaPing:     32.5,
    propertyAge:  12,
    floor:        8,
    totalFloors:  12,
  };

  test('謄本解析成功 → parseSuccess=true + 200', async () => {
    mockParseDoc.mockResolvedValue({ success: true, landRegistry: PARSED_LR });
    mockCallXGBoost.mockResolvedValue(MOCK_RESULT);
    const res = await request(app).post('/api/valuate/xgboost').send(IMAGE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.data.parseSuccess).toBe(true);
    expect(res.body.data.parsed.areaPing).toBe(32.5);
  });

  test('謄本解析失敗 → 400', async () => {
    mockParseDoc.mockResolvedValue({ success: false });
    const res = await request(app).post('/api/valuate/xgboost').send(IMAGE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('謄本解析後 areaPing=0 → 400 且提示手動填寫', async () => {
    mockParseDoc.mockResolvedValue({
      success: true,
      landRegistry: { ...PARSED_LR, areaPing: 0 },
    });
    const res = await request(app).post('/api/valuate/xgboost').send(IMAGE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('坪數');
  });

  test('圖片模式下 totalFloors 以用戶補填為準（謄本無記載）', async () => {
    mockParseDoc.mockResolvedValue({
      success: true,
      landRegistry: { ...PARSED_LR, totalFloors: undefined },
    });
    mockCallXGBoost.mockResolvedValue(MOCK_RESULT);
    const res = await request(app).post('/api/valuate/xgboost').send({ ...IMAGE_BODY, totalFloors: 15 });
    expect(res.status).toBe(200);
    const calledWith = mockCallXGBoost.mock.calls[0][0];
    expect(calledWith.totalFloors).toBe(15);
  });
});
