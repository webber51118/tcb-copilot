# Gemma 4 開放模型整合評估

> **評估日期**: 2026-04-04
> **模型**: Google Gemma 4（Apache 2.0）
> **目的**: 評估以自托管開放模型取代部分外部 API，提升資料合規性並降低成本

---

## 一、Gemma 4 規格總覽

| 版本 | 有效參數 | Context Window | 多模態 | 適合場景 |
|------|---------|----------------|--------|---------|
| E2B | 2.3B | 128K | ✅（圖/影/音） | 邊緣裝置、手機 |
| E4B | 4.5B | 128K | ✅（圖/影/音） | 輕量伺服器推論 |
| 26B MoE | 3.8B（推論時） | 256K | ❌ | 成本效益高的中等任務 |
| **31B Dense** | 30.7B | 256K | ❌ | **主力推薦，高複雜任務** |

### 關鍵特性
- **授權**：Apache 2.0，可商用、可修改、可自托管
- **推論模式**：內建 reasoning mode（step-by-step thinking）
- **多語言**：140+ 語言，含繁體中文
- **Function Calling**：原生支援，適合 Agent 工作流
- **Fine-tuning**：支援 LoRA / QLoRA / 全量微調（HuggingFace / Keras）
- **基準測試**（31B）：MMLU Pro 85.2%、LiveCodeBench v6 80.0%

---

## 二、現有架構 AI 服務使用現況

| 模組 | 檔案 | 目前使用 | 月費估算 |
|------|------|---------|---------|
| 前端對話推薦 | `frontend/` | Claude Sonnet 4.6 | 依用量 |
| 謄本文件解析 | `documentParser.ts` | Claude Vision（Sonnet） | 依用量 |
| 委員審議（3 Agent） | `committeeReviewService.ts` | Claude Sonnet 4.6 | 依用量 |
| RAG 法規問答 | `ragService.ts` | Azure OpenAI GPT-4o | 依用量 |
| 後端審議摘要 | `creditReportGenerator.ts` | 固定模板（無 LLM） | 無 |
| XGBoost 鑑估解釋 | `xgboostValuationService.py` | 無（數字輸出） | 無 |

---

## 三、Gemma 4 應用場景（五個）

### 場景 1：RAG 法規問答本地化 🔴 最高優先

**現況**
```
用戶問題 → Azure AI Search（向量搜尋）→ Azure OpenAI GPT-4o → 回答
```

**替換後**
```
用戶問題 → Azure AI Search（向量搜尋，保留）→ Gemma 4 31B（行內自托管）→ 回答
```

**為什麼這個最重要**
- 法規問答會夾帶**客戶徵信資料**（DBR、負債比、收入）
- 送到外部 API 有金融監理合規風險
- Gemma 4 31B 自托管後，所有推論在行內伺服器完成

**實作方式**
```typescript
// src/main/typescript/services/ragService.ts
// 將 Azure OpenAI 呼叫替換為本地 Ollama / vLLM 端點

const GEMMA_ENDPOINT = process.env.GEMMA_API_URL || 'http://localhost:11434/api/generate';

async function queryWithGemma(context: string, question: string): Promise<string> {
  const response = await fetch(GEMMA_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      model: 'gemma4:31b',
      prompt: `${context}\n\n問題：${question}\n請用繁體中文回答：`,
      stream: false
    })
  });
  return (await response.json()).response;
}
```

**預期效益**：資料不出行 ✅、每月節省 GPT-4o 費用 ✅

---

### 場景 2：謄本文件解析（Vision） 🔴 高優先

**現況**：`documentParser.ts` → Claude Vision API（圖片送至 Anthropic）

**替換後**：Gemma 4 E4B 多模態（本地處理圖片）

```python
# src/main/python/services/documentParserLocal.py
# 使用 Gemma 4 E4B 本地解析謄本圖片

import ollama

def parse_land_registry_local(image_path: str) -> dict:
    response = ollama.chat(
        model='gemma4:4b',
        messages=[{
            'role': 'user',
            'content': '請從這份不動產謄本中擷取：行政區、坪數、屋齡、樓層、建物類型。以 JSON 格式回傳。',
            'images': [image_path]
        }]
    )
    return json.loads(response['message']['content'])
```

**注意**：建議與現有 Claude Vision 並聯測試，確認準確度 ≥ 85% 後再替換。

---

### 場景 3：委員審議規則型委員 🟡 中優先

**現況**：`committeeReviewService.ts` → 3 個委員全用 Claude Sonnet

**建議分工**

| 委員 | 現況 | 替換方案 | 理由 |
|------|------|---------|------|
| 授信規定領航員 | Claude | **Gemma 4 31B** | 法規條文引用，規則明確 |
| 徵信領航員 | Claude | **保留 Claude** | 需細膩語義判斷 |
| 鑑價領航員 | Claude | **Gemma 4 31B** | 數字推理，規則明確 |

**預期效益**：委員審議 Claude API 成本降低約 67%

