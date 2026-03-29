# 個金 Co-Pilot 領航員 — Pilot Crew 後端架構設計

> **版本**: 1.0
> **建立日期**: 2026-03-29
> **專案**: 分行神隊友：個金 Co-Pilot 領航員
> **目的**: 黑客松 Demo 後端多 Agent 架構包裝說明

---

## 一、核心概念

### 命名邏輯

```
Co-Pilot 領航員（品牌名）
    ↓
Co-Pilot 指揮艙（MAF 工作流引擎，總指揮）
    ↓
Pilot Crew（各功能 Agent 小組）
    ↓
Crew 成員（各專責 Service / Model）
```

### 設計理念

- **每個 Crew 是一個自治單元**：有明確輸入、輸出、職責邊界
- **指揮艙統一編排**：依貸款類型（房貸 / 信貸）動態召集對應 Crew
- **Crew 間解耦**：Crew 只對指揮艙負責，不直接相互呼叫
- **可視化敘事**：每個 Crew 對應後台管理介面的一張任務進度卡

---

## 二、系統架構全景

```
客戶端（LINE Bot / LIFF 前端）
              ↓ 申請送出
┌─────────────────────────────────────────────────┐
│           Co-Pilot 指揮艙                        │
│           workflowService（MAF 工作流引擎）       │
│                                                  │
│  依貸款類型決定 Crew 召集順序：                    │
│  房貸：文件 → 法規 → 徵信 → 鑑估 → 審議 → 報告    │
│  信貸：文件 → 法規 → 徵信 → 審議 → 報告           │
└──────────┬────────────────────────────────────── ┘
           │
  ┌────────┴─────────────────────────────────────────┐
  ↓         ↓          ↓          ↓          ↓        ↓
文件 Crew  法規 Crew  徵信 Crew  鑑估 Crew  審議 Crew  客服 Crew
（Crew 5） （Crew 3） （Crew 1） （Crew 2） （Crew 4） （Crew 6）
  ↓         ↓          ↓          ↓          ↓
              ↘        ↓        ↙
              審議 Crew（彙整各 Crew 結果）
                       ↓
               最終核准 / 婉拒決議
                       ↓
              文件 Crew（批覆書 / PDF 輸出）
                       ↓
              客服 Crew（LINE 推播通知）
```

---

## 三、各 Pilot Crew 詳細說明

---

### 🛩️ Co-Pilot 指揮艙（總指揮）

| 項目 | 說明 |
|------|------|
| **英文名** | Co-Pilot Command Bridge |
| **職責** | 工作流編排、Crew 召集、結果整合 |
| **核心檔案** | `src/main/typescript/services/workflowService.ts` |
| **API** | `POST /api/workflow/full-review` |

**任務流程**：
```typescript
// 房貸流程
[DocumentCrew] → [RegulatoryCreW] → [CreditCrew] → [ValuationCrew] → [CommitteeCrew]

// 信貸流程
[DocumentCrew] → [RegulatoryCrew] → [CreditCrew] → [CommitteeCrew]
```

---

### 👥 Crew 1：徵信領航員小組

| 項目 | 說明 |
|------|------|
| **英文名** | Credit Intelligence Pilot Crew |
| **職責** | 信用評估、負債計算、防詐偵測、5P 評級 |
| **適用** | 房貸 ✅ 信貸 ✅ |
| **API** | `POST /api/credit-review` |

**成員組成**：

| 職稱 | 成員 Agent | 核心任務 | 檔案 |
|------|-----------|---------|------|
| 🎖️ 機長 | 5P 信用評級官 | 綜合信用評分 0–100 | `creditReviewService.ts` |
| 🥈 副機長 | 合規閾值核查員 | DBR ≤22倍 / 負債比 ≤85% | `thresholdChecker.ts` |
| 👤 成員 | 借款人輪廓分析師 | 職業穩定性、所得成長性 | `borrowerProfileScorer.ts` |
| 💰 成員 | 還款來源評估師 | 資金用途合理性 | `repaymentSourceScorer.ts` |
| ⚠️ 成員 | 風險因子評估師 | 資產淨值、流動比率 | `riskFactorScorer.ts` |
| 🛡️ 成員 | 擔保品評估師 | 淨值比率 | `creditProtectionScorer.ts` |
| 🔍 特攻 | 防詐偵測特工 | 8 項詐欺風險偵測 | `fraudDetector.ts` |

