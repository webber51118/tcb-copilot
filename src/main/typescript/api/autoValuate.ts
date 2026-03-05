/**
 * INPUT:  imageBase64（可選）+ region, buildingType, areaPing, propertyAge, floor, layout, hasParking, loanAmount
 * OUTPUT: { success, data: { parsed, parseSuccess, valuation } }
 * POS:    API 層 — AI 自動鑑價端點（不需 LINE token）
 */

import { Router, Request, Response } from 'express';
import { parseLandRegistryDoc } from '../services/documentParser';
import { callValuationEngine } from '../services/valuationClient';
import { ValuationRequest } from '../models/types';

export const autoValuateRouter = Router();

interface AutoValuateBody {
  imageBase64?: string | null;
  region: string;
  buildingType: string;
  areaPing: number;
  propertyAge: number;
  floor: number;
  layout: string;
  hasParking: boolean;
  loanAmount: number;
}

autoValuateRouter.post('/auto-valuate', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as AutoValuateBody;

  // 必填欄位驗證
  const required = ['region', 'buildingType', 'areaPing', 'propertyAge', 'floor', 'layout', 'loanAmount'] as const;
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      res.status(400).json({ success: false, message: `缺少必填欄位：${field}` });
      return;
    }
  }
  if (body.hasParking === undefined || body.hasParking === null) {
    res.status(400).json({ success: false, message: '缺少必填欄位：hasParking' });
    return;
  }

  // Step 1：若有圖片則解析謄本（僅供前端顯示，不用於鑑價計算）
  let parsed = null;
  let parseSuccess = false;

  if (body.imageBase64) {
    try {
      const parseResult = await parseLandRegistryDoc(body.imageBase64);
      if (parseResult.success && parseResult.landRegistry) {
        parsed = parseResult.landRegistry;
        parseSuccess = true;
      }
    } catch (err) {
      console.error('[autoValuate] 謄本解析失敗（繼續鑑價）:', err);
    }
  }

  // Step 2：用 Step 2 確認值（非 AI 解析值）呼叫鑑價引擎
  const valuationReq: ValuationRequest = {
    areaPing:    Number(body.areaPing),
    propertyAge: Number(body.propertyAge),
    buildingType: body.buildingType,
    floor:       Number(body.floor),
    hasParking:  Boolean(body.hasParking),
    layout:      body.layout,
    region:      body.region,
    loanAmount:  Number(body.loanAmount),
  };

  try {
    const valuation = await callValuationEngine(valuationReq);
    res.json({
      success: true,
      data: { parsed, parseSuccess, valuation },
    });
  } catch (err: any) {
    if (err?.code === 'VALUATION_SERVICE_UNAVAILABLE') {
      res.status(503).json({ success: false, message: '鑑價引擎暫時離線，請稍後再試' });
      return;
    }
    console.error('[autoValuate] 鑑價引擎錯誤:', err);
    res.status(500).json({ success: false, message: '鑑價計算發生錯誤' });
  }
});
