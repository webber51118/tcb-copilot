/**
 * INPUT: UserSession（當前狀態）、使用者輸入文字
 * OUTPUT: TransitionResult（下一狀態 + 回覆訊息）
 * POS: 核心模組，對話狀態機，控制整個對話流程的狀態轉移
 */

import { ConversationState, LoanType } from '../models/enums';
import { UserSession, TransitionResult, LineReplyMessage } from '../models/types';
import {
  parseLoanType, parseAge, parseOccupation, parseIncome,
  parsePurpose, parseTerm, parseAmount, parsePropertyAge,
  parseArea, parseParking, parseLayout, parseFloor, parseBuildingType,
} from '../utils/validators';
import {
  loanTypeQuickReply, occupationQuickReply,
  mortgagePurposeQuickReply, personalPurposeQuickReply,
  mortgageTermQuickReply, personalTermQuickReply,
  parkingQuickReply, buildingTypeQuickReply, layoutQuickReply,
} from '../utils/quickReplyHelper';

/** 產生文字回覆（含可選 Quick Reply） */
function textMsg(text: string, quickReply?: { items: import('../models/types').QuickReplyItem[] }): LineReplyMessage {
  const msg: LineReplyMessage = { type: 'text', text };
  if (quickReply) msg.quickReply = quickReply;
  return msg;
}

/** 狀態處理函數型別 */
type StateHandler = (session: UserSession, input: string) => TransitionResult;

/** IDLE → 歡迎訊息，進入選擇貸款類型 */
const handleIdle: StateHandler = (_session, _input) => ({
  nextState: ConversationState.CHOOSE_LOAN_TYPE,
  messages: [
    textMsg(
      '您好！歡迎使用合庫「個金Co-Pilot領航員」\n\n請問您想了解哪種貸款呢？',
      loanTypeQuickReply(),
    ),
  ],
});

/** 選擇貸款類型 */
const handleChooseLoanType: StateHandler = (session, input) => {
  const loanType = parseLoanType(input);
  if (!loanType) {
    return {
      nextState: ConversationState.CHOOSE_LOAN_TYPE,
      messages: [textMsg('請選擇「房屋貸款」或「信用貸款」', loanTypeQuickReply())],
    };
  }
  session.loanType = loanType;
  const label = loanType === LoanType.MORTGAGE ? '房屋貸款' : '信用貸款';
  return {
    nextState: ConversationState.COLLECT_AGE,
    messages: [textMsg(`好的，為您服務${label}！\n\n請問您的年齡是？（20~75 歲）`)],
  };
};

/** 收集年齡 */
const handleCollectAge: StateHandler = (session, input) => {
  const age = parseAge(input);
  if (age === null) {
    return {
      nextState: ConversationState.COLLECT_AGE,
      messages: [textMsg('請輸入有效的年齡（20~75 歲）')],
    };
  }
  session.basicInfo.age = age;
  return {
    nextState: ConversationState.COLLECT_OCCUPATION,
    messages: [textMsg('請問您的職業是？', occupationQuickReply())],
  };
};

/** 收集職業 */
const handleCollectOccupation: StateHandler = (session, input) => {
  const occupation = parseOccupation(input);
  if (occupation === null) {
    return {
      nextState: ConversationState.COLLECT_OCCUPATION,
      messages: [textMsg('請從以下選項中選擇您的職業', occupationQuickReply())],
    };
  }
  session.basicInfo.occupation = occupation;
  return {
    nextState: ConversationState.COLLECT_INCOME,
    messages: [textMsg('請問您的月收入大約多少？\n（可輸入如：5萬、3.5萬、50000）')],
  };
};

/** 收集月收入 */
const handleCollectIncome: StateHandler = (session, input) => {
  const income = parseIncome(input);
  if (income === null) {
    return {
      nextState: ConversationState.COLLECT_INCOME,
      messages: [textMsg('請輸入有效的月收入（至少 1 萬元）\n例如：5萬、35000')],
    };
  }
  session.basicInfo.income = income;
  const qr = session.loanType === LoanType.MORTGAGE
    ? mortgagePurposeQuickReply()
    : personalPurposeQuickReply();
  return {
    nextState: ConversationState.COLLECT_PURPOSE,
    messages: [textMsg('請問您的貸款用途是？', qr)],
  };
};

/** 收集貸款用途 */
const handleCollectPurpose: StateHandler = (session, input) => {
  const purpose = parsePurpose(input);
  if (purpose === null) {
    return {
      nextState: ConversationState.COLLECT_PURPOSE,
      messages: [textMsg('請輸入貸款用途')],
    };
  }
  session.basicInfo.purpose = purpose;
  const qr = session.loanType === LoanType.MORTGAGE
    ? mortgageTermQuickReply()
    : personalTermQuickReply();
  return {
    nextState: ConversationState.COLLECT_TERM,
    messages: [textMsg('請問您希望的貸款年限？', qr)],
  };
};

/** 收集貸款年限 */
const handleCollectTerm: StateHandler = (session, input) => {
  const term = parseTerm(input);
  if (term === null) {
    return {
      nextState: ConversationState.COLLECT_TERM,
      messages: [textMsg('請輸入有效的貸款年限（1~40 年）')],
    };
  }
  session.basicInfo.termYears = term;
  const hint = session.loanType === LoanType.MORTGAGE
    ? '請問您希望的貸款金額？\n（例如：800萬、5000000）'
    : '請問您希望的貸款金額？\n（例如：50萬、500000）';
  return {
    nextState: ConversationState.COLLECT_AMOUNT,
    messages: [textMsg(hint)],
  };
};

