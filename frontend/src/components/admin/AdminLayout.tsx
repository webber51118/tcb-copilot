/**
 * AdminLayout — 後台共用側邊欄 + 頂部列
 * Props: children, title, apiKey
 */

import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: '儀表板',   icon: '📊' },
  { path: '/admin/cases',     label: '案件管理', icon: '📋' },
  { path: '/admin/rag',       label: 'RAG 法規', icon: '📚' },
  { path: '/admin/monitor',   label: '監控中心', icon: '🎯' },
];

const NAV_BOTTOM = [
  { path: '/admin/settings', label: '系統設定', icon: '⚙️' },
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { apiKey, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/admin', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── 頂部列 ── */}
      <header
        className="h-14 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 justify-between z-20 fixed top-0 left-0 right-0"
      >
        <div className="flex items-center gap-3">
          {/* 側邊欄佔位，對齊主內容 */}
          <div className="w-[220px] flex items-center gap-2.5">
            <span className="text-2xl">🏦</span>
            <div className="leading-tight">
              <p className="text-[#0F2035] font-black text-sm tracking-tight">個金 Co-Pilot</p>
              <p className="text-gray-400 text-[10px]">行員後台管理系統</p>
            </div>
          </div>
          {title && (
            <h1 className="text-gray-700 font-bold text-sm border-l border-gray-200 pl-4 ml-2">
              {title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-gray-700">行員</p>
            <p className="text-[10px] text-gray-400 font-mono">{apiKey?.slice(0, 8)}…</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200"
          >
            登出
          </button>
        </div>
      </header>

      <div className="flex flex-1 pt-14">
        {/* ── 側邊欄 ── */}
        <aside
          className="fixed top-14 left-0 bottom-0 w-[220px] bg-[#0F2035] flex flex-col z-10"
        >
          <nav className="flex-1 py-4 px-3 space-y-1">
            {NAV_ITEMS.map(({ path, label, icon }) => {
              const active = location.pathname === path ||
                (path === '/admin/cases' && location.pathname.startsWith('/admin/cases'));
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-white/10 text-white border-l-2 border-[#F5A623]'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* 分隔線 + 底部選單 */}
          <div className="px-3 py-4 border-t border-white/10 space-y-1">
            {NAV_BOTTOM.map(({ path, label, icon }) => {
              const active = location.pathname === path;
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-white/10 text-white border-l-2 border-[#F5A623]'
                      : 'text-blue-200/50 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
            <div className="px-3 py-2 text-[10px] text-blue-200/30 text-center">
              合作金庫商業銀行 © 2025
            </div>
          </div>
        </aside>

        {/* ── 主內容區 ── */}
        <main className="flex-1 ml-[220px] min-h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
