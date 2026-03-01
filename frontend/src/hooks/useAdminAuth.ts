/**
 * INPUT: Admin API Key（使用者輸入）
 * OUTPUT: isAuth 狀態、apiKey、login/logout 方法
 * POS: Hook 層，Admin 後台身份驗證
 */

import { useState } from 'react';

const STORAGE_KEY = 'admin_api_key';

export function useAdminAuth() {
  const [apiKey, setApiKey] = useState<string>(
    () => sessionStorage.getItem(STORAGE_KEY) || '',
  );
  const [isAuth, setIsAuth] = useState<boolean>(
    () => !!sessionStorage.getItem(STORAGE_KEY),
  );

  /** 驗證 API Key（向後端發送測試請求） */
  const login = async (key: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/applications?status=pending', {
        headers: { 'x-admin-api-key': key },
      });
      if (res.ok) {
        sessionStorage.setItem(STORAGE_KEY, key);
        setApiKey(key);
        setIsAuth(true);
        return true;
      }
    } catch {
      // network error
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    setIsAuth(false);
  };

  return { apiKey, isAuth, login, logout };
}