/** 收集貸款金額 */
const handleCollectAmount: StateHandler = (session, input) => {
  const amount = parseAmount(input);
  if (amount === null) {
    return {
      nextState: ConversationState.COLLECT_AMOUNT,
      messages: [textMsg('請輸入有效的貸款金額（至少 10 萬元）\n例如：500萬、1500000')],
    };
  }
  session.basicInfo.amount = amount;

  // 信貸：基本資訊收集完畢，進入推薦
  if (session.loanType === LoanType.PERSONAL) {
    return {
      nextState: ConversationState.RECOMMEND,
      messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
    };
  }

  // 房貸：繼續收集標的物資訊
  return {
    nextState: ConversationState.COLLECT_PROPERTY_AGE,
    messages: [textMsg('接下來需要了解房屋標的物資訊。\n\n請問房屋屋齡大約幾年？（0~60 年）')],
  };
};

/** 收集屋齡 */
const handleCollectPropertyAge: StateHandler = (session, input) => {
  const propertyAge = parsePropertyAge(input);
  if (propertyAge === null) {
    return {
      nextState: ConversationState.COLLECT_PROPERTY_AGE,
      messages: [textMsg('請輸入有效的屋齡（0~60 年）')],
    };
  }
  session.propertyInfo.propertyAge = propertyAge;
  return {
    nextState: ConversationState.COLLECT_AREA,
    messages: [textMsg('請問房屋坪數？（1~200 坪）')],
  };
};

/** 收集坪數 */
const handleCollectArea: StateHandler = (session, input) => {
  const area = parseArea(input);
  if (area === null) {
    return {
      nextState: ConversationState.COLLECT_AREA,
      messages: [textMsg('請輸入有效的坪數（1~200 坪）')],
    };
  }
  session.propertyInfo.areaPing = area;
  return {
    nextState: ConversationState.COLLECT_PARKING,
    messages: [textMsg('請問是否有車位？', parkingQuickReply())],
  };
};

/** 收集車位 */
const handleCollectParking: StateHandler = (session, input) => {
  const parking = parseParking(input);
  if (parking === null) {
    return {
      nextState: ConversationState.COLLECT_PARKING,
      messages: [textMsg('請回答「有」或「無」', parkingQuickReply())],
    };
  }
  session.propertyInfo.hasParking = parking;
  return {
    nextState: ConversationState.COLLECT_LAYOUT,
    messages: [textMsg('請問房屋格局？', layoutQuickReply())],
  };
};

/** 收集格局 */
const handleCollectLayout: StateHandler = (session, input) => {
  const layout = parseLayout(input);
  if (layout === null) {
    return {
      nextState: ConversationState.COLLECT_LAYOUT,
      messages: [textMsg('請輸入房屋格局（如：3房2廳2衛）', layoutQuickReply())],
    };
  }
  session.propertyInfo.layout = layout;
  return {
    nextState: ConversationState.COLLECT_FLOOR,
    messages: [textMsg('請問所在樓層？（1~99 樓）')],
  };
};

/** 收集樓層 */
const handleCollectFloor: StateHandler = (session, input) => {
  const floor = parseFloor(input);
  if (floor === null) {
    return {
      nextState: ConversationState.COLLECT_FLOOR,
      messages: [textMsg('請輸入有效的樓層數（1~99）')],
    };
  }
  session.propertyInfo.floor = floor;
  return {
    nextState: ConversationState.COLLECT_BUILDING_TYPE,
    messages: [textMsg('請問建物類型？', buildingTypeQuickReply())],
  };
};

/** 收集建物類型 */
const handleCollectBuildingType: StateHandler = (session, input) => {
  const buildingType = parseBuildingType(input);
  if (buildingType === null) {
    return {
      nextState: ConversationState.COLLECT_BUILDING_TYPE,
      messages: [textMsg('請選擇建物類型', buildingTypeQuickReply())],
    };
  }
  session.propertyInfo.buildingType = buildingType;
  return {
    nextState: ConversationState.RECOMMEND,
    messages: [textMsg('資料收集完成！正在為您分析最適合的貸款方案...')],
  };
};

/**
 * RECOMMEND 狀態：保持不動，等待外層 conversationHandler 產生推薦結果。
 * 外層在處理完推薦後應呼叫 resetSession() 將狀態歸零。
 */
const handleRecommend: StateHandler = (_session, _input) => ({
  nextState: ConversationState.RECOMMEND,
  messages: [textMsg('系統正在處理中，請稍候...')],
});

/** 狀態處理函數對照表 */
const stateHandlers: Record<ConversationState, StateHandler> = {
  [ConversationState.IDLE]: handleIdle,
  [ConversationState.CHOOSE_LOAN_TYPE]: handleChooseLoanType,
  [ConversationState.COLLECT_AGE]: handleCollectAge,
  [ConversationState.COLLECT_OCCUPATION]: handleCollectOccupation,
  [ConversationState.COLLECT_INCOME]: handleCollectIncome,
  [ConversationState.COLLECT_PURPOSE]: handleCollectPurpose,
  [ConversationState.COLLECT_TERM]: handleCollectTerm,
  [ConversationState.COLLECT_AMOUNT]: handleCollectAmount,
  [ConversationState.COLLECT_PROPERTY_AGE]: handleCollectPropertyAge,
  [ConversationState.COLLECT_AREA]: handleCollectArea,
  [ConversationState.COLLECT_PARKING]: handleCollectParking,
  [ConversationState.COLLECT_LAYOUT]: handleCollectLayout,
  [ConversationState.COLLECT_FLOOR]: handleCollectFloor,
  [ConversationState.COLLECT_BUILDING_TYPE]: handleCollectBuildingType,
  [ConversationState.RECOMMEND]: handleRecommend,
};

/** 執行狀態轉移 */
export function transition(session: UserSession, input: string): TransitionResult {
  const handler = stateHandlers[session.state];
  return handler(session, input);
}
