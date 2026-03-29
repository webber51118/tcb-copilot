/**
 * 黑客松簡報生成器
 * 個金 Co-Pilot 領航員 — 分行神隊友
 * 執行：node docs/generate-pptx.js
 */
const pptxgen = require('C:/Users/Webber/AppData/Roaming/npm/node_modules/pptxgenjs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = '個金 Co-Pilot 領航員';
pres.title = '分行神隊友：個金 Co-Pilot 領航員';

// ─── 色系 ──────────────────────────────────────────────────────
const C = {
  deepBlue:  "1B3A6B",
  medBlue:   "2C5282",
  darkBlue2: "14233F",
  gold:      "C9A84C",
  goldLight: "FBF3DC",
  white:     "FFFFFF",
  lightGray: "F8F9FC",
  midGray:   "64748B",
  darkGray:  "1E293B",
  lightBlueBg: "EBF4FF",
  green:     "27AE60",
  teal:      "1A5276",
  forestGreen: "145A32",
  purple:    "6B3FA0",
  red:       "C0392B",
  border:    "CBD5E0",
};

// 每次呼叫回傳全新物件（避免 PptxGenJS 內部 mutate）
const mkShadow = () => ({ type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.10 });

// ─── Helper：標題列 ────────────────────────────────────────────
function addTitleBar(slide, title, sub) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.72, fill: { color: C.deepBlue }, line: { color: C.deepBlue }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0.72, w: 10, h: 0.045, fill: { color: C.gold }, line: { color: C.gold }
  });
  slide.addText(title, {
    x: 0.4, y: 0, w: 9.2, h: 0.72,
    fontSize: 22, fontFace: "Calibri", bold: true,
    color: C.white, valign: "middle", margin: 0,
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.4, y: 0.78, w: 9.2, h: 0.28,
      fontSize: 11, fontFace: "Calibri", color: C.midGray, italic: true, margin: 0
    });
  }
}

