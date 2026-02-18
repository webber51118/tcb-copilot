/**
 * INPUT: HTTP Request（Admin API Key 驗證）
 * OUTPUT: 活動 CRUD 操作結果
 * POS: API 層，限時活動後台管理端點
 *
 * 路由（掛載於 /api/admin）：
 *   GET    /promotions           — 列出所有活動
 *   POST   /promotions           — 新增活動
 *   PUT    /promotions/:id       — 更新活動
 *   DELETE /promotions/:id       — 刪除活動
 *   PATCH  /promotions/:id/toggle — 啟用/停用切換
 */

import { Router, Request, Response } from 'express';
import {
  getAllPromotions, savePromotion, deletePromotion, togglePromotion,
} from '../config/promotionStore';
import { Promotion } from '../models/promotion';

export const promotionAdminRouter = Router();

/** 列出所有活動 */
promotionAdminRouter.get('/promotions', (_req: Request, res: Response) => {
  const promotions = getAllPromotions();
  res.json({ success: true, data: promotions, total: promotions.length });
});

/** 新增活動 */
promotionAdminRouter.post('/promotions', (req: Request, res: Response) => {
  const body = req.body as Partial<Promotion>;
  if (!body.id || !body.name || !body.startDate || !body.endDate || !body.type) {
    res.status(400).json({ success: false, message: '缺少必要欄位：id, name, startDate, endDate, type' });
    return;
  }
  const promotion: Promotion = {
    isActive: true,
    ...body,
  } as Promotion;
  savePromotion(promotion);
  res.status(201).json({ success: true, data: promotion });
});

/** 更新活動 */
promotionAdminRouter.put('/promotions/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const body = req.body as Partial<Promotion>;
  const existing = getAllPromotions().find((p) => p.id === id);
  if (!existing) {
    res.status(404).json({ success: false, message: `找不到活動 id=${id}` });
    return;
  }
  const updated: Promotion = { ...existing, ...body, id };
  savePromotion(updated);
  res.json({ success: true, data: updated });
});

/** 刪除活動 */
promotionAdminRouter.delete('/promotions/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const deleted = deletePromotion(id);
  if (!deleted) {
    res.status(404).json({ success: false, message: `找不到活動 id=${id}` });
    return;
  }
  res.json({ success: true, message: `活動 ${id} 已刪除` });
});

/** 啟用 / 停用切換 */
promotionAdminRouter.patch('/promotions/:id/toggle', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const updated = togglePromotion(id);
  if (!updated) {
    res.status(404).json({ success: false, message: `找不到活動 id=${id}` });
    return;
  }
  res.json({
    success: true,
    message: `活動 ${updated.name} 已${updated.isActive ? '啟用' : '停用'}`,
    data: updated,
  });
});
