# 個金 Co-Pilot 領航員 — 防詐領航員小組（Crew 7）架構設計

> **版本**: 1.0
> **建立日期**: 2026-03-29
> **專案**: 分行神隊友：個金 Co-Pilot 領航員
> **目的**: 防詐 Pilot Crew 設計方向、技術來源對照、實作路徑規劃

---

## 一、Crew 1 vs Crew 7 分工邊界

### 設計原則

原有 **Crew 1（徵信領航員小組）** 的 8 項查核維持不動，定位為「**信用風險查核**」。
新增 **Crew 7（防詐領航員小組）** 聚焦「**申貸真實性與詐騙偵測**」，兩者互不重疊。

| 面向 | Crew 1（徵信領航員） | Crew 7（防詐領航員） |
|------|---------------------|---------------------|
| 核心問題 | 這個人還得起嗎？ | 這個人是真實借款人嗎？ |
| 資料來源 | MyData、聯徵、報稅資料 | 身分文件、黑名單、交易紀錄、關聯圖譜 |
| 輸出 | 信用風險等級（正常/注意/警示） | 詐騙風險等級（低/中/高） |
| 觸發時機 | 所有案件 | 所有案件（並行執行） |
| 結果用途 | 徵審報告第 3 節 | 徵審報告第 7 節（防詐評估） |

### Crew 1 既有 8 項（保留不動）

| 項目 | 查核內容 | 定位 |
|------|----------|------|
| 1 | 證件掃描比對（MyData vs 申請書） | 文件一致性 |
| 2 | 公司及居住地（縣市 / 薪轉） | 地域合理性 |
| 3 | 職業穩定性（職業類別 / 年齡 / 就業穩定性） | 信用風險 |
| 4 | 所得成長性（所得資料完整性） | 信用風險 |
| 5 | 資產淨值（淨值水準） | 信用風險 |
| 6 | 聯徵查詢次數（近 2 個月 > 3 次） | 過度借貸警示 |
| 7 | 銀行借款情形（是否有本行往來） | 往來關係 |
| 8 | 有無不動產（供參考） | 擔保品潛力 |

---

## 二、Crew 7 防詐領航員小組設計

### 小組定位

```
Co-Pilot 指揮艙
      ↓（與 Crew 1-6 並行觸發）
┌─────────────────────────────────────────┐
│     Crew 7：防詐領航員小組               │
│  Anti-Fraud Pilot Crew                  │
│                                         │
│  目標：識別申貸行為異常、詐騙手法、      │
│        身分偽造、人頭帳戶等詐騙模式      │
└─────────────────────────────────────────┘
```

### 成員組成（5 項偵測模組）

#### 成員 A：身分認證防偽核查員（Identity Authenticity Checker）

- **對應協理規格書**：身分認證防偽模組
- **查核邏輯**：
  - OCR 解析身分證、健保卡正反面格式一致性
  - 証件號碼格式驗證（身分證字號邏輯規則）
  - 姓名 / 生日 / 地址三要素與 MyData 比對
  - 照片特徵一致性（黑客松：規則模擬，未來可接臉部辨識 API）
- **黑客松實作**：規則驗證（正規表達式 + MyData 比對邏輯）
- **輸出欄位**：`identityAuthResult: { passed, flags[], score }`

#### 成員 B：黑名單掃描員（Blacklist Scanner）

- **對應協理規格書**：身分風險偵測模組
- **查核邏輯**：
  - 身分證號比對內部黑名單（詐欺前科、惡意違約）
  - 電話號碼比對詐騙通報資料庫（黑客松：Mock 靜態清單）
  - 地址比對已知詐騙集團地址（黑客松：Mock 靜態清單）
  - 聯徵「拒絕往來戶」查詢結果
- **黑客松實作**：靜態 Mock 黑名單 JSON + 規則比對
- **輸出欄位**：`blacklistResult: { hit, matchedFields[], riskLevel }`

#### 成員 C：異常申貸行為偵測員（Abnormal Application Behavior Detector）

- **對應協理規格書**：異常行為偵測模組
- **查核邏輯**（對應協理規格書 7 項特徵）：
  1. 短期多行申貸（聯徵近 2 月查詢 > 3 次，與 Crew 1 項目 6 聯動）
  2. 申請金額異常（金額 / 年收比 > 10 倍）
  3. 貸款用途與職業不符（例：學生申請大額企業週轉）
  4. 聯絡電話近期更換（MyData 資料 vs 申請書不一致）
  5. 地址填寫不完整或使用虛擬辦公室地址
  6. 申請時間異常（深夜 / 節假日密集申請）
  7. 同一 IP / 裝置多次申請不同姓名（黑客松：模擬欄位）