// ─── Slide 1：封面 ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.deepBlue };

  // 裝飾圓
  s.addShape(pres.shapes.OVAL, {
    x: 6.2, y: -0.8, w: 6.5, h: 6.5,
    fill: { color: "243D70", transparency: 50 }, line: { color: "243D70" }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: 1.5, w: 3.5, h: 3.5,
    fill: { color: "1A2F58", transparency: 40 }, line: { color: "1A2F58" }
  });

  // 頂部金線
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.07, fill: { color: C.gold }, line: { color: C.gold }
  });

  // 主標
  s.addText("分行神隊友", {
    x: 0.6, y: 0.5, w: 8.5, h: 1.3,
    fontSize: 58, fontFace: "Arial Black", bold: true, color: C.white,
  });

  // 副標
  s.addText("個金 Co-Pilot 領航員", {
    x: 0.6, y: 1.75, w: 8.5, h: 0.75,
    fontSize: 30, fontFace: "Calibri", bold: true, color: C.gold,
  });

  // 分隔線
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 2.58, w: 5.5, h: 0.05, fill: { color: C.gold }, line: { color: C.gold }
  });

  // 說明文字
  s.addText("AI 驅動的銀行貸款審核平台", {
    x: 0.6, y: 2.72, w: 7.5, h: 0.45,
    fontSize: 17, fontFace: "Calibri", color: "CADCFC",
  });
  s.addText("黑客松 Demo  ✦  Taiwan Cooperative Bank × AI", {
    x: 0.6, y: 3.18, w: 7.5, h: 0.38,
    fontSize: 13, fontFace: "Calibri", color: "7A9EC8",
  });

  // 技術標籤
  const tags = ["Claude API", "XGBoost", "LINE Bot", "React + TypeScript", "Node.js", "Python FastAPI"];
  tags.forEach((tag, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6 + i * 1.55, y: 4.05, w: 1.42, h: 0.3,
      fill: { color: "243D70" }, line: { color: "2C4A7A", width: 1 }
    });
    s.addText(tag, {
      x: 0.6 + i * 1.55, y: 4.05, w: 1.42, h: 0.3,
      fontSize: 9, fontFace: "Calibri", color: "8BAED4",
      align: "center", valign: "middle", margin: 0,
    });
  });

  // 底部列
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.2, w: 10, h: 0.425, fill: { color: C.darkBlue2 }, line: { color: C.darkBlue2 }
  });
  s.addText("7 個 Pilot Crew  ·  全自動徵審  ·  5 分鐘出批覆書", {
    x: 0.5, y: 5.2, w: 9, h: 0.425,
    fontSize: 11, fontFace: "Calibri", color: "4A6A8E",
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── Slide 2：問題 ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "行員每天在面對什麼？", "四大痛點，每天消耗行員 60% 的工作時間");

  const pains = [
    { num: "01", title: "房貸鑑估等 2 天",  color: C.deepBlue,
      body: "客戶問「我能貸多少？」\n行員翻 Excel、打電話\n聯絡鑑估單位、等候報告\n平均 1-2 個工作天" },
    { num: "02", title: "手工計算 DBR",     color: C.teal,
      body: "信貸客戶問「我符合嗎？」\n行員手工算 DBR / 負債比\n查詢授信規章條文\n容易計算錯誤或遺漏" },
    { num: "03", title: "法規記憶負擔",     color: C.forestGreen,
      body: "央行政策頻繁調整\n成數限制、戶數規定複雜\n行員容易記錯、查錯\n有違規風險" },
    { num: "04", title: "人工風控盲點",     color: C.purple,
      body: "人工審核難識別異常\n詐騙手法多樣化演進\n身分偽造、人頭帳戶\n單靠經驗難以全面防範" },
  ];

  pains.forEach((p, i) => {
    const x = 0.28 + i * 2.37;
    const y = 1.1;
    const w = 2.22;
    const h = 4.05;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h, fill: { color: C.white }, line: { color: C.border, width: 1 },
      shadow: mkShadow(),
    });
    // 頂部色條
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h: 0.08, fill: { color: p.color }, line: { color: p.color }
    });

    // 數字徽章
    s.addShape(pres.shapes.OVAL, {
      x: x + w / 2 - 0.32, y: y + 0.18, w: 0.64, h: 0.64,
      fill: { color: p.color }, line: { color: p.color }
    });
    s.addText(p.num, {
      x: x + w / 2 - 0.32, y: y + 0.18, w: 0.64, h: 0.64,
      fontSize: 14, fontFace: "Arial Black", bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0,
    });

    // 標題
    s.addText(p.title, {
      x: x + 0.1, y: y + 0.95, w: w - 0.2, h: 0.5,
      fontSize: 13, fontFace: "Calibri", bold: true, color: p.color, align: "center",
    });

    // 說明
    s.addText(p.body, {
      x: x + 0.14, y: y + 1.5, w: w - 0.28, h: 2.4,
      fontSize: 10.5, fontFace: "Calibri", color: C.darkGray, valign: "top",
    });
  });

  // 底部結論
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 5.05, w: 9.44, h: 0.43,
    fill: { color: C.goldLight }, line: { color: C.gold, width: 1.5 }
  });
  s.addText("行員每天花 60% 時間「查資料、算數字」，真正服務客戶的時間不到 40%", {
    x: 0.28, y: 5.05, w: 9.44, h: 0.43,
    fontSize: 12, fontFace: "Calibri", bold: true, color: C.deepBlue,
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── Slide 3：解法 ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "Co-Pilot 領航員的角色", "讓 AI 當副駕駛，行員專注決策");

  // 頂部 Hero Banner
  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.8, y: 1.0, w: 6.4, h: 0.52,
    fill: { color: C.goldLight }, line: { color: C.gold, width: 1.5 }
  });
  s.addText("AI 副駕駛 + 行員機長 = 最強分行神隊友", {
    x: 1.8, y: 1.0, w: 6.4, h: 0.52,
    fontSize: 15, fontFace: "Calibri", bold: true, color: C.deepBlue,
    align: "center", valign: "middle", margin: 0,
  });

  const caps = [
    {
      title: "智能對話推薦",
      sub: "Crew 6 客服領航員",
      color: C.deepBlue,
      items: ["LINE Bot 5 分鐘完成需求分析", "AI 推薦青安/國軍/一般產品", "Claude API 生成個人化推薦說明", "Canvas API 視覺海報一鍵分享"],
    },
    {
      title: "全自動徵審引擎",
      sub: "Crew 1-5 + Crew 7 協作",
      color: C.teal,
      items: ["XGBoost ML 估算房產市值", "5P 評分 + DBR/負債比計算", "防詐 5 大防線全面查核", "自動生成批覆書 PDF"],
    },
    {
      title: "即時法規問答",
      sub: "Crew 3 法規領航員",
      color: C.forestGreen,
      items: ["RAG 三層知識庫架構", "央行規定、政策貸款規章即查", "Claude 合成 + 信心度標示", "5 分鐘熱快取加速回應"],
    },
  ];

  caps.forEach((c, i) => {
    const x = 0.28 + i * 3.22;
    const y = 1.65;
    const w = 3.0;
    const h = 3.65;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h, fill: { color: C.white }, line: { color: C.border, width: 1 },
      shadow: mkShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h: 0.52, fill: { color: c.color }, line: { color: c.color }
    });
    s.addText(c.title, {
      x: x + 0.12, y, w: w - 0.24, h: 0.52,
      fontSize: 14, fontFace: "Calibri", bold: true, color: C.white,
      valign: "middle", margin: 0,
    });
    s.addText(c.sub, {
      x: x + 0.12, y: y + 0.56, w: w - 0.24, h: 0.3,
      fontSize: 10, fontFace: "Calibri", color: C.midGray, italic: true,
    });
    const richItems = c.items.map((item, idx) => ({
      text: item, options: { bullet: true, breakLine: idx < c.items.length - 1 },
    }));
    s.addText(richItems, {
      x: x + 0.12, y: y + 0.9, w: w - 0.24, h: 2.6,
      fontSize: 11, fontFace: "Calibri", color: C.darkGray, valign: "top",
    });
  });
}