---

### 場景 4：XGBoost 鑑估結果自然語言解釋 🟡 中優先（新增功能）

**現況**：鑑估結果只輸出數字（估值、LTV、風險等級）

**新增**：用 Gemma 4 把特徵重要性轉成白話說明

```python
# src/main/python/services/xgboostValuationService.py 新增

def explain_valuation(result: dict, district: str, area_ping: float,
                       property_age: int, floor: int) -> str:
    prompt = f"""
    以下是 XGBoost 房屋鑑估結果，請用2-3句繁體中文說明主要影響估值的因素：

    行政區：{district}
    坪數：{area_ping} 坪
    屋齡：{property_age} 年
    樓層：{floor} 樓
    鑑估值：{result['estimated_value']:,.0f} 元
    風險等級：{result['risk_level']}

    請說明哪些因素讓估值偏高或偏低。
    """
    return query_gemma_local(prompt)  # 呼叫本地 Gemma 4
```

**前端展示**：ValuationPage Step 3 結果頁新增「AI 解釋」卡片

---

### 場景 5：信用審核摘要段落生成 🟢 低優先

**現況**：`creditReportGenerator.ts` 產出固定格式 PDF，審核意見為模板填空

**新增**：Gemma 4 26B MoE 把 6 Agent 評分結果轉為白話審核意見

```typescript
// src/main/typescript/services/creditReportGenerator.ts 強化

async function generateNarrativeSummary(creditResult: CreditReviewResult): Promise<string> {
  const prompt = `
  以下是一件房貸申請的 5P 徵信評分結果，請用繁體中文寫一段100字的專業審核意見：
  借保戶概況：${creditResult.borrowerProfile.summary}
  收支平衡：${creditResult.repaymentSource.summary}
  資產負債：${creditResult.creditProtection.summary}
  風險因子：${creditResult.riskFactor.summary}
  詐欺查核：${creditResult.fraud.level}
  `;
  return await queryGemmaLocal(prompt);
}
```

---

## 四、導入路徑規劃

### Phase 1：基礎設施建立（Demo 後 1 週）

```bash
# 在行內伺服器安裝 Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 下載模型
ollama pull gemma4:31b    # RAG 問答、委員審議
ollama pull gemma4:4b     # 謄本解析（多模態）
ollama pull gemma4:26b    # 信用摘要

# 啟動 API 服務（預設 port 11434）
ollama serve
```

### Phase 2：RAG 問答替換（1–2 天）

- `ragService.ts` 新增 Gemma 端點切換開關（env flag）
- A/B 測試：相同問題同時打 GPT-4o 和 Gemma，比對答案品質
- 達標（準確度 ≥ GPT-4o 80%）後切換

### Phase 3：謄本解析並聯測試（1–2 天）

- `documentParser.ts` 新增 fallback 邏輯：Gemma 解析失敗 → Claude 重試
- 評估 100 張謄本樣本的解析準確度

### Phase 4：委員審議分流（1 天）

- `committeeReviewService.ts` 委員 1、3 改呼叫 Gemma
- 委員 2 保留 Claude

---

## 五、成本效益試算

| 項目 | 目前（全雲端 API） | Gemma 替換後 | 節省 |
|------|-----------------|-------------|------|
| RAG 問答（GPT-4o） | 依用量計費 | 伺服器電費 | ~80% |
| 謄本解析（Claude Vision） | 依圖片數計費 | 伺服器電費 | ~70% |
| 委員審議（Claude，2/3 委員） | 依 token 計費 | 伺服器電費 | ~67% |
| **合計** | — | — | **預估 70–80%** |

---

## 六、風險與限制

| 風險 | 說明 | 緩解方式 |
|------|------|---------|
| 中文理解差距 | Gemma 4 繁中能力略遜 Claude | 並聯測試，設準確度門檻 |
| 首次推論延遲 | 31B 模型冷啟動較慢 | 常駐 GPU 伺服器，預熱模型 |
| 硬體需求 | 31B 需 ≥ 24GB VRAM（A100/H100） | 可先用 Q4 量化版（~16GB） |
| 維護成本 | 需自行更新模型 | 季度評估是否升級 |

---

## 七、與現有架構整合點

```
LINE Bot / LIFF 前端
  ↓
Node.js 後端（現有）
  ├─ ragService.ts ──────────────→ Gemma 4 31B（本地）🆕
  ├─ documentParser.ts ──────────→ Gemma 4 E4B（本地）🆕 / Claude（fallback）
  ├─ committeeReviewService.ts ──→ Gemma 4 31B（委員1,3）🆕 + Claude（委員2）
  └─ creditReportGenerator.ts ──→ Gemma 4 26B MoE（摘要）🆕
Python ML 引擎（現有）
  └─ xgboostValuationService.py → Gemma 4 解釋模組🆕
```

---

*參考資料：[Gemma 4 Model Card](https://ai.google.dev/gemma/docs/core/model_card_4)*
