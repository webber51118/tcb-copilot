/**
 * INPUT: CommitteeReviewRequest（貸款申請摘要 + 徵審結果 + 鑑價結果）
 * OUTPUT: CommitteeReviewResponse（三輪討論 + 最終決議）
 * POS: 服務層，以 Claude claude-sonnet-4-6 模擬三代辦並行討論，協調者合成最終決議
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CommitteeReviewRequest,
  CommitteeReviewResponse,
  CommitteeRound,
  AgentOpinion,
  CommitteeAgent,
  AgentRecommendation,
  CommitteeFinalDecision,
  FinalDecision,
} from '../models/committeeReview';

const MODEL = 'claude-sonnet-4-6';

// ─── 案件摘要文字（三代辦共享上下文） ────────────────────────────

function buildCaseSummary(req: CommitteeReviewRequest): string {
  const {
    loanType,
    loanAmount,
    termYears,
    borrowerName,
    borrowerAge,
    occupation,
    purpose,
    creditReviewSummary: cs,
    valuationSummary: vs,
  } = req;

  const typeLabel = loanType === 'mortgage' ? '房屋貸款' : '信用貸款';
  const amountFmt = `NT$ ${loanAmount.toLocaleString()} 元`;
  const fraudIcon = cs.fraudLevel === 'normal' ? '🟢' : cs.fraudLevel === 'caution' ? '🟡' : '🔴';

  let summary = `
【案件基本資料】
・貸款類型：${typeLabel}
・申請金額：${amountFmt}
・貸款年限：${termYears} 年
・借款人：${borrowerName}（${borrowerAge} 歲，${occupation}）
・貸款用途：${purpose}

【徵審關鍵指標】
・5P 風控評分：${cs.riskScore}/100 分
・${cs.primaryMetricLabel}（門檻${cs.thresholdPass ? '通過✅' : '超標❌'}）
・防詐查核：${fraudIcon} ${cs.fraudPassCount}/8 項通過（${cs.fraudLevel}）
・整體評估：${cs.overallAssessment}
`;

  if (cs.adjustedLoanAmount !== undefined && !cs.thresholdPass) {
    summary += `・建議調整金額：NT$ ${cs.adjustedLoanAmount.toLocaleString()} 元\n`;
  }

  if (loanType === 'mortgage' && vs) {
    const sentimentLabel =
      vs.sentimentScore < -0.1 ? '看跌（偏空）'
      : vs.sentimentScore > 0.1 ? '看漲（偏多）'
      : '中性';
    summary += `
【ML 鑑價摘要】
・建議鑑估值：NT$ ${vs.estimatedValue.toLocaleString()} 元
・貸款成數（LTV）：${(vs.ltvRatio * 100).toFixed(1)}%
・市場情緒：${sentimentLabel}（${vs.sentimentScore.toFixed(2)}）
・風險等級：${vs.riskLevel}
`;
  }

  return summary.trim();
}

// ─── 單一代辦意見生成 ─────────────────────────────────────────

type RoundType = 'initial' | 'discussion' | 'final';

const AGENT_ROLES: Record<CommitteeAgent, string> = {
  '授信規定領航員':
    '你是授信規定專家，負責檢核央行法規（LTV成數、寬限期）、DBR/負債比合規性、貸款年限與年齡限制。',
  '徵信領航員':
    '你是個人徵信專家，負責分析 5P 信用評分（職業穩定性/所得成長/資產負債/流動比率/所得負債比）、防詐查核結果、及整體還款能力。',
  '鑑價領航員':
    '你是不動產鑑價專家，負責評估 ML 預測鑑估值、市場情緒趨勢、LTV 擔保充足性，以及不動產擔保品風險。信貸案件時，評估借款人資產狀況作為替代分析。',
};

const ROUND_INSTRUCTIONS: Record<RoundType, string> = {
  initial: '請根據案件資料，提出你的初步審查意見（2-3 句話）和建議結論。語氣簡潔專業。',
  discussion:
    '聽取其他委員的初步意見後，請確認或調整你的立場，並指出你最關注的 1-2 個關鍵風險或優勢。',
  final:
    '請給出你的最終明確立場與建議。必須選擇：強烈建議核准 / 建議核准 / 有條件核准 / 需補件 / 建議婉拒。',
};

const RECOMMENDATION_OPTIONS: AgentRecommendation[] = [
  '強烈建議核准',
  '建議核准',
  '有條件核准',
  '需補件',
  '建議婉拒',
];

async function generateAgentOpinion(
  client: Anthropic,
  agent: CommitteeAgent,
  caseSummary: string,
  roundType: RoundType,
  previousOpinions?: AgentOpinion[],
): Promise<AgentOpinion> {
  const previousContext =
    previousOpinions && previousOpinions.length > 0
      ? `\n【其他委員初步意見】\n${previousOpinions
          .map((o) => `${o.agent}：${o.opinion}（${o.recommendation}）`)
          .join('\n')}`
      : '';

  const prompt = `${caseSummary}${previousContext}

${ROUND_INSTRUCTIONS[roundType]}

請以以下 JSON 格式回覆（不要有任何額外文字）：
{
  "opinion": "你的意見摘要（2-3句）",
  "recommendation": "從[強烈建議核准,建議核准,有條件核准,需補件,建議婉拒]選一",
  "keyPoints": ["關鍵點1", "關鍵點2"]
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
    system: `你是彰化銀行授信審議小組成員。${AGENT_ROLES[agent]}
請以繁體中文、專業銀行用語回覆。只輸出要求的 JSON，不要加任何 markdown 或說明。`,
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  let parsed: { opinion: string; recommendation: string; keyPoints: string[] };
  try {
    // 移除可能的 markdown code block
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // 解析失敗時給預設值
    parsed = {
      opinion: '已收到案件資料，評估中。',
      recommendation: '有條件核准',
      keyPoints: ['需進一步確認'],
    };
  }

  // 驗證 recommendation 合法
  const rec = RECOMMENDATION_OPTIONS.includes(parsed.recommendation as AgentRecommendation)
    ? (parsed.recommendation as AgentRecommendation)
    : '有條件核准';

  return {
    agent,
    opinion: parsed.opinion ?? '評估中。',
    recommendation: rec,
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 3) : [],
  };
}

// ─── 最終決議生成 ─────────────────────────────────────────────

async function generateFinalDecision(
  client: Anthropic,
  req: CommitteeReviewRequest,
  caseSummary: string,
  allOpinions: AgentOpinion[],
): Promise<CommitteeFinalDecision> {
  const voteSummary = allOpinions
    .filter((_, i) => i >= allOpinions.length - 3) // 最後一輪（第三輪）的意見
    .map((o) => `${o.agent}：${o.recommendation}`)
    .join('、');

  const prompt = `${caseSummary}

【委員最終票決】
${voteSummary}

請作為審議小組主席，根據以上資料和委員意見，給出最終決議。
申請金額：NT$ ${req.loanAmount.toLocaleString()} 元，年限：${req.termYears} 年。
${req.creditReviewSummary.adjustedLoanAmount ? `建議調整金額：NT$ ${req.creditReviewSummary.adjustedLoanAmount.toLocaleString()} 元` : ''}

請以 JSON 格式回覆：
{
  "decision": "核准 或 有條件核准 或 婉拒",
  "approvedAmount": 實際核准金額數字（元，整數）,
  "approvedTermYears": 核准年限數字,
  "interestRateHint": "如：機動利率2.185%起",
  "conditions": ["條件1", "條件2"],
  "summary": "決議摘要（1-2句）"
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
    system: `你是彰化銀行授信審議小組主席，負責綜合委員意見，以繁體中文輸出最終決議 JSON。只輸出 JSON，不加任何說明。`,
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  let parsed: {
    decision: string;
    approvedAmount: number;
    approvedTermYears: number;
    interestRateHint: string;
    conditions: string[];
    summary: string;
  };

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // fallback
    const pass = req.creditReviewSummary.thresholdPass;
    parsed = {
      decision: pass ? '核准' : '有條件核准',
      approvedAmount: req.creditReviewSummary.adjustedLoanAmount ?? req.loanAmount,
      approvedTermYears: req.termYears,
      interestRateHint: req.loanType === 'mortgage' ? '機動利率2.185%起' : '機動利率5.5%起',
      conditions: pass ? [] : ['依建議調整後金額辦理'],
      summary: '審議小組決議通過，請依核准條件辦理後續手續。',
    };
  }

  const validDecisions: FinalDecision[] = ['核准', '有條件核准', '婉拒'];
  const decision: FinalDecision = validDecisions.includes(parsed.decision as FinalDecision)
    ? (parsed.decision as FinalDecision)
    : '有條件核准';

  // 最後一輪各代辦票決
  const lastRoundOpinions = allOpinions.slice(-3);
  const votes = lastRoundOpinions.map((o) => ({
    agent: o.agent,
    recommendation: o.recommendation,
  }));

  return {
    decision,
    approvedAmount: Math.round(parsed.approvedAmount ?? req.loanAmount),
    approvedTermYears: parsed.approvedTermYears ?? req.termYears,
    interestRateHint: parsed.interestRateHint ?? '機動利率另議',
    conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
    summary: parsed.summary ?? '審議完成。',
    votes,
  };
}

// ─── 主服務函式 ────────────────────────────────────────────────

export async function runCommitteeReview(
  req: CommitteeReviewRequest,
): Promise<CommitteeReviewResponse> {
  const startMs = Date.now();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const applicationId = req.applicationId ?? `CR-${Date.now()}`;
  const caseSummary = buildCaseSummary(req);

  const agents: CommitteeAgent[] =
    req.loanType === 'mortgage'
      ? ['授信規定領航員', '徵信領航員', '鑑價領航員']
      : ['授信規定領航員', '徵信領航員', '鑑價領航員'];

  const rounds: CommitteeRound[] = [];
  const allOpinions: AgentOpinion[] = [];

  // ── 第一輪：初步意見（三代辦並行）────────────────────────────
  const round1Opinions = await Promise.all(
    agents.map((agent) =>
      generateAgentOpinion(client, agent, caseSummary, 'initial'),
    ),
  );
  allOpinions.push(...round1Opinions);
  rounds.push({
    roundNumber: 1,
    roundTitle: '第一輪：初步審查意見',
    opinions: round1Opinions,
  });

  // ── 第二輪：交叉討論（了解他人意見後調整）────────────────────
  const round2Opinions = await Promise.all(
    agents.map((agent) =>
      generateAgentOpinion(client, agent, caseSummary, 'discussion', round1Opinions),
    ),
  );
  allOpinions.push(...round2Opinions);
  rounds.push({
    roundNumber: 2,
    roundTitle: '第二輪：交叉討論與確認',
    opinions: round2Opinions,
  });

  // ── 第三輪：最終票決 ──────────────────────────────────────────
  const round3Opinions = await Promise.all(
    agents.map((agent) =>
      generateAgentOpinion(client, agent, caseSummary, 'final', round2Opinions),
    ),
  );
  allOpinions.push(...round3Opinions);
  rounds.push({
    roundNumber: 3,
    roundTitle: '第三輪：最終票決',
    opinions: round3Opinions,
  });

  // ── 主席合成最終決議 ──────────────────────────────────────────
  const finalDecision = await generateFinalDecision(client, req, caseSummary, allOpinions);

  return {
    success: true,
    applicationId,
    rounds,
    finalDecision,
    durationMs: Date.now() - startMs,
  };
}
