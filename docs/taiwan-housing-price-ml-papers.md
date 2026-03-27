# 台灣實價登錄 × 機器學習房價預測：文獻整理

> **整理日期：** 2026-03-23
> **資料來源：** AIRITILIBRARY、NDLTD、ScienceDirect、ResearchGate、ACM DL
> **關鍵詞：** 實價登錄、機器學習、房價預測、深度學習、集成學習

---

## 一、期刊論文

### 1. 蔡繡容、夏政瑋（2023）

| 項目 | 內容 |
|------|------|
| **標題** | 預測台灣房地產市場趨勢之模型---應用深度學習技術 |
| **期刊** | 住宅學報，Vol. 32, No. 2，第21–55頁 |
| **機構** | 國立高雄科技大學財務管理系 |
| **年份** | 2023年12月（收稿2022年5月） |

#### 使用方法
- 主要模型：**LSTM（長短期記憶神經網路）**
- 比較基準：GARCH(1,1)
- 框架：TensorFlow + Keras
- 資料正規化：平均值正規化（縮放至 [-1, 1]）
- **滾動視窗（Rolling Window）**：逐年調整模型參數

#### 特徵變數（共5大類）

| 類別 | 變數 | 資料來源 |
|------|------|----------|
| 總體經濟 | CSI、GDP、PDI、RHPI（房價所得比）、TAIEX、UR（失業率） | 台灣經濟新報（TEJ） |
| 貨幣政策 | M1B（貨幣供給）、CPI、HIR（房貸利率） | TEJ |
| 房地產 | 議價率(BR)、建築貸款餘額(CBL)、CCI、住宅存量(HS)、所有權移轉棟數(NTO)、銷售率(SR) | 國泰房地產指數、內政部、TEJ |
| 人口結構 | 扶養比(DR)、勞動人口(LF)、淨人口移入(NI)、總人口(POP)、家戶人口(PPH) | 中華民國統計資訊網 |
| 網路搜尋量 | 出租(ARR)、信用貸款(CL)、房地產(RE)、房地產代理商(REA) | Google Trends（SVI） |

- **預測目標：** 房價指數（HP）、成交量指數（VOL）
- **資料期間：** 2005年Q1–2020年Q3（共63筆季資料）
- **研究地區：** 台灣全區、台北市、新北市

#### 預測精度

| 地區 | 指標 | 提升幅度 |
|------|------|----------|
| 台灣全區 | 加入非經濟變數後房價指數RMSE | -0.033（+22%） |
| 台北市 | 加入非經濟變數後房價指數RMSE | -0.018（+42%） |
| 新北市 | 加入非經濟變數後房價指數RMSE | -0.053（**+72%**） |
| 滾動視窗調整後 | 房價指數準確度 | **97%** |
| 滾動視窗調整後 | 成交量指數準確度 | **76%** |

#### 重要發現
1. **LSTM 全面優於 GARCH**，後者誤差隨時間累積放大
2. 加入**人口結構 + Google搜尋量**顯著提升準確度，新北市效果最大（+72%）
3. **滾動視窗**機制使模型與時俱進，實現 97% 房價指數預測準確度
4. 少子化、高齡化與網路搜尋量為不可忽視的非經濟因素

---

### 2. Kuei-Chen Chiu（2023）

| 項目 | 內容 |
|------|------|
| **標題** | A long short-term memory model for forecasting housing prices in Taiwan in the post-epidemic era through big data analytics |
| **期刊** | Asia Pacific Management Review（Elsevier / ScienceDirect） |
| **DOI** | https://doi.org/10.1016/j.apmrv.2023.08.002 |
| **年份** | 2023年8月 |

#### 使用方法
- **LSTM** + 多元迴歸（特徵篩選前置）
- 評估指標：R²、RMSE

#### 資料
- 台灣房價指數（2002–2020年）
- 總體經濟指標：GDP、CPI、貨幣供給、房貸利率等

#### 重要發現
1. **房貸利率**為後疫情期間最關鍵預測因子，佔前10大影響因素之首
2. 後疫情低利率環境下，部分變數影響效果趨於「非顯著」
3. LSTM 大數據預測模型經 R² 與 RMSE 驗證具良好預測效能

---

### 3. Kuentai Chen（2011）