**輸出格式**：
```typescript
{
  crewId: "credit-crew",
  score: 85,              // 0–100 綜合評分
  grade: "優良",
  thresholds: {
    dbr: { value: 18.5, pass: true },        // 信貸
    debtIncomeRatio: { value: 0.54, pass: true } // 房貸
  },
  fraudCheck: {
    passCount: 8,
    overallLevel: "low"
  },
  recommendation: "強烈建議核准"
}
```

---

### 🏠 Crew 2：鑑估領航員小組

| 項目 | 說明 |
|------|------|
| **英文名** | Valuation Pilot Crew |
| **職責** | 個別物件估價、市場趨勢分析、風險區間模擬 |
| **適用** | 房貸 ✅ 信貸 ❌ |
| **API** | `POST /api/valuate/xgboost` |

**成員組成**：

| 職稱 | 成員 Agent | 核心任務 | 檔案 |
|------|-----------|---------|------|
| 🎖️ 機長 | XGBoost 估價引擎 | 實價登錄資料訓練，MAPE ~10–15% | `xgboostValuationService.py` |
| 🥈 副機長 | Monte Carlo 風險模擬師 | GBM 1,000 路徑，P5/P50/P95 | `monte_carlo.py` |
| 📈 成員 | LSTM 市場趨勢預測師 | HP 房價指數 + VOL 成交量（論文：蔡繡容 2023） | `demo_lstm.py` |
| 🧭 成員 | RF+SDE 情緒分析師 | 長短期市場情緒分類（論文：王文楷 2025） | `demo_rf_sde.py` |
| 🗺️ 地勤 | 縣市基準查表員 | 22 縣市基準單價 × 屋齡折舊 × 樓層係數 | `region_price_table.py` |

**估價四層架構**：
```
Layer 1：縣市基準單價（靜態查表）
    ↓
Layer 2：LSTM 市場趨勢調整（Demo / 真實模型）
    ↓
Layer 3：RF+SDE 情緒修正（Demo / 真實模型）
    ↓
Layer 4：Monte Carlo 風險區間（P5 / P50 / P95）
```

**輸出格式**：
```typescript
{
  crewId: "valuation-crew",
  estimatedValue: 14500000,    // P50 建議鑑估值（元）
  confidence: {
    p5:  12800000,
    p50: 14500000,
    p95: 16200000
  },
  ltv: 0.69,                   // 貸款成數
  riskLevel: "low",
  pricePerPing: 483333,        // 估計單價（元/坪）
  model: "xgboost"             // xgboost / demo
}
```

---

### 📚 Crew 3：法規領航員小組

| 項目 | 說明 |
|------|------|
| **英文名** | Regulatory Pilot Crew |
| **職責** | 三大知識庫 RAG 問答、法規合規檢查 |
| **適用** | 房貸 ✅ 信貸 ✅ |
| **API** | `POST /api/rag-query` |

**成員組成**：

| 職稱 | 成員 Agent | 核心任務 | 知識庫 |
|------|-----------|---------|--------|
| 🎖️ 機長 | RAG 法規問答引擎 | 語義檢索 + GPT-4o 答案生成 | `ragService.ts` |
| 📕 知識庫A | 央行法規專員 | LTV、寬限期、高價房限制 | 央行不動產抵押貸款問答 |
| 📙 知識庫B | 政策貸款專員 | 新青安、國軍貸款規定 | 個金政策性貸款規章 |
| 📗 知識庫C | 授信規章專員 | 徵信、保證人、一般流程 | 個金授信規章 |

