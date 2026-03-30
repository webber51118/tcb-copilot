/**
 * AdminDashboardPage — 行員儀表板首頁
 * 顯示 KPI 卡片、申請趨勢圖、AI Crew 狀態、最近案件
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// ── 型別 ─────────────────────────────────────────────────────────────

interface LoanApplication {
  id: string;
  applicantName: string;
  loanType: string;
  basicInfo: { amount: number | null };
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  appliedAt: string;
}

// ── Crew 設定 ─────────────────────────────────────────────────────────

const CREWS = [
  { id: 1, name: '5P 徵審', icon: '🔍', color: '#1B4F8A' },
  { id: 2, name: 'ML 鑑估', icon: '🏠', color: '#7C3AED' },
  { id: 3, name: 'RAG 法規', icon: '📚', color: '#0891B2' },
  { id: 4, name: '審議小組', icon: '⚖️', color: '#D97706' },
  { id: 5, name: '文件解析', icon: '📄', color: '#059669' },
  { id: 6, name: '產品推薦', icon: '💡', color: '#DB2777' },
  { id: 7, name: '防詐領航', icon: '🛡️', color: '#DC2626' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: '待審核', reviewing: '審核中', approved: '已核准', rejected: '已婉拒',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};
const LOAN_TYPE_LABEL: Record<string, string> = {
  mortgage: '🏠 房貸', reverse_annuity: '🌸 以房養老', personal: '💳 信貸',
};

const PIE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'];

// ── KPI 卡片 ──────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bgColor: string;
  icon: string;
  trend?: string;
}

function KpiCard({ label, value, sub, color, bgColor, icon, trend }: KpiCardProps) {
  return (
    <div className={`${bgColor} rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 ${color}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className={`text-4xl font-black ${color}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${color} opacity-70`}>{sub}</p>}
      </div>
      <p className={`text-xs font-semibold ${color} opacity-80`}>{label}</p>
    </div>
  );
}

// ── 自訂 Tooltip ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-bold text-gray-600 mb-1">{label}</p>
        <p className="text-[#1B4F8A] font-black">{payload[0].value} 件</p>
      </div>
    );
  }
  return null;
}

// ── 主元件 ────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { apiKey } = useAdminAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) { navigate('/admin', { replace: true }); return; }
    fetch('/api/admin/applications', { headers: { 'x-admin-api-key': apiKey } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setCases(d.data as LoanApplication[]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [apiKey, navigate]);

  // ── 計算 KPI ──────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = cases.length;
    const pending = cases.filter((c) => c.status === 'pending').length;
    const reviewing = cases.filter((c) => c.status === 'reviewing').length;
    const approved = cases.filter((c) => c.status === 'approved').length;
    const rejected = cases.filter((c) => c.status === 'rejected').length;
    const rate = total > 0 ? Math.round((approved / (approved + rejected || 1)) * 100) : 0;
    // 今日新增
    const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
    const todayCount = cases.filter((c) => {
      const d = new Date(c.appliedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
      return d === today;
    }).length;
    return { total, pending, reviewing, approved, rejected, rate, todayCount };
  }, [cases]);

  // ── 近 7 天趨勢 ───────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dateStr = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
      const count = cases.filter((c) => {
        const cd = new Date(c.appliedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
        return cd === dateStr;
      }).length;
      days.push({ date: label, count });
    }
    return days;
  }, [cases]);

  // ── 狀態分佈 ──────────────────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: '待審核', value: kpi.pending },
    { name: '審核中', value: kpi.reviewing },
    { name: '已核准', value: kpi.approved },
    { name: '已婉拒', value: kpi.rejected },
  ].filter((d) => d.value > 0), [kpi]);

  // ── 最近 5 筆案件 ─────────────────────────────────────────────────
  const recentCases = useMemo(() =>
    [...cases]
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
      .slice(0, 5),
    [cases]
  );

  // ── Crew 模擬狀態（基於案件數量） ─────────────────────────────────
  const crewStats = useMemo(() => CREWS.map((crew) => ({
    ...crew,
    todayCount: Math.floor(kpi.total * 0.6 + crew.id * 2),
    avgMs: 300 + crew.id * 150,
    status: kpi.reviewing > 0 ? 'running' : 'idle',
  })), [kpi.total, kpi.reviewing]);

  return (
    <AdminLayout title="儀表板">
      <div className="p-6 space-y-6">

        {/* ── 區塊 1：KPI 卡片 ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            label="總案件數"
            value={loading ? '—' : kpi.total}
            sub={`今日 +${kpi.todayCount}`}
            color="text-white"
            bgColor="bg-[#0F2035]"
            icon="📁"
            trend={`今日 +${kpi.todayCount}`}
          />
          <KpiCard
            label="待審核"
            value={loading ? '—' : kpi.pending}
            color="text-amber-800"
            bgColor="bg-amber-50"
            icon="⏳"
          />
          <KpiCard
            label="審核中"
            value={loading ? '—' : kpi.reviewing}
            color="text-indigo-700"
            bgColor="bg-indigo-50"
            icon="🔄"
          />
          <KpiCard
            label="已核准"
            value={loading ? '—' : kpi.approved}
            color="text-green-700"
            bgColor="bg-green-50"
            icon="✅"
          />
          <KpiCard
            label="核准率"
            value={loading ? '—' : `${kpi.rate}%`}
            sub={`${kpi.approved} / ${kpi.approved + kpi.rejected} 件`}
            color="text-[#B8860B]"
            bgColor="bg-yellow-50"
            icon="🏆"
          />
        </div>

        {/* ── 區塊 2：圖表列 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 折線圖 */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-4">📈 近 7 天申請趨勢</h3>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">載入中…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1B4F8A"
                    strokeWidth={2.5}
                    dot={{ fill: '#1B4F8A', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#1B4F8A' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 圓餅圖 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-4">🍩 狀態分佈</h3>
            {loading || pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
                {loading ? '載入中…' : '尚無案件'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── 區塊 3：AI Crew 狀態列 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 text-sm mb-4">🤖 AI Pilot Crew 即時狀態</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {crewStats.map((crew) => (
              <div
                key={crew.id}
                className="border border-gray-100 rounded-xl p-3 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow"
              >
                {/* 狀態指示點 */}
                <div className="relative">
                  <span className="text-2xl">{crew.icon}</span>
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      crew.status === 'running'
                        ? 'bg-orange-400 animate-pulse'
                        : 'bg-green-400'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500">Crew {crew.id}</p>
                  <p className="text-xs font-bold text-gray-700 leading-tight">{crew.name}</p>
                </div>
                <div className="w-full space-y-0.5">
                  <p className="text-[10px] text-gray-400">今日 <span className="font-bold text-gray-600">{crew.todayCount}</span> 件</p>
                  <p className="text-[10px] text-gray-400">均 <span className="font-bold text-gray-600">{crew.avgMs}</span>ms</p>
                </div>
                {/* 迷你進度條 */}
                <div className="w-full bg-gray-100 rounded-full h-1">
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (crew.todayCount / 80) * 100)}%`,
                      backgroundColor: crew.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 區塊 4：最近案件 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-700 text-sm">🕐 最近案件（最新 5 筆）</h3>
            <button
              onClick={() => navigate('/admin/cases')}
              className="text-xs text-[#1B4F8A] hover:underline font-semibold"
            >
              查看全部 →
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-300 text-sm">
              <span className="w-4 h-4 border-2 border-gray-200 border-t-[#1B4F8A] rounded-full animate-spin mr-2" />
              載入中…
            </div>
          ) : recentCases.length === 0 ? (
            <div className="text-center py-10 text-gray-300">
              <p className="text-sm">尚無案件資料</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">案件編號</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">申請人</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">類型</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400">金額</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400">狀態</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/admin/cases/${c.id}`)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#1B4F8A] font-bold">{c.id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 text-xs">{c.applicantName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{LOAN_TYPE_LABEL[c.loanType] || c.loanType}</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-gray-700">
                      {c.basicInfo.amount ? `NT$ ${Math.round(c.basicInfo.amount / 10000).toLocaleString('zh-TW')} 萬` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(c.appliedAt).toLocaleString('zh-TW', {
                        timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
