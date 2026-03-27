import dotenv from 'dotenv';
dotenv.config();

import { pushCobankLoanTest } from '../services/lineService';

const userId = process.env.TEST_LINE_USER_ID;
if (!userId) {
  console.error('請在 .env 設定 TEST_LINE_USER_ID');
  process.exit(1);
}

(async () => {
  try {
    console.log('向', userId, '發送合庫速速貸測試訊息...');
    await pushCobankLoanTest(userId);
    console.log('送出成功');
  } catch (err) {
    console.error('推播失敗：', err);
    process.exit(1);
  }
})();
