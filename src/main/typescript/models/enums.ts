/**
 * INPUT: 無
 * OUTPUT: 對話狀態、貸款類型等列舉定義
 * POS: 資料模型層，定義全系統共用的列舉常數
 */

/** 對話狀態機 — 所有可能的對話階段 */
export enum ConversationState {
  /** 閒置，等待使用者開始 */
  IDLE = 'IDLE',
  /** 選擇貸款類型（房貸/信貸） */
  CHOOSE_LOAN_TYPE = 'CHOOSE_LOAN_TYPE',
  /** 展示產品介紹、試算表、申辦流程 */
  SHOW_PRODUCT_INTRO = 'SHOW_PRODUCT_INTRO',
  /** 收集年齡 */
  COLLECT_AGE = 'COLLECT_AGE',
  /** 收集職業 */
  COLLECT_OCCUPATION = 'COLLECT_OCCUPATION',
  /** 收集月收入 */
  COLLECT_INCOME = 'COLLECT_INCOME',
  /** 收集貸款用途 */
  COLLECT_PURPOSE = 'COLLECT_PURPOSE',
  /** 收集貸款年限 */
  COLLECT_TERM = 'COLLECT_TERM',
  /** 收集貸款金額 */
  COLLECT_AMOUNT = 'COLLECT_AMOUNT',
  /** 收集屋齡（房貸專用） */
  COLLECT_PROPERTY_AGE = 'COLLECT_PROPERTY_AGE',
  /** 收集坪數（房貸專用） */
  COLLECT_AREA = 'COLLECT_AREA',
  /** 收集是否有車位（房貸專用） */
  COLLECT_PARKING = 'COLLECT_PARKING',
  /** 收集格局（房貸專用） */
  COLLECT_LAYOUT = 'COLLECT_LAYOUT',
  /** 收集樓層（房貸專用） */
  COLLECT_FLOOR = 'COLLECT_FLOOR',
  /** 收集建物類型（房貸專用） */
  COLLECT_BUILDING_TYPE = 'COLLECT_BUILDING_TYPE',
  /** 產品推薦結果 */
  RECOMMEND = 'RECOMMEND',
  /** AI 推薦第一題：主要需求 */
  AI_SUGGEST_Q1 = 'AI_SUGGEST_Q1',
  /** AI 推薦第二題：有無房屋（週轉情境） */
  AI_SUGGEST_Q2 = 'AI_SUGGEST_Q2',
  /** 文件說明 + 確認（申請前置步驟） */
  PREPARE_DOCS = 'PREPARE_DOCS',
  /** 確認 MYDATA 所得資料是否備妥 */
  CONFIRM_MYDATA = 'CONFIRM_MYDATA',
  /** 確認土地建物謄本是否備妥（房貸/以房養老專用） */
  CONFIRM_LAND_REG = 'CONFIRM_LAND_REG',
  /** 顯示推薦摘要 + 確認申請 */
  CONFIRM_APPLY = 'CONFIRM_APPLY',
  /** 收集申請人姓名 */
  COLLECT_NAME = 'COLLECT_NAME',
  /** 收集聯絡電話 */
  COLLECT_PHONE = 'COLLECT_PHONE',
  /** 申請完成（顯示案件編號） */
  APPLY_DONE = 'APPLY_DONE',
  /** 等待使用者上傳文件（MYDATA / 謄本圖片）*/
  UPLOAD_DOCS = 'UPLOAD_DOCS',
  /** 文件解析完成，等待使用者確認資料正確性 */
  DOC_REVIEW = 'DOC_REVIEW',
}

/** 貸款類型 */
export enum LoanType {
  /** 房屋貸款 */
  MORTGAGE = 'mortgage',
  /** 信用貸款 */
  PERSONAL = 'personal',
  /** 以房養老（反向年金房貸） */
  REVERSE_ANNUITY = 'reverse_annuity',
}

/** 常設產品 ID */
export enum ProductId {
  /** 青年安心成家購屋貸款 */
  YOUNG_SAFE_HOME  = 'young-safe-home',
  /** 國軍輔導理財購屋貸款 */
  MILITARY_HOUSING = 'military-housing',
  /** Next貸．幸福週轉金 */
  NEXT_LOAN        = 'next-loan',
  /** 以房養老-幸福滿袋 */
  REVERSE_MORTGAGE = 'reverse-mortgage',
  /** 軍公教人員優惠信貸 */
  MILITARY_CIVIL   = 'military-civil-loan',
  /** 優職優利信用貸款 */
  ELITE_LOAN       = 'elite-loan',
}

/** 建物類型 */
export enum BuildingType {
  /** 大樓 */
  APARTMENT = '大樓',
  /** 華廈 */
  MANSION = '華廈',
  /** 公寓 */
  WALK_UP = '公寓',
  /** 透天 */
  TOWNHOUSE = '透天',
  /** 套房 */
  STUDIO = '套房',
}

/** 職業類別 */
export enum OccupationType {
  /** 軍人 */
  MILITARY = '軍人',
  /** 公務員 */
  CIVIL_SERVANT = '公務員',
  /** 教師 */
  TEACHER = '教師',
  /** 上班族 */
  OFFICE_WORKER = '上班族',
  /** 自營商 */
  SELF_EMPLOYED = '自營商',
  /** 其他 */
  OTHER = '其他',
}
