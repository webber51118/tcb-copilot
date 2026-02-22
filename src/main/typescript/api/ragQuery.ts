/**
 * INPUT: POST /api/rag-query（RagQueryRequest JSON）
 * OUTPUT: { success: true, answer, sources, confidence, cached }
 * POS: API 層，路由 + 欄位驗證，呼叫 ragService 執行三層知識庫問答
 */

import { Router, Request, Response } from 'express';
import { RagQueryRequest, RagQueryErrorResponse } from '../models/rag';
import { ragQuery } from '../services/ragService';

export const ragQueryRouter = Router();

// ─── 欄位驗證 ─────────────────────────────────────────────────

function validateRequest(body: unknown): { valid: true; req: RagQueryRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '請求體必須為 JSON 物件' };
  }

  const b = body as Record<string, unknown>;

  // question：必填，字串，最多 500 字
  if (typeof b['question'] !== 'string' || !b['question'].trim()) {
    return { valid: false, error: 'question 為必填字串' };
  }
  if (b['question'].length > 500) {
    return { valid: false, error: 'question 不得超過 500 字' };
  }

  // loanType：選填，限 mortgage 或 personal
  if (b['loanType'] !== undefined) {
    if (b['loanType'] !== 'mortgage' && b['loanType'] !== 'personal') {
      return { valid: false, error: 'loanType 必須為 "mortgage" 或 "personal"' };
    }
  }

  return {
    valid: true,
    req: {
      question: (b['question'] as string).trim(),
      loanType: b['loanType'] as 'mortgage' | 'personal' | undefined,
    },
  };
}

// ─── POST /api/rag-query ───────────────────────────────────────

ragQueryRouter.post('/rag-query', async (req: Request, res: Response): Promise<void> => {
  const validation = validateRequest(req.body);
  if (!validation.valid) {
    const errResp: RagQueryErrorResponse = { success: false, message: validation.error };
    res.status(400).json(errResp);
    return;
  }

  try {
    const result = await ragQuery(validation.req);
    res.json(result);
  } catch (err) {
    console.error('[ragQuery] RAG 問答執行錯誤:', err);
    const errResp: RagQueryErrorResponse = {
      success: false,
      message: 'RAG 問答服務異常，請稍後再試',
    };
    res.status(500).json(errResp);
  }
});
