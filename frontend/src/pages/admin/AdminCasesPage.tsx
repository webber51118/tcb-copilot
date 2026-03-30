/**
 * INPUT: Admin API Key（sessionStorage）
 * OUTPUT: 所有貸款申請案件列表（含狀態過濾、搜尋、排序）
 * POS: 後台案件列表頁
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import AdminLayout from '../../components/admin/AdminLayout';

interface BasicInfo {
  age: number | null;
  occupation: string | null;
  income: number | null;
  purpose: string | null;
  termYears: number | null;
  amount: number | null;
}

interface LoanApplication {
  id: string;
  applicantName: string;
  applicantPhone: string;
  loanType: string;
  basicInfo: BasicInfo;
  mydataReady: boolean;
  landRegistryReady: boolean | null;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  appliedAt: string;
}

type StatusFilter = 'all' | 'pending' | 'reviewing' | 'approved' | 'rejected';
type SortField = 'appliedAt' | 'amount';
type SortDir = 'asc' | 'desc';

const STATUS_LABEL: Record<string, string> = {
  pending: '待審核',
  reviewing: '徵審中',
  approved: '已核准',
  rejected: '已婉拒',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

const LOAN_TYPE_LABEL: Record<string, string> = {
  mortgage: '🏠 房屋貸款',
  reverse_annuity: '🌸 以房養老',
  personal: '💳 信用貸款',
};

function fmt(n: number | null, unit = '') {
  if (n == null) return '—';
  return `${n.toLocaleString('zh-TW')}${unit}`;
}

export default function AdminCasesPage() {
  const { apiKey } = useAdminAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('appliedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // 若未登入則跳回登入頁
  useEffect(() => {
    if (!apiKey) navigate('/admin', { replace: true });
  }, [apiKey, navigate]);

  // 載入案件列表
  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    fetch('/api/admin/applications', {
      headers: { 'x-admin-api-key': apiKey },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCases(d.data as LoanApplication[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [apiKey]);

  // 統計各狀態數量
  const counts = useMemo(() => ({
    all: cases.length,
    pending: cases.filter((c) => c.status === 'pending').length,
    reviewing: cases.filter((c) => c.status === 'reviewing').length,
    approved: cases.filter((c) => c.status === 'approved').length,
    rejected: cases.filter((c) => c.status === 'rejected').length,
  }), [cases]);

  // 搜尋 + 過濾 + 排序
  const filtered = useMemo(() => {
    let list = filter === 'all' ? cases : cases.filter((c) => c.status === filter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        c.id.toLowerCase().includes(q) ||
        (c.applicantName || '').toLowerCase().includes(q) ||
        (c.applicantPhone || '').includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      if (sortField === 'appliedAt') {
        const diff = new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
        return sortDir === 'asc' ? diff : -diff;
      } else {
        const aAmt = a.basicInfo.amount ?? 0;
        const bAmt = b.basicInfo.amount ?? 0;
        return sortDir === 'asc' ? aAmt - bAmt : bAmt - aAmt;
      }
    });

    return list;
  }, [cases, filter, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-[#1B4F8A] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <AdminLayout title="案件管理">
      <div className="p-6 space-y-5">
        {/* 頁面標題 + 統計 */}
        <div>
          <h1 className="text-gray-800 text-xl font-black mb-4">案件管理</h1>
          <div className="grid grid-cols-5 gap-3">
            {(
              [
                { key: 'all', label: '全部案件', color: 'bg-[#1B4F8A] text-white' },
                { key: 'pending', label: '待審核', color: 'bg-yellow-500 text-white' },
                { key: 'reviewing', label: '徵審中', color: 'bg-blue-500 text-white' },
                { key: 'approved', label: '已核准', color: 'bg-green-600 text-white' },
                { key: 'rejected', label: '已婉拒', color: 'bg-red-600 text-white' },
              ] as { key: StatusFilter; label: string; color: string }[]
            ).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-xl p-3 text-center transition-all border-2 ${
                  filter === key
                    ? `${color} border-transparent shadow-md scale-105`
                    : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                }`}
              >
                <div className="text-2xl font-black">{counts[key]}</div>
                <div className="text-xs mt-0.5 font-medium">{label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 搜尋欄 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋申請人姓名、電話或案件 ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A]
                         placeholder-gray-300 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm"
              >
                ✕
              </button>
            )}
          </div>
          {search && (
            <p className="text-xs text-gray-400">找到 {filtered.length} 筆結果</p>
          )}
        </div>

        {/* 案件表格 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              <span className="w-5 h-5 border-2 border-gray-200 border-t-[#1B4F8A] rounded-full animate-spin mr-2" />
              載入中…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-sm">
                {search ? `找不到「${search}」相關案件` : `目前沒有${filter === 'all' ? '' : `「${STATUS_LABEL[filter]}」的`}案件`}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 w-36">案件編號</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">申請人</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">貸款類型</th>
                  <th
                    className="text-right px-4 py-3 text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    申貸金額<SortIcon field="amount" />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-600 select-none"
                    onClick={() => toggleSort('appliedAt')}
                  >
                    申請時間<SortIcon field="appliedAt" />
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400">狀態</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/cases/${c.id}`)}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-[#1B4F8A] font-bold">
                      {c.id}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-gray-800">{c.applicantName || '—'}</div>
                      <div className="text-xs text-gray-400">{c.applicantPhone || ''}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-xs">
                      {LOAN_TYPE_LABEL[c.loanType] || c.loanType}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-800">
                      {c.basicInfo.amount
                        ? `NT$ ${fmt(Math.round(c.basicInfo.amount / 10000))} 萬`
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {new Date(c.appliedAt).toLocaleString('zh-TW', {
                        timeZone: 'Asia/Taipei',
                        month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/cases/${c.id}`); }}
                        className="text-xs text-[#1B4F8A] hover:underline font-semibold"
                      >
                        查看 →
                      </button>
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
