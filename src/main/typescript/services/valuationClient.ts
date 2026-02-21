/**
 * INPUT:  ValuationRequest（camelCase）
 * OUTPUT: ValuationResult（camelCase）
 * POS:    服務層 — Node.js ↔ Python 鑑價引擎橋接器
 *
 * 負責：
 *   1. camelCase → snake_case（傳給 Python FastAPI）
 *   2. snake_case → camelCase（Python 回傳轉換）
 *   3. 優雅降級：Python 服務下線時回 503
 */

import { ValuationRequest, ValuationResult } from '../models/types';

const VALUATION_API_URL = process.env.VALUATION_API_URL || 'http://localhost:8001';
const VALUATE_ENDPOINT  = `${VALUATION_API_URL}/valuate`;

/** camelCase → snake_case 轉換（傳給 Python） */
function toSnakeCase(req: ValuationRequest): Record<string, unknown> {
  return {
    area_ping:     req.areaPing,
    property_age:  req.propertyAge,
    building_type: req.buildingType,
    floor:         req.floor,
    has_parking:   req.hasParking,
    layout:        req.layout,
    region:        req.region,
    loan_amount:   req.loanAmount,
  };
}

/** snake_case → camelCase 轉換（Python 回傳） */
function toCamelCase(raw: Record<string, unknown>): ValuationResult {
  const ci = raw.confidence_interval as Record<string, number>;
  const breakdown = raw.breakdown as Record<string, number>;

  return {
    estimatedValue:     raw.estimated_value as number,
    confidenceInterval: {
      p5:  ci.p5,
      p50: ci.p50,
      p95: ci.p95,
    },
    ltvRatio:      raw.ltv_ratio      as number,
    riskLevel:     raw.risk_level     as ValuationResult['riskLevel'],
    lstmIndex:     raw.lstm_index     as number,
    sentimentScore: raw.sentiment_score as number,
    baseValue:     raw.base_value     as number,
    breakdown,
    mode:          raw.mode           as ValuationResult['mode'],
    region:        raw.region         as string,
    buildingType:  raw.building_type  as string,
  };
}

/**
 * 呼叫 Python 鑑價引擎
 *
 * @param request  鑑價請求（camelCase）
 * @returns        ValuationResult（camelCase）
 * @throws         503 當 Python 服務不可用
 */
export async function callValuationEngine(request: ValuationRequest): Promise<ValuationResult> {
  let response: Response;

  try {
    response = await fetch(VALUATE_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(toSnakeCase(request)),
    });
  } catch (err) {
    // Python 服務下線或網路錯誤 → 優雅降級
    const error = new Error('鑑價引擎暫時無法連線，請稍後再試');
    (error as NodeJS.ErrnoException).code = 'VALUATION_SERVICE_UNAVAILABLE';
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`鑑價引擎回傳錯誤 ${response.status}：${body}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return toCamelCase(raw);
}