// ─── Slide 4：系統架構 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: "F0F4F8" };
  addTitleBar(s, "系統架構 — 四層設計", "從客戶端到 AI 引擎，端到端整合；指揮艙依貸款類型動態召集 Crew");

  const layers = [
    {
      label: "Layer 1    客戶端",
      desc: "LINE Bot 對話  ·  LIFF 前端表單  ·  視覺海報生成與分享",
      bgColor: "E8F4FD", border: "5DADE2", textColor: C.darkGray, descColor: C.teal,
    },
    {
      label: "Layer 2    Co-Pilot 指揮艙（後端）",
      desc: "Node.js + TypeScript  ·  MAF 多 Agent 工作流  ·  7 個 Pilot Crew 統一調度",
      bgColor: C.deepBlue, border: C.deepBlue, textColor: C.white, descColor: "CADCFC",
    },
    {
      label: "Layer 3    AI 引擎",
      desc: "Python FastAPI：XGBoost / LSTM / Monte Carlo 鑑價  ·  Claude claude-sonnet-4-6 API：RAG + Vision + 推薦說明",
      bgColor: C.teal, border: C.teal, textColor: C.white, descColor: "A9CCE3",
    },
    {
      label: "Layer 4    資料層",
      desc: "JSON 本機（黑客松）  →  Azure Cosmos DB / AI Search（正式版）",
      bgColor: C.forestGreen, border: C.forestGreen, textColor: C.white, descColor: "A9DFBF",
    },
  ];

  layers.forEach((l, i) => {
    const y = 1.0 + i * 1.05;
    const indent = i * 0.12;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.28 + indent, y, w: 9.44 - indent * 2, h: 0.92,
      fill: { color: l.bgColor }, line: { color: l.border, width: 1.5 },
      shadow: mkShadow(),
    });
    s.addText(l.label, {
      x: 0.45 + indent, y, w: 3.0, h: 0.92,
      fontSize: 12, fontFace: "Calibri", bold: true, color: l.textColor,
      valign: "middle", margin: 0,
    });
    // 分隔線
    s.addShape(pres.shapes.RECTANGLE, {
      x: 3.35 + indent, y: y + 0.2, w: 0.03, h: 0.52,
      fill: { color: l.descColor }, line: { color: l.descColor }
    });
    s.addText(l.desc, {
      x: 3.45 + indent, y, w: 6.2 - indent, h: 0.92,
      fontSize: 10.5, fontFace: "Calibri", color: l.descColor, valign: "middle",
    });
    // 向下箭頭
    if (i < 3) {
      s.addText("v", {
        x: 4.9, y: y + 0.9, w: 0.2, h: 0.15,
        fontSize: 8, fontFace: "Calibri", bold: true, color: C.gold,
        align: "center", margin: 0,
      });
    }
  });

  // 底部說明
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 5.1, w: 9.44, h: 0.4,
    fill: { color: C.goldLight }, line: { color: C.gold, width: 1 }
  });
  s.addText("指揮艙召集順序  |  房貸：文件 > 法規 > 鑑估 > 徵信 > 防詐 > 審議   信貸：文件 > 法規 > 徵信 > 防詐 > 審議", {
    x: 0.28, y: 5.1, w: 9.44, h: 0.4,
    fontSize: 11, fontFace: "Calibri", bold: true, color: C.deepBlue,
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── Slide 5：Pilot Crew 表格 ──────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "7 個 Pilot Crew — 各司其職", "各 Crew 有明確輸入/輸出/職責邊界，指揮艙統一調度，互不直接呼叫");

  const cellOpt = (txt, opts) => ({ text: txt, options: opts || {} });
  const hdr = (txt) => cellOpt(txt, { bold: true, color: C.white, fill: { color: C.deepBlue }, valign: "middle" });
  const row7 = (txt) => cellOpt(txt, { bold: true, color: C.deepBlue, fill: { color: C.goldLight }, valign: "middle" });

  const tableData = [
    [hdr("Crew"), hdr("名稱"), hdr("核心功能"), hdr("技術工具"), hdr("觸發條件")],
    ["Crew 1", "徵信領航員", "5P 評分、8 項信用查核、DBR / 負債比計算", "TypeScript 規則引擎", "所有案件"],
    ["Crew 2", "鑑估領航員", "XGBoost 個別鑑價、LSTM 市場趨勢、Monte Carlo 模擬", "Python FastAPI + XGBoost", "房貸案件"],
    ["Crew 3", "法規領航員", "RAG 查詢央行規定、政策性貸款規章（三層知識庫）", "Claude API + 知識庫", "所有案件"],
    ["Crew 4", "審議領航員", "彙整三階段結果、最終核准/婉拒建議與理由", "Node.js 規則聚合", "所有案件"],
    ["Crew 5", "文件領航員", "Claude Vision 解析土地謄本、MyData 文件驗證", "Claude Vision API", "有文件案件"],
    ["Crew 6", "客服領航員", "LINE Bot 對話、產品推薦、視覺海報生成與分享", "LINE API + Canvas API", "前台申請流程"],
    [row7("Crew 7"), row7("防詐領航員"), row7("身分防偽、黑名單掃描、異常申貸行為、LLM 交易分析"), row7("規則引擎 + 模擬資料"), row7("所有案件")],
  ];

  s.addTable(tableData, {
    x: 0.28, y: 0.95, w: 9.44, h: 4.55,
    fontSize: 10, fontFace: "Calibri", color: C.darkGray,
    border: { pt: 0.5, color: C.border },
    colW: [0.7, 1.5, 3.5, 2.1, 1.44],
    rowH: 0.54,
    align: "left", valign: "middle",
  });
}

