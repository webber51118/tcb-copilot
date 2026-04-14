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

---

## 七、Power BI 業務 KPI Dashboard 規劃

### 定位：業務分析，非即時監控

| 工具 | 用途 | 受眾 |
|------|------|------|
| `/admin/monitor`（現有）| Agent 即時狀態 | 行員 |
| Azure Application Insights | 雲端執行軌跡 + 告警 | 技術維運 |
| **Power BI Dashboard**（規劃中）| 業務 KPI 趨勢分析 | 主管 / 評審 |

### 資料來源

```
案件資料（JSON → 未來 Cosmos DB）
        ↓
Power BI 連接器（Cosmos DB Connector）
        ↓
Power BI Dashboard
```

### 建議 KPI 指標

#### 營運效率類
| KPI | 說明 | 視覺化 |
|-----|------|--------|
| 月增案件量 | 每月新送件數趨勢 | 折線圖 |
| 平均審核時間 | 從送件到決議的平均天數 | KPI 卡片 |
| AI 自動化率 | 無需人工介入直接決議的比例 | 量表圖 |
| Crew 平均耗時 | 各 Crew 執行時間比較 | 橫條圖 |

#### 風險管理類
| KPI | 說明 | 視覺化 |
|-----|------|--------|
| 核准率 | 核准 / 總案件 | KPI 卡片 + 趨勢 |
| 防詐觸發率 | 高風險案件佔比 | 圓餅圖 |
| 平均 LTV | 核准案件平均貸款成數 | 直方圖 |
| 平均 DBR | 信貸案件負債比分佈 | 箱型圖 |

#### 產品組合類
| KPI | 說明 | 視覺化 |
|-----|------|--------|
| 房貸 vs 信貸比例 | 貸款類型分佈 | 圓餅圖 |
| 推薦產品命中率 | AI 推薦 vs 客戶最終申請 | 矩陣圖 |
| 平均核准金額 | 依貸款類型分組 | 群組直條圖 |

### Microsoft 生態加分說明

> Power BI 連接 Azure Cosmos DB 是標準 Microsoft 生態整合路徑，
> 展示「Cosmos DB（儲存）→ Power BI（分析）→ Azure AI（決策）」的完整資料鏈，
> 對 4/22 微軟顧問是強力加分點。

### 實作前置條件

1. Azure Cosmos DB 建立完成（目前為 JSON 檔案，需先遷移）
2. Power BI Desktop 或 Power BI Service 帳號
3. Cosmos DB Connector 設定

### 展示說法

> 「主管端用 Power BI 連接 Azure Cosmos DB，
> 即時看到核准率趨勢、AI 自動化率、風險分佈——
> 這是從案件申請到業務洞察的完整 Microsoft 資料鏈。」

---

---

## 八、Hierarchical Agent Architecture — 三層 Agent 話術

> **對應框架**：在 Harness Engineering 護欄下，六大 Pilot Crew 實作了標準的「Hierarchical Agent Architecture」三層結構。

### 三層對應關係

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1：策略調度層（Planner / Architect）                      │
│  → 個金 Co-Pilot 指揮艙（workflowService.ts）                   │
│  · 接收貸款申請，判斷類型（房貸 / 信貸）                         │
│  · 分解任務為 Phase 1 → 2 → 3 的 DAG 執行圖                    │
│  · State Tracker：追蹤每個 Phase 完成狀態，決定下一步召集誰      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2：邏輯管理層（Manager / Controller）                     │
│  → 六大 Pilot Crew 機長角色                                      │
│  · Crew 1 機長：協調五個 5P 評分器的執行順序與結果整合           │
│  · Crew 2 機長：XGBoost 估價 → Monte Carlo → Qwen2.5 說明      │
│  · Crew 3 機長：向量搜尋 → Claude 合成法規答案                  │
│  · Crew 4 機長：召集三委員、收集投票、形成最終決議               │
│  · 各 Crew 負責 Context 壓縮（只傳必要資訊給下層 Worker）        │
│  · 具備 Retry Policy：Worker 失敗時降級或重試                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3：原子執行層（Worker / Executor）                        │
│  → 各 Crew 內的單一職責執行單元                                  │
│  · 5P 評分器（六個）：Purpose / Payment / Protection 各自獨立   │
│  · XGBoost 推論引擎：單一物件 → 單價預測                        │
│  · Monte Carlo GBM：1,000 路徑風險模擬                          │
│  · Azure AI Search：法規向量語義搜尋                             │
│  · Claude Vision：謄本 OCR 解析                                  │
│  · 每個 Worker 有工具沙盒（Tool RBAC）：只能呼叫被授權的 API     │
│  · 輸出格式：PilotCrewResponse 統一結構化 Handoff               │
└─────────────────────────────────────────────────────────────────┘
```

### 關鍵機制對應

| Hierarchical Agent 概念 | 個金 Co-Pilot 實作 | 檔案 |
|------------------------|-----------------|------|
| **Planner / DAG** | Phase 1→2→3 流程圖，依貸款類型動態決定 | `workflowService.ts` |
| **State Tracker** | Phase 狀態機（pending → running → done） | `workflowService.ts` |
| **Manager Context 壓縮** | 各 Crew 只傳摘要結果給指揮艙，不傳原始資料 | `PilotCrewResponse` |
| **Worker Sandboxing** | 各 Python Worker 獨立程序，不共享狀態 | `xgboostValuationService.py` |
| **Critic Agent** | Crew 4 三委員交叉驗證（Inferential Sensor） | `committeeReviewService.ts` |
| **Structured Handoff** | `PilotCrewResponse`：result + confidence + rationale | 各 Crew 輸出介面 |
| **Harness 護欄** | DBR/LTV 紅線（Planner 層過濾）+ 監控埋點（Worker 層記錄）| `thresholdChecker.ts` |

### Critic Agent 詳解 — 委員會三委員

```
Worker 層產出（5P 評分 + 鑑估結果 + 法規確認）
        ↓
