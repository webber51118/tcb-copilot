/**
 * INPUT: 無
 * OUTPUT: PRODUCT_CATALOG — 6個常設貸款產品定義
 * POS: 設定層，定義合庫個金Co-Pilot所有常設產品資料
 */

import { LoanType, OccupationType, ProductId } from '../models/enums';
import { ProductCatalog } from '../models/types';

export const PRODUCT_CATALOG: ProductCatalog = {
  mortgage: [
    {
      id: ProductId.YOUNG_SAFE_HOME,
      name: '財政部青年安心成家購屋貸款',
      rank: 1,
      rateRange: '2.275%',
      rateValue: 2.275,
      maxAmount: 10_000_000,
      maxTermYears: 40,
      gracePeriodYears: 5,
      eligibility: {
        isFirstHomeBuyer: true,
      },
      features: [
        '最高核貸1,000萬元',
        '最高8成核貸',
        '最長40年還款',
        '寬限期最長5年',
        '本人與配偶及未成年子女均無自有住宅',
        '活動至115年7月31日止',
      ],
      savingsHighlight: '首購族專屬房貸，利率2.275%，40年超長還款減輕月付壓力',
      crossSell: {
        insurance: { name: '合庫房貸壽險', price: '每月約NT$300起' },
        creditCard: { name: '合庫御璽卡', cashback: '房貸繳費3%回饋', fee: '年費NT$1,800' },
      },
    },
    {
      id: ProductId.MILITARY_HOUSING,
      name: '國軍輔導理財購屋貸款',
      rank: 1,
      rateRange: '2.23%',
      rateValue: 2.23,
      maxAmount: 0, // 依擔保品估值核定
      maxTermYears: 30,
      eligibility: {
        occupations: [OccupationType.MILITARY],
      },
      features: [
        '現役志願役軍官、士官、士兵專屬',
        '利率2.23%（郵儲利率浮動計息）',
        '購置住宅最長30年',
        '住宅整修最長20年',
        '第一順位抵押設定',
        '業界最優惠貸款條件',
      ],
      savingsHighlight: '軍人專屬優惠利率2.23%，比一般市場利率更有競爭力',
      crossSell: {
        insurance: { name: '軍人團體保險加值方案', price: '每月約NT$200起' },
        creditCard: { name: '合庫軍人認同卡', cashback: '軍用品消費5%回饋', fee: '免年費' },
      },
    },
    {
      id: ProductId.NEXT_LOAN,
      name: 'Next貸．幸福週轉金',
      rank: 2,
      rateRange: 'A區2.35% / B區2.40% / 其他2.45%',
      rateValue: 2.35,
      maxAmount: 0, // 依擔保品估值核定
      maxTermYears: 30,
      eligibility: {
        minAnnualIncome: 800_000,
        mortgagePurposes: ['資金週轉'],
      },
      features: [
        '年所得達80萬元以上（或借保戶年所得達120萬元以上）',
        '量化模型評估1~7級',
        'A區利率2.35%起（雙北及主要都會）',
        'B區利率2.40%起',
        '其他地區2.45%起',
        '總額度600億元',
        '受理至115年12月31日',
        '須透過個人房屋貸款申貸網站線上進件',
      ],
      savingsHighlight: '以房產週轉資金，A區利率低至2.35%，資金靈活無負擔',
      crossSell: {
        insurance: { name: '週轉金信用保險', price: '每月約NT$500起' },
        creditCard: { name: '合庫現金回饋白金卡', cashback: '一般消費2.5%回饋', fee: '年費NT$1,200' },
      },
    },
    {
      id: ProductId.REVERSE_MORTGAGE,
      name: '以房養老-幸福滿袋',
      rank: 1,
      rateRange: '分段式2.338% / 一段式2.608%',
      rateValue: 2.338,
      maxAmount: 0, // 依擔保品首次最高7成
      maxTermYears: 35,
      eligibility: {
        minAge: 60,
        isReverseAnnuity: true,
      },
      features: [
        '年滿60歲本國自然人',
        '票債信正常且具完全行為能力',
        '本人單獨所有之完整建物及基地',
        '首次核貸最高7成',
        '採平均法按月定額撥付',
        '分段式：前2年2.338%，第3年起2.638%',
        '一段式：2.608%（全期固定）',
        '最長35年',
      ],
      savingsHighlight: '將房屋轉換為每月穩定養老金，幸福安享晚年生活',
      crossSell: {
        insurance: { name: '長期照護保險', price: '每月約NT$1,500起' },
        creditCard: { name: '合庫敬老卡', cashback: '醫療消費10%回饋', fee: '免年費' },
      },
    },
  ],
  personal: [
    {
      id: ProductId.MILITARY_CIVIL,
      name: '軍公教人員優惠信用貸款',
      rank: 1,
      rateRange: '薪轉戶1.78%起 / 非薪轉戶1.88%起',
      rateValue: 1.78,
      maxAmount: 3_000_000,
      maxTermYears: 7,
      eligibility: {
        occupations: [OccupationType.MILITARY, OccupationType.CIVIL_SERVANT, OccupationType.TEACHER],
        minAnnualIncome: 300_000,
      },
      features: [
        '軍公教警消及約聘僱人員專屬',
        '年收入30萬元以上',
        '薪轉戶：前3個月最低1.78%，第4個月起1.89%',
        '非薪轉戶：前3個月最低1.88%，第4個月起1.99%',
        '有保證人：最高300萬元',
        '無保證人：最高80萬元',
        '最長7年免綁約',
        '活動至115年12月31日止',
      ],
      savingsHighlight: '軍公教人員最低1.78%優惠利率，免綁約隨時彈性還款',
      crossSell: {
        insurance: { name: '公教人員專屬意外險', price: '每年約NT$3,600起' },
        creditCard: { name: '合庫公務人員認同卡', cashback: '公費支出5%回饋', fee: '免年費' },
      },
    },
    {
      id: ProductId.ELITE_LOAN,
      name: '優職優利信用貸款',
      rank: 2,
      rateRange: '2.228%~5.758%（薪轉戶最低1.78%）',
      rateValue: 2.228,
      maxAmount: 3_000_000,
      maxTermYears: 7,
      eligibility: {
        occupations: [OccupationType.OFFICE_WORKER, OccupationType.SELF_EMPLOYED, OccupationType.OTHER],
      },
      features: [
        '上市上櫃公司或前千大企業正式員工',
        '執業專業人士（律師、醫師、會計師等）',
        '醫學中心或區域醫院員工',
        '薪轉戶前3個月最低1.78%，第4個月起1.89%',
        '一般利率2.228%起',
        '有保證人：最高300萬元',
        '無保證人：最高80萬元',
        '最長7年',
        '線上申請免等待',
      ],
      savingsHighlight: '優質職業最低利率2.228%起，線上申辦快速核貸',
      crossSell: {
        insurance: { name: '高階主管專業責任險', price: '每年約NT$5,000起' },
        creditCard: { name: '合庫商務御璽卡', cashback: '差旅及商務消費3%回饋', fee: '年費NT$2,400' },
      },
    },
  ],
};