| 項目 | 內容 |
|------|------|
| **標題** | Predicting price of Taiwan real estates by neural networks and support vector regression |
| **出版** | Proceedings of the 15th WSEAS International Conference on Systems |
| **機構** | 明志科技大學 |
| **連結** | [ResearchGate](https://www.researchgate.net/publication/262316125) \| [ACM DL](https://dl.acm.org/doi/10.5555/2028395.2028436) |

#### 使用方法
- **BPNN（倒傳遞類神經網路）** vs **SVR（支援向量迴歸）**
- 特徵選擇：逐步迴歸法（Stepwise）+ 試誤法（Trial-and-Error）

#### 重要特徵
- 重貼現率、貨幣供給
- **上期房價**（三種模型共同最重要變數）

#### 預測精度
- **SVR（試誤法）最佳：MAPE = 4.47%，R² = 0.854**

#### 重要發現
1. SVR 優於 BPNN，適合台灣房地產小樣本時間序列
2. 上期房價是最關鍵預測變數（慣性效應）
3. 為台灣最早期房地產 ML 預測基準文獻之一

---

## 二、碩博士論文

### 4. 匿名（2024）—國立台灣大學

| 項目 | 內容 |
|------|------|
| **標題** | 機器學習與集成學習方法在房價預測上之應用 |
| **系所** | 國立台灣大學 |
| **編號** | U0001-1115240716206018 |
| **連結** | [AIRITILIBRARY](https://www.airitilibrary.com/Article/Detail/U0001-1115240716206018) |

#### 使用方法
- 基礎模型（5種）：Ridge Regression、Lasso Regression、Elastic Net、LightGBM、**XGBoost**
- 集成策略：Voting、Stacking、**Blending**（三層集成）

#### 重要發現
1. 單一模型中，**Lasso Regression** 表現最佳
2. **XGBoost 優於 LightGBM**（Gradient Boosting 框架不適合小樣本）
3. **Blending 集成為整體最佳**，透過最優混合權重結合 Voting 與 Stacking

---

### 5. 匿名（2023）—碩士論文

| 項目 | 內容 |
|------|------|
| **標題** | 應用集成學習建立房價預測模型──以台北市為例 |
| **編號** | U0017-2211202315273521 |
| **資料** | 台北市實價登錄（2012–2019年） |
| **連結** | [AIRITILIBRARY](https://www.airitilibrary.com/Article/Detail/U0017-2211202315273521) |

#### 使用方法
- **XGBoost + Random Forest（異質集成）**
- **Stacking Ensemble**（堆疊集成）

#### 預測精度
- 最佳模型（Stacking Ensemble）：**MAPE = 10.17%**

#### 重要發現
- Stacking 集成優於單一模型
- 異質集成（不同類型基礎模型）表現最穩定

---

### 6. 匿名（2021）—碩士論文

| 項目 | 內容 |
|------|------|
| **標題** | 迴歸機器學習應用於房價預測──以台北市實價登錄為例 |
| **編號** | 110MIT00030006 |
| **連結** | [NDLTD](https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi/login?o=dnclcdr&s=id%3D%22110MIT00030006%22.&searchmode=basic) |

#### 使用方法
- 多種迴歸機器學習方法
- 資料：台北市實價登錄

---

### 7. 匿名（2020）—台中市研究

| 項目 | 內容 |
|------|------|
| **標題** | 以多元線性迴歸與機器學習模型預估不動產價格──以台中市實價登錄為例 |
| **編號** | U0005-0808202016040700 |
| **資料** | 台中市實價登錄（2018–2019年） |
| **連結** | [AIRITILIBRARY](https://www.airitilibrary.com/Publication/alDetailedMesh1?DocID=U0005-0808202016040700) |

#### 使用方法
- 基準：多元線性迴歸
- 正則化迴歸（Lasso、Ridge）
- **Random Forest + XGBoost**
- 特殊特徵：**議價指標特徵（bargaining indicator features）**

#### 預測精度
- **XGBoost 較線性迴歸降低 RMSE 約 20%**

#### 重要發現
1. XGBoost 顯著優於線性迴歸
2. 加入議價指標特徵可有效提升準確度
3. 目標：提供買賣雙方合理成交價格參考

---

### 8. 匿名（2020）—地址特徵工程研究

| 項目 | 內容 |
|------|------|
| **標題** | 數值分析與機器學習在房價預測之應用 |
| **編號** | U0022-3006202015321400 |
| **資料** | 實價登錄（2014–2019年），訓練：2014–2018，測試：2019 |
| **連結** | [AIRITILIBRARY](https://www.airitilibrary.com/Article/Detail/U0022-3006202015321400) |

#### 使用方法
- 線性迴歸、正則化迴歸
- **創新：地址細粒度拆分特徵工程**（而非座標化）

#### 預測精度
- **準確度 98%（MSE = 0.02%）**

#### 重要發現
1. 地址細粒度拆分優於座標化，能捕捉短距離價格差異
2. 短距離內房價可能出現戲劇性變化，需精細地理特徵處理

---

### 9. 匿名（2019）—淡江大學

| 項目 | 內容 |
|------|------|
| **標題** | 應用人工智慧於房價預測模型研究與分析 |
| **系所** | 淡江大學 |
| **編號** | 107TKU05392044 |
| **連結** | [AIRITILIBRARY](https://www.airitilibrary.com/Article/Detail/U0002-2608201910580000) |

#### 使用方法
- 線性迴歸（基準）→ **MLP** → **LSTM**
- 優化器比較：**Adam** vs SGD vs RMSProp

#### 重要發現
1. **LSTM 預測效果最優**（優於 MLP 與線性迴歸）
2. **Adam 優化器**優於 SGD 與 RMSProp
3. **單層深度神經網路**優於多層（避免過擬合）

---

### 10. 匿名（2019）—國立中山大學（可解釋AI）

| 項目 | 內容 |
|------|------|
| **標題** | 基於可解釋機器學習演算法的房屋價值評估──以高雄市為例 |
| **系所** | 國立中山大學 |
| **編號** | 107NSYS5396019 |
| **連結** | [NSYSU](https://ethesys.lis.nsysu.edu.tw/ETD-db/ETD-search-c/view_etd?URN=etd-0101119-092357) \| [NDLTD](https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi/login?o=dnclcdr&s=id=%22107NSYS5396019%22.&searchmode=basic) |

#### 使用方法
- **Random Forest + XGBoost**
- **SHAP（SHapley Additive exPlanations）**——可解釋AI特徵重要性

#### 資料
- 高雄市實價登錄資料

#### 重要發現
1. **首次將可解釋機器學習（SHAP）應用於台灣房價預測**
2. Random Forest 精確計算 Shapley 值，提升模型透明度
3. 可量化各特徵對房價的貢獻度

---

### 11. 匿名（2020–2021）—國立中興大學

| 項目 | 內容 |
|------|------|
| **標題** | 實價登錄資料庫結合類神經網路推估房地產市價 |
| **系所** | 國立中興大學（NCHU） |
| **連結** | [NCHU機構典藏](https://ir.lib.nchu.edu.tw/handle/11455/96182) |

#### 使用方法
- **ANN（類神經網路）**結合實價登錄資料庫

---

### 12. 匿名（2014）—高雄市早期研究

| 項目 | 內容 |
|------|------|
| **標題** | 實價登錄之類神經網路估價模型──以高雄市農16及美術館區大樓為例 |
| **編號** | U0015-1808201413275600 |
| **連結** | [AIRITILIBRARY](https://www.airitilibrary.com/Publication/alDetailedMesh1?DocID=U0015-1808201413275600) |

#### 使用方法
- **監督式倒傳遞類神經網路（Backpropagation ANN）**
- 比較基準：特徵價格法（Hedonic Pricing Method）

#### 重要特徵
- **建物面積、屋齡、總樓層數**（對預測影響最大）

#### 預測精度
| 指標 | ANN | 特徵價格法 |
|------|-----|------------|
| MAPE | **9.48%–13.92%** | 17.1% |
| 誤差<10%比例 | **45.6%–56.7%** | — |

#### 重要發現
1. **ANN（MAPE 9.48%）優於特徵價格法（MAPE 17.1%）**，誤差減少約 44%
2. 實價登錄制度實施後，資料透明度提升，ANN 估價模型可行
3. 建物面積、屋齡、樓層為最關鍵的三個預測特徵

---

## 三、綜合比較表

| # | 作者/年份 | 方法 | 資料來源 | 最佳精度 | 地區 |
|---|-----------|------|----------|----------|------|
| 1 | 蔡繡容、夏政瑋（2023） | LSTM + Rolling Window | 2005–2020 季資料 | 房價指數 **97%** | 台灣、台北、新北 |
| 2 | Chiu（2023） | LSTM + 迴歸特徵篩選 | 2002–2020 | R²驗證良好 | 台灣全區 |
| 3 | Chen（2011） | SVR / BPNN | 台灣房地產時序 | **MAPE=4.47%, R²=0.854** | 台灣全區 |
| 4 | 匿名（2024，台大） | Blending（LightGBM+XGBoost+Lasso） | 台灣房價資料 | Blending 最優 | 台灣全區 |
| 5 | 匿名（2023） | XGBoost + Stacking 集成 | 台北實價登錄 2012–2019 | **MAPE=10.17%** | 台北市 |
| 6 | 匿名（2021） | 迴歸 ML | 台北實價登錄 | — | 台北市 |
| 7 | 匿名（2020，台中） | XGBoost + RF（含議價特徵） | 台中實價登錄 2018–2019 | RMSE 較 LR 低 **20%** | 台中市 |
| 8 | 匿名（2020，地址工程） | 正則化迴歸 + 地址細粒度拆分 | 實價登錄 2014–2019 | **準確度 98%** | 台灣 |
| 9 | 匿名（2019，淡江） | LSTM > MLP > LR | 實價登錄 | LSTM 最優 | 台灣 |
| 10 | 匿名（2019，中山） | XGBoost + SHAP 可解釋AI | 高雄實價登錄 | 特徵可解釋性量化 | 高雄市 |
| 11 | 匿名（2020–21，中興） | ANN + 實價登錄DB | 實價登錄 | — | 台灣 |
| 12 | 匿名（2014） | ANN vs 特徵價格法 | 高雄實價登錄 | **MAPE=9.48%** | 高雄市 |

---

## 四、技術趨勢分析

### 方法演進時間軸

```
2011–2014  ─── ANN、SVR、特徵價格法（奠定基礎）
2019–2020  ─── LSTM、MLP、Random Forest、XGBoost（深度學習崛起）
2021–2024  ─── Stacking/Blending集成、SHAP可解釋AI（精緻化階段）
```

### 最常用特徵類型

| 類型 | 常用特徵 |
|------|----------|
| **結構特徵** | 屋齡、建物面積、樓層、停車位、建材、格局 |
| **空間特徵** | 行政區、地址細粒度拆分、GPS座標 |
| **總體經濟** | 房貸利率、GDP、CPI、貨幣供給（M1B）、失業率 |
| **房地產市場** | 議價率、建築貸款餘額、銷售率、所有權移轉棟數 |
| **新興特徵** | Google搜尋量（SVI）、人口結構（扶養比、少子化） |

### 資料來源一覽

- **內政部實價登錄**（2012年正式上線）——最主要資料來源
- **國泰房地產指數**——房價指數研究
- **台灣經濟新報（TEJ）**——總體經濟變數
- **Google Trends**——搜尋量指數（SVI）
- **中華民國統計資訊網**——人口結構資料

---

## 五、重要文獻連結

| 論文 | 連結 |
|------|------|
| 蔡繡容、夏政瑋（2023）住宅學報 | 本專案根目錄 PDF |
| Chiu（2023）ScienceDirect | https://www.sciencedirect.com/science/article/pii/S1029313223000623 |
| Chen（2011）ResearchGate | https://www.researchgate.net/publication/262316125 |
| 集成學習台北市（2023）AIRITILIBRARY | https://www.airitilibrary.com/Article/Detail/U0017-2211202315273521 |
| 集成學習台大（2024）AIRITILIBRARY | https://www.airitilibrary.com/Article/Detail/U0001-1115240716206018 |
| 台中市XGBoost（2020）AIRITILIBRARY | https://www.airitilibrary.com/Publication/alDetailedMesh1?DocID=U0005-0808202016040700 |
| 地址特徵工程（2020）AIRITILIBRARY | https://www.airitilibrary.com/Article/Detail/U0022-3006202015321400 |
| 淡江大學LSTM（2019）AIRITILIBRARY | https://www.airitilibrary.com/Article/Detail/U0002-2608201910580000 |
| 中山大學SHAP（2019）NSYSU | https://ethesys.lis.nsysu.edu.tw/ETD-db/ETD-search-c/view_etd?URN=etd-0101119-092357 |
| 中興大學ANN | https://ir.lib.nchu.edu.tw/handle/11455/96182 |
| 高雄市ANN（2014）AIRITILIBRARY | https://www.airitilibrary.com/Publication/alDetailedMesh1?DocID=U0015-1808201413275600 |
| 台北市ML（2021）NDLTD | https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi/login?o=dnclcdr&s=id%3D%22110MIT00030006%22 |
