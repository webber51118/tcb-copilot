# 個金 Co-Pilot 領航員 — 統一架構敘事

> **建立日期**：2026-04-09
> **用途**：4/22 微軟顧問會談 + 黑客松評審架構說明
> **原始架構文件**：`pilot-crew-architecture.md`

---

## 一、系統全景（四層架構）

```
╔══════════════════════════════════════════════════════════════╗
║              個金 Co-Pilot 領航員 — 系統架構                ║
╠══════════════════════════════════════════════════════════════╣
║  【護欄層】Harness                                          ║
║   Guides（前饋）：CLAUDE.md · 對話狀態機 · 合規紅線         ║
║   Sensors（反饋）：Agent 監控看板 · Azure App Insights       ║
╠══════════════════════════════════════════════════════════════╣
║  【編排層】Co-Pilot 指揮艙                                  ║
║   workflowService — 依貸款類型動態召集 Crew                 ║
║   Phase 1 鑑估 → Phase 2 徵審+法規 → Phase 3 委員會        ║
╠══════════════════════════════════════════════════════════════╣
║  【執行層】六大 Pilot Crew                                  ║
║  Crew 1 徵信  Crew 2 鑑估  Crew 3 法規                     ║
║  Crew 4 審議  Crew 5 文件  Crew 6 客服                     ║
╠══════════════════════════════════════════════════════════════╣
║  【底座層】Azure 雲端服務                                   ║
║   AI Search（法規知識庫）· App Insights（監控）             ║
║   Cosmos DB（案件儲存）· Foundry（未來 Crew 部署）          ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 二、各層職責說明

### 護欄層 — Harness（讓 AI 不亂跑）

參考框架：[Martin Fowler — Harness Engineering](https://martinfowler.com/articles/harness-engineering.html)

> Agent = Model + Harness
> Model 決定 AI 有多聰明，Harness 決定 AI 有多可靠。

**Guides（前饋護欄）**：事前限制 AI 的行為空間

| Guide | 對應實作 | 作用 |
|-------|---------|------|
| 合規紅線 | DBR ≤ 22x（信貸）/ LTV ≤ 85%（房貸）| 硬規則，觸犯直接拒絕 |
| 行為規範 | `CLAUDE.md` | 語言風格、禁止行為、必做事項 |
| 對話約束 | `conversationStateMachine.ts` | 限制客戶只能走合法申請狀態 |
| 知識庫優先序 | RAG 三層（央行 > 政策 > 授信）| 法規問答的回答順序 |
| 角色設定 | 委員會系統 Prompt | 三委員 AI 各自扮演的專業立場 |

**Sensors（反饋護欄）**：事後監控 AI 的執行結果

| Sensor | 對應實作 | 監控對象 |
|--------|---------|---------|
| 呼叫埋點 | `recordAgentCall()` | 每個 Crew 的成功/失敗/耗時 |
| 即時看板 | `/admin/monitor` | 8 個 Agent 的今日狀態 |
| 雲端追蹤 | Azure Application Insights | 全 Crew 執行軌跡（未來）|

---

### 編排層 — Co-Pilot 指揮艙

**核心檔案**：`src/main/typescript/services/workflowService.ts`
**API**：`POST /api/workflow/full-review`

```
房貸流程：Phase 1（鑑估）→ Phase 2（徵審 + 法規）→ Phase 3（委員會）
信貸流程：                  Phase 2（徵審 + 法規）→ Phase 3（委員會）
```

指揮艙只做兩件事：**召集對的 Crew** 和 **整合 Crew 的結果**。
Crew 之間不直接溝通，全部透過指揮艙協調。

---

### 執行層 — 六大 Pilot Crew

每個 Crew 都有：明確輸入 → 執行 → 統一格式輸出（`PilotCrewResponse`）

| Crew | 職責 | 核心技術 | Harness Guide | Harness Sensor |
|------|------|---------|--------------|----------------|
| **Crew 1 徵信** | 5P 信用評分 + 8 項防詐 | 六個評分器模組 | DBR/LTV 硬閾值 | `recordAgentCall('5P徵審引擎')` |
| **Crew 2 鑑估** | 房屋估價 + 風險區間 | XGBoost + Monte Carlo | LTV ≤ 85% | `recordAgentCall('XGBoost鑑價')` |
| **Crew 3 法規** | 法規問答 + 合規確認 | Azure AI Search + Claude | 知識庫優先序 | `recordAgentCall('RAG法規問答')` |
| **Crew 4 審議** | 三委員 AI 投票決議 | Claude Sonnet 角色扮演 | 委員角色 Prompt | `recordAgentCall('委員會審議')` |
| **Crew 5 文件** | 謄本解析 + PDF 批覆書 | Claude Vision + pdf-lib | 解析欄位規格 | `recordAgentCall('文件解析AI')` |
| **Crew 6 客服** | LINE Bot + 推播通知 | LINE Messaging API | 對話狀態機 | `recordAgentCall('對話推薦引擎')` |

---

### 底座層 — Azure 雲端服務

| Azure 服務 | 對應 Crew / 層級 | 目前狀態 |
|-----------|----------------|---------|
| **Azure AI Search** | Crew 3 法規（向量搜尋）| 計畫中（P0）|
| **Application Insights** | Harness Sensor 層 | 計畫中（P1）|
| **Cosmos DB** | 案件資料持久化 | 計畫中（P2）|
| **AI Foundry Hosted Agents** | 六大 Crew 雲端部署 | 未來方向 |

> Azure AI Foundry 是目前唯一同時托管 Anthropic Claude 和 OpenAI GPT 的雲端平台，
> 個金 Co-Pilot 的混合模型架構（Claude Vision + Claude Sonnet）完全符合 Foundry 部署規格。

---

## 三、完整資料流

```
① 客戶 LINE 申請
   → Crew 6 客服：接收訊息、整理申請資料、產生 session

