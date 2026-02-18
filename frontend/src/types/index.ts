/**
 * 前端型別定義 — 與後端 ProductDefinition 對應
 */

export type LoanType = 'mortgage' | 'personal' | 'reverse_annuity';

export type OccupationType = '軍人' | '公務員' | '教師' | '上班族' | '自營商' | '其他';

export interface RecommendedProduct {
  id: string;
  name: string;
  rank: number;
  rateRange: string;
  rateValue: number;
  maxAmount: number;
  maxTermYears: number;
  gracePeriodYears?: number;
  features: string[];
  savingsHighlight: string;
  monthlyPayment?: number;
  crossSell?: {
    insurance?: { name: string; price: string };
    creditCard?: { name: string; cashback: string; fee: string };
  };
}

export interface Promotion {
  id: string;
  name: string;
  holiday: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  type: 'overlay' | 'standalone';
  targetProducts?: string[];
  bonusDescription?: string;
  bonusRateReduction?: number;
  bonusFeatures?: string[];
  standalone?: {
    loanType: LoanType;
    rateRange: string;
    rateValue: number;
    maxAmount: number;
    maxTermYears: number;
    features: string[];
    savingsHighlight: string;
  };
}

export interface RecommendRequest {
  loanType: LoanType;
  age: number;
  occupation: OccupationType | '';
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
}

export interface RecommendResponse {
  primary: RecommendedProduct;
  alternatives: RecommendedProduct[];
  activePromotions: Promotion[];
}

/** 步驟式表單收集的資料（前端狀態） */
export interface ApplicationFormData {
  loanType: LoanType | null;
  age: number | null;
  occupation: OccupationType | '';
  income: number | null;
  purpose: string;
  termYears: number | null;
  amount: number | null;
  propertyAge: number | null;
  areaPing: number | null;
  hasParking: boolean | null;
  layout: string;
  floor: number | null;
  buildingType: string;
}

export const INITIAL_FORM_DATA: ApplicationFormData = {
  loanType: null,
  age: null,
  occupation: '',
  income: null,
  purpose: '',
  termYears: null,
  amount: null,
  propertyAge: null,
  areaPing: null,
  hasParking: null,
  layout: '',
  floor: null,
  buildingType: '',
};
