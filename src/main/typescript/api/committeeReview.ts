/**
 * INPUT: POST /api/committee-review（CommitteeReviewRequest JSON）
 * OUTPUT: { success: true, applicationId, rounds, finalDecision, durationMs }
 * POS: API 層，路由 + 欄位驗證，呼叫 committeeReviewService 執行三輪審議
 */

import { Router, Request, Response } from 'express';
import {
  CommitteeReviewRequest,
  CreditReviewSummary,
  ValuationSummary,
  CommitteeReviewErrorResponse,
} from '../models/committeeReview';
import { runCommitteeReview } from '../services/committeeReviewService';

export const committeeReviewRouter = Router();

// ─── 驗證輔助 ─────────────────────────────────────────────────

function validateCreditReviewSummary(
  cs: unknown,
): cs is CreditReviewSummary {
  if (!cs || typeof cs !== 'object') return false;
  const c = cs as Record<string, unknown>;
  return (
    typeof c['riskScore'] === 'number' &&
    ['normal', 'caution', 'alert'].includes(c['fraudLevel'] as string) &&
    typeof c['thresholdPass'] === 'boolean' &&
    typeof c['primaryMetricValue'] === 'number' &&
    typeof c['primaryMetricLabel'] === 'string' &&
    typeof c['fraudPassCount'] === 'number' &&
    typeof c['overallAssessment'] === 'string'
  );
}

function validateValuationSummary(vs: unknown): vs is ValuationSummary {
  if (!vs || typeof vs !== 'object') return false;
  const v = vs as Record<string, unknown>;
  return (
    typeof v['estimatedValue'] === 'number' &&
    typeof v['ltvRatio'] === 'number' &&
    ['低風險', '中風險', '高風險'].includes(v['riskLevel'] as string) &&
    typeof v['sentimentScore'] === 'number'
  );
}

function validateRequest(
  body: unknown,
): { valid: true; req: CommitteeReviewRequest } | { valid: false; error: string } {
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

  if (typeof b['termYears'] !== 'number' || b['termYears'] <= 0 || b['termYears'] > 40) {
    return { valid: false, error: 'termYears 必須介於 1-40' };
  }

  if (typeof b['borrowerName'] !== 'string' || !b['borrowerName'].trim()) {
    return { valid: false, error: 'borrowerName 為必填字串' };
  }

  if (typeof b['borrowerAge'] !== 'number' || b['borrowerAge'] < 18 || b['borrowerAge'] > 90) {
    return { valid: false, error: 'borrowerAge 必須介於 18-90' };
  }

  if (typeof b['occupation'] !== 'string' || !b['occupation'].trim()) {
    return { valid: false, error: 'occupation 為必填字串' };
  }

  if (typeof b['purpose'] !== 'string' || !b['purpose'].trim()) {
    return { valid: false, error: 'purpose 為必填字串' };
  }

  if (!validateCreditReviewSummary(b['creditReviewSummary'])) {
    return {
      valid: false,
      error:
        'creditReviewSummary 格式錯誤，須包含 riskScore / fraudLevel / thresholdPass / primaryMetricValue / primaryMetricLabel / fraudPassCount / overallAssessment',
    };
  }

  if (b['loanType'] === 'mortgage') {
    if (!validateValuationSummary(b['valuationSummary'])) {
      return {
        valid: false,
        error:
          '房貸申請時 valuationSummary 為必填，須包含 estimatedValue / ltvRatio / riskLevel / sentimentScore',
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
      borrowerName: (b['borrowerName'] as string).trim(),
      borrowerAge: b['borrowerAge'] as number,
      occupation: (b['occupation'] as string).trim(),
      purpose: (b['purpose'] as string).trim(),
      creditReviewSummary: b['creditReviewSummary'] as CreditReviewSummary,
      valuationSummary:
        b['loanType'] === 'mortgage'
          ? (b['valuationSummary'] as ValuationSummary)
          : undefined,
    },
  };
}

// ─── POST /api/committee-review ────────────────────────────────

committeeReviewRouter.post(
  '/committee-review',
  async (req: Request, res: Response): Promise<void> => {
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      const errResp: CommitteeReviewErrorResponse = {
        success: false,
        message: validation.error,
      };
      res.status(400).json(errResp);
      return;
    }

    try {
      console.log(
        `[committeeReview] 啟動審議小組：${validation.req.borrowerName} / ${validation.req.loanType} / NT$${validation.req.loanAmount.toLocaleString()}`,
      );
      const result = await runCommitteeReview(validation.req);
      console.log(
        `[committeeReview] 審議完成：${result.finalDecision.decision} / 耗時 ${result.durationMs}ms`,
      );
      res.json(result);
    } catch (err) {
      console.error('[committeeReview] 審議執行錯誤:', err);
      const errResp: CommitteeReviewErrorResponse = {
        success: false,
        message: '審議小組服務異常，請稍後再試',
      };
      res.status(500).json(errResp);
    }
  },
);