- **黑客松實作**：規則引擎（7 條規則，計分制，≥ 3 分觸發警示）
- **輸出欄位**：`behaviorResult: { score, triggeredRules[], level }`

#### 成員 D：LLM 交易行為分析員（LLM Transaction Behavior Analyzer）

- **對應協理規格書 + PPT**：LLM 規則產生 + Deep SHAP 可解釋性
- **設計說明**：
  - PPT 研究成果：用 GPT-5 分析歷史交易序列，自動產生可程式化防詐規則
  - 規則範例：「薪資入帳後 24 小時內轉出 90% → 高風險」
  - 規則範例：「每月固定日期轉帳至同一帳號 → 疑似人頭帳戶特徵」
  - Deep SHAP：可解釋哪些交易特徵貢獻了風險分數
- **黑客松實作**：**模擬資料**（預設 3-5 條 Mock 規則 + 模擬交易序列）
- **未來規劃**：串接核心帳務系統 API，LLM 即時分析真實交易序列
- **輸出欄位**：`transactionResult: { mockMode: true, triggeredPatterns[], riskScore }`

#### 成員 E：關聯網絡分析員（Network Association Analyzer）

- **對應協理規格書**：關聯網絡分析模組
- **設計說明**：
  - 協理規格書設計：建立借款人、擔保人、保人、企業間的圖形網絡
  - 偵測「共同擔保人 / 保人」涉及多案異常
  - 偵測同一電話 / 地址關聯多位申請人
  - 偵測家族連鎖借貸（父母子女同時申請大額）
- **黑客松實作**：**規則模擬**（靜態 Mock 關聯清單，2-3 條規則）
- **未來規劃**：圖資料庫（Neo4j / Azure Cosmos DB Gremlin）+ 圖神經網路
- **輸出欄位**：`networkResult: { mockMode: true, suspiciousLinks[], alertLevel }`

---

## 三、綜合評分與警示等級

### 評分規則

```typescript
// 各成員輸出分數（0-100）
const fraudScore = weightedAverage([
  { score: identityAuthResult.score,  weight: 0.30 },  // 身分認證最重要
  { score: blacklistResult.riskLevel, weight: 0.25 },  // 黑名單次之
  { score: behaviorResult.score,      weight: 0.25 },  // 異常行為
  { score: transactionResult.riskScore, weight: 0.10 }, // 交易分析（Mock）
  { score: networkResult.alertLevel,  weight: 0.10 },  // 關聯分析（Mock）
]);
```

### 警示等級判定

| 等級 | 條件 | 建議處理 |
|------|------|----------|
| **低風險** `low` | 綜合分數 < 30 | 正常流程辦理 |
| **中風險** `medium` | 30 ≤ 分數 < 60，或任一成員觸發 | 強化徵信，主管覆核 |
| **高風險** `high` | 分數 ≥ 60，或黑名單命中，或身分認證失敗 | 建議拒絕，呈報防詐中心 |

---

## 四、批覆書整合方案

### 新增第 7 節：防詐領航員評估結果

在現有 `creditReportGenerator.ts` 輸出的徵審報告中，新增以下段落：

```
七、防詐領航員評估結果
═══════════════════════════════════════

綜合防詐風險等級：【低風險 / 中風險 / 高風險】
防詐評分：XX / 100

┌─────────────────────────────────────────────────┐
│ 查核項目            │ 結果     │ 說明            │
├─────────────────────────────────────────────────┤
│ A. 身分認證防偽      │ ✓ 通過   │ 三要素比對一致  │
│ B. 黑名單掃描        │ ✓ 未命中 │ 無紀錄          │
│ C. 異常申貸行為      │ ⚠ 注意   │ 觸發規則：...   │
│ D. 交易行為分析      │ ✓ 正常   │（模擬資料）     │
│ E. 關聯網絡分析      │ ✓ 正常   │（模擬資料）     │
└─────────────────────────────────────────────────┘

處理建議：[根據等級自動生成文字]

注意：D、E 項目於黑客松階段使用模擬資料，
      正式上線需串接交易系統與圖資料庫。
═══════════════════════════════════════
```

---

## 五、實作路徑規劃

### 目錄結構

