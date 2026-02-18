/**
 * LIFF SDK 封裝
 */

declare const liff: any;

let initialized = false;

/** 初始化 LIFF SDK */
export async function initLiff(): Promise<void> {
  if (initialized) return;
  const liffId = import.meta.env.VITE_LIFF_ID;
  if (!liffId || liffId === 'your_liff_id_here') {
    console.warn('[LIFF] LIFF_ID 未設定，跳過初始化（開發模式）');
    initialized = true;
    return;
  }
  await liff.init({ liffId });
  initialized = true;
}

/** 取得 LINE 用戶資訊（需登入） */
export async function getLiffProfile(): Promise<{ displayName: string; userId: string } | null> {
  try {
    if (!liff.isLoggedIn()) return null;
    return await liff.getProfile();
  } catch {
    return null;
  }
}

/** 關閉 LIFF 視窗 */
export function closeLiff(): void {
  try {
    liff.closeWindow();
  } catch {
    window.close();
  }
}

/** 分享訊息至 LINE（圖片 URL） */
export async function shareToLine(imageUrl: string, text: string): Promise<void> {
  try {
    await liff.shareTargetPicker([
      { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl },
      { type: 'text', text },
    ]);
  } catch {
    // 非 LINE 環境：複製連結
    await navigator.clipboard.writeText(text);
  }
}

/** 取得 URL 查詢參數 */
export function getLiffQuery(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((v, k) => { result[k] = v; });
  return result;
}
