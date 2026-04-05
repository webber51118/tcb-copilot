import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';

// ── 型別定義 ──────────────────────────────────────────────────────────
interface AgentStatus {
  name:          string;
  status:        'online' | 'idle' | 'error';
  callsToday:    number;
  errorsToday:   number;
  lastCallAgo:   string;
  avgDurationMs: number | null;
}

interface RecentWorkflow {
  appId:     string;
  loanType:  string;
  status:    string;
  amount:    number;
  createdAt: string;
}

interface MonitorData {
  timestamp:       string;
  summary:         { totalAgents: number; onlineNow: number; totalCallsToday: number; totalErrorsToday: number };
  agents:          AgentStatus[];
  recentWorkflows: RecentWorkflow[];
}

// ── 輔助元件 ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AgentStatus['status'] }) {
  const cls =
    status === 'online' ? 'bg-green-400 animate-pulse' :
    status === 'error'  ? 'bg-red-400' : 'bg-gray-300';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function statusLabel(s: AgentStatus['status']) {
  return s === 'online' ? '運行中' : s === 'error' ? '錯誤' : '閒置';
}

function statusTextColor(s: AgentStatus['status']) {
  return s === 'online' ? 'text-green-600' : s === 'error' ? 'text-red-500' : 'text-gray-400';
}

function formatWan(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(0)} 萬` : `${n}`;
}

function workflowStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending:          'bg-yellow-100 text-yellow-700',
    reviewing:        'bg-blue-100 text-blue-700',
    committee_review: 'bg-purple-100 text-purple-700',
    approved:         'bg-green-100 text-green-700',
    rejected:         'bg-red-100 text-red-700',
  };
  const label: Record<string, string> = {
    pending: '待審', reviewing: '徵審中', committee_review: '委員會',
    approved: '核准', rejected: '拒絕',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {label[status] ?? status}
    </span>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────────────

const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY ?? '';
const POLL_MS   = 5000;

export default function AgentMonitorPage() {
  const [data, setData]         = useState<MonitorData | null>(null);
  const [error, setError]       = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents/status', {
        headers: { 'x-admin-api-key': ADMIN_KEY },
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}：請確認 VITE_ADMIN_API_KEY 設定`);
        return;
      }
      const json = (await res.json()) as { success: boolean } & MonitorData;
      if (json.success) {
        setData(json);
        setError('');
        setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
      }
    } catch {
      setError('無法連線後端，請確認服務已啟動');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  return (
    <div className="min-h-screen bg-tcb-gray flex flex-col">
      <Header />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-4">
        {/* 標題列 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-tcb-blue">軍機處 · Agent 監控看板</h1>
            <p className="text-xs text-gray-400">每 5 秒自動更新 · 最後更新：{lastUpdated || '—'}</p>
          </div>
          <button
            onClick={fetchStatus}
            className="text-xs text-tcb-blue border border-tcb-blue rounded-lg px-3 py-1.5 active:bg-blue-50"
          >
            手動刷新
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">{error}</div>
        )}

        {/* 今日統計卡 */}
        {data && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Agent 總數',    value: data.summary.totalAgents,     sub: `${data.summary.onlineNow} 個運行中`, color: 'text-tcb-blue' },
              { label: '今日呼叫',      value: data.summary.totalCallsToday, sub: `${data.summary.totalErrorsToday} 次錯誤`, color: 'text-gray-800' },
            ].map((item) => (
              <div key={item.label} className="card text-center">
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                <p className="text-xs font-bold text-gray-600 mt-0.5">{item.label}</p>
                <p className="text-xs text-gray-400">{item.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Agent 狀態列表 */}
        <div className="card">
          <p className="text-xs font-bold text-gray-500 mb-3">Agent 即時狀態</p>
          {!data ? (
            <p className="text-xs text-gray-400 animate-pulse text-center py-4">載入中...</p>
          ) : (
            <div className="space-y-3">
              {data.agents.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={agent.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{agent.name}</p>
                      <p className="text-xs text-gray-400">{agent.lastCallAgo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div>
                      <p className="text-xs font-bold text-gray-700">{agent.callsToday} 次</p>
                      {agent.errorsToday > 0 && (
                        <p className="text-xs text-red-400">{agent.errorsToday} 錯誤</p>
                      )}
                      {agent.avgDurationMs && (
                        <p className="text-xs text-gray-400">{agent.avgDurationMs}ms</p>
                      )}
                    </div>
                    <span className={`text-xs font-bold w-14 text-right ${statusTextColor(agent.status)}`}>
                      {statusLabel(agent.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 近期工作流 */}
        <div className="card">
          <p className="text-xs font-bold text-gray-500 mb-3">近期申請案件</p>
          {!data || data.recentWorkflows.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">尚無申請紀錄</p>
          ) : (
            <div className="space-y-2">
              {data.recentWorkflows.map((wf) => (
                <div key={wf.appId} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-gray-700">{wf.appId}</p>
                    <p className="text-xs text-gray-400">{wf.loanType} · {formatWan(wf.amount)}</p>
                  </div>
                  {workflowStatusBadge(wf.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-300">
          軍機處 Kanban · 概念借鑑自 Edict 三省六部架構
        </p>
      </div>
    </div>
  );
}