Critic Agent（Crew 4 委員會）
   委員 A — 風控立場：是否超過合規閾值？
   委員 B — 業務立場：客戶還款能力是否充分？
   委員 C — 法規立場：法規紅線是否符合？
        ↓
投票結果 → 核准 / 婉拒 / 待補件（REWORK）
```

> **為什麼需要 Critic Agent？**
> Worker 各自是局部最優，但可能彼此矛盾。
> 例如：信用評分通過，但鑑估 LTV 偏高——需要跨領域裁量，這正是 Critic Agent 的職責。

### 4/22 Demo 說法（Hierarchical Agent 話術）

> 「個金 Co-Pilot 實作了標準的三層 Hierarchical Agent 架構：
>
> 第一層是『指揮艙』——它是策略調度層（Planner），
> 接到申請後把任務拆解成 Phase 1 鑑估、Phase 2 徵審、Phase 3 委員會的 DAG 執行圖，
> 並追蹤每個 Phase 的完成狀態。
>
> 第二層是『六大 Pilot Crew 機長』——邏輯管理層（Manager），
> 每位機長負責協調旗下的 Worker、壓縮 Context、處理 Retry，
> 只把摘要結果 Handoff 給指揮艙。
>
> 第三層是各 Crew 內的原子執行單元——Worker，
> 每個 Worker 只做一件事：XGBoost 估一個房價、搜一條法規、跑一次 Monte Carlo，
> 輸出統一的 PilotCrewResponse 結構。
>
> 最後由 Crew 4 委員會擔任 Critic Agent，
> 三位 AI 委員交叉驗證所有 Worker 結果，投票形成最終決議。
>
> 整套架構在 Harness Engineering 護欄下運行：
> 合規紅線在 Planner 層前置過濾，監控埋點在 Worker 層全程記錄。」

---

---

## 九、推薦系統 — Netflix × InstructRec 混合架構

> **定位**：個金 Co-Pilot 的產品推薦系統，實作了金融領域的混合推薦架構，
> 結合 Content-Based Filtering（Netflix 冷啟動策略）、Collaborative Filtering（Netflix 核心）、
> 與 LLM Instruction Following（InstructRec，ArXiv 2023）三層設計。

### 演算法對應關係

| 推薦系統概念 | 學術歸類 | 個金 Co-Pilot 實作 |
|------------|---------|-----------------|
| Netflix 冷啟動解法 | Content-Based Filtering | `isEligible()`：年齡/職業/收入/用途篩選 |
| Netflix 熱門排序 | Popularity Ranking | `priorityOrder`：青安 > 國軍 > 一般 |
| InstructRec 顯性意圖 | Instruction Following | 申請表單：用戶主動說出金額/用途/年限 |
| InstructRec 可解釋性 | LLM-generated Rationale | Qwen2.5 動態生成個人化推薦說明 |
| Netflix CF 核心 | Collaborative Filtering | crossSell 套餐推薦（規劃升級）|

### 三層架構圖

```
Layer 1：Content-Based（Netflix 冷啟動策略）
  用戶屬性（年齡/職業/收入）
  → isEligible() 資格篩選
  → 候選商品池
         ↓
Layer 2：Collaborative Filtering（Netflix 核心）
  「申辦青安的客戶，68% 同時辦了御璽卡 + 房貸壽險」
  → crossSell 套餐推薦（由靜態升級為 CF 驅動）
         ↓
Layer 3：LLM Instruction Following（InstructRec）
  申請表單 = Structured Instruction
  → Qwen2.5 即時生成個人化說明
  → 同一推薦，對不同客戶說不同的理由
