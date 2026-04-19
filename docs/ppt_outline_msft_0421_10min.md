# 個金 Co-Pilot 領航員：微軟顧問約談精簡版（7 張投影片）

> **用途**：4/21 微軟顧問第一次架構約談（10 分鐘版）
> **目標**：大方向對齊 + 三個問題丟給顧問，開啟討論
> **時長**：10 分鐘簡報 + 開放討論
> **版本**：v1 精簡版（2026-04-19）
> **對應**：從 20 分鐘完整版濃縮，口述補足細節

---

## 投影片大綱

---

### 投影片 1【封面 + 破題】
標題：分行神隊友：個金 Co-Pilot 領航員
副標：行員掌舵，Agent 執行

破題三行：
• 2022 Prompt Engineering — 學會問對問題，讓 AI 給出好答案
• 2024 Context Engineering — 給 AI 完整背景，讓它理解複雜任務
• 2026 Harness Engineering — 人類定義邊界與目標，AI 在邊界內全速執行

核心主張：不是讓 AI 取代行員，而是讓行員掌舵、Agent 全速執行
"Humans steer. Agents execute." — Harness Engineering

標籤：2026 Microsoft Copilot 黑客松｜微軟顧問架構約談 4/21

---

### 投影片 2【三大斷點 + 機會規模】
標題：個金業務三大斷點：個金部已知道問題在哪，Co-Pilot 讓規劃真正落地

三欄卡片設計（左：深綠 / 中：金色 / 右：深藍）：

---

📱 左欄【前端（獲客斷點）】
卡片標題：數位體驗斷裂與高齡落差

個金部現行規劃（斜體小字）：
擴大數位申辦管道，推動線上進件

現實與根因：
• LINE Bot 只是導流工具，點擊即跳轉，客戶在進件前就流失
• 400 萬高齡長輩無法適應 App，台語入口完全缺席
• 缺乏自然語言互動，規劃再好客戶端就是進不來

Co-Pilot 補足（綠色小字）：
→ 台語 ASR + LINE 完整申貸閉環，進件前不再流失

---

⚙️ 中欄【中端（營運斷點）】
卡片標題：規則引擎撞上自動化天花板

個金部現行規劃（斜體小字）：
自動過件率目標 2.5 成 → 5–7 成
MyData 所得 / 勞保資料自動帶入
不動產自動估價系統（與授管部協商中）

現實與根因：
• 規則 IF/THEN 設計保守，稍微複雜的案件就落人工
• MyData 能帶入資料，但系統無法「理解」資料
• 鑑估還是靠行員人工輸入合理單價，結果因人而異
• 根因：規則無法學習，每次法規更新都要人工改參數

Co-Pilot 補足（綠色小字）：
→ XGBoost 非線性學習 + Critic Agent 灰色地帶裁量
→ Monte Carlo 鑑估取代人工查詢，15 秒出結果

---

📁 右欄【後端（資料斷點）】
卡片標題：資料孤島阻斷 AI 進化路徑

個金部現行規劃（斜體小字）：
整合 Open Data（實價登錄 / 主計總處薪資大數據）
貸後自動化管理（資金流向 / 設定 / 保險 / 實登比對）
分行回報流程數位化

現實與根因：
• 實價登錄 / 薪資大數據散落各處，格式不統一
• 分行回報依賴 Excel / PDF，總行撈數據跨系統查詢
• 貸後追蹤靠行員人工，常遺漏，衍生稽核缺失
• 根因：資料不 AI-readable，Open Data 整合進來也用不了

Co-Pilot 補足（綠色小字）：
→ MD + YAML 結構化 + Azure AI Search + Cosmos DB
→ 總行 Power BI 即時看所有分行，貸後自動告警

---

右側大數字：
40 件/月 × 300 家分行 = 年審件天花板 144,000 件
→ 效率提升 10 倍 = 釋放 130,000 件/年潛在產能
個金放款每年逾新台幣 2 兆元

底部連結句：
前端解決獲客流失、中端突破自動化天花板、後端讓 Open Data 真正可被 AI 利用——
三個斷點對應 Co-Pilot 的五大 Crew 與資料策略全景

---

### 投影片 3【四層架構全景 + 五大 Crew】
標題：四層架構：護欄在前、指揮在中、Crew 執行、Azure 在底

四層堆疊：
【護欄層 Harness】
  Guides：Co-Pilot 行為規範文件 · 對話狀態機 · DBR/LTV 合規紅線 · RAG 優先序
  Sensors：recordAgentCall() · Admin 監控看板 · Azure App Insights