```
src/main/typescript/services/
├── creditReview/
│   ├── fraudDetector.ts          ← 現有 Crew 1（8 項，不動）
│   ├── creditReviewService.ts    ← 新增呼叫 Crew 7
│   └── creditReportGenerator.ts ← 新增第 7 節輸出
│
└── antifraud/                   ← 新建目錄（Crew 7）
    ├── index.ts                 ← Crew 7 入口，整合 5 個成員輸出
    ├── identityChecker.ts       ← 成員 A：身分認證防偽
    ├── blacklistScanner.ts      ← 成員 B：黑名單掃描
    ├── behaviorDetector.ts      ← 成員 C：異常申貸行為
    ├── transactionAnalyzer.ts   ← 成員 D：LLM 交易分析（Mock）
    └── networkAnalyzer.ts       ← 成員 E：關聯網絡分析（Mock）
```

### 核心介面（TypeScript）

```typescript
// src/models/antifraud.ts（新建）
export interface AntiFraudResult {
  crewId: 'crew7';
  crewName: '防詐領航員小組';
  overallScore: number;             // 0-100
  overallLevel: 'low' | 'medium' | 'high';
  message: string;
  members: {
    identityAuth: IdentityAuthResult;
    blacklist: BlacklistResult;
    behavior: BehaviorResult;
    transaction: TransactionResult;  // mockMode: true
    network: NetworkResult;          // mockMode: true
  };
  recommendation: string;
  mockDataUsed: boolean;             // 黑客松標記
}
```

### 與工作流整合

```
workflowService.ts（指揮艙）
    ├── Crew 1：fraudDetector.detectFraud()          ← 現有
    └── Crew 7：antiFraudCrew.runAntiFraudCheck()    ← 新增（並行執行）

    ↓ 合併結果
creditReportGenerator.generateReport()
    ├── 第 3 節：信用風險查核（Crew 1 輸出）        ← 現有
    └── 第 7 節：防詐評估（Crew 7 輸出）            ← 新增
```

---

## 六、技術來源對照

| Crew 7 成員 | 協理規格書對應 | PPT 研究對應 | 黑客松實作方式 |
|------------|-------------|------------|--------------|
| A. 身分認證防偽 | 身分認證防偽模組（4項特徵） | — | 規則驗證 |
| B. 黑名單掃描 | 身分風險偵測模組（黑名單比對） | — | Mock 靜態清單 |
| C. 異常申貸行為 | 異常行為偵測模組（7項特徵） | — | 規則引擎計分 |
| D. 交易行為分析 | — | LLM 規則產生 + Deep SHAP | **模擬資料** |
| E. 關聯網絡分析 | 關聯網絡分析模組（圖形網絡） | — | **規則模擬** |

---

## 七、黑客松 Demo 腳本（Crew 7 段落）

```
行員：「李先生的申請書送出後，防詐領航員小組同步啟動...」

[後台管理介面顯示 Crew 7 進度卡]

「五位成員同時出發：
  ✓ 身分認證防偽核查員 → 通過
  ✓ 黑名單掃描員 → 未命中
  ⚠ 異常申貸行為偵測員 → 近 2 個月查詢 4 次，觸發注意
  ✓ LLM 交易行為分析員 → 低風險（Demo 模擬）
  ✓ 關聯網絡分析員 → 無異常關聯（Demo 模擬）

防詐綜合評分：28/100（低風險）
建議：正常流程辦理，異常申貸行為已記錄供參考」
```

---

## 八、後續發展路線

### 黑客松（當前）
- 5 個成員全部實作，D/E 使用模擬資料
- 徵審報告新增第 7 節輸出
- 後台管理介面顯示 Crew 7 進度卡

### 正式版 Phase 1（黑客松後 3 個月）
- 成員 D 串接核心帳務系統 API
- 成員 B 串接金融聯合徵信中心黑名單 API
- LLM 交易分析使用真實交易序列

### 正式版 Phase 2（協理規格書長遠規劃）
- 成員 E 導入圖資料庫（Azure Cosmos DB Gremlin）
- 圖神經網路（GNN）偵測複雜關聯網絡
- Deep SHAP 可解釋性報告
- 即時風險預警（串接核心系統事件流）

---

*文件對應 pilot-crew-architecture.md 的 Crew 7 延伸設計*
*技術來源：協理規格書（個人貸款自動徵審模型第二階段）+ PPT（Status Report 20260204 LLM v2）*
