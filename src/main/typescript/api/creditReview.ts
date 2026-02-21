/**
 * INPUT: POST /api/credit-review（CreditReviewRequest JSON）
 * OUTPUT: { success: true, data: CreditReviewResult }
 * POS: API 層，路由 + 欄位驗證，呼叫 creditReviewService 執行 5P 徵審
 */

import { Router, Request, Response } from 'express';
import { OccupationType } from '../models/enums';
import { CreditReviewRequest } from '../models/creditReview';
import { performCreditReview } from '../services/creditReviewService';

export const creditReviewRouter = Router();

// ─── 欄位驗證輔助 ──────────────────────────────────────────────

function isValidOccupation(val: unknown): val is OccupationType {
  return Object.values(OccupationType).includes(val as OccupationType);
}

function validateRequest(body: unknown): { valid: true; req: CreditReviewRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '請求體必須為 JSON 物件' };
  }

  const b = body as Record<string, unknown>;

  // loanType
  if (b['loanType'] !== 'mortgage' && b['loanType'] !== 'personal') {
    return { valid: false, error: 'loanType 必須為 "mortgage" 或 "personal"' };
  }

  // loanAmount
  if (typeof b['loanAmount'] !== 'number' || b['loanAmount'] <= 0) {
    return { valid: false, error: 'loanAmount 必須為正數（元）' };
  }

  // termYears
  if (typeof b['termYears'] !== 'number' || b['termYears'] <= 0 || b['termYears'] > 40) {
    return { valid: false, error: 'termYears 必須介於 1-40 年' };
  }

  // borrower
  const borrower = b['borrower'] as Record<string, unknown> | undefined;
  if (!borrower || typeof borrower !== 'object') {
    return { valid: false, error: 'borrower 為必填欄位' };
  }
  if (typeof borrower['name'] !== 'string' || !borrower['name']) {
    return { valid: false, error: 'borrower.name 為必填字串' };
  }
  if (typeof borrower['age'] !== 'number' || borrower['age'] < 18 || borrower['age'] > 90) {
    return { valid: false, error: 'borrower.age 必須介於 18-90' };
  }
  if (!isValidOccupation(borrower['occupation'])) {
    return {
      valid: false,
      error: `borrower.occupation 必須為 ${Object.values(OccupationType).join(' / ')} 之一`,
    };
  }
  if (typeof borrower['monthlyIncome'] !== 'number' || borrower['monthlyIncome'] < 0) {
    return { valid: false, error: 'borrower.monthlyIncome 必須為非負數（元）' };
  }
  if (typeof borrower['yearsEmployed'] !== 'number' || borrower['yearsEmployed'] < 0) {
    return { valid: false, error: 'borrower.yearsEmployed 必須為非負數（年）' };
  }
  if (typeof borrower['isPublicServant'] !== 'boolean') {
    return { valid: false, error: 'borrower.isPublicServant 必須為布林值' };
  }
  if (typeof borrower['hasMyData'] !== 'boolean') {
    return { valid: false, error: 'borrower.hasMyData 必須為布林值' };
  }

  // 房貸時 property 為必填
  if (b['loanType'] === 'mortgage') {
    const prop = b['property'] as Record<string, unknown> | undefined;
    if (!prop || typeof prop !== 'object') {
      return { valid: false, error: '房貸申請時 property 為必填欄位' };
    }
    if (typeof prop['region'] !== 'string' || !prop['region']) {
      return { valid: false, error: 'property.region 為必填字串（縣市）' };
    }
    if (!['購屋', '週轉金', '其他'].includes(prop['purpose'] as string)) {
      return { valid: false, error: 'property.purpose 必須為 購屋 / 週轉金 / 其他' };
    }
  }

  // 保證人 occupation 驗證（如有）
  const guarantor = b['guarantor'] as Record<string, unknown> | undefined;
  if (guarantor) {
    if (!isValidOccupation(guarantor['occupation'])) {
      return {
        valid: false,
        error: `guarantor.occupation 必須為 ${Object.values(OccupationType).join(' / ')} 之一`,
      };
    }
  }

  return { valid: true, req: b as unknown as CreditReviewRequest };
}

// ─── POST /api/credit-review ──────────────────────────────────

creditReviewRouter.post('/credit-review', async (req: Request, res: Response): Promise<void> => {
  const validation = validateRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({ success: false, message: validation.error });
    return;
  }

  try {
    const result = await performCreditReview(validation.req);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[creditReview] 徵審執行錯誤:', err);
    res.status(500).json({
      success: false,
      message: '徵審服務異常，請稍後再試',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