// ─── Slide 6：客戶 Demo ────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "客戶 Demo 路徑（LINE Bot）", "5 個步驟，5 分鐘完成申貸諮詢 + 視覺海報");

  const steps = [
    { n: "1", title: "開啟 LINE",     body: "輸入「申請貸款」\n啟動 Co-Pilot Bot\nQuick Reply 導引" },
    { n: "2", title: "選貸款類型",   body: "房貸 / 信貸\n按鈕一鍵選擇\n系統自動切換問答流程" },
    { n: "3", title: "Bot 問答收集", body: "年齡、職業\n月收入、金額、期限\n房貸加問：\n屋齡坪數樓層格局車位" },
    { n: "4", title: "AI 推薦產品",  body: "青安/國軍/一般\n月付金額 + 年利率\nClaude 生成\n個人化推薦說明" },
    { n: "5", title: "生成視覺海報", body: "70% 主力產品\n30% 交叉銷售\nCanvas API 生成\n直接分享到 LINE" },
  ];

  steps.forEach((step, i) => {
    const x = 0.25 + i * 1.9;
    const isLast = i === 4;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w: 1.75, h: 4.15,
      fill: { color: isLast ? C.goldLight : C.lightBlueBg },
      line: { color: isLast ? C.gold : "BFD7F5", width: isLast ? 2 : 1 },
      shadow: mkShadow(),
    });

    s.addShape(pres.shapes.OVAL, {
      x: x + 0.575, y: 1.15, w: 0.6, h: 0.6,
      fill: { color: isLast ? C.gold : C.deepBlue },
      line: { color: isLast ? C.gold : C.deepBlue },
    });
    s.addText(step.n, {
      x: x + 0.575, y: 1.15, w: 0.6, h: 0.6,
      fontSize: 16, fontFace: "Arial Black", bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0,
    });

    s.addText(step.title, {
      x: x + 0.1, y: 1.85, w: 1.55, h: 0.45,
      fontSize: 12, fontFace: "Calibri", bold: true,
      color: isLast ? C.deepBlue : C.deepBlue, align: "center",
    });

    s.addText(step.body, {
      x: x + 0.1, y: 2.38, w: 1.55, h: 2.65,
      fontSize: 10, fontFace: "Calibri", color: C.darkGray,
      align: "center", valign: "top",
    });

    if (i < 4) {
      s.addText(">", {
        x: x + 1.77, y: 2.6, w: 0.2, h: 0.4,
        fontSize: 14, fontFace: "Arial Black", bold: true, color: C.gold,
        align: "center", margin: 0,
      });
    }
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 5.1, w: 9.44, h: 0.38,
    fill: { color: C.lightBlueBg }, line: { color: "BFD7F5" }
  });
  s.addText("技術亮點：Claude API 推薦說明  ·  Canvas API 海報生成  ·  LINE ShareTargetPicker 一鍵分享", {
    x: 0.28, y: 5.1, w: 9.44, h: 0.38,
    fontSize: 10, fontFace: "Calibri", color: C.deepBlue,
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── Slide 7：行員 Demo ────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "行員 Demo 路徑（後台管理介面）", "7 個 Crew 依序亮燈，5 分鐘完成 AI 徵審，自動輸出批覆書");

  // 左側步驟
  const steps = [
    { n: "1", text: "收到 LINE 推播通知\n「新案件：王○○ 房貸 1,200 萬」" },
    { n: "2", text: "登入後台 > 案件列表\n> 點開案件詳情頁" },
    { n: "3", text: "點擊「執行 AI 徵審」\n7 個 Crew 自動依序執行" },
    { n: "4", text: "下載批覆書 PDF\n含完整評分明細與建議" },
    { n: "5", text: "核准 / 婉拒\n系統自動通知客戶" },
  ];

  steps.forEach((st, i) => {
    const y = 1.02 + i * 0.88;
    s.addShape(pres.shapes.OVAL, {
      x: 0.3, y: y + 0.06, w: 0.45, h: 0.45,
      fill: { color: C.deepBlue }, line: { color: C.deepBlue }
    });
    s.addText(st.n, {
      x: 0.3, y: y + 0.06, w: 0.45, h: 0.45,
      fontSize: 13, bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(st.text, {
      x: 0.85, y, w: 4.45, h: 0.78,
      fontSize: 11, fontFace: "Calibri", color: C.darkGray, valign: "middle",
    });
    if (i < 4) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: y + 0.51, w: 0.04, h: 0.4,
        fill: { color: C.border }, line: { color: C.border }
      });
    }
  });

  // 右側 Crew 狀態面板
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.55, y: 0.95, w: 4.2, h: 4.55,
    fill: { color: C.lightGray }, line: { color: C.border, width: 1 },
    shadow: mkShadow(),
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.55, y: 0.95, w: 4.2, h: 0.42,
    fill: { color: C.medBlue }, line: { color: C.medBlue }
  });
  s.addText("AI 徵審執行進度", {
    x: 5.55, y: 0.95, w: 4.2, h: 0.42,
    fontSize: 12, bold: true, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });

  const crewStatus = [
    { crew: "Crew 5", name: "文件解析",    result: "謄本解析完成",         color: C.green },
    { crew: "Crew 2", name: "XGBoost 鑑估", result: "市值 2,150萬 LTV 55.8%", color: C.green },
    { crew: "Crew 1", name: "5P 信用評分",  result: "低風險  DBR 8.2 倍",   color: C.green },
    { crew: "Crew 3", name: "法規查核",     result: "符合央行全部規定",     color: C.green },
    { crew: "Crew 7", name: "防詐查核",     result: "低風險  28 / 100",     color: C.green },
    { crew: "Crew 4", name: "審議小組",     result: "建議核准  調整 1,150萬", color: C.gold },
  ];

  crewStatus.forEach((cr, i) => {
    const y = 1.47 + i * 0.665;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.65, y, w: 4.0, h: 0.57,
      fill: { color: C.white }, line: { color: C.border, width: 0.5 }
    });
    s.addShape(pres.shapes.OVAL, {
      x: 5.72, y: y + 0.07, w: 0.42, h: 0.42,
      fill: { color: cr.color }, line: { color: cr.color }
    });
    s.addText("v", {
      x: 5.72, y: y + 0.07, w: 0.42, h: 0.42,
      fontSize: 11, bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(cr.crew + "  " + cr.name, {
      x: 6.2, y, w: 1.85, h: 0.57,
      fontSize: 10, fontFace: "Calibri", bold: true, color: C.darkGray, valign: "middle",
    });
    s.addText(cr.result, {
      x: 8.05, y, w: 1.55, h: 0.57,
      fontSize: 9, fontFace: "Calibri", color: C.midGray, valign: "middle",
    });
  });
}

