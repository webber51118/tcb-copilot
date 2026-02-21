/**
 * INPUT:  POST /api/valuate（JSON body，camelCase）
 * OUTPUT: { success: true, data: ValuationResult } 或錯誤訊息
 * POS:    API 路由層 — 鑑價引擎代理端點
 */

import { Router, Request, Response } from 'express';
import { callValuationEngine } from '../services/valuationClient';
import { ValuationRequest } from '../models/types';

export const valuateRouter = Router();

valuateRouter.post('/valuate', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<ValuationRequest>;

  // 基本欄位驗證（詳細驗證由 Python Pydantic 處理）
  const required: (keyof ValuationRequest)[] = [
    'areaPing', 'propertyAge', 'buildingType', 'floor',
    'hasParking', 'layout', 'region', 'loanAmount',
  ];

  const missing = required.filter((k) => body[k] === undefined || body[k] === null);
  if (missing.length > 0) {
    res.status(400).json({
      success: false,
      message: `缺少必要欄位：${missing.join(', ')}`,
    });
    return;
  }

  try {
    const result = await callValuationEngine(body as ValuationRequest);
    res.json({ success: true, data: result });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;

    if (error.code === 'VALUATION_SERVICE_UNAVAILABLE') {
      res.status(503).json({
        success: false,
        message: '鑑價引擎暫時離線，請確認 Python 服務（port 8001）已啟動',
      });
      return;
    }

    console.error('[valuate] 鑑價失敗：', error.message);
    res.status(500).json({
      success: false,
      message: error.message || '鑑價計算發生未預期錯誤',
    });
  }
});
