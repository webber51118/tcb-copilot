/**
 * INPUT: Admin API Key（sessionStorage）
 * OUTPUT: 系統設定頁（Demo 用：顯示系統資訊與環境狀態）
 * POS: 後台系統設定頁
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import AdminLayout from '../../components/admin/AdminLayout';

interface HealthData {
  status: string;
  service: string;
}

export default function AdminSettingsPage() {
  const { apiKey, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState(false);

  if (!apiKey) {
    navigate('/admin', { replace: true });
    return null;
  }

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealthError(true));
  }, []);

  const CONFIG_ROWS = [
    { label: '系統名稱',    value: '個金 Co-Pilot 領航員' },
    { label: '版本',        value: 'v1.0.0 (Hackathon Demo)' },
    { label: '後端服務',    value: 'Node.js 20 + TypeScript' },
    { label: 'AI 模型',     value: 'Claude claude-sonnet-4-6 (Anthropic)' },
    { label: 'ML 鑑價',     value: 'XGBoost + Monte Carlo GBM' },
    { label: 'RAG 知識庫',  value: '三層架構（央行 / 政策 / 授信）' },
    { label: '資料庫',      value: 'JSON File Store (Demo Mode)' },
  ];

  const CREW_ROWS = [
    { id: 1, name: '5P 徵審引擎',   desc: 'Claude claude-sonnet-4-6 分析借款人風險' },
    { id: 2, name: 'ML 鑑估引擎',   desc: 'XGBoost + Monte Carlo 房屋估價' },
    { id: 3, name: 'RAG 法規引擎',  desc: '三層知識庫 × Claude 合成答案' },
    { id: 4, name: '審議小組',       desc: '多 Agent 委員會投票決議' },
    { id: 5, name: '文件解析器',     desc: '結構化資料擷取（MyData / 謄本）' },
    { id: 6, name: '產品推薦引擎',  desc: '個金產品適合度評分推薦' },
    { id: 7, name: '防詐領航員',     desc: '八項防詐查核 + LLM 行為分析' },
  ];

  return (
    <AdminLayout title="系統設定">
      <div className="p-6 space-y-6 max-w-3xl">

        <h1 className="text-gray-800 text-xl font-black">⚙️ 系統設定</h1>

        {/* 後端健康狀態 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-4">後端服務狀態</h3>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${health ? 'bg-green-400' : healthError ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
            <span className="text-sm font-semibold text-gray-700">
              {health ? `✅ 正常運作 — ${health.service}` :
               healthError ? '❌ 無法連線後端' :
               '⏳ 連線中…'}
            </span>
          </div>
        </div>

        {/* 系統資訊 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500">系統資訊</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {CONFIG_ROWS.map(({ label, value }) => (
              <div key={label} className="flex items-center px-5 py-3 gap-4">
                <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
                <span className="text-xs font-semibold text-gray-700">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Crew 設定 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500">AI Pilot Crew 配置（7 個 Agent）</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {CREW_ROWS.map(({ id, name, desc }) => (
              <div key={id} className="flex items-center px-5 py-3 gap-4">
                <span className="w-7 h-7 bg-[#0F2035] text-white text-xs font-black rounded-full flex items-center justify-center shrink-0">
                  {id}
                </span>
                <div>
                  <p className="text-xs font-bold text-gray-800">{name}</p>
                  <p className="text-[10px] text-gray-400">{desc}</p>
                </div>
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">啟用</span>
              </div>
            ))}
          </div>
        </div>

        {/* 登出區 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-1">帳號管理</h3>
          <p className="text-xs text-gray-400 mb-4">目前登入 API Key：<span className="font-mono">{apiKey.slice(0, 8)}…</span></p>
          <button
            onClick={() => { logout(); navigate('/admin', { replace: true }); }}
            className="px-5 py-2 border border-red-200 text-red-500 text-sm rounded-xl hover:bg-red-50 transition-colors"
          >
            登出後台
          </button>
        </div>

      </div>
    </AdminLayout>
  );
}
