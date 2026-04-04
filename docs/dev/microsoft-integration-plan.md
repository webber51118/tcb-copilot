# Microsoft 整合策略 — 方案 B（保留架構 + 加 Microsoft 門面）

> **決策日期**: 2026-04-04
> **策略**: 保留全部現有架構，加強 Microsoft 生態系可見度
> **預估工作量**: 2–3 天

---

## 決策背景

公司採購 Microsoft 365 套裝方案，黑客松評審重視 Microsoft 生態系整合度。
評估三方案後，選擇**方案 B（最務實）**：不重建現有系統，改為強化已有的 Azure 整合並補充監控門面。

---

## 現有架構已有的 Microsoft 服務（無需額外工作）

| 服務 | 用途 | 狀態 |
|------|------|------|
| **Azure OpenAI（GPT-4o）** | RAG 法規問答、後端 AI 審議 | ✅ 已整合 |
| **Azure AI Search** | 三大知識庫向量搜尋 | ✅ 已整合 |
| **Azure Cosmos DB** | 案件資料、對話 Session 儲存 | ✅ 已整合 |
| **Azure App Service** | Node.js 後端部署 | ✅ 已部署 |

> 重點：後端核心已是 **Azure Full Stack**，這是真實的，不是包裝。

---

## 方案 B 新增三項（2–3 天）

### 1. Power BI 業務儀表板（1–2 天）⭐ 優先

連接現有 Cosmos DB，建立即時 KPI 儀表板：

```
Cosmos DB（現有）
  ↓ Power BI Desktop → Get Data → Azure Cosmos DB
Power BI Report（新增）
  ├─ 今日送件數 / 核准率
  ├─ 各 Crew 平均執行時間（ms）
  ├─ 貸款類型分布（房貸 vs 信貸）
  └─ 風險等級分布（低 / 中 / 高）
  ↓ 發布到 Power BI Service
（選做）嵌入 Teams
```

### 2. Azure Application Insights 監控（0.5 天）

在現有 Node.js 後端加入 Application Insights SDK，記錄：
- 各 API 端點回應時間
- 各 Crew Agent 執行時間
- 錯誤率與例外追蹤

```bash
npm install applicationinsights
```

### 3. Demo 架構圖與投影片重新包裝（0.5 天）

將現有架構圖改用 Microsoft 生態系視角呈現：

```
客戶（LINE / LIFF）
  ↓
Azure App Service（Node.js + TypeScript）
  ├─ Co-Pilot 指揮艙（自製 MAF 工作流引擎）
  ├─ 6 Agent 信用審核 Crew
  └─ 3 Agent AI 審議委員會
  ↓
Azure OpenAI（GPT-4o）   ← 委員審議、RAG 問答
Azure AI Search          ← 法規知識庫
Azure Cosmos DB          ← 案件資料
Azure Application Insights ← 監控（新增）
  ↓
Power BI Dashboard       ← 業務儀表板（新增）
```

---

## 不做的事（刻意排除）

| 項目 | 排除原因 |
|------|---------|
| Copilot Studio 重建對話流 | 需重建 27 個狀態機，黑客松前趕不完 |
| LINE Bot → Teams Bot 遷移 | 平台遷移，非「加外衣」，風險過高 |
| Power Automate 橋接後端 | 現有 Node.js API 已足夠，增加複雜度無實益 |
| Semantic Kernel 整合 | 現有 Agent 架構運作正常，避免引入技術債 |

---

## Demo 說法

> 「本方案完整建構於 Microsoft Azure 生態系之上：
> 核心 AI 決策引擎採用 Azure OpenAI GPT-4o，
> 法規知識庫透過 Azure AI Search 進行語義搜尋，
> 所有案件資料與 AI 決策軌跡儲存於 Azure Cosmos DB，
> 並以 Power BI 提供主管即時業務洞察。」

---

## 執行時程

| 工作項目 | 預估時間 | 負責 |
|---------|---------|------|
| Power BI 連接 Cosmos DB + 設計 KPI 儀表板 | 1–2 天 | 待分配 |
| Application Insights SDK 整合 | 0.5 天 | 待分配 |
| Demo 架構圖重繪（Microsoft 視角） | 0.5 天 | 待分配 |
| **合計** | **2–3 天** | |
