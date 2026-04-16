/**
 * INPUT: { audioBase64?: string, mimeType?: string }
 * OUTPUT: { transcript, fields, mode }
 * POS: 台語語音辨識 API — Demo 模式返回示範腳本，Real 模式接 Breeze-ASR-26
 */

import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

export const voiceRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Demo 腳本（3 個場景，循環使用） ──────────────────────────────────

const DEMO_SCRIPTS = [
  {
    taiwaneseDisplay: '「我是護理師，月薪六萬，想借五百萬，買第一間厝」',
    transcript: '我是護理師，月薪六萬，想借五百萬，買第一間房子，自己住的',
  },
  {
    taiwaneseDisplay: '「我是現役軍人，月俸七萬，想借七百萬，要買自住的厝」',
    transcript: '我是現役軍人，月俸七萬元，想借七百萬元，要買自住的房子',
  },
  {
    taiwaneseDisplay: '「我已經退休，每月有四萬退休金，想借三十萬週轉用」',
    transcript: '我已經退休了，每個月有四萬塊退休金，想借三十萬週轉用',
  },
];

let demoIndex = 0;

// ── Claude NLU 解析 ────────────────────────────────────────────────

interface ParsedFields {
  loanType: 'mortgage' | 'personal' | 'reverse_annuity';
  basicInfo: {
    occupation: string | null;
    income: number | null;
    purpose: string | null;
    amount: number | null;
    termYears: number | null;
  };
}

async function parseWithClaude(transcript: string): Promise<ParsedFields> {
  const prompt = `你是台灣銀行的貸款申請助理。
以下是客戶說的台語轉錄文字（繁體中文）：
"${transcript}"

請從中提取：貸款類型（mortgage=房貸/reverse_annuity=以房養老/personal=信用貸款）、
職業、月收入（數字，單位：元）、貸款金額（數字，單位：元，萬元請乘以10000）、
貸款用途（例：首購自住、換屋、週轉）、貸款年限（若有提及）。
以 JSON 格式回傳，無法確定的欄位設為 null。

回傳格式範例：
{
  "loanType": "mortgage",
  "basicInfo": {
    "occupation": "護理師",
    "income": 60000,
    "purpose": "首購自住",
    "amount": 5000000,
    "termYears": null
  }
}

只回傳 JSON，不要有其他文字。`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  try {
    const parsed = JSON.parse(text.trim()) as ParsedFields;
    return parsed;
  } catch {
    return {
      loanType: 'mortgage',
      basicInfo: {
        occupation: null,
        income: null,
        purpose: null,
        amount: null,
        termYears: null,
      },
    };
  }
}

// ── POST /voice/process ────────────────────────────────────────────

voiceRouter.post('/voice/process', async (req: Request, res: Response) => {
  const { audioBase64, mimeType } = req.body as { audioBase64?: string; mimeType?: string };

  const isDemoMode =
    process.env.VOICE_DEMO_MODE === 'true' ||
    !audioBase64 ||
    !process.env.BREEZE_ASR_URL;

  let transcript: string;
  let mode: 'demo' | 'asr';
  let taiwaneseDisplay: string | undefined;

  if (isDemoMode) {
    // Demo Mode：使用預設腳本（循環）
    const script = DEMO_SCRIPTS[demoIndex % DEMO_SCRIPTS.length];
    demoIndex++;
    transcript = script.transcript;
    taiwaneseDisplay = script.taiwaneseDisplay;
    mode = 'demo';
  } else {
    // Real Mode：呼叫 Breeze-ASR-26 Python FastAPI
    try {
      const asrUrl = process.env.BREEZE_ASR_URL || 'http://localhost:8001/voice/transcribe';
      const asrRes = await fetch(asrUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      const asrData = await asrRes.json() as { transcript?: string };
      transcript = asrData.transcript || '';
      mode = 'asr';
    } catch {
      // ASR 服務離線，fallback 到 Demo Mode
      const script = DEMO_SCRIPTS[demoIndex % DEMO_SCRIPTS.length];
      demoIndex++;
      transcript = script.transcript;
      taiwaneseDisplay = script.taiwaneseDisplay;
      mode = 'demo';
    }
  }

  // Claude NLU 解析（Demo/Real 都執行）
  const fields = await parseWithClaude(transcript);

  res.json({
    success: true,
    transcript,
    taiwaneseDisplay,
    fields,
    mode,
  });
});
