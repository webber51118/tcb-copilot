/**
 * INPUT: HTTP Request（Admin API Key 驗證）
 * OUTPUT: 貸款申請案件管理結果
 * POS: API 層，申請案件後台管理端點
 *
 * 路由（掛載於 /api/admin）：
 *   GET   /applications              — 列出所有申請（?status=pending 過濾）
 *   GET   /applications/:id          — 查看單一申請
 *   PATCH /applications/:id/status   — 更新審核狀態
 */

import { Router, Request, Response } from 'express';
import {
  getAllApplications, getApplicationById, updateApplicationStatus,
} from '../config/applicationStore';
import { LoanApplication } from '../models/types';
import { lineClient } from '../core/lineClient';

export const applicationAdminRouter = Router();

/** 列出所有申請（支援 ?status= 過濾） */
applicationAdminRouter.get('/applications', (req: Request, res: Response) => {
  let apps = getAllApplications();
  const statusFilter = req.query['status'] as string | undefined;
  if (statusFilter) {
    apps = apps.filter((a) => a.status === statusFilter);
  }
  res.json({ success: true, data: apps, total: apps.length });
});

/** 查看單一申請 */
applicationAdminRouter.get('/applications/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const app = getApplicationById(id);
  if (!app) {
    res.status(404).json({ success: false, message: `找不到申請 id=${id}` });
    return;
  }
  res.json({ success: true, data: app });
});

/** 推播審核結果給客戶 LINE */
applicationAdminRouter.post('/applications/:id/notify-customer', async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const app = getApplicationById(id);
  if (!app) {
    res.status(404).json({ success: false, message: `找不到申請 id=${id}` });
    return;
  }

  const BLUE = '#1B4F8A'; const GREEN = '#166534'; const RED = '#991B1B';
  const WHITE = '#FFFFFF'; const LIGHT = '#F0F6FF'; const BORDER = '#E2E8F0';

  const isApproved = app.status === 'approved';
  const isRejected = app.status === 'rejected';

  if (!isApproved && !isRejected) {
    res.status(400).json({ success: false, message: '只有已核准或婉拒的案件才能發送通知' });
    return;
  }

  const headerColor = isApproved ? GREEN : RED;
  const icon = isApproved ? '🎉' : '😔';
  const title = isApproved ? '恭喜！您的貸款申請已核准' : '很遺憾，您的貸款申請未通過';
  const desc = isApproved
    ? '合庫將於 3 個工作天內與您聯繫，確認後續撥款事宜，請保持電話暢通。'
    : '很抱歉此次申請未能通過審核。如有任何疑問，歡迎至鄰近合庫分行諮詢，行員將為您說明後續選項。';

  const footerButtons: unknown[] = [];
  footerButtons.push({
    type: 'button', style: isApproved ? 'secondary' : 'primary',
    color: isApproved ? undefined : BLUE, height: 'sm',
    action: { type: 'message', label: '回到主選單', text: '返回主選單' },
  });

  try {
    await lineClient.pushMessage({
      to: app.lineUserId,
      messages: [{
        type: 'flex',
        altText: `${icon} 案件 ${app.id} 審核結果：${isApproved ? '核准' : '婉拒'}`,
        contents: {
          type: 'bubble', size: 'mega',
          header: {
            type: 'box', layout: 'vertical', backgroundColor: headerColor, paddingAll: '16px',
            contents: [
              { type: 'text', text: icon, size: '3xl', align: 'center' },
              { type: 'text', text: title, weight: 'bold', size: 'sm', color: WHITE, align: 'center', margin: 'sm', wrap: true },
            ],
          },
          body: {
            type: 'box', layout: 'vertical', backgroundColor: WHITE, paddingAll: '16px', spacing: 'md',
            contents: [
              { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                { type: 'text', text: '案件編號', size: 'sm', color: '#64748B', flex: 4 },
                { type: 'text', text: app.id, size: 'sm', color: BLUE, weight: 'bold', flex: 6, wrap: true },
              ]},
              { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                { type: 'text', text: '申請人', size: 'sm', color: '#64748B', flex: 4 },
                { type: 'text', text: app.applicantName, size: 'sm', color: '#1E293B', flex: 6 },
              ]},
              { type: 'separator', margin: 'md' },
              { type: 'text', text: desc, size: 'xs', color: '#64748B', wrap: true, margin: 'md' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', backgroundColor: LIGHT, spacing: 'sm',
            borderColor: BORDER, borderWidth: '1px', paddingAll: '12px',
            contents: footerButtons,
          },
        } as unknown as Record<string, unknown>,
      } as unknown as Parameters<typeof lineClient.pushMessage>[0]['messages'][0]],
    });
    res.json({ success: true, message: '審核結果通知已發送給客戶' });
  } catch (err) {
    console.error('[admin] 客戶通知失敗:', err);
    res.status(500).json({ success: false, message: '通知發送失敗' });
  }
});

/** 更新審核狀態 */
applicationAdminRouter.patch('/applications/:id/status', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const { status } = req.body as { status: LoanApplication['status'] };
  const validStatuses: Array<LoanApplication['status']> = ['pending', 'reviewing', 'approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      message: '無效的狀態值，請使用 pending / reviewing / approved / rejected',
    });
    return;
  }
  const updated = updateApplicationStatus(id, status);
  if (!updated) {
    res.status(404).json({ success: false, message: `找不到申請 id=${id}` });
    return;
  }
  res.json({ success: true, data: updated });
});
