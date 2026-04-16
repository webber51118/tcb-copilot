/**
 * INPUT:  recordAgentCall(agentName, success)
 * OUTPUT: AgentStatus[]（各 Agent 今日統計 + 最後呼叫時間）
 * POS:    Singleton in-memory store，追蹤各 Agent 呼叫狀態
 *         供 /admin/agents/status 端點查詢，前端 Kanban 看板使用
 */

export type AgentName =
  | 'ML鑑價引擎'
  | '5P徵審引擎'
  | '委員會審議'
  | 'RAG法規問答'
  | 'Qwen2.5本地AI'
  | 'XGBoost鑑價'
  | '文件解析AI'
  | '對話推薦引擎';

export interface AgentCallRecord {
  agentName: AgentName;
  timestamp: Date;
  success: boolean;
  durationMs?: number;
}

export interface AgentStatus {
  name:         AgentName;
  status:       'online' | 'idle' | 'error';
  callsToday:   number;
  errorsToday:  number;
  lastCallAt:   Date | null;
  lastCallAgo:  string;        // 人類可讀：「3秒前」「2分前」
  avgDurationMs: number | null;
}

// ── In-memory store（程序重啟後清空，足夠 Demo 用途）─────────────────
const _calls: AgentCallRecord[] = [];
const IDLE_THRESHOLD_MS  = 5  * 60 * 1000;  // 5 分鐘無呼叫 → idle
const ONLINE_THRESHOLD_MS = 30 * 1000;       // 30 秒內有呼叫 → online

/** Demo 種子資料：啟動時預填今日呼叫記錄，避免監控中心一片空白 */
export function seedDemoData(): void {
  if (_calls.length > 0) return; // 已有資料則跳過

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dayElapsedMs = now - todayStart.getTime() - 5 * 60 * 1000; // 排除最後 5 分鐘

  const SEED: Array<{ name: AgentName; count: number; errRate: number; avgMs: number }> = [
    { name: '對話推薦引擎',  count: 52, errRate: 0.02, avgMs: 1850 },
    { name: 'XGBoost鑑價',   count: 31, errRate: 0.03, avgMs: 2340 },
    { name: '5P徵審引擎',    count: 28, errRate: 0.04, avgMs: 3120 },
    { name: '文件解析AI',    count: 24, errRate: 0.04, avgMs: 1640 },
    { name: 'RAG法規問答',   count: 18, errRate: 0.06, avgMs:  980 },
    { name: 'ML鑑價引擎',    count: 15, errRate: 0.07, avgMs: 4210 },
    { name: '委員會審議',    count: 10, errRate: 0.10, avgMs: 2890 },
    { name: 'Qwen2.5本地AI', count:  5, errRate: 0.00, avgMs: 5620 },
  ];

  // 偽隨機（固定種子讓每次重啟結果穩定）
  let seed = 20260417;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

  for (const { name, count, errRate, avgMs } of SEED) {
    for (let i = 0; i < count; i++) {
      const offset    = Math.floor(rand() * dayElapsedMs);
      const timestamp = new Date(todayStart.getTime() + offset);
      const success   = rand() > errRate;
      const durationMs = Math.round(avgMs * (0.7 + rand() * 0.6));
      _calls.push({ agentName: name, timestamp, success, durationMs });
    }
  }

  // 讓 5P徵審引擎 與 XGBoost鑑價 顯示為 online（最後呼叫 < 30 秒前）
  _calls.push({ agentName: '5P徵審引擎', timestamp: new Date(now - 8_000),  success: true, durationMs: 3250 });
  _calls.push({ agentName: 'XGBoost鑑價', timestamp: new Date(now - 15_000), success: true, durationMs: 2180 });
}

/** 重置 Demo 資料（展示前可呼叫，還原乾淨狀態） */
export function resetDemoData(): void {
  _calls.splice(0, _calls.length);
  seedDemoData();
}

const ALL_AGENTS: AgentName[] = [
  'ML鑑價引擎', 'XGBoost鑑價', '5P徵審引擎', '委員會審議',
  'RAG法規問答', 'Qwen2.5本地AI', '文件解析AI', '對話推薦引擎',
];

/** 記錄一次 Agent 呼叫 */
export function recordAgentCall(
  agentName: AgentName,
  success: boolean,
  durationMs?: number,
): void {
  _calls.push({ agentName, timestamp: new Date(), success, durationMs });
  // 最多保留 1000 筆（避免記憶體洩漏）
  if (_calls.length > 1000) _calls.splice(0, _calls.length - 1000);
}

/** 格式化相對時間 */
function formatAgo(date: Date | null): string {
  if (!date) return '從未';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60)  return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  return `${Math.floor(sec / 3600)}小時前`;
}

/** 取得今日所有 Agent 狀態 */
export function getAgentStatuses(): AgentStatus[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = Date.now();

  return ALL_AGENTS.map((name) => {
    const todayCalls = _calls.filter(
      (c) => c.agentName === name && c.timestamp >= todayStart,
    );
    const lastCall = _calls
      .filter((c) => c.agentName === name)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] ?? null;

    const lastCallAt   = lastCall?.timestamp ?? null;
    const msSinceLast  = lastCallAt ? now - lastCallAt.getTime() : Infinity;

    let status: AgentStatus['status'] = 'idle';
    if (lastCallAt && msSinceLast <= ONLINE_THRESHOLD_MS) status = 'online';
    else if (lastCallAt && msSinceLast <= IDLE_THRESHOLD_MS) status = 'idle';

    const durations = todayCalls
      .filter((c) => c.durationMs != null)
      .map((c) => c.durationMs as number);
    const avgDurationMs = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

    return {
      name,
      status,
      callsToday:   todayCalls.length,
      errorsToday:  todayCalls.filter((c) => !c.success).length,
      lastCallAt,
      lastCallAgo:  formatAgo(lastCallAt),
      avgDurationMs,
    };
  });
}