**優先權**：央行（最高）> 政策（中）> 授信（一般）

**輸出格式**：
```typescript
{
  crewId: "regulatory-crew",
  answer: "第2戶購屋最高成數50%，無寬限期。",
  sources: ["央行問答 Q5 (114.9.8生效)"],
  compliancePass: true,
  cached: false           // Hot Cache 命中 → true（<1秒）
}
```

---

### 🏛️ Crew 4：審議領航員小組

| 項目 | 說明 |
|------|------|
| **英文名** | Committee Pilot Crew |
| **職責** | 彙整各 Crew 報告、模擬多委員討論、最終決策 |
| **適用** | 房貸 ✅ 信貸 ✅ |
| **API** | `POST /api/committee-review` |

**成員組成**：

| 職稱 | 成員 Agent | 核心任務 | 實作 |
|------|-----------|---------|------|
| 🎖️ 主席 | 審議整合引擎 | 多委員意見彙整、最終決議 | `committeeReviewService.ts` |
| 👨‍💼 委員A | 授信專家 Agent | 從徵信 Crew 視角提出意見 | GPT-4o 角色扮演 |
| 🏠 委員B | 鑑價專家 Agent | 從鑑估 Crew 視角提出意見 | GPT-4o 角色扮演 |
| ⚖️ 委員C | 法規專家 Agent | 從法規 Crew 視角提出意見 | GPT-4o 角色扮演 |

**三輪審議流程**：
```
第 1 輪：各委員初步意見（依 Crew 報告）
    ↓
第 2 輪：委員交叉辯論（關鍵數字交叉確認）
    ↓
第 3 輪：主席歸納，形成最終決議
```

**輸出格式**：
```typescript
{
  crewId: "committee-crew",
  decision: "核准",          // 核准 / 有條件核准 / 婉拒
  amount: 8000000,
  rate: "2.185%起",
  term: 20,
  conditions: ["需補齊財力證明"],
  finalSummary: {
    riskScore: 78,
    recommendation: "有條件核准"
  }
}
```

---

### 📄 Crew 5：文件領航員小組

| 項目 | 說明 |
|------|------|
| **英文名** | Document Pilot Crew |
| **職責** | 謄本解析、徵審報告生成、PDF 批覆書輸出 |
| **適用** | 房貸 ✅（謄本解析）信貸 ✅（報告輸出）|
| **API** | `POST /api/parse-document`、`GET /api/credit-review/:id/report` |

**成員組成**：

| 職稱 | 成員 Agent | 核心任務 | 檔案 |
|------|-----------|---------|------|
| 🎖️ 機長 | 謄本 AI 解析員 | Claude Vision 解析不動產謄本 | `documentParser.ts` |
| 📊 成員 | 徵審報告編輯員 | 整合各 Crew 結果為完整徵審報告 | `creditReportGenerator.ts` |
| 🖨️ 成員 | PDF 批覆書輸出員 | pdf-lib 生成正式批覆書 | `pdfGenerator.ts` |

---

### 🤝 Crew 6：客服領航員小組

| 項目 | 說明 |
|------|------|
| **英文名** | Customer Service Pilot Crew |
| **職責** | LINE Bot 對話引導、LIFF 表單收件、進度推播 |
| **適用** | 房貸 ✅ 信貸 ✅ |
| **API** | `POST /api/webhook`（LINE）|

**成員組成**：

| 職稱 | 成員 Agent | 核心任務 | 檔案 |
|------|-----------|---------|------|
| 🎖️ 機長 | LINE Bot 對話引擎 | 狀態機管理、Flex Message 推播 | `conversationHandler.ts` |
| 🗺️ 成員 | 申請引導員 | 對話式收集貸款需求 | `conversationStateMachine.ts` |
| 📣 成員 | 通知推播員 | 行員新案通知 / 客戶核准通知 | `staffNotifier.ts`、`lineService.ts` |
| 🎯 成員 | 產品推薦引擎 | 青安 / 國軍 / 薪轉 智能推薦 | `recommendationEngine.ts` |

