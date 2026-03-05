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

  const hasImage = !!body.imageBase64;

  // 必填驗證：有圖片時只需 layout/hasParking/loanAmount；無圖片時需全部欄位
  if (!body.layout) {
    res.status(400).json({ success: false, message: '缺少必填欄位：layout' });
    return;
  }
  if (body.hasParking === undefined || body.hasParking === null) {
    res.status(400).json({ success: false, message: '缺少必填欄位：hasParking' });
    return;
  }
  if (!body.loanAmount) {
    res.status(400).json({ success: false, message: '缺少必填欄位：loanAmount' });
    return;
  }
  if (!hasImage) {
    const manualRequired = ['region', 'buildingType', 'areaPing', 'propertyAge', 'floor'] as const;
    for (const field of manualRequired) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        res.status(400).json({ success: false, message: `缺少必填欄位：${field}` });
        return;
      }
    }
  }

  // Step 1：若有圖片則解析謄本，解析結果直接用於鑑價
  let parsed = null;
  let parseSuccess = false;

  // 先以 body 值初始化（無圖片時使用）
  let valuationReq: ValuationRequest = {
    areaPing:    Number(body.areaPing),
    propertyAge: Number(body.propertyAge),
    buildingType: body.buildingType,
    floor:       Number(body.floor),
    hasParking:  Boolean(body.hasParking),
    layout:      body.layout,
    region:      body.region,
    loanAmount:  Number(body.loanAmount),
  };

  if (hasImage) {
    try {
      const parseResult = await parseLandRegistryDoc(body.imageBase64!);
      if (parseResult.success && parseResult.landRegistry) {
        parsed = parseResult.landRegistry;
        parseSuccess = true;
        const lr = parseResult.landRegistry;
        // 以 AI 解析值覆蓋鑑價參數
        valuationReq = {
          region:      lr.region      || body.region      || '台北市',
          buildingType: lr.buildingType || body.buildingType || '大樓',
          areaPing:    lr.areaPing    ?? Number(body.areaPing)    ?? 30,
          propertyAge: lr.propertyAge ?? Number(body.propertyAge) ?? 10,
          floor:       lr.floor       ?? Number(body.floor)       ?? 5,
          hasParking:  Boolean(body.hasParking),
          layout:      body.layout,
          loanAmount:  Number(body.loanAmount),
        };
      } else {
        // 解析失敗 → 回傳錯誤，請使用者手動填寫
        res.status(400).json({ success: false, message: '謄本解析失敗，請略過圖片並手動填寫物件資訊' });
        return;
      }
    } catch (err) {
      console.error('[autoValuate] 謄本解析錯誤:', err);
      res.status(400).json({ success: false, message: '謄本解析發生錯誤，請略過圖片並手動填寫' });
      return;
    }
  }

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
