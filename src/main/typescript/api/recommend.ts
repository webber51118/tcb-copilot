/**
 * INPUT: HTTP Request（申辦資訊 JSON）
 * OUTPUT: 推薦產品結果 + 進行中活動
 * POS: API 層，供 LIFF 前端呼叫的推薦端點
 *
 * 路由：
 *   POST /api/recommend      — 依申辦資訊推薦最適產品
 *   GET  /api/promotions/active — 公開取得進行中活動
 */

import { Router, Request, Response } from 'express';
import { LoanType, OccupationType } from '../models/enums';
import { UserSession, BasicInfo, PropertyInfo } from '../models/types';
import { ConversationState } from '../models/enums';
import { recommendProducts } from '../services/recommendationEngine';
import { getActivePromotions } from '../config/promotionStore';

export const recommendRouter = Router();

/** POST /api/recommend — LIFF 推薦端點 */
recommendRouter.post('/recommend', (req: Request, res: Response) => {
  const body = req.body as {
    loanType: string;
    age: number;
    occupation: string;
    income: number;
    purpose: string;
    termYears: number;
    amount: number;
    propertyInfo?: {
      propertyAge?: number;
      areaPing?: number;
      hasParking?: boolean;
      layout?: string;
      floor?: number;
      buildingType?: string;
    };
  };

  // 基本驗證
  if (!body.loanType || !body.age || !body.income || !body.termYears || !body.amount) {
    res.status(400).json({ success: false, message: '缺少必要欄位' });
    return;
  }

  // 組建 UserSession 供推薦引擎使用
  const basicInfo: BasicInfo = {
    age: body.age,
    occupation: (body.occupation as OccupationType) || null,
    income: body.income,
    purpose: body.purpose || null,
    termYears: body.termYears,
    amount: body.amount,
  };

  const propertyInfo: PropertyInfo = {
    propertyAge: body.propertyInfo?.propertyAge ?? null,
    areaPing: body.propertyInfo?.areaPing ?? null,
    hasParking: body.propertyInfo?.hasParking ?? null,
    layout: body.propertyInfo?.layout ?? null,
    floor: body.propertyInfo?.floor ?? null,
    buildingType: (body.propertyInfo?.buildingType as any) ?? null,
  };

  const session: UserSession = {
    userId: 'liff-user',
    state: ConversationState.RECOMMEND,
    loanType: body.loanType as LoanType,
    basicInfo,
    propertyInfo,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const result = recommendProducts(session);
  const activePromotions = getActivePromotions();

  res.json({
    success: true,
    data: {
      primary: result.primary,
      alternatives: result.alternatives,
      activePromotions,
    },
  });
});

/** GET /api/promotions/active — 公開取得進行中活動 */
recommendRouter.get('/promotions/active', (_req: Request, res: Response) => {
  const promotions = getActivePromotions();
  res.json({ success: true, data: promotions, total: promotions.length });
});