// ─── Slide 8：XGBoost 鑑價引擎 ────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "Crew 2 鑑估領航員 — 三層估價模型", "XGBoost 個別鑑價 + LSTM 市場趨勢 + Monte Carlo 風險模擬");

  const layers = [
    {
      title: "Layer 1   XGBoost 個別物件鑑價",
      color: C.deepBlue,
      items: [
        "資料來源：內政部實價登錄 8 季（約 30 萬筆交易紀錄）",
        "特徵：行政區、建物類型、坪數、屋齡、樓層、格局、車位",
        "目標精度：MAPE 10-15%  |  Demo 階段：行政區查表回退機制",
      ],
    },
    {
      title: "Layer 2   LSTM 市場趨勢指數",
      color: C.teal,
      items: [
        "輸入：9 個月歷史房價走勢（月度指數）",
        "輸出：市場趨勢乘數，調整鑑估基準價",
        "現狀：Demo Stub（假資料），正式版替換真實 LSTM 模型",
      ],
    },
    {
      title: "Layer 3   Monte Carlo 風險模擬",
      color: C.forestGreen,
      items: [
        "1,000 路徑隨機模擬（整合 LSTM 趨勢 + XGBoost 基準）",
        "輸出：P5 / P50 / P95 信心區間 + 建議市值 + LTV 成數 + 風險等級",
      ],
    },
  ];

  layers.forEach((l, i) => {
    const y = 1.02 + i * 1.4;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.28, y, w: 6.85, h: 1.28,
      fill: { color: C.white }, line: { color: C.border, width: 1 },
      shadow: mkShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.28, y, w: 6.85, h: 0.38,
      fill: { color: l.color }, line: { color: l.color }
    });
    s.addText(l.title, {
      x: 0.42, y, w: 6.6, h: 0.38,
      fontSize: 12, fontFace: "Calibri", bold: true, color: C.white,
      valign: "middle", margin: 0,
    });
    const richItems = l.items.map((item, idx) => ({
      text: item, options: { bullet: true, breakLine: idx < l.items.length - 1 },
    }));
    s.addText(richItems, {
      x: 0.42, y: y + 0.4, w: 6.6, h: 0.8,
      fontSize: 10.5, fontFace: "Calibri", color: C.darkGray, valign: "top",
    });
  });

  // 右側輸出摘要
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.38, y: 1.02, w: 2.35, h: 3.18,
    fill: { color: C.goldLight }, line: { color: C.gold, width: 1.5 },
    shadow: mkShadow(),
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.38, y: 1.02, w: 2.35, h: 0.42,
    fill: { color: C.gold }, line: { color: C.gold }
  });
  s.addText("最終輸出", {
    x: 7.38, y: 1.02, w: 2.35, h: 0.42,
    fontSize: 13, bold: true, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });

  const outputs = [
    { label: "建議市值", val: "2,150 萬" },
    { label: "LTV 成數", val: "55.8%" },
    { label: "信心區間", val: "P5~P95" },
    { label: "風險等級", val: "低 / 中 / 高" },
  ];
  outputs.forEach((o, i) => {
    s.addText(o.label, {
      x: 7.5, y: 1.58 + i * 0.65, w: 1.0, h: 0.5,
      fontSize: 10, fontFace: "Calibri", color: C.midGray, valign: "middle",
    });
    s.addText(o.val, {
      x: 8.5, y: 1.58 + i * 0.65, w: 1.1, h: 0.5,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.deepBlue, valign: "middle",
    });
  });

  // 底部備註
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 4.55, w: 9.44, h: 0.82,
    fill: { color: C.lightBlueBg }, line: { color: "BFD7F5" }
  });
  s.addText([
    { text: "黑客松狀態：", options: { bold: true } },
    { text: "XGBoost 推論服務已完成（xgboostValuationService.py），待執行 fetch_lvpr.py 抓取資料 + train_xgboost.py 訓練模型，\n", options: {} },
    { text: "模型訓練完成後將自動替換 Demo 查表模式，前端已完整整合 XGBoost API 端點", options: {} },
  ], {
    x: 0.45, y: 4.55, w: 9.1, h: 0.82,
    fontSize: 10.5, fontFace: "Calibri", color: C.darkGray, valign: "middle",
  });
}

