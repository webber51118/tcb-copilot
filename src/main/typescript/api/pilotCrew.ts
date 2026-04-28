/**
 * INPUT:  POST /api/pilot-crew（PilotCrewRequest JSON）
 * OUTPUT: PilotCrewResult（三 Crew 並行結果）或錯誤回應
 * POS:    API 層，三位一體 PILOT CREW 並行審核入口
 *
 * 流程：
 *   1. 驗證 loanType / fraudInput 必要欄位
 *   2. 呼叫 runPilotCrewReview（CREW 1/2/3 並行）
 *   3. alertLevel === 3 → 觸發 Power Automate 防詐警示 → Teams
 *   4. 回傳完整結果（含 powerAutomateTriggered 旗標）
 */

import { Router, Request, Response } from 'express';
import { runPilotCrewReview } from '../services/workflowService';
import { triggerFraudAlert } from '../services/powerAutomateNotifier';
import { PilotCrewRequest } from '../models/workflow';
import { ConversationState, LoanType, OccupationType, BuildingType } from '../models/enums';

export const pilotCrewRouter = Router();

// ─── 輸入驗證 ─────────────────────────────────────────────────────

function validateFraudInput(fi: unknown): fi is PilotCrewRequest['fraudInput'] {
  if (!fi || typeof fi !== 'object') return false;
  const v = fi as Record<string, unknown>;
  return (
    typeof v['age'] === 'number' && v['age'] >= 18 &&
    typeof v['occupationCode'] === 'number' &&
    typeof v['monthlyIncome'] === 'number' && (v['monthlyIncome'] as number) > 0 &&
    typeof v['creditInquiryCount'] === 'number' &&
    typeof v['existingBankLoans'] === 'number' &&
    typeof v['hasRealEstate'] === 'boolean' &&
    typeof v['documentMatch'] === 'boolean' &&
    typeof v['livesInBranchCounty'] === 'boolean' &&
    typeof v['hasSalaryTransfer'] === 'boolean'
  );
}

/** 以寬鬆方式建構 UserSession（欄位不足補預設值，避免前端傳完整 Session 的複雜度） */
function buildSession(body: Record<string, unknown>): PilotCrewRequest['session'] {
  const loanType = body['loanType'] === 'mortgage' ? LoanType.MORTGAGE : LoanType.PERSONAL;
  const bi = (body['basicInfo'] as Record<string, unknown> | undefined) ?? {};
  const pi = (body['propertyInfo'] as Record<string, unknown> | undefined) ?? {};
  const fi = body['fraudInput'] as Record<string, unknown>;

  return {
    userId:              (body['userId'] as string | undefined) ?? `anon-${Date.now()}`,
    state:               ConversationState.COMPLETED,
    loanType,
    basicInfo: {
      age:       typeof bi['age'] === 'number' ? bi['age'] : (fi['age'] as number),
      occupation: (bi['occupation'] as OccupationType | null) ??
                  (['軍人', '公務員', '教師'].includes(String(bi['occupation'])) ?
                    bi['occupation'] as OccupationType : OccupationType.OTHER),
      income:    typeof bi['income'] === 'number' ? bi['income'] :
                 (fi['monthlyIncome'] as number) * 10000,
      purpose:   (bi['purpose'] as string | null) ?? null,
      termYears: (bi['termYears'] as number | null) ?? null,
      amount:    (bi['amount'] as number | null) ?? null,
    },
    propertyInfo: {
      propertyAge:  (pi['propertyAge'] as number | null) ?? null,
      areaPing:     (pi['areaPing'] as number | null) ?? null,
      hasParking:   (pi['hasParking'] as boolean | null) ?? null,
      layout:       (pi['layout'] as string | null) ?? null,
      floor:        (pi['floor'] as number | null) ?? null,
      buildingType: (pi['buildingType'] as BuildingType | null) ?? null,
    },
    applicantName:      (body['applicantName'] as string | null) ?? null,
    applicantPhone:     (body['applicantPhone'] as string | null) ?? null,
    recommendedProductId: null,
    mydataReady:        null,
    landRegistryReady:  null,
    idNumber:           null,
    employer:           null,
    annualIncome:       null,
    parsedFromDoc:      false,
    docReviewConfirmed: false,
    createdAt:          Date.now(),
    updatedAt:          Date.now(),
  };
}

// ─── POST /api/pilot-crew ─────────────────────────────────────────

pilotCrewRouter.post('/pilot-crew', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  // 1. 基本驗證
  if (body['loanType'] !== 'mortgage' && body['loanType'] !== 'personal') {
    res.status(400).json({ success: false, message: 'loanType 必須為 mortgage 或 personal' });
    return;
  }
  if (!validateFraudInput(body['fraudInput'])) {
    res.status(400).json({
      success: false,
      message: 'fraudInput 缺少必要欄位（age/occupationCode/monthlyIncome/creditInquiryCount/existingBankLoans/hasRealEstate/documentMatch/livesInBranchCounty/hasSalaryTransfer）',
    });
    return;
  }

  // 2. 組裝 PilotCrewRequest
  const pilotReq: PilotCrewRequest = {
    applicationId:  (body['applicationId'] as string | undefined),
    loanType:       body['loanType'] as 'mortgage' | 'personal',
    session:        body['session'] ? (body['session'] as PilotCrewRequest['session']) : buildSession(body),
    fraudInput:     body['fraudInput'] as PilotCrewRequest['fraudInput'],
    valuationInput: body['valuationInput'] as PilotCrewRequest['valuationInput'] | undefined,
    property:       body['property'] as PilotCrewRequest['property'] | undefined,
  };

  // 3. 執行三 Crew 並行審核
  let result;
  try {
    result = await runPilotCrewReview(pilotReq);
  } catch (err) {
    console.error('[pilotCrew] runPilotCrewReview 失敗：', err);
    res.status(500).json({ success: false, message: '三 Crew 執行失敗，請稍後再試' });
    return;
  }

  // 4. CREW 3 alertLevel === 3 → 觸發 Power Automate 防詐警示 → Teams
  let powerAutomateTriggered = false;
  if (result.crew3.mlScore.alertLevel === 3) {
    powerAutomateTriggered = await triggerFraudAlert({
      applicationId:   result.applicationId,
      fraudScore:      result.crew3.mlScore.fraudScore,
      riskLevel:       result.crew3.mlScore.riskLevel,
      topRiskFactors:  result.crew3.mlScore.topRiskFactors,
    });
  }

  res.json({ ...result, powerAutomateTriggered });
});

// ─── GET /api/pilot-crew/health ───────────────────────────────────

pilotCrewRouter.get('/pilot-crew/health', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    service: '三位一體 PILOT CREW',
    crews: ['CREW1-行銷PILOT', 'CREW2-鑑估PILOT', 'CREW3-防詐PILOT'],
    powerAutomate: {
      fraudWebhook: Boolean(process.env['POWER_AUTOMATE_FRAUD_WEBHOOK_URL']),
      pdfWebhook:   Boolean(process.env['POWER_AUTOMATE_PDF_WEBHOOK_URL']),
    },
    fraudScoring: {
      apiUrl: process.env['FRAUD_SCORING_API_URL'] ?? 'http://localhost:8002',
    },
  });
});