【編排層 Co-Pilot 指揮艙】
  workflowService.ts — 條件式派工，Phase 1 鑑估 → Phase 2 徵審+法規 → Phase 3 委員會

【執行層 五大 Pilot Crew】
  Crew 1 數據徵信（判別式 AI）— 5P 評分 + MyData 整合
  Crew 2 鑑估風控（XGBoost + Monte Carlo）— 2–3天 → 15秒，RMSE < 8%
  Crew 3 法規合規（Azure OpenAI + RAG）— 三庫向量搜尋 + 批覆書自動生成
  Crew 4 防詐審議（異常偵測 + Critic Agent + 複審機制）
  Crew 5 行銷客服（推薦系統 + 台語 ASR + LINE Bot 完整申貸閉環）

【底座層 Azure】
  AI Search（已接入）· App Insights（P1）· Cosmos DB（P2）· AI Foundry（未來）

底部混合模型說明：
Azure OpenAI（法規推理 / 審議）+ Qwen2.5 開源（推薦說明，版本自控，不受降智影響）

【口述補充：業界先例】
某台灣本土銀行用 RAG + Azure OpenAI 做授信，審件從 3–5 天縮短到 36 小時。
Co-Pilot 在這個基礎上加 Orchestrator + LLM 兩層，進一步壓縮到 90 秒 AI 初審。

---

### 投影片 4【LINE Bot × 推薦系統 × 資料策略】
標題：三個差異化賣點：LINE 完整申貸 × 智慧推薦 × AI-readable 資料

左欄【LINE 完整申貸閉環】：
現行：點擊 → 彈窗 → 跳 App → 放棄
Co-Pilot：諮詢 → 推薦 → 申辦 → 追蹤 → 核准，全程不離開 LINE（< 3 分鐘）
台語語音：「我想借錢買厝」直接辨識，65 歲以上族群 400 萬人服務到位

中欄【三層推薦引擎 × 新舊客戶分流】：
舊客戶 → Collaborative Filtering（Netflix 演算法）
  「申辦青安的客戶 68% 同時辦了御璽卡 + 房貸壽險」→ 套餐自動組合
新客戶 → InstructRec Cold Start（ArXiv 2023）
  填表即下指令，不需歷史資料，冷啟動不卡關
合庫全產品線整合：房貸 / 信貸 / 信用卡 / 財富管理 / 保險 / 信託

右欄【AI-readable 資料策略】：
法規 + 案件 + 產品 → MD + YAML + README 索引
→ RAG 即時可用（新增公文 30 秒進知識庫）
→ 批覆書 = 監督學習標籤（案件越多模型越準）
→ Cosmos DB + Power BI → 總行即時看所有分行，不需手動回報
→ 未來：Graph RAG 知識圖譜升級

---

### 投影片 5【Azure 三軌四階段遷移路徑】
標題：三軌整合：四週可完成第一軌，架構已預留所有 Azure 接口

| Phase | AI 核心軌 | 資料平台軌 | 企業協作軌 |
|-------|-----------|-----------|-----------|
| Phase 1（已完成）| Azure OpenAI + Qwen2.5 本地 + Breeze-ASR-26 | JSON + Azure AI Search（P0）| LINE Bot 前端 |
| Phase 2（4 週）| Azure OpenAI GPT-4o 統一管理 | Cosmos DB（案件 + 對話）| Azure Bot Service 多頻道 |
| Phase 3（8 週）| Azure AI Foundry Hosted Agents | Azure ML（XGBoost 版控）| M365 Copilot 行員端 |
| Phase 4（12 週）| Azure AI Studio + LoRA Fine-tuning + 資料科學家計畫 | Synapse Analytics | Teams 審議室 + Power BI |

Azure AI Foundry 托管優勢：
• 無需自建基礎設施，Crew 狀態可視化，自動 scaling
• Entra ID 每個 Agent 獨立身份，Private Networking，金融合規

---

### 投影片 6【三方責任表 + 落地可行性】
標題：合庫 × Microsoft × 架構：責任清晰，落地路徑可行

三欄責任表：
【合庫貢獻】個金領域知識 / 法規知識庫 / E-LOAN 5P 規則基礎 / 真實案件資料
【Microsoft】Azure AI Foundry / Azure OpenAI / Microsoft RAI / Azure Security / GTM 資源
【現有架構】MAF Orchestrator / Harness 護欄 / RAG 三庫 / 三層推薦引擎 / 混合模型策略