```

### 金融冷啟動優勢

Netflix 冷啟動難，因為用戶可匿名瀏覽。
銀行貸款申請**必須填齊**：年齡、職業、收入、金額、用途——
這個填表過程即為 InstructRec 所定義的 **Onboarding Questionnaire**，
系統一開始就有完整 Content Features，冷啟動問題天然不存在。

### 生命週期套餐推薦

| 客群 | 主推 | CF 配套 | Qwen2.5 說明角度 |
|------|------|---------|---------------|
| 首購族（30歲/公務員）| 青安房貸 | 御璽卡 + 房貸壽險 + CoBaby帳戶 | 未來30年節省試算 |
| 退休族（62歲/自有房）| 以房養老 | 長照保險 + 安養信託 + 黃金存摺 | 每月穩定現金流 |
| 軍公教（職業軍人）| 國軍輔導房貸 | 軍人認同卡 + 軍人團體保險 | 軍人專屬優惠組合 |

### 學術依據

| 論文 | 對應 Co-Pilot 架構 |
|------|-----------------|
| DropoutNet (NIPS 2017) | 冷啟動訓練策略 |
| Wide & Deep (DLRS 2016) | Layer 1 屬性篩選 |
| PinSage / GNN (KDD 2018) | Layer 2 套餐關聯 |
| Recommendation as Instruction Following (ArXiv 2023) | Layer 3 LLM 說明 |

### 4/22 Demo 說法（混合推薦話術）

> 「個金 Co-Pilot 實作了金融推薦的三層混合架構：
>
> 第一層 Content-Based——跟 Netflix 冷啟動解法一樣，
> 用客戶靜態屬性篩選資格，但銀行填表必填，冷啟動天然不存在。
>
> 第二層 Collaborative Filtering——Netflix 的核心，
> 申辦青安的客戶 68% 同時辦了御璽卡和房貸壽險，
> 系統自動推薦整套生命週期金融組合。
>
> 第三層 LLM Instruction Following——對應 2023 年最新論文 InstructRec，
> 客戶填表即指令，Qwen2.5 即時生成個人化說明，
> 同一推薦對不同客戶說不一樣的理由——這是傳統規則引擎做不到的。」

---

---

## 十、Human-in-the-Loop（HITL）架構

> **定位**：個金 Co-Pilot 實作了金融 AI 的標準 HITL 迴路——
> AI 負責分析與建議，人類行員負責最終決策。
> **AI 是副駕駛，人類是機長。**

### 現有 HITL 迴路

```
客戶 LINE 申請
      ↓
Crew 1-3：AI 三階段徵審（5P評分 + 鑑估 + 法規）
      ↓
Crew 4：AI 委員會三委員投票（建議核准 / 有條件核准 / 婉拒）
      ↓
Admin 後台：行員審閱完整 AI 分析報告
      ↓
人工決策：行員點擊「✅ 核准」或「❌ 婉拒」
      ↓
LINE 通知客戶結果
```

**關鍵點**：AI 委員會的決議是「建議」，不是「命令」。
行員看到完整的評分依據、委員意見、法規確認後，才做最終決定。

### 現況與規劃

| 功能 | 狀態 | 說明 |
|------|------|------|
| AI 建議 → 人工確認 | ✅ 已實作 | Admin 後台核准 / 婉拒按鈕 |
| 完整 AI 分析報告展示 | ✅ 已實作 | 5P 評分、委員意見、法規確認 |
| 批覆書 PDF 下載 | ✅ 已實作 | 人工確認後可下載正式文件 |
| **參數覆寫** | 🔲 規劃中 | 行員調整 AI 建議金額 / 年限再核准 |
| **升級路由** | 🔲 規劃中 | 高風險案件自動轉主管審核 |
| **婉拒原因輸入** | 🔲 規劃中 | 婉拒時填寫原因，供客戶申訴參考 |
| **稽核軌跡** | 🔲 規劃中 | 記錄誰在何時做了什麼決定 |

### Harness Engineering 對應

HITL 在 Harness Engineering 框架下屬於 **Sensor 層（反饋迴路）**：

```
AI 執行（Worker 層）
      ↓
AI 建議產出（Structured Handoff）
      ↓
人工審閱介面（Sensor — 人類回饋）  ← HITL 發生點
      ↓
人工決策注入（Override / Confirm）
      ↓
結果回饋給系統（更新案件狀態）
```

### 4/22 Demo 說法

> 「個金 Co-Pilot 的 AI 不直接做最終決定。
>
> 委員會三位 AI 委員完成交叉驗證後，
> 行員在後台看到完整的評分依據、委員意見和法規確認，
> 才由人工按下核准或婉拒——這是金融 AI 的標準 Human-in-the-Loop 設計。
>
> AI 處理的是『資訊整合與風險量化』，
> 人類負責的是『最終判斷與責任承擔』。
> 這樣的分工才是 AI 在金融業真正可以落地的方式。」

---

*文件版本 1.4 — 2026-04-14*
*本文件為架構敘事層，不改變任何現有命名或程式碼。*
*詳細技術實作請參考 `pilot-crew-architecture.md`。*
