/**
 * INPUT: POST /api/workflow/full-review（FullReviewRequest JSON）
 * OUTPUT: FullReviewResponse（三階段結果 + 最終摘要）或 FullReviewErrorResponse
 * POS: API 層，路由 + 欄位驗證，呼叫 workflowService 執行完整審核流程
 */

import { Router, Request, Response } from 'express';
import { FullReviewRequest, FullReviewErrorResponse } from '../models/workflow';
import { runFullReview } from '../services/workflowService';

export const workflowRouter = Router();

// ─── 驗證輔助 ──────────────────────────────────────────────────

const OCCUPATION_VALUES = ['軍人', '公務員', '教師', '上班族', '自營商', '其他'];

function validateBorrower(
  b: unknown,
): b is FullReviewRequest['borrower'] {
  if (!b || typeof b !== 'object') return false;
  const v = b as Record<string, unknown>;
  return (
    typeof v['name'] === 'string' &&
    v['name'].trim().length > 0 &&
    typeof v['age'] === 'number' &&
    v['age'] >= 18 &&
    v['age'] <= 90 &&
    OCCUPATION_VALUES.includes(v['occupation'] as string) &&
    typeof v['isPublicServant'] === 'boolean' &&
    typeof v['yearsEmployed'] === 'number' &&
    v['yearsEmployed'] >= 0 &&
    typeof v['hasMyData'] === 'boolean' &&
    typeof v['monthlyIncome'] === 'number' &&
    v['monthlyIncome'] > 0
  );
}

function validateProperty(
  p: unknown,
): p is FullReviewRequest['property'] {
  if (!p || typeof p !== 'object') return false;
  const v = p as Record<string, unknown>;
  return (
    typeof v['region'] === 'string' &&
    v['region'].trim().length > 0 &&
    typeof v['isFirstHome'] === 'boolean' &&
    typeof v['isOwnerOccupied'] === 'boolean' &&
    ['購屋', '週轉金', '其他'].includes(v['purpose'] as string)
  );
}

function validateValuationInput(
  vi: unknown,
): vi is NonNullable<FullReviewRequest['valuationInput']> {
  if (!vi || typeof vi !== 'object') return false;
  const v = vi as Record<string, unknown>;
  return (
    typeof v['areaPing'] === 'number' &&
    v['areaPing'] > 0 &&
    typeof v['propertyAge'] === 'number' &&
    v['propertyAge'] >= 0 &&
    typeof v['buildingType'] === 'string' &&
    v['buildingType'].trim().length > 0 &&
    typeof v['floor'] === 'number' &&
    v['floor'] >= 1 &&
    typeof v['hasParking'] === 'boolean' &&
    typeof v['layout'] === 'string' &&
    v['layout'].trim().length > 0
  );
}

function validateRequest(
  body: unknown,
): { valid: true; req: FullReviewRequest } | { valid: false; error: string; phase?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '請求體必須為 JSON 物件' };
  }

  const b = body as Record<string, unknown>;

  if (b['loanType'] !== 'mortgage' && b['loanType'] !== 'personal') {
    return { valid: false, error: 'loanType 必須為 "mortgage" 或 "personal"' };
  }

  if (typeof b['loanAmount'] !== 'number' || b['loanAmount'] <= 0) {
    return { valid: false, error: 'loanAmount 必須為正數（元）' };
  }

  if (typeof b['termYears'] !== 'number' || b['termYears'] < 1 || b['termYears'] > 40) {
    return { valid: false, error: 'termYears 必須介於 1-40' };
  }

  if (!validateBorrower(b['borrower'])) {
    return {
      valid: false,
      error:
        'borrower 格式錯誤，須包含 name / age(18-90) / occupation / isPublicServant / yearsEmployed / hasMyData / monthlyIncome',
    };
  }

  if (b['loanType'] === 'mortgage') {
    if (!validateProperty(b['property'])) {
      return {
        valid: false,
        error: '房貸申請時 property 為必填，須包含 region / isFirstHome / isOwnerOccupied / purpose',
        phase: 'creditReview',
      };
    }
    if (!validateValuationInput(b['valuationInput'])) {
      return {
        valid: false,
        error:
          '房貸申請時 valuationInput 為必填，須包含 areaPing / propertyAge / buildingType / floor / hasParking / layout',
        phase: 'valuation',
      };
    }
  }

  return {
    valid: true,
    req: {
      applicationId: typeof b['applicationId'] === 'string' ? b['applicationId'] : undefined,
      loanType: b['loanType'] as 'mortgage' | 'personal',
      loanAmount: b['loanAmount'] as number,
      termYears: b['termYears'] as number,
      borrower: b['borrower'] as FullReviewRequest['borrower'],
      guarantor: b['guarantor'] as FullReviewRequest['guarantor'],
      property:
        b['loanType'] === 'mortgage'
          ? (b['property'] as FullReviewRequest['property'])
          : undefined,
      valuationInput:
        b['loanType'] === 'mortgage'
          ? (b['valuationInput'] as FullReviewRequest['valuationInput'])
          : undefined,
    },
  };
}

// ─── POST /api/workflow/full-review ────────────────────────────

workflowRouter.post(
  '/workflow/full-review',
  async (req: Request, res: Response): Promise<void> => {
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      const errResp: FullReviewErrorResponse = {
        success: false,
        message: validation.error,
        phase: validation.phase as FullReviewErrorResponse['phase'],
      };
      res.status(400).json(errResp);
      return;
    }

    try {
      console.log(
        `[workflow] 啟動完整審核：${validation.req.borrower.name} / ${validation.req.loanType} / NT$${validation.req.loanAmount.toLocaleString()}`,
      );
      const result = await runFullReview(validation.req);
      console.log(
        `[workflow] 審核完成：${result.finalSummary.decision} / 耗時 ${result.totalDurationMs}ms`,
      );
      res.json(result);
    } catch (err) {
      console.error('[workflow] 完整審核流程異常:', err);
      const errResp: FullReviewErrorResponse = {
        success: false,
        message: '審核流程發生異常，請稍後再試',
      };
      res.status(500).json(errResp);
    }
  },
);