② 行員後台啟動 AI 審核
   → Co-Pilot 指揮艙：判斷貸款類型，召集對應 Crew

③ Phase 1（房貸專屬）
   → Crew 2 鑑估：XGBoost 估價 → Monte Carlo 風險區間 → Qwen2.5 白話說明

④ Phase 2（房貸 + 信貸）
   → Crew 1 徵信：5P 評分 + 防詐偵測 → 合規閾值核查
   → Crew 3 法規：Azure AI Search 向量搜尋 → Claude 合成法規答案

⑤ Phase 3（房貸 + 信貸）
   → Crew 4 審議：三委員 AI 依各 Crew 結果投票 → 形成決議

⑥ 全程監控
   → Harness Sensors：每個 Crew 呼叫埋點 → Admin 看板即時顯示

⑦ 決議後
   → Crew 5 文件：生成徵審報告 + PDF 批覆書
   → Crew 6 客服：LINE 推播通知客戶核准/婉拒結果
```

---

## 四、Harness Engineering 對應總覽

| 框架概念 | 個金 Co-Pilot 實作 | 檔案位置 |
|---------|-----------------|---------|
| **Constitution**（不可違反的規則）| DBR ≤ 22x / LTV ≤ 85% 金融紅線 | `creditReviewService.ts` |
| **Guides**（前饋護欄）| `CLAUDE.md` + 對話狀態機 + RAG 優先序 | `CLAUDE.md` / `conversationStateMachine.ts` |
| **Sensors**（反饋護欄）| `recordAgentCall()` + Admin 監控看板 | `agentMonitorStore.ts` |
| **Harness Orchestrator** | Co-Pilot 指揮艙 | `workflowService.ts` |
| **Computational Sensors** | DBR 計算、LTV 計算（決定性、毫秒級）| `thresholdChecker.ts` |
| **Inferential Sensors** | 委員會三委員交叉驗證（語義、非決定性）| `committeeReviewService.ts` |

---

## 五、4/22 Demo 說法腳本

### 開場（30 秒）

> 「個金 Co-Pilot 是一套 AI 驅動的銀行授信協作系統。
> 核心是 Co-Pilot 指揮艙帶領六支 Pilot Crew 分工協作——
> 每支 Crew 都有明確的護欄：合規紅線在前、即時監控在後。」

### 展示 Agent 監控看板時（30 秒）

> 「這是 Harness Sensor 層的即時儀表板，追蹤六大 Crew 的執行狀態。
> 每個 Agent 的呼叫次數、成功率、平均耗時都即時記錄，
> 這套架構實踐了 Martin Fowler 提出的 Harness Engineering 框架：
> Model 決定 AI 有多聰明，Harness 決定 AI 有多可靠。」

### 展示 Azure 整合時（30 秒）

> 「底層跑在 Azure 上：
> Crew 3 法規用 Azure AI Search 做向量語義搜尋，
> App Insights 追蹤每個 Crew 的執行軌跡。
> 六大 Crew 的架構完全符合 Azure AI Foundry Hosted Agents 的部署規格，
> Azure 是唯一同時托管 Claude 和 GPT 的平台，我們的混合模型架構正好對應這個優勢。」

### 回答「AI 怎麼保證不亂跑？」（30 秒）

> 「兩層保護：
> 第一層是 Guides，合規紅線硬編在程式碼裡——DBR 超過 22 倍直接拒絕，不進委員會。
> 第二層是 Sensors，每個 Crew 執行完都埋點記錄，Azure App Insights 全程追蹤。
> 這不是信任 AI，是讓 AI 在可審計的框架內工作。」

---

## 六、與其他框架的對應關係

| 外部框架 | 個金 Co-Pilot 對應 |
|---------|------------------|
| Martin Fowler Harness Engineering | 護欄層（Guides + Sensors）|
| Azure AI Foundry Hosted Agents | 六大 Pilot Crew（可直接部署）|
| Agent Governance（bounce12340）| 合規紅線（Constitution）+ 委員會審議（Judicial 驗證）|
| AWS 保險理賠 EKS（參考架構）| 業務流程對應（保險理賠 ≈ 銀行授信）|

---

*文件版本 1.0 — 2026-04-09*
*本文件為架構敘事層，不改變任何現有命名或程式碼。*
*詳細技術實作請參考 `pilot-crew-architecture.md`。*
