# CLAUDE.md - 個金Co-Pilot領航員

> **Documentation Version**: 1.0
> **Last Updated**: 2026-02-15
> **Project**: 個金Co-Pilot領航員
> **Description**: 分行神隊友：個金 Co-Pilot 領航員 — AI 驅動的銀行貸款審核平台
> **Features**: GitHub auto-backup, Task agents, technical debt prevention

This file provides essential guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言風格規範 (tcb-language-style)

- 所有技術文件、程式碼註解說明、以及對話回覆，必須使用**繁體中文**。
- 專用術語需符合**台灣金融業習慣**（例：徵信、授信、鑑價、負債比、寬限期、成數等）。
- 提交訊息（commit message）的描述部分使用繁體中文，類型前綴維持英文（feat/fix/docs 等）。

## 重要規則 - 請先閱讀

### ABSOLUTE PROHIBITIONS
- **NEVER** create new files in root directory → use proper module structure
- **NEVER** write output files directly to root directory → use designated output folders
- **NEVER** create documentation files (.md) unless explicitly requested by user
- **NEVER** use git commands with -i flag (interactive mode not supported)
- **NEVER** use `find`, `grep`, `cat`, `head`, `tail`, `ls` commands → use Read, Grep, Glob tools instead
- **NEVER** create duplicate files (manager_v2.py, enhanced_xyz.py, utils_new.js) → ALWAYS extend existing files
- **NEVER** create multiple implementations of same concept → single source of truth
- **NEVER** copy-paste code blocks → extract into shared utilities/functions
- **NEVER** hardcode values that should be configurable → use config files/environment variables
- **NEVER** use naming like enhanced_, improved_, new_, v2_ → extend original files instead

### MANDATORY REQUIREMENTS
- **COMMIT** after every completed task/phase - no exceptions
- **GITHUB BACKUP** - Push to GitHub after every commit: `git push origin main`
- **USE TASK AGENTS** for all long-running operations (>30 seconds)
- **TODOWRITE** for complex tasks (3+ steps) → parallel agents → git checkpoints → test validation
- **READ FILES FIRST** before editing - Edit/Write tools will fail if you didn't read the file first
- **DEBT PREVENTION** - Before creating new files, check for existing similar functionality to extend
- **SINGLE SOURCE OF TRUTH** - One authoritative implementation per feature/concept

### EXECUTION PATTERNS
- **PARALLEL TASK AGENTS** - Launch multiple Task agents simultaneously for maximum efficiency
- **SYSTEMATIC WORKFLOW** - TodoWrite → Parallel agents → Git checkpoints → GitHub backup → Test validation
- **GITHUB BACKUP WORKFLOW** - After every commit: `git push origin main`
- **BACKGROUND PROCESSING** - ONLY Task agents can run true background operations

---

## PROJECT OVERVIEW

AI 驅動的銀行貸款審核平台，整合：
- 前端對話推薦 + 視覺海報生成 (React + Claude API)
- 後端 MAF 六大領航員（雙模式徵審）
- ML 鑑價（LSTM + RF + SDE）
- RAG 法規問答（三大知識庫）

## TECH STACK

### Frontend
- React 18 + TypeScript
- Claude API (claude-sonnet-4-20250929)
- Canvas API (poster generation)
- Tailwind CSS + Styled Components

### Backend
- Node.js 20 + TypeScript
- Microsoft Agent Framework (MAF)
- Azure OpenAI (gpt-4o)
- Azure Cosmos DB
- Azure AI Search

### ML/AI Models
- LSTM (TensorFlow/Keras) - housing price prediction
- Random Forest (scikit-learn) - market sentiment
- SDE Monte Carlo (NumPy) - risk simulation
- RAG (Azure AI Search + GPT-4o) - regulatory Q&A

## CODE STYLE

- TypeScript: ESLint + Prettier
- Python: Black + isort + mypy
- Function docs: TSDoc / Google Style
- Naming: camelCase (TS) / snake_case (Python)

## COMMIT CONVENTION

Format: `type(scope): description`
- feat: new feature
- fix: bug fix
- docs: documentation update
- refactor: code refactoring
- test: test related
- chore: build/tooling

Example: `feat(frontend): add visual poster generator`

## TESTING

- Frontend: Jest + React Testing Library (>70% coverage)
- Backend: Jest + Supertest (>70% coverage)
- Python: pytest (>70% coverage)

## PROJECT-SPECIFIC RULES

### Frontend Conversation Flow
1. Loan type first: mortgage or personal loan
2. Basic info: age, occupation, income, purpose, term, amount
3. Mortgage-specific: property age, area, parking, layout, floor, building type
4. Product recommendation:
   - Mortgage: 青安 → 國軍 → 一般
   - Personal: 國軍 → 薪轉 → 一般
5. Visual poster: 70% main product + 30% cross-sell
6. Monthly payment calculation

### Backend Credit Analysis (Dual Mode)
- Personal loan: DBR ≤ 22x
- Mortgage: Debt ratio = (monthly payments + 18,000) / monthly income ≤ 85%
- 5P scoring + 8-item fraud detection

### ML Valuation (Mortgage Only)
- LSTM time series (9-month history, <0.6% error)
- RF + SDE market sentiment (93.35% accuracy)
- Monte Carlo 1,000-path simulation

### RAG Regulatory Q&A (3 Knowledge Bases)
1. Central Bank mortgage Q&A (highest priority)
2. Policy loan regulations (medium)
3. General credit regulations (standard)

## COMMON COMMANDS

```bash
# Frontend
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm run test         # Run tests

# Backend
npm run start:dev    # Backend (localhost:3001)
npm run test:e2e     # E2E tests

# Python ML
python train_lstm.py        # Train LSTM
python train_rf_sde.py      # Train RF+SDE
pytest tests/               # Python tests
```

## TECHNICAL DEBT PREVENTION

### Before Creating ANY New File:
1. **SEARCH FIRST** - Use Grep/Glob to find existing implementations
2. **ANALYZE EXISTING** - Read and understand current patterns
3. **DECISION**: Can extend existing? → DO IT | Must create new? → Document why
4. **FOLLOW PATTERNS** - Use established project patterns
5. **VALIDATE** - Ensure no duplication or technical debt
