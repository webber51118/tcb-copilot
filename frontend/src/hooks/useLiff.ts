import { useState, useEffect } from 'react';
import { getLiffProfile, getLiffQuery } from '../services/liff';

interface LiffState {
  isReady: boolean;
  profile: { displayName: string; userId: string } | null;
  query: Record<string, string>;
}

/** LIFF 初始化狀態與用戶資訊 */
export function useLiff(): LiffState {
  const [state, setState] = useState<LiffState>({
    isReady: false,
    profile: null,
    query: {},
  });

  useEffect(() => {
    async function load() {
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