// ─── Slide 9：Crew 7 防詐 ──────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "Crew 7 防詐領航員 — 5 大防線", "Crew 1 問「還得起嗎？」/ Crew 7 問「是真實借款人嗎？」");

  const defenses = [
    { code: "A", title: "身分認證\n防偽",    body: "證件格式驗證\nMyData 三要素比對\n照片一致性（規則）",  weight: "30%", implColor: C.green,     impl: "規則引擎" },
    { code: "B", title: "黑名單\n掃描",      body: "身分證/電話/地址\n比對詐騙清單\n聯徵拒絕往來戶",     weight: "25%", implColor: C.teal,      impl: "Mock 清單" },
    { code: "C", title: "異常申貸\n行為",    body: "7 項規則計分\n短期多行申貸\n金額/用途異常",          weight: "25%", implColor: C.green,     impl: "規則計分" },
    { code: "D", title: "LLM 交易\n行為分析", body: "GPT 分析交易序列\n薪轉後快速轉出\n定期轉固定帳號",  weight: "10%", implColor: C.midGray,   impl: "模擬資料" },
    { code: "E", title: "關聯網絡\n分析",    body: "共同擔保人異常\n同地址多申請人\n家族連鎖借貸",       weight: "10%", implColor: C.midGray,   impl: "規則模擬" },
  ];

  defenses.forEach((d, i) => {
    const x = 0.25 + i * 1.9;
    const y = 1.05;
    const w = 1.75;
    const h = 4.15;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h, fill: { color: C.white }, line: { color: C.border, width: 1 },
      shadow: mkShadow(),
    });

    // 頂色條
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h: 0.07, fill: { color: C.deepBlue }, line: { color: C.deepBlue }
    });

    // 字母徽章
    s.addShape(pres.shapes.OVAL, {
      x: x + w / 2 - 0.32, y: y + 0.14, w: 0.64, h: 0.64,
      fill: { color: C.deepBlue }, line: { color: C.gold, width: 2 }
    });
    s.addText(d.code, {
      x: x + w / 2 - 0.32, y: y + 0.14, w: 0.64, h: 0.64,
      fontSize: 18, fontFace: "Arial Black", bold: true, color: C.gold,
      align: "center", valign: "middle", margin: 0,
    });

    // 標題
    s.addText(d.title, {
      x: x + 0.1, y: y + 0.88, w: w - 0.2, h: 0.6,
      fontSize: 11, fontFace: "Calibri", bold: true, color: C.deepBlue, align: "center",
    });

    // 說明
    s.addText(d.body, {
      x: x + 0.1, y: y + 1.55, w: w - 0.2, h: 1.55,
      fontSize: 9.5, fontFace: "Calibri", color: C.darkGray, align: "center", valign: "top",
    });

    // 權重
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.27, y: y + 3.1, w: 1.2, h: 0.3,
      fill: { color: C.goldLight }, line: { color: C.gold }
    });
    s.addText("權重 " + d.weight, {
      x: x + 0.27, y: y + 3.1, w: 1.2, h: 0.3,
      fontSize: 10, bold: true, color: C.deepBlue, align: "center", valign: "middle", margin: 0,
    });

    // 實作標籤
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.27, y: y + 3.5, w: 1.2, h: 0.28,
      fill: { color: d.implColor }, line: { color: d.implColor }
    });
    s.addText(d.impl, {
      x: x + 0.27, y: y + 3.5, w: 1.2, h: 0.28,
      fontSize: 9, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 5.1, w: 9.44, h: 0.38,
    fill: { color: C.goldLight }, line: { color: C.gold, width: 1.5 }
  });
  s.addText("輸出：防詐評分 0-100 + 警示等級（低/中/高）+ 整合進批覆書第 7 節「防詐領航員評估結果」", {
    x: 0.28, y: 5.1, w: 9.44, h: 0.38,
    fontSize: 11, fontFace: "Calibri", bold: true, color: C.deepBlue,
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── Slide 10：開發進度 ────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "目前開發進度（2026-03-29）", "整體 72%，黑客松前聚焦 4 個關鍵待辦項目");

  // 大數字
  s.addShape(pres.shapes.OVAL, {
    x: 7.7, y: 1.0, w: 2.0, h: 2.0,
    fill: { color: C.deepBlue }, line: { color: C.gold, width: 3 }
  });
  s.addText("72%", {
    x: 7.7, y: 1.0, w: 2.0, h: 1.6,
    fontSize: 46, fontFace: "Arial Black", bold: true, color: C.gold,
    align: "center", valign: "middle",
  });
  s.addText("整體進度", {
    x: 7.7, y: 2.6, w: 2.0, h: 0.35,
    fontSize: 12, fontFace: "Calibri", color: C.midGray, align: "center",
  });

  // 進度條
  const bars = [
    { label: "後端 Node.js / TypeScript", pct: 82, note: "Crew 7 程式碼待補",      fillColor: C.green },
    { label: "前端 React / TypeScript",   pct: 78, note: "LIFF_ID 待設定",         fillColor: C.green },
    { label: "Python ML 鑑價引擎",        pct: 55, note: "XGBoost 模型待訓練",     fillColor: C.gold },
    { label: "基礎建設 / 部署",           pct: 45, note: "本機可運行，Azure 待部署", fillColor: "E67E22" },
  ];

  bars.forEach((b, i) => {
    const y = 1.1 + i * 0.92;
    const barW = 6.6;
    const filled = barW * b.pct / 100;

    s.addText(b.label, {
      x: 0.4, y, w: 4.0, h: 0.36,
      fontSize: 12, fontFace: "Calibri", bold: true, color: C.darkGray,
    });
    s.addText(b.pct + "%  —  " + b.note, {
      x: 4.4, y, w: 3.2, h: 0.36,
      fontSize: 10.5, fontFace: "Calibri", color: C.midGray,
    });
    // 背景軌道
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: y + 0.4, w: barW, h: 0.3,
      fill: { color: "E2E8F0" }, line: { color: "E2E8F0" }
    });
    // 填充
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: y + 0.4, w: filled, h: 0.3,
      fill: { color: b.fillColor }, line: { color: b.fillColor }
    });
  });

  // 待辦清單
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 4.82, w: 9.44, h: 0.65,
    fill: { color: C.lightGray }, line: { color: C.border }
  });
  s.addText("黑客松前必做：", {
    x: 0.45, y: 4.82, w: 2.0, h: 0.3,
    fontSize: 11, fontFace: "Calibri", bold: true, color: C.deepBlue,
  });
  const todos = [
    "執行 fetch_lvpr + train_xgboost（XGBoost 模型）",
    "實作 antifraud/ 目錄（Crew 7 5 個模組）",
    "申請 LINE LIFF App + 設定 VITE_LIFF_ID",
    "AdminCaseDetailPage 加入 Crew 7 進度卡",
  ];
  s.addText(todos.map((t, i) => ({ text: (i < 2 ? "[紅] " : "[黃] ") + t, options: { breakLine: i < todos.length - 1 } })), {
    x: 0.45, y: 5.1, w: 9.1, h: 0.38,
    fontSize: 9.5, fontFace: "Calibri", color: C.darkGray, valign: "middle",
  });
}

