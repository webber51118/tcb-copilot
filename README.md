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

## Development Guidelines

- **Always search first** before creating new files
- **Extend existing** functionality rather than duplicating
- **Use Task agents** for operations >30 seconds
- **Single source of truth** for all functionality
- **Commit after each feature**
