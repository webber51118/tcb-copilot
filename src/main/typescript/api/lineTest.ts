import { Router } from 'express';
import { pushCobankLoanTest } from '../services/lineService';

const router = Router();

// Admin protected endpoint,請搭配 index.ts 中的 adminAuth
router.post('/line-test', async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId 欄位為必填' });
  }

  try {
    await pushCobankLoanTest(userId);
    res.json({ success: true, message: '測試訊息已發送' });
  } catch (err) {
    console.error('[lineTest] push failed', err);
    res.status(500).json({ success: false, message: '推播失敗' });
  }
});

export default router;
