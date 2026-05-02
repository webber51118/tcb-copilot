# 個金Co-Pilot領航員

**分行神隊友：個金 Co-Pilot 領航員**

AI 驅動的銀行貸款審核平台，整合智能對話推薦、視覺海報生成、自動徵審、機器學習鑑價與法規智能問答。

## Quick Start

1. **Read CLAUDE.md first** - Contains essential rules for Claude Code
2. Follow the pre-task compliance checklist before starting any work
3. Use proper module structure under `src/main/`
4. Commit after every completed task

## Project Structure

```
src/
├── main/
│   ├── typescript/     # Frontend (React) + Backend (Node.js)
│   │   ├── core/       # Core business logic
│   │   ├── utils/      # Utility functions
│   │   ├── models/     # Data models
│   │   ├── services/   # Service layer
│   │   └── api/        # API endpoints
│   ├── python/         # ML models
│   │   ├── core/       # Core ML algorithms
│   │   ├── models/     # Model definitions
│   │   ├── training/   # Training scripts
│   │   ├── inference/  # Prediction code
│   │   └── evaluation/ # Model evaluation
│   └── resources/      # Config and assets
└── test/
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Claude API + Canvas API
- **Backend**: Node.js 20 + TypeScript + Microsoft Agent Framework
- **ML**: LSTM (TensorFlow) + Random Forest (scikit-learn) + SDE Monte Carlo
- **RAG**: Azure AI Search + GPT-4o + Cosmos DB
- **Cloud**: Azure (App Service, Cosmos DB, AI Search, ML)

## 黑客松衝刺進度（截止 5/20 17:00）

> **內部審閱目標**：5/15 前完成主要功能，提供個金部同仁測試
> **正式截止**：5/20 17:00 上傳 PPT + 影片

### Demo 九大功能狀態

| # | 功能 | 程式碼 | 平台設定 | 備註 |
|---|------|--------|---------|------|
| ① | LINE 主選單 → 房貸 / 信貸資料收集 | ✅ | — | 完成 |
| ② | InstructRec 三層推薦 + 個人化說明 | ✅ | — | 完成 |
| ③ | P2-A 月還款互動試算卡 | ✅ | — | 完成 |
| ④ | 一鍵申辦 → 三位一體 PILOT CREW 並行審核 | ✅ | — | 完成 |
| ⑤ | 台語語音 Breeze-ASR-26 | ✅ Demo fallback | — | 完成（Demo 模式） |
| ⑥ | Copilot Studio 行員助理 Agent | ✅ Instructions 完成 | 🔜 上傳知識庫 | 等取回操作手冊 |
| ⑦ | Power Automate → Teams 防詐警示 | ✅ Adaptive Card 完成 | 🔜 等 Webhook URL | 等顧問開放權限 |
| ⑧ | Power BI 行員儀表板 | ✅ TS 層完成 | 🔜 建立 Dataset | 平台操作待完成 |
| ⑨ | SharePoint PDF 歸檔（Graph API） | ✅ | 🔜 等 Site ID | 等管理員授權 |

### 衝刺時間軸

```
5/02        ✅ Copilot Studio Instructions 完成、知識庫精簡（25,780→1,942行）
5/02        ✅ Session 持久化（in-memory → JSON）完成（提前達標）
5/08 前     Copilot Studio 知識庫上傳（取回操作手冊後）
            Power BI Push Dataset 建立 + 三 Tab 報表
            Microsoft Forms 問卷建立 → 填入 .env
5/12 前     Demo 黃金測資完整驗收
            Teams 防詐警示（等顧問 Webhook URL）
5/15        ⭐ 個金部同仁內部審閱
5/15–19     修正回饋、PPT 製作、Demo 影片錄製
5/20 17:00  🏁 上傳 PPT + 影片
```

### 待解除封鎖項目

| 項目 | 等待對象 | 行動 |
|------|---------|------|
| Teams Webhook URL | IT 顧問 | 已發出權限申請 |
| SharePoint Site ID | 租戶管理員 | 需管理員同意 Sites.ReadWrite.All |
| Copilot Studio 知識庫 | 操作手冊文件 | 去公司取回後上傳 |
| Microsoft Forms URL | 自行建立 | 建立後填入 MICROSOFT_FORMS_URL |

---

## Development Guidelines

- **Always search first** before creating new files
- **Extend existing** functionality rather than duplicating
- **Use Task agents** for operations >30 seconds
- **Single source of truth** for all functionality
- **Commit after each feature**