---

## 四、Crew 召集矩陣

| Crew | 房貸 | 信貸 | 觸發時機 |
|------|------|------|---------|
| 客服 Crew | ✅ | ✅ | 申請全程 |
| 文件 Crew（解析）| ✅ | ❌ | 謄本上傳後 |
| 法規 Crew | ✅ | ✅ | 工作流啟動後 |
| 徵信 Crew | ✅ | ✅ | 行員啟動徵審 |
| 鑑估 Crew | ✅ | ❌ | 房貸專屬 |
| 審議 Crew | ✅ | ✅ | 所有 Crew 完成後 |
| 文件 Crew（輸出）| ✅ | ✅ | 審議決議後 |
| 客服 Crew（通知）| ✅ | ✅ | 核准 / 婉拒後 |

---

## 五、統一 Crew Response 格式

每個 Crew 的回傳都遵循統一結構，便於指揮艙彙整：

```typescript
interface PilotCrewResponse {
  crewId: string;              // "credit-crew" | "valuation-crew" | ...
  crewName: string;            // 顯示名稱
  status: "success" | "partial" | "failed";
  duration: number;            // 執行時間（ms）
  confidence: number;          // 0–1 可信度
  result: object;              // Crew 專屬結果
  recommendation: string;      // 本 Crew 的建議文字
  warnings: string[];          // 警示事項
}
```

---

## 六、黑客松 Demo 敘事腳本

```
【行員視角】

1. 客戶透過 LINE Bot 填寫申請
   → 客服 Crew 接收，自動整理申請資料

2. 行員在後台看到新案件通知
   → 點擊「啟動 AI 徵審」

3. Co-Pilot 指揮艙召集各 Crew：
   Phase 1：文件 Crew → 謄本解析
   Phase 2：法規 Crew → 合規確認
            徵信 Crew → 信用評估
            鑑估 Crew → 房屋估價（房貸專屬）
   Phase 3：審議 Crew → 三位委員 AI 討論，形成決議

4. 行員確認 → 核准 → 客服 Crew 推播通知客戶
```

---

## 七、未來擴充 Crew（Phase 2）

| Crew | 英文名 | 功能 | 優先級 |
|------|--------|------|--------|
| 貸後管理 Crew | Post-Loan Monitoring Crew | 還款監控、逾期預警 | 🟡 中 |
| 財富管理 Crew | Wealth Management Crew | 理財產品交叉銷售建議 | 🟡 中 |
| GIS 地理 Crew | GIS Intelligence Crew | 捷運站距、學區、商圈評分 | 🟢 低 |
| SHAP 解釋 Crew | Explainability Crew | 估價特徵重要性可視化 | 🟢 低 |

---

## 八、技術棧總覽

| 層級 | 技術 | 用途 |
|------|------|------|
| 工作流引擎 | Node.js + TypeScript（MAF 概念）| 指揮艙編排 |
| 信用評估 | GPT-4o（Azure OpenAI） | 5P 評分、審議委員 |
| 估價模型 | XGBoost + Python（FastAPI）| 個別物件鑑估 |
| 法規問答 | RAG（Azure AI Search + GPT-4o）| 三大知識庫 |
| 文件解析 | Claude Vision API | 謄本 OCR 解析 |
| 前端 | React 18 + TypeScript + Tailwind | 行員後台 + LIFF |
| 通訊 | LINE Messaging API + LIFF SDK | 客戶互動 |
| 資料儲存 | JSON（Demo）→ Azure Cosmos DB（正式）| 案件狀態 |

---

*文件版本 1.0 — 2026-03-29*
*基於黑客松 Demo 架構設計，正式產品化時 Stub 模組將逐步替換為真實模型。*
