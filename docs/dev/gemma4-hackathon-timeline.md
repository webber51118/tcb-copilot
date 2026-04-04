# Gemma 4 黑客松前實作計畫

> **建立日期**: 2026-04-04
> **黑客松時程**: 4/22 微軟顧問約談 → 5/10 開發完成 → 5/20 繳交

---

## 時程總覽

```
4/04 ──────── 4/22 ──────────────── 5/10 ──────── 5/20
  ↑              ↑                     ↑              ↑
 今天        微軟顧問約談            開發完成        繳交
 Phase 1      (18天)                 (36天)         (46天)
```

---

## Phase 1：4/04–4/22（微軟顧問約談前）

**目標：核心功能完成 + Gemma 最簡整合可展示**

| 項目 | 類型 | 磁碟需求 | 預估時間 | 備註 |
|------|------|---------|---------|------|
| `fetch_lvpr.py` + `train_xgboost.py` | 🔴 必做 | ~2 GB 資料 | 1–2 天 | XGBoost 模型真實上線 |
| Crew 7 防詐程式碼 | 🔴 必做 | — | 2–3 天 | 5 個偵測模組 |
| LINE LIFF_ID 設定 | 🟡 必做 | — | 0.5 天 | `VITE_LIFF_ID` 環境變數 |
| **Gemma E4B：XGBoost 白話解釋** | ✅ Gemma | **3.3 GB** | **2–3 小時** | 本週可完成，新增功能不動舊流程 |

### Gemma E4B 設定步驟（30 分鐘）

```bash
# Step 1：安裝 Ollama
brew install ollama

# Step 2：下載模型（15–20 分鐘，依網速）
ollama pull gemma3:4b    # Gemma 4 E4B 上 Ollama 後替換為 gemma4:4b

# Step 3：驗證
ollama run gemma3:4b "台北市大安區30坪大樓估值1800萬，請用2句話說明估值因素"
```

### XGBoost 白話解釋實作

**Python（加入 `xgboostValuationService.py`）**

```python
import requests

def explain_valuation_zh(district: str, area_ping: float, property_age: int,
                          floor: int, estimated_value: float, risk_level: str) -> str:
    """用 Gemma 4 E4B 將鑑估結果轉為白話中文說明"""
    prompt = (
        f"房屋鑑估結果：{district}、{area_ping}坪、屋齡{property_age}年、"
        f"{floor}樓、估值{estimated_value/10000:.0f}萬元、{risk_level}。"
        f"請用繁體中文2句話說明主要影響估值的因素。"
    )
    try:
        r = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "gemma3:4b", "prompt": prompt, "stream": False},
            timeout=30
        )
        return r.json().get("response", "")
    except Exception:
        return ""   # Gemma 離線時靜默降級，不影響主流程
```

**前端：`ValuationPage.tsx` Step 3 新增 AI 說明卡**

```tsx
{val.explanation && (
  <div className="card">
    <p className="text-xs font-bold text-gray-500 mb-2">AI 鑑估說明</p>
    <p className="text-sm text-gray-700 leading-relaxed">{val.explanation}</p>
    <p className="text-xs text-gray-400 mt-1">由 Gemma 4 本地模型生成</p>
  </div>
)}
```

**4/22 顧問會議展示重點**：  
「我們採用 Azure + 開放模型混合架構，敏感資料留行內用 Gemma，複雜推理用 Azure OpenAI。」

---

## Phase 2：4/22–5/10（主力開發期）

**目標：Gemma 深度整合，重要功能上線**

| 項目 | 模型 | 新增磁碟 | 預估時間 | 效益 |
|------|------|---------|---------|------|
| **RAG 法規問答本地化** | Gemma 31B | **+20 GB** | 2–3 天 | 🔴 資料不出行，合規 |
| **謄本解析並聯測試** | E4B vision（已下載）| +0 | 1 天 | Claude 作 fallback 保底 |
| **委員審議分流** | 31B（已下載）| +0 | 1 天 | 降低 Claude API 費用 |
| Power BI 業務儀表板 | — | — | 1–2 天 | Microsoft 方案 B 必做項 |

### RAG 本地化架構

```
用戶問題
  ↓
Azure AI Search（向量搜尋，保留）
  ↓ 取得相關法規段落
Gemma 4 31B（行內自托管，取代 GPT-4o）
  ↓
法規問答回應（客戶資料全程不出行）
```

### 委員審議分流

| 委員 | 現況 | Phase 2 替換 | 理由 |
|------|------|------------|------|
| 授信規定領航員 | Claude | **Gemma 4 31B** | 法規條文引用，規則明確 |
| 徵信領航員 | Claude | **保留 Claude** | 需細膩語義判斷 |
| 鑑價領航員 | Claude | **Gemma 4 31B** | 數字推理，規則明確 |

---

## Phase 3：5/10–5/20（收尾）

- 整合測試、效能調整
- Demo 演練腳本
- **不引入新技術**

---

## 磁碟空間需求總覽

```
Phase 1（4/04–4/22）：
  Ollama 安裝：           ~200 MB
  Gemma 4 E4B (Q4量化)：  ~3.3 GB
  實價登錄訓練資料：       ~1–2 GB
  XGBoost 模型：          ~50 MB
  ─────────────────────────────────
  Phase 1 合計：          ~5–6 GB

Phase 2（4/22–5/10）：
  Gemma 4 31B (Q4量化)：  ~20.0 GB
  ─────────────────────────────────
  Phase 2 新增：          ~20 GB

全程總計：                ~25–26 GB
```

> ⚠️ **建議開始前確認磁碟剩餘空間 ≥ 30 GB**

---

## 硬體需求與推論速度

| 功能 | 模型 | MacBook CPU | GPU（24GB VRAM）| 單次延遲 |
|------|------|------------|----------------|---------|
| XGBoost 白話解釋 | E4B | ✅ 可跑 | ✅ | 3–5 秒 |
| 謄本圖片解析 | E4B vision | ✅ 可跑（慢）| ✅ | 8–15 秒 |
| RAG 法規問答 | 31B | ⚠️ ~30–60 秒 | ✅ 快（3–5秒）| 建議 GPU |
| 委員審議 | 31B | ⚠️ ~30–60 秒 | ✅ 快 | 建議 GPU |

> **31B 無 GPU 替代方案**：改用 **26B MoE**（磁碟 ~17 GB，VRAM 需求降至 ~10 GB，速度快 3x）

---

## 本週行動清單（4/04–4/08）

```
□ 確認磁碟剩餘空間 ≥ 30 GB
□ brew install ollama
□ ollama pull gemma3:4b（3.3 GB）
□ 執行 fetch_lvpr.py（下載實價登錄資料）
□ 執行 train_xgboost.py（訓練 XGBoost 模型）
□ 實作 explain_valuation_zh()（2–3 小時）
□ ValuationPage.tsx 加入 AI 說明卡
□ 開始 Crew 7 防詐程式碼
```

---

## 成本效益預估（Phase 2 完成後）

| 項目 | 目前（雲端 API）| Gemma 替換後 | 節省 |
|------|--------------|------------|------|
| RAG 問答（GPT-4o）| 依 token 計費 | 伺服器電費 | ~80% |
| 謄本解析（Claude Vision）| 依圖片計費 | 伺服器電費 | ~70% |
| 委員審議（Claude，2/3）| 依 token 計費 | 伺服器電費 | ~67% |
| **合計** | — | — | **預估 70–80%** |
