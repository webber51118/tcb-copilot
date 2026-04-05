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
  | 'Gemma4本地AI'
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

const ALL_AGENTS: AgentName[] = [
  'ML鑑價引擎', 'XGBoost鑑價', '5P徵審引擎', '委員會審議',
  'RAG法規問答', 'Gemma4本地AI', '文件解析AI', '對話推薦引擎',
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
