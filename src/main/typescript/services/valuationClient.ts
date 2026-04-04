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

import { ValuationRequest, ValuationResult, XGBoostValuationRequest, XGBoostValuationResult } from '../models/types';

const VALUATION_API_URL  = process.env.VALUATION_API_URL || 'http://localhost:8001';
const VALUATE_ENDPOINT   = `${VALUATION_API_URL}/valuate`;
const XGBOOST_ENDPOINT   = `${VALUATION_API_URL}/valuate/xgboost`;
const XGBOOST_EXPLAIN_ENDPOINT = `${VALUATION_API_URL}/valuate/xgboost/explain`;

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


/** XGBoost snake_case → camelCase 轉換 */
function fromXGBoostSnakeCase(raw: Record<string, unknown>): XGBoostValuationResult {
  const ci = raw.confidence_interval as Record<string, number>;
  return {
    estimatedValue:     raw.estimated_value  as number,
    confidenceInterval: { p5: ci.p5, p50: ci.p50, p95: ci.p95 },
    ltvRatio:           raw.ltv_ratio        as number,
    riskLevel:          raw.risk_level       as XGBoostValuationResult['riskLevel'],
    pricePerPing:       raw.price_per_ping   as number,
    model:              (raw.model ?? 'xgboost') as XGBoostValuationResult['model'],
  };
}

/** XGBoost camelCase → snake_case 轉換（傳給 Python） */
function toXGBoostSnakeCase(req: XGBoostValuationRequest): Record<string, unknown> {
  return {
    district:      req.district,
    building_type: req.buildingType,
    area_ping:     req.areaPing,
    property_age:  req.propertyAge,
    floor:         req.floor,
    total_floors:  req.totalFloors,
    has_parking:   req.hasParking,
    rooms:         req.rooms,
    loan_amount:   req.loanAmount,
  };
}

/**
 * 呼叫 XGBoost 個別物件鑑價引擎
 *
 * @param request  XGBoost 鑑價請求（camelCase）
 * @returns        XGBoostValuationResult（camelCase）
 * @throws         503 當 Python 服務不可用或模型尚未訓練
 */
export async function callXGBoostValuate(request: XGBoostValuationRequest): Promise<XGBoostValuationResult> {
  let response: Response;

  try {
    response = await fetch(XGBOOST_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(toXGBoostSnakeCase(request)),
    });
  } catch (err) {
    const error = new Error('XGBoost 鑑價引擎暫時無法連線，請稍後再試');
    (error as NodeJS.ErrnoException).code = 'VALUATION_SERVICE_UNAVAILABLE';
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`XGBoost 鑑價引擎回傳錯誤 ${response.status}：${body}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return fromXGBoostSnakeCase(raw);
}


export interface XGBoostExplainRequest {
  district:       string;
  buildingType:   string;
  areaPing:       number;
  propertyAge:    number;
  floor:          number;
  pricePerPing:   number;
  estimatedValue: number;
  ltvRatio:       number;
  riskLevel:      string;
  loanAmount:     number;
}

/**
 * 呼叫 Gemma 4 產生 XGBoost 估價白話說明
 * 失敗時回傳空字串，不拋例外
 */
export async function callXGBoostExplain(request: XGBoostExplainRequest): Promise<string> {
  try {
    const response = await fetch(XGBOOST_EXPLAIN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        district:        request.district,
        building_type:   request.buildingType,
        area_ping:       request.areaPing,
        property_age:    request.propertyAge,
        floor:           request.floor,
        price_per_ping:  request.pricePerPing,
        estimated_value: request.estimatedValue,
        ltv_ratio:       request.ltvRatio,
        risk_level:      request.riskLevel,
        loan_amount:     request.loanAmount,
      }),
    });
    if (!response.ok) return '';
    const data = (await response.json()) as { explanation?: string };
    return data.explanation ?? '';
  } catch {
    return '';
  }
}
