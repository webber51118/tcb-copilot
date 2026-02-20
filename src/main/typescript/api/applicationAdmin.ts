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