落地可行性說明：
• 台灣金融 AI 已有同業以 RAG + Azure OpenAI 完成授信落地（已轉正）
• 開源模型 Qwen2.5 支援 LoRA Fine-tuning，Phase 4 可與學術單位產學合作
• 每個 Phase 獨立可交付，風險可控
• 資料科學家需求：短期產學合作，中長期建立內部 AI 團隊

給微軟顧問的三個問題：
❓ Q1：Foundry Hosted Agents 台灣區資料落地合規如何處理？有無台灣區時程？
❓ Q2：recordAgentCall() 自建監控 vs Foundry 原生 Agent 追蹤，能直接替換嗎？
❓ Q3：Phase 2 PoC 啟動（4 週 AI Search + App Insights），Microsoft 資源投入模式？

---

### 投影片 7【結語】
標題：讓每位客戶都有專屬的 AI 貸款顧問
副標：行員掌舵，Agent 執行 — 分行神隊友，個金 Co-Pilot 領航員

三個下一步：
• ✅ 黑客松 Demo Day（4/26）：完整展示三大情境，端到端流程可驗證
• 🤝 邀請 Microsoft 共同設計 PoC：4 週 Phase 2 計畫
• 🚀 分行試跑（Q3 2026）：1 個分行，3 個月，量測效率與風險指標

ROI：40 件/月 → 400 件/月（×10），年省工時 ≈ 1,500 萬小時
相當於新增 7,000 名全職行員的產能——不需要增加一個人力

---

## 10 分鐘節奏建議

| 時間 | 投影片 | 重點 |
|------|--------|------|
| 0:00–0:45 | 1 | 三階段破題，Humans steer. Agents execute. |
| 0:45–2:00 | 2 | 三大斷點（前/中/後端），口述三斷點對應三解法 |
| 2:00–4:30 | 3 | 四層架構全景，五 Crew 說清楚，口述業界先例 |
| 4:30–6:30 | 4 | 三個差異化賣點：LINE 申貸 / 推薦系統 / AI-readable |
| 6:30–7:30 | 5 | Azure 三軌，遷移路徑清楚 |
| 7:30–9:00 | 6 | 三方責任表 + 落地可行性 + 三個問題 |
| 9:00–10:00 | 7 | 結語 ROI |
| 10:00→ | — | 顧問回答三個問題，開啟討論 |

---

## 與 20 分鐘版的對照

| 20 分鐘版張數 | 精簡版處理方式 |
|-------------|-------------|
| S1 封面 | ✅ 保留 |
| S2 五大斷點 | ✅ 保留，每點縮短為兩行 |
| S2.5 行內現況 × AI 補足 | ❌ 刪除，整合進 S3 口述 |
| S3 四層架構 | ✅ 保留 |
| S3.5 資料策略 | 整合進 S4 右欄（精簡版） |
| S4 Harness 護欄 | ❌ 刪除，整合進 S3 說明 |
| S5 HITL + 委員會 | ❌ 刪除，整合進 S3 Crew 4 說明 |
| S5.5 LINE Bot × 推薦 | 整合進 S4（三個差異化賣點）|
| S6 推薦演算法技術深化 | 整合進 S4 中欄 |
| S7 Azure 三軌 | ✅ 保留 |
| S8 三方責任表 | ✅ 保留，加落地可行性 |
| S9 結語 | ✅ 保留 |

---

## 口述備忘（不出現在投影片）

**S3 講架構時口述業界先例**：
> 「台灣金融業已有同業用 RAG + Azure OpenAI 做授信，
> 審件從傳統 3–5 天縮短到 36 小時，金管會沙盒已轉正。
> Co-Pilot 在這個基礎上多了 Orchestrator 並行 + LLM 生成批覆書，
> 把 36 小時進一步壓縮到 90 秒 AI 初審。」

**S4 講推薦系統時口述開源模型**：
> 「推薦說明用 Qwen2.5 開源模型本地推論——
> 不受雲端廠商靜默更新影響，版本自己控制，
> 而且開源模型才能做 Fine-tuning，
> Phase 4 我們計畫做金融領域的 LoRA 微調。」

**S6 講落地可行性時口述資料科學家**：
> 「Fine-tuning 需要資料科學家，我們的規劃是：
> 短期與學術單位產學合作，
> 中長期隨著 PoC 成果建立內部 AI 團隊。
> 這不是額外成本，這是把銀行業務知識轉化成 AI 資產的必要投資。」
