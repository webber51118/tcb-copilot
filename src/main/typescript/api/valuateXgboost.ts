/**
 * INPUT:  imageBase64（可選）+ district, buildingType, areaPing, propertyAge, floor, totalFloors, hasParking, layout, loanAmount
 * OUTPUT: { success, data: { parsed, parseSuccess, valuation: XGBoostValuationResult } }
 * POS:    API 層 — XGBoost 個別物件鑑價端點（不需 LINE token）
 *
 * 若提供 imageBase64，先以 Claude Vision 解析謄本，再呼叫 XGBoost 鑑價
 */

import { Router, Request, Response } from 'express';
import { parseLandRegistryDoc } from '../services/documentParser';
import { callXGBoostValuate } from '../services/valuationClient';
import { XGBoostValuationRequest } from '../models/types';

export const valuateXgboostRouter = Router();

interface ValuateXgboostBody {
  imageBase64?: string | null;
  district:     string;
  buildingType: string;
  areaPing:     number;
  propertyAge:  number;
  floor:        number;
  totalFloors:  number;
  hasParking:   boolean;
  layout:       string;
  loanAmount:   number;
}

valuateXgboostRouter.post('/valuate/xgboost', async (req: Request, res: Response): Promise<void> => {
  const body    = req.body as ValuateXgboostBody;
  const hasImage = !!body.imageBase64;

  // 必填驗證
  if (!body.loanAmount) {
    res.status(400).json({ success: false, message: '缺少必填欄位：loanAmount' });
    return;
  }
  if (body.hasParking === undefined || body.hasParking === null) {
    res.status(400).json({ success: false, message: '缺少必填欄位：hasParking' });
    return;
  }
  if (!hasImage) {
    const required = ['district', 'buildingType', 'areaPing', 'propertyAge', 'floor', 'totalFloors'] as const;
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        res.status(400).json({ success: false, message: `缺少必填欄位：${field}` });
        return;
      }
    }
  }

  // 從格局字串萃取房間數（例：「3房2廳1衛」→ 3）
  const rooms = parseInt(body.layout?.match(/(\d+)房/)?.[1] ?? '3', 10) || 3;

  let parsed      = null;
  let parseSuccess = false;

  let xgboostParams: XGBoostValuationRequest = {
    district:     body.district,
    buildingType: body.buildingType,
    areaPing:     Number(body.areaPing),
    propertyAge:  Number(body.propertyAge),
    floor:        Number(body.floor),
    totalFloors:  Number(body.totalFloors),
    hasParking:   Boolean(body.hasParking),
    rooms,
    loanAmount:   Number(body.loanAmount),
  };

  // Step 1：若有圖片則解析謄本，覆蓋物件參數
  if (hasImage) {
    try {
      const parseResult = await parseLandRegistryDoc(body.imageBase64!);
      if (parseResult.success && parseResult.landRegistry) {
        parsed      = parseResult.landRegistry;
        parseSuccess = true;
        const lr    = parseResult.landRegistry;

        xgboostParams = {
          district:     lr.district     || body.district     || '',
          buildingType: lr.buildingType || '大樓',
          areaPing:     lr.areaPing     || 0,
          propertyAge:  lr.propertyAge  ?? 0,
          floor:        lr.floor        || 0,
          totalFloors:  lr.totalFloors  || Number(body.totalFloors) || 0,
          hasParking:   Boolean(body.hasParking),
          rooms,
          loanAmount:   Number(body.loanAmount),
        };

        // 只驗證鑑價計算絕對必要的欄位（district 空值由 Python Demo 模式降級處理）
        const missing: string[] = [];
        if (!xgboostParams.areaPing)     missing.push('坪數');
        if (!xgboostParams.floor)        missing.push('樓層');
        if (!xgboostParams.buildingType) missing.push('建物類型');

        if (missing.length > 0) {
          res.status(400).json({
            success: false,
            message: `AI 無法從謄本辨識：${missing.join('、')}。請略過圖片並手動填寫。`,
          });
          return;
        }
      } else {
        res.status(400).json({ success: false, message: '謄本解析失敗，請略過圖片並手動填寫物件資訊' });
        return;
      }
    } catch (err) {
      console.error('[valuateXgboost] 謄本解析錯誤:', err);
      res.status(400).json({ success: false, message: '謄本解析發生錯誤，請略過圖片並手動填寫' });
      return;
    }
  }

  // Step 2：呼叫 XGBoost 鑑價引擎
  try {
    const valuation = await callXGBoostValuate(xgboostParams);
    res.json({
      success: true,
      data: { parsed, parseSuccess, valuation },
    });
  } catch (err: any) {
    if (err?.code === 'VALUATION_SERVICE_UNAVAILABLE') {
      res.status(503).json({ success: false, message: 'XGBoost 鑑價引擎暫時離線，請稍後再試' });
      return;
    }
    if (err?.message?.includes('503')) {
      res.status(503).json({ success: false, message: 'XGBoost 模型尚未訓練，請先執行 train_xgboost.py' });
      return;
    }
    console.error('[valuateXgboost] 鑑價引擎錯誤:', err);
    res.status(500).json({ success: false, message: 'XGBoost 鑑價計算發生錯誤' });
  }
});
