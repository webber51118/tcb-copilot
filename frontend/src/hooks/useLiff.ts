import { useState, useEffect } from 'react';
import { initLiff, getLiffProfile, getLiffQuery } from '../services/liff';

interface LiffState {
  isReady: boolean;
  profile: { displayName: string; userId: string } | null;
  query: Record<string, string>;
}

/** LIFF 初始化狀態與用戶資訊（包含自動 init） */
export function useLiff(): LiffState {
  const [state, setState] = useState<LiffState>({
    isReady: false,
    profile: null,
    query: {},
  });

  useEffect(() => {
    async function load() {
      // 確保 LIFF 初始化完成再取用戶資訊（initLiff 內含重複執行保護）
      await initLiff().catch((err) => console.warn('[LIFF] 初始化失敗:', err));
      const [profile, query] = await Promise.all([
        getLiffProfile(),
        Promise.resolve(getLiffQuery()),
      ]);
      setState({ isReady: true, profile, query });
    }
    load();
  }, []);

  return state;
}
