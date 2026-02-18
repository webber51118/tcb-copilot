/**
 * INPUT: 無
 * OUTPUT: Promotion 介面 — 限時節日活動資料結構
 * POS: 資料模型層，定義節日活動相關介面
 */

import { LoanType, ProductId } from './enums';
import { ProductEligibility } from './types';

/** 活動類型 */
export type PromotionType = 'overlay' | 'standalone';

/** 獨立活動產品定義 */
export interface StandaloneProduct {
  loanType: LoanType;
  rateRange: string;
  rateValue: number;
  maxAmount: number;
  maxTermYears: number;
  eligibility: ProductEligibility;
  features: string[];
  savingsHighlight: string;
}

/** 推播設定 */
export interface PushNotificationConfig {
  /** 推播訊息內容 */
  message: string;
  /** 排程推播時間（ISO datetime） */
  scheduledAt: string;
  /** 是否已發送 */
  sent: boolean;
}

/** 限時節日活動 */
export interface Promotion {
  /** 唯一識別碼（如 "2026-children-day"） */
  id: string;
  /** 活動名稱（如「兒童節幸福家庭貸」） */
  name: string;
  /** 節日標籤（如「兒童節」、「端午節」） */
  holiday: string;
  /** 活動開始日期（ISO date，如 "2026-04-01"） */
  startDate: string;
  /** 活動結束日期（ISO date，如 "2026-04-30"） */
  endDate: string;
  /** 是否啟用（後台可切換） */
  isActive: boolean;
  /** 活動類型 */
  type: PromotionType;

  // ── Type A：疊加現有產品優惠 ──────────────────────
  /** 適用的常設產品ID清單（overlay 類型使用） */
  targetProducts?: ProductId[];
  /** 加碼說明（如「利率再降0.1%」） */
  bonusDescription?: string;
  /** 利率折扣（負數，如 -0.1 表示降0.1%） */
  bonusRateReduction?: number;
  /** 額外優惠說明清單 */
  bonusFeatures?: string[];

  // ── Type B：獨立節日產品 ──────────────────────────
  /** 獨立活動產品定義（standalone 類型使用） */
  standalone?: StandaloneProduct;

  // ── 推播設定 ──────────────────────────────────────
  pushNotification?: PushNotificationConfig;
}
