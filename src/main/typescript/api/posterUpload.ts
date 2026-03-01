/**
 * INPUT: base64 PNG 圖片
 * OUTPUT: 可公開存取的 HTTPS URL（有效 30 分鐘）
 * POS: API 層，提供 LIFF 海報上傳暫存服務
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const POSTER_DIR = path.join(process.cwd(), 'data', 'posters');
const TTL_MS = 30 * 60 * 1000; // 30 分鐘自動清除

if (!fs.existsSync(POSTER_DIR)) {
  fs.mkdirSync(POSTER_DIR, { recursive: true });
}

/** POST /api/poster-upload — 接收 base64 PNG，存為暫存檔，回傳 HTTPS URL */
router.post('/poster-upload', (req: Request, res: Response): void => {
  try {
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64) {
      res.status(400).json({ success: false, message: '缺少 imageBase64 欄位' });
      return;
    }

    // 移除 data URI 前綴（如 data:image/png;base64,）
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `${crypto.randomUUID()}.png`;
    const filepath = path.join(POSTER_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    // 30 分鐘後自動清除暫存檔
    setTimeout(() => {
      try { fs.unlinkSync(filepath); } catch { /* 已刪除則忽略 */ }
    }, TTL_MS);

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const imageUrl = `${baseUrl}/posters/${filename}`;

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('[poster-upload] 上傳失敗:', err);
    res.status(500).json({ success: false, message: '伺服器錯誤，請稍後再試' });
  }
});

export { router as posterUploadRouter };
