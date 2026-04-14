# Agent 監控看板架構設計

> **建立日期**：2026-04-05  
> **設計框架**：Harness Engineering Sensor 層（Martin Fowler）
> **路由**：`/admin/monitor`（行員後台，需 Admin API Key）

---

## 設計目的

4/22 與微軟顧問首次會談時，能即時展示 AI Agent 在協作運作。讓顧問直觀看到：

- 哪些 Agent 正在運行、最後呼叫時間
- 今日各 Agent 呼叫次數與錯誤率
- 近期貸款申請案件流轉狀態

---

## 架構概覽

```
前端（React）                後端（Node.js）              資料來源
─────────────────────────────────────────────────────────────────
AgentMonitorPage.tsx         GET /api/admin/agents/status
  ↓ polling 每 5 秒          └─ agentMonitor.ts (Router)
  ↓ x-admin-api-key              └─ agentMonitorStore.ts (Store)
  ↓ fetch                            ├─ getAgentStatuses()
  ↓                                  └─ getAllApplications()
顯示：                                     ↑
  ┌─ 統計卡（在線數 / 今日呼叫）     各 Agent 在呼叫時
  ├─ Agent 狀態列表（燈號+耗時）     執行 recordAgentCall()
  └─ 近期申請流水帳
```

---

## 監控 Agent 清單（8 個）

| Agent 名稱 | 對應服務 | 記錄位置 |
|-----------|---------|---------|
| ML 鑑價引擎 | Python FastAPI `/valuate` | `workflowService.ts` Phase1 |
| XGBoost 鑑價 | Python FastAPI `/valuate/xgboost` | `valuateXgboost.ts` |
| 5P 徵審引擎 | `creditReviewService.ts` | `workflowService.ts` Phase2 |
| 委員會審議 | `committeeReviewService.ts` (Claude) | `workflowService.ts` Phase3 |
| RAG 法規問答 | `ragService.ts` (Azure AI Search) | `ragQuery.ts` |
| Qwen2.5 本地AI | Ollama `/api/chat` | `valuateXgboost.ts` explain 端點 |
| 文件解析AI | `documentParser.ts` (Claude Vision) | `parseDocument.ts` |
| 對話推薦引擎 | `recommendationEngine.ts` | *(預留，尚未記錄)* |

---

## 資料流

### recordAgentCall（埋點方式）

```typescript
// 在每個 Agent 呼叫完成後埋入：
import { recordAgentCall } from '../config/agentMonitorStore';

const t0 = Date.now();
try {
  const result = await callSomeAgent(...);
  recordAgentCall('XGBoost鑑價', true, Date.now() - t0);
} catch {
  recordAgentCall('XGBoost鑑價', false);
}
```

### agentMonitorStore（In-Memory Singleton）

```typescript
// 最多保留 1000 筆呼叫紀錄
// 狀態判斷規則：
//   online: 30 秒內有呼叫
//   idle:   30 秒 ~ 5 分鐘無呼叫
//   (若 errorsToday > 0 可擴充為 error 狀態)
```

### GET /api/admin/agents/status 回應格式

```json
{
  "success": true,
  "timestamp": "2026-04-05T10:00:00.000Z",
  "summary": {
    "totalAgents": 8,
    "onlineNow": 3,
    "totalCallsToday": 47,
    "totalErrorsToday": 2
  },
  "agents": [
    {
      "name": "XGBoost鑑價",
      "status": "online",
      "callsToday": 12,
      "errorsToday": 0,
      "lastCallAt": "...",
      "lastCallAgo": "3秒前",
      "avgDurationMs": 840
    }
  ],
  "recentWorkflows": [
    {
      "appId": "APP-001",
      "loanType": "房貸",
      "status": "approved",
      "amount": 10000000,
      "createdAt": "..."
    }
  ]
}
```

---

## 前端 UI 設計

```
┌─────────────────────────────────┐
│  監控中心 · Agent 監控看板        │
│  每 5 秒自動更新 · 最後更新 10:00│
├──────────────┬──────────────────┤
│  Agent 總數  │   今日呼叫       │
│     8        │      47          │
│  3 個運行中  │   2 次錯誤       │
├─────────────────────────────────┤
│ Agent 即時狀態                  │
│ ● XGBoost鑑價   12次  3秒前  運行中│
│ ● 5P徵審引擎    12次  3秒前  運行中│
│ ● 委員會審議    11次  8秒前  運行中│
│ ○ RAG法規問答    5次  2分前  閒置  │
│ ○ Qwen2.5本地AI  8次  5分前  閒置  │
├─────────────────────────────────┤
│ 近期申請案件                    │
│ APP-001  房貸·1000萬  [核准]    │
│ APP-002  信貸·50萬    [徵審中]  │
└─────────────────────────────────┘
```

---

## 技術選型說明

| 特性 | 方案 | 原因 |
|------|------|------|
| 狀態心跳 | In-Memory + Polling | 零額外依賴，Hackathon Demo 環境適用 |
| 更新方式 | 拉取（5秒 polling） | Demo 環境不保證長連線穩定性 |
| Agent 數量 | 8 個 | 對應六大 Pilot Crew + 輔助 Agent |
| 部署複雜度 | 零額外依賴 | 不需 Redis，直接啟動 |
| 任務干預 | *(未來擴充)* | Hackathon 後可加叫停/取消功能 |

---

## 未來擴充（Hackathon 後）

1. **WebSocket 即時推播** — 取代 polling，降低後端壓力
2. **Credit Gate 封駁記錄** — 顯示被門下省封駁的案件
3. **Token 消耗追蹤** — 顯示各 Claude/Gemma Agent 的 token 使用量
4. **任務干預** — 管理員可從看板叫停進行中的審核流程
5. **持久化** — 用 SQLite/Redis 替換 In-Memory，重啟後保留歷史資料
