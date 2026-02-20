/**
 * INPUT: HTTP Request（token + 表單資料 + 簽名）
 * OUTPUT: 案件編號、PDF 路徑、LINE Push 申請完成通知
 * POS: API 層，LIFF 申請書提交端點
 *
 * 路由：
 *   GET  /api/application-data/:token  — 取得 session 資料供 LIFF 預填
 *   POST /api/submit-application       — 提交申請書（表單 + 簽名）
 */

import { Router, Request, Response } from 'express';
import { validateToken, consumeToken } from '../config/sessionTokenStore';
import { getSession, resetSession } from '../core/sessionStore';
import { createApplication } from '../config/applicationStore';
import { generateApplicationPdf } from '../services/pdfGenerator';
import { lineClient } from '../core/lineClient';
import { LoanType } from '../models/enums';

export const submitApplicationRouter = Router();

/** GET /api/application-data/:token — 供 LIFF 取得 session 資料 */
submitApplicationRouter.get('/application-data/:token', (req: Request, res: Response) => {
  const token = req.params['token'] as string;
  const userId = validateToken(token);
  if (!userId) {
    res.status(401).json({ success: false, message: 'Token 無效或已過期' });
    return;
  }

  const session = getSession(userId);
  const isMortgage = session.loanType === LoanType.MORTGAGE
    || session.loanType === LoanType.REVERSE_ANNUITY;

  res.json({
    success: true,
    data: {
      loanType: session.loanType,
      isMortgage,
      applicantName: session.applicantName,
      applicantPhone: session.applicantPhone,
      idNumber: session.idNumber,
      employer: session.employer,
      basicInfo: session.basicInfo,
      propertyInfo: isMortgage ? session.propertyInfo : null,
      recommendedProductId: session.recommendedProductId,
      mydataReady: session.mydataReady,
      landRegistryReady: session.landRegistryReady,
    },
  });
});

/** POST /api/submit-application — 提交申請書 */
submitApplicationRouter.post('/submit-application', async (req: Request, res: Response) => {
  const {
    token,
    signatureBase64,
    extraInfo,
  } = req.body as {
    token: string;
    signatureBase64: string;
    extraInfo?: {
      birthDate?: string;
      maritalStatus?: string;
      education?: string;
      address?: string;
    };
  };

  if (!token) {
    res.status(400).json({ success: false, message: '缺少 token' });
    return;
  }

  const userId = consumeToken(token);
  if (!userId) {
    res.status(401).json({ success: false, message: 'Token 無效或已過期，請重新開始申請' });
    return;
  }

  const session = getSession(userId);

  // 建立申請案件
  const application = createApplication(
    session.userId,
    session.applicantName ?? '',
    session.applicantPhone ?? '',
    session.loanType ?? LoanType.PERSONAL,
    session.basicInfo,
    session.propertyInfo,
    session.recommendedProductId ?? '',
    session.mydataReady ?? false,
    session.landRegistryReady,
  );

  // 生成 PDF
  let pdfPath = '';
  try {
    pdfPath = await generateApplicationPdf(application, signatureBase64 ?? '', extraInfo ?? {});
  } catch (err) {
    console.error('[submitApplication] PDF 生成失敗:', err);
    // PDF 失敗不影響案件建立，繼續流程
  }

  // 重置 session
  resetSession(userId);

  // Push LINE 申請完成通知
  try {
    await pushApplyDoneMessage(userId, application.id, application.applicantName, application.applicantPhone);
  } catch (err) {
    console.error('[submitApplication] LINE Push 失敗:', err);
    // Push 失敗不影響 API 回應
  }

  res.json({
    success: true,
    data: {
      caseId: application.id,
      status: application.status,
      appliedAt: application.appliedAt,
      pdfGenerated: pdfPath.length > 0,
    },
  });
});

/** 推送申請完成 LINE 訊息 */
async function pushApplyDoneMessage(
  userId: string,
  caseId: string,
  name: string,
  phone: string,
): Promise<void> {
  const D = '#0D1B2A'; const M = '#0F2035'; const B = '#0A1628';
  const ACCENT = '#69F0AE'; const BTN = '#1B5E20';

  await lineClient.pushMessage({
    to: userId,
    messages: [
      {
        type: 'flex',
        altText: `✅ 申請完成！案件編號：${caseId}`,
        contents: {
          type: 'bubble', size: 'mega',
          body: {
            type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '0px', backgroundColor: D,
            contents: [
              {
                type: 'box', layout: 'vertical', paddingAll: '20px', paddingBottom: '12px', spacing: 'sm',
                contents: [
                  { type: 'text', text: '✅', size: '3xl', align: 'center' },
                  { type: 'text', text: '線上申請已完成！', weight: 'bold', size: 'lg', color: '#FFFFFF', align: 'center', margin: 'sm' },
                ],
              },
              { type: 'box', layout: 'vertical', height: '3px', backgroundColor: ACCENT, contents: [{ type: 'filler' }] },
              {
                type: 'box', layout: 'vertical', backgroundColor: M, paddingAll: '16px', spacing: 'md',
                contents: [
                  { type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: '案件編號', size: 'sm', color: '#90A4AE', flex: 4 },
                    { type: 'text', text: caseId, size: 'sm', weight: 'bold', color: ACCENT, flex: 6, wrap: true },
                  ]},
                  { type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: '申請人', size: 'sm', color: '#90A4AE', flex: 4 },
                    { type: 'text', text: name, size: 'sm', color: '#FFFFFF', flex: 6 },
                  ]},
                  { type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: '聯絡電話', size: 'sm', color: '#90A4AE', flex: 4 },
                    { type: 'text', text: phone, size: 'sm', color: '#FFFFFF', flex: 6 },
                  ]},
                  { type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: '審核狀態', size: 'sm', color: '#90A4AE', flex: 4 },
                    { type: 'text', text: '待審核', size: 'sm', color: '#FFD54F', weight: 'bold', flex: 6 },
                  ]},
                ],
              },
              {
                type: 'box', layout: 'vertical', paddingAll: '16px',
                contents: [
                  { type: 'text', text: '申請書已完成電子簽署！合庫將於 3~5 個工作天內與您聯繫，請保持電話暢通。', size: 'xs', color: '#90A4AE', wrap: true },
                ],
              },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: B,
            contents: [{ type: 'button', style: 'primary', color: BTN,
              action: { type: 'message', label: '回到主選單', text: '返回主選單' },
            }],
          },
        } as unknown as Record<string, unknown>,
      } as unknown as Parameters<typeof lineClient.pushMessage>[0]['messages'][0],
    ],
  });
}