// ─── Slide 11：分工建議 ────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  addTitleBar(s, "黑客松分工建議", "4 個角色平行作業，最大化效率");

  const roles = [
    {
      role: "角色 A", title: "後端工程師", color: C.deepBlue,
      tasks: ["實作 antifraud/ 目錄（Crew 7）", "5 個偵測模組程式碼", "workflowService 整合 Crew 7 並行", "creditReportGenerator 加第 7 節"],
    },
    {
      role: "角色 B", title: "ML 工程師", color: C.teal,
      tasks: ["執行 fetch_lvpr.py 抓取資料", "執行 train_xgboost.py 訓練", "驗證 MAPE 15% 以內", "確認 FastAPI 推論服務正常"],
    },
    {
      role: "角色 C", title: "前端工程師", color: C.forestGreen,
      tasks: ["申請 LINE LIFF App", "設定 VITE_LIFF_ID", "AdminPage 加 Crew 7 進度卡", "確認完整 Demo 流程跑通"],
    },
    {
      role: "角色 D", title: "Demo 負責人", color: C.purple,
      tasks: ["準備客戶 + 行員 Demo 腳本", "準備 Mock 測試資料", "演練端到端 Demo 流程", "準備簡報與口頭說明"],
    },
  ];

  roles.forEach((r, i) => {
    const x = 0.28 + i * 2.37;
    const w = 2.2;
    const h = 4.35;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w, h,
      fill: { color: C.white }, line: { color: C.border, width: 1 },
      shadow: mkShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w, h: 0.58,
      fill: { color: r.color }, line: { color: r.color }
    });
    s.addText(r.role, {
      x: x + 0.12, y: 1.05, w: w - 0.24, h: 0.26,
      fontSize: 10, fontFace: "Calibri", color: "CADCFC", valign: "top", margin: 0,
    });
    s.addText(r.title, {
      x: x + 0.12, y: 1.3, w: w - 0.24, h: 0.28,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.white, valign: "top", margin: 0,
    });

    const taskItems = r.tasks.map((t, idx) => ({
      text: t, options: { bullet: true, breakLine: idx < r.tasks.length - 1 },
    }));
    s.addText(taskItems, {
      x: x + 0.1, y: 1.7, w: w - 0.2, h: 3.55,
      fontSize: 10.5, fontFace: "Calibri", color: C.darkGray, valign: "top",
    });
  });
}

