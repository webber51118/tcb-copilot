/**
 * POST /api/rag-query — 欄位驗證 + 服務整合測試
 */

import request from 'supertest';
import express from 'express';

jest.mock('../services/ragService');

import { ragQueryRouter } from '../api/ragQuery';
import { ragQuery } from '../services/ragService';

const mockRagQuery = ragQuery as jest.MockedFunction<typeof ragQuery>;

const MOCK_RESULT = {
  success: true as const,
  answer: '根據央行規定，第一戶自然人名下有房屋者，自113.9.20起不得有寬限期。',
  sources: ['央行規定'] as ('央行規定' | '政策性貸款' | '授信規章')[],
  confidence: 'high' as const,
  cached: false,
};

const app = express();
app.use(express.json());
app.use('/api', ragQueryRouter);

// ─────────────────────────────────────────────────────────────────
describe('POST /api/rag-query — 欄位驗證', () => {
  test('無 body → 400', async () => {
    const res = await request(app).post('/api/rag-query').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('question 缺失 → 400', async () => {
    const res = await request(app)
      .post('/api/rag-query')
      .send({ loanType: 'mortgage' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('question');
  });

  test('question 為空字串 → 400', async () => {
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('question');
  });

  test('question 超過 500 字 → 400', async () => {
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: 'A'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('500');
  });

  test('loanType 不合法 → 400', async () => {
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: '請問DBR上限？', loanType: 'business' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('loanType');
  });
});

describe('POST /api/rag-query — 成功與錯誤', () => {
  beforeEach(() => {
    mockRagQuery.mockResolvedValue(MOCK_RESULT);
  });
  afterEach(() => jest.clearAllMocks());

  test('有效問題 → 200 + answer', async () => {
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: 'DBR上限是多少？' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toBeDefined();
    expect(mockRagQuery).toHaveBeenCalledWith({ question: 'DBR上限是多少？', loanType: undefined });
  });

  test('帶 loanType 的有效問題 → 200', async () => {
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: '青安貸款利率？', loanType: 'mortgage' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRagQuery).toHaveBeenCalledWith({ question: '青安貸款利率？', loanType: 'mortgage' });
  });

  test('快取結果 cached:true 正確透傳', async () => {
    mockRagQuery.mockResolvedValue({ ...MOCK_RESULT, cached: true });
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: 'DBR上限是多少？' });
    expect(res.body.cached).toBe(true);
  });

  test('服務層拋出錯誤 → 500', async () => {
    mockRagQuery.mockRejectedValue(new Error('Claude API 失敗'));
    const res = await request(app)
      .post('/api/rag-query')
      .send({ question: '請問規定？' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
