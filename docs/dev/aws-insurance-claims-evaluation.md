# AWS 保險理賠 EKS 專案評估報告

> **評估日期**: 2026-04-01
> **評估對象**: [aws-samples/sample-agentic-insurance-claims-processing-eks](https://github.com/aws-samples/sample-agentic-insurance-claims-processing-eks)
> **評估目的**: 分析適用性，作為個金 Co-Pilot 後端架構參考依據

---

## 一、專案定位

AWS 官方出品的生產等級 Demo，展示如何用 **LangGraph + AWS EKS** 建立多 Agent 保險理賠自動審核系統，含詐欺偵測、人工介入、合規稽核。

---

## 二、系統架構全貌

### 核心 Agent 節點（7 個）

```
提交理賠
    │
    ▼
① analyze_claim         ← 多來源資料富化 + LLM 優先度評估
    │
    ▼
② route_agents          ← 決定派遣哪些 Agent
    │
    ▼
③ execute_parallel      ← 詐欺 Agent + 保單 Agent 並行執行
    │
    ▼
④ evaluate_collaboration ── 需要深查？
    │                          │
    │ 否                       │ 是
    ▼                          ▼
⑤ aggregate_results   ⑥ coordinate_investigation
    │                          │
    └──────────┬───────────────┘
               ▼
       ⑦ human_routing         ← 強制人工決策
               │
              END
```

### 條件邊邏輯

| 詐欺分數 | 觸發行為 |
|---------|---------|
| > 0.7   | SIU 特調部升級（強制人工）|
| > 0.4   | 加強調查路徑 |
| ≤ 0.4   | 標準流程 |

### StateGraph 狀態欄位

```python
CoordinatorState:
  messages, claim_data, agent_assignments, agent_results,
  coordination_strategy, priority_level, collaboration_needed,
  ai_recommendation, human_routing_decision, reasoning_chain,
  regulatory_requirements, active_workflows
```

---

## 三、詐欺偵測引擎（`langgraph_fraud_agent.py`）

### 加權評分公式

```python
final_score = (金額風險 × 0.3) + (行為模式 × 0.5) + (0.2 × (1 - 調查因子))
```

### 五大查核維度

| 維度 | 查核項目 | 權重 |
|------|---------|------|
| 金額分析 | 金額/保額比、整數金額偵測、接近保額上限 | 0.30 |
| 行為模式 | 高額理賠(>$25,000)、週末事故、描述過短(<50字) | 0.50 |
| 歷史紀錄 | 過往理賠頻率、信用評分 0.0-1.0 | 含於模式 |
| ML 梯度提升 | 15+ 特徵（天氣、地理、報案延遲）| 輔助評分 |
| LLM 推理 | 真實 LLM 分析，非 mock，生成決策建議 | 綜合判斷 |

### 關鍵設計原則

> **「AI 提供分析建議，人類保留決策權」**
> `human_decision_required: True` 防止 AI 自動拒絕理賠，符合保險業法規要求。

---

## 四、Agent 協商協議（`agent_negotiation_protocol.py`）

### 六種協商類型

```
resource_allocation     任務資源分配
task_assignment         工作派遣
conflict_resolution     衝突仲裁
priority_negotiation    優先序競爭
information_sharing     資訊交換
collaborative_planning  協同規劃
```

### 信任分數機制

| 事件 | 分數變化 |
|------|---------|
| 協作成功 | +0.05 |
| 協作失敗 | -0.05 |
| 提案接受閾值 | > 0.8 |

### 協商策略

- **合作型（Cooperative）**: 最大化雙方收益
- **競爭型（Competitive）**: 爭取最大自身利益
- **自適應型（Adaptive）**: 依歷史動態切換

---

## 五、Human-in-the-Loop 設計（`human_workflow_manager.py`）

### 九層角色與核准權限

| 角色 | 核准上限 | 備註 |
|------|---------|------|
| FNOL 專員 | 無核准權 | 初始受理 |
| 理賠員 | $10,000 | 一般案件 |
| 資深理賠員 | $50,000 | 中型案件 |
| 理賠經理 | $500,000 | 大型案件 |
| 核保員 | 保單修改 | 承保調整 |
| SIU 調查員 | 詐欺案件 | 特調介入 |
| 精算師 | 準備金調整 | 財務管控 |
| 法務顧問 | 訴訟案件 | 法律風險 |
| 主管 | 例外處理 | 最終裁量 |

### 自動升級觸發條件

- 詐欺分數 > 0.7 → 指派 SIU 調查員
- 理賠金額 > $100,000 → 資深理賠員審查
- 保障範圍爭議 → 核保員介入
- 接近核准上限 80% → 自動升級下一層

### 合規時限追蹤

| 事項 | 法定期限 |
|------|---------|
| 保障範圍決定 | 30 天 |
| 和解提案 | 45 天 |
| 詐欺通報 | 10 天 |

---

## 六、動態工作流引擎（`dynamic_workflow_engine.py`）

工作流會**自我優化**，根據執行歷史調整路徑：

| 機制 | 觸發條件 | 行為 |
|------|---------|------|
| 節點停用 | 成功率 < 0.3 | 自動禁用該節點 |
| 信心調升 | 持續高效能 | 提高執行閾值 |
| 捷徑建立 | 高頻成功路徑 | 建立直達邊 |
| Fallback | 節點失敗 | 啟動備援策略 |

---

## 七、主管儀表板 KPI

```
損失比率    = (損失金額 + 費用) / 已賺保費    目標 < 70%
綜合比率    = 損失比率 + 費用比率             目標 < 100%
平均處理時間 = 2.3 分鐘
AI 建議準確率 = 94.7%
詐欺攔截率   = 10–15%
系統可用率   = 99.2%
```

---

## 八、技術棧清單

| 層級 | 技術 |
|------|------|
| 容器編排 | AWS EKS（Kubernetes 1.33）|
| 基礎設施即程式碼 | Terraform 1.5+ |
| AI 框架 | LangGraph |
| LLM | Ollama（Qwen2.5，本地推理）|
| 後端 | FastAPI + Python 3.11 |
| 資料庫 | MongoDB 6.0 |
| 快取 | Redis |
| ML 模型 | 梯度提升（詐欺）+ 隨機森林（嚴重度）|
| 監控 | AWS CloudWatch + 自訂指標 |
| 安全 | IAM IRSA + Secrets Manager + RBAC + TLS |

---

## 九、與個金 Co-Pilot 的對照

### 業務邏輯對照

| AWS 保險理賠 | 個金 Co-Pilot | 可借鑒程度 |
|------------|--------------|-----------|
| 詐欺分數加權公式 | Crew 7 防詐評分 | ✅ 公式可直接參考 |
| 行為模式五項查核 | Crew 7 五大查核項目 | ✅ 邏輯高度吻合 |
| SIU 升級機制 | 高風險案件行員警示 | ✅ 可新增升級邏輯 |
| Agent 協商協議 | Crew 4 審議小組辯論 | ✅ 信任分數機制可借鑒 |
| 動態 Workflow 引擎 | MAF 固定流程 | ⭕ 未來可升級 |
| Human-in-the-Loop | 行員核准/婉拒 | ✅ 九層可精簡為 3 層 |
| 主管 KPI 儀表板 | AdminDashboardPage | ✅ 損失比率指標可對應 |
| 精算模型（RF + 梯度提升）| LSTM + RF + SDE | ✅ 雙模型邏輯相同 |
| 合規時限追蹤 | RAG 法規查核 | ✅ 概念相同 |

### 技術棧差異

| 項目 | AWS 專案 | 個金 Co-Pilot |
|------|---------|--------------|
| 後端語言 | Python + FastAPI | Node.js + TypeScript |
| AI 框架 | LangGraph | MAF |
| LLM | Ollama（本地）| Azure OpenAI + Claude |
| 雲端平台 | AWS | Azure |
| 資料庫 | MongoDB | Azure Cosmos DB |

---

## 十、結論與建議

### 適用性評分

| 維度 | 評分 | 說明 |
|------|------|------|
| 業務邏輯吻合度 | ⭐⭐⭐⭐⭐ | 保險理賠 ≈ 銀行授信，幾乎 1:1 對應 |
| 詐欺偵測設計 | ⭐⭐⭐⭐⭐ | 公式、查核項、升級機制完整 |
| Human-in-the-Loop | ⭐⭐⭐⭐⭐ | 設計最嚴謹，符合金融合規要求 |
| 技術棧直接採用 | ⭐⭐ | AWS / Python 與現有架構衝突 |
| 黑客松即用性 | ⭐⭐ | 需要重大改寫 |
| 長期 Production 參考 | ⭐⭐⭐⭐⭐ | 最佳參考藍圖 |

### 立即可行（黑客松前）

1. **強化 Crew 7 評分公式**：參考 `金額×0.3 + 行為模式×0.5 + 調查因子×0.2`
2. **儀表板新增 KPI**：平均徵審時間、AI 準確率、防詐攔截率
3. **高風險升級警示**：防詐分數 > 70 → 紅色警告 + 行員強制介入提示

### 黑客松後（Production 路線圖）

1. 參考九層角色設計，擴充行員權限分層（一般行員 / 資深行員 / 主管）
2. 引入動態 Workflow 自適應引擎（節點效能追蹤）
3. 合規時限追蹤模組（授信 7 天、通知 3 天等法規要求）
4. Agent 協商協議強化 Crew 4 審議小組辯論品質