// ─── Slide 12：結語 ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.deepBlue };

  // 裝飾圓
  s.addShape(pres.shapes.OVAL, {
    x: 7.0, y: 2.0, w: 6.0, h: 6.0,
    fill: { color: "243D70", transparency: 50 }, line: { color: "243D70" }
  });
  s.addShape(pres.shapes.OVAL, {
    x: -2.5, y: -1.0, w: 5.5, h: 5.5,
    fill: { color: "1A2F58", transparency: 40 }, line: { color: "1A2F58" }
  });

  // 頂部金線
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.85, w: 3.5, h: 0.06, fill: { color: C.gold }, line: { color: C.gold }
  });

  s.addText("讓 AI 當副駕駛", {
    x: 0.6, y: 1.0, w: 8.5, h: 0.9,
    fontSize: 42, fontFace: "Arial Black", bold: true, color: C.white,
  });
  s.addText("讓行員當機長", {
    x: 0.6, y: 1.85, w: 8.5, h: 0.9,
    fontSize: 42, fontFace: "Arial Black", bold: true, color: C.gold,
  });

  const values = [
    "行員不用再當「查資料的機器」",
    "5 分鐘完成過去 2 天的徵審工作",
    "AI 提供依據，人類做最終決策",
  ];
  values.forEach((v, i) => {
    s.addText("✦  " + v, {
      x: 0.6, y: 2.92 + i * 0.52, w: 7.2, h: 0.44,
      fontSize: 16, fontFace: "Calibri", color: "CADCFC", valign: "middle",
    });
  });

  // 技術標籤
  const tags = ["Claude API", "XGBoost", "LINE Bot", "React + TypeScript", "Node.js", "Python FastAPI"];
  tags.forEach((tag, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6 + i * 1.55, y: 4.6, w: 1.42, h: 0.3,
      fill: { color: "243D70" }, line: { color: "2C4A7A" }
    });
    s.addText(tag, {
      x: 0.6 + i * 1.55, y: 4.6, w: 1.42, h: 0.3,
      fontSize: 9, fontFace: "Calibri", color: "8BAED4",
      align: "center", valign: "middle", margin: 0,
    });
  });

  // 底部金條
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.24, w: 10, h: 0.385, fill: { color: C.gold }, line: { color: C.gold }
  });
  s.addText("分行神隊友：個金 Co-Pilot 領航員  ·  黑客松 Demo  2026", {
    x: 0, y: 5.24, w: 10, h: 0.385,
    fontSize: 12, fontFace: "Calibri", bold: true, color: C.deepBlue,
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── 輸出 ──────────────────────────────────────────────────────
pres.writeFile({ fileName: "docs/hackathon-intro.pptx" })
  .then(() => console.log("✅ docs/hackathon-intro.pptx 已生成（12 張投影片）"))
  .catch(err => { console.error("❌ 生成失敗：", err); process.exit(1); });
