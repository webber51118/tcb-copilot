/**
 * INPUT: Admin API Key（行員輸入）
 * OUTPUT: 導向 /admin/cases
 * POS: 後台登入頁
 */

import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    const ok = await login(key.trim());
    setLoading(false);
    if (ok) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      setError('API Key 錯誤或伺服器無回應，請確認後重試');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F2035] to-[#1B4F8A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <span className="text-3xl">🏦</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight">個金 Co-Pilot</h1>
          <p className="text-blue-200 text-sm mt-1">行員後台管理系統</p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl p-8 space-y-5"
        >
          <div>
            <h2 className="text-gray-800 text-lg font-bold mb-1">行員登入</h2>
            <p className="text-gray-400 text-xs">請輸入後台管理 API Key 以繼續</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Admin API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="請輸入 API Key"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800
                         focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] focus:border-transparent
                         placeholder-gray-300"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="w-full py-3 rounded-xl bg-[#1B4F8A] text-white font-bold text-sm
                       hover:bg-[#163F70] active:scale-95 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                驗證中…
              </span>
            ) : '登入後台'}
          </button>

          <p className="text-center text-xs text-gray-300">
            API Key 設定於伺服器 .env 的 ADMIN_API_KEY
          </p>
        </form>

        <p className="text-center text-blue-300/50 text-xs mt-6">
          合作金庫商業銀行 © 2025
        </p>
      </div>
    </div>
  );
}
