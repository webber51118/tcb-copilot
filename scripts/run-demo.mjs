/**
 * Demo 黃金測資執行腳本
 * 用途：黑客松 Demo 前一鍵跑通三大場景，驗證 PILOT CREW + Teams + Power BI
 *
 * 使用方式：
 *   node --env-file=.env scripts/run-demo.mjs
 *   node --env-file=.env scripts/run-demo.mjs --scenario 1   （只跑場景一）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(readFileSync(join(__dirname, '../data/demo-scenarios.json'), 'utf-8'));

const BASE_URL    = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_KEY   = process.env.ADMIN_API_KEY ?? '';

if (!ADMIN_KEY) {
  console.error('❌ ADMIN_API_KEY 未設定，請確認 .env 檔案');
  process.exit(1);
}

// 指定只跑特定場景（--scenario 1|2|3）
const scenarioArg = process.argv.find(a => a.startsWith('--scenario'));
const targetIdx   = scenarioArg ? parseInt(scenarioArg.split(' ')[1] ?? process.argv[process.argv.indexOf(scenarioArg) + 1]) - 1 : null;
const toRun       = targetIdx !== null ? [scenarios[targetIdx]] : scenarios;

const DIVIDER = '═'.repeat(60);

async function runScenario(scenario) {
  console.log(`\n${DIVIDER}`);
  console.log(`🎬 ${scenario.scenarioId}｜${scenario.scenarioName}`);
  console.log(`📝 ${scenario.description}`);
  console.log(DIVIDER);

  const start = Date.now();
  let resp, data;

  try {
    resp = await fetch(`${BASE_URL}/api/pilot-crew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ADMIN_KEY,
      },
      body: JSON.stringify(scenario.request),
      signal: AbortSignal.timeout(30_000),
    });
    data = await resp.json();
  } catch (err) {
    console.error(`❌ API 呼叫失敗：${err.message}`);
    console.error('   請確認後端已啟動（npm run dev）');
    return false;
  }

  const elapsed = Date.now() - start;

  if (!resp.ok || !data.success) {
    console.error(`❌ PILOT CREW 回傳失敗 (HTTP ${resp.status})`);
    console.error(JSON.stringify(data, null, 2));
    return false;
  }

  // ── CREW 1 推薦結果 ──────────────────────────────────
  const crew1 = data.crew1?.recommendation?.primary;
  const productName = crew1?.name ?? '—';
  const productId   = crew1?.id   ?? '—';
  console.log(`\n✅ CREW 1 行銷 PILOT`);
  console.log(`   推薦商品：${productName}（${productId}）`);
  console.log(`   利率：${crew1?.rateRange ?? '—'}　月付：${crew1?.monthlyPayment?.toLocaleString() ?? '—'} 元`);

  // ── CREW 2 鑑估結果（房貸才有）────────────────────────
  if (data.crew2) {
    const v = data.crew2.result;
    console.log(`\n✅ CREW 2 鑑估 PILOT`);
    console.log(`   P50 鑑估值：${v?.estimatedValue?.toLocaleString() ?? v?.p50?.toLocaleString() ?? '—'} 元`);
    console.log(`   模式：${data.crew2.mode}`);
  }

  // ── CREW 3 防詐結果 ──────────────────────────────────
  const crew3 = data.crew3?.mlScore;
  const fraudScore = crew3?.fraudScore ?? 0;
  const alertLevel = crew3?.alertLevel ?? 0;
  const riskEmoji  = alertLevel === 3 ? '🔴' : alertLevel === 2 ? '🟠' : '🟢';
  console.log(`\n${riskEmoji} CREW 3 防詐 PILOT`);
  console.log(`   FraudScore：${fraudScore}　等級：${crew3?.riskLevel ?? '—'}（Level ${alertLevel}）`);
  if (crew3?.topRiskFactors?.length > 0) {
    crew3.topRiskFactors.slice(0, 3).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.label ?? f}（${((f.contribution ?? 0) * 100).toFixed(1)}%）`);
    });
  }

  // ── 驗收對比 ────────────────────────────────────────
  const exp = scenario.expectedResult;
  console.log(`\n📋 驗收結果`);
  const checks = [
    ['PILOT CREW 成功',           data.success === true],
    ['CREW1 商品正確',             !exp.crew1Product || productId === exp.crew1Product],
    ['CREW2 鑑估有值',             exp.crew2HasValuation ? !!data.crew2 : true],
    ['CREW3 Level 符合預期',       exp.crew3AlertLevel ? alertLevel === exp.crew3AlertLevel : true],
    ['FraudScore < 最大值',        exp.crew3FraudScoreMax ? fraudScore < exp.crew3FraudScoreMax : true],
    ['FraudScore > 最小值',        exp.crew3FraudScoreMin ? fraudScore > exp.crew3FraudScoreMin : true],
    ['Teams 防詐警示已觸發',       exp.teamsFraudAlert ? (data.powerAutomateTriggered === true) : true],
  ];

  let passed = 0;
  checks.forEach(([label, result]) => {
    console.log(`   ${result ? '✅' : '❌'} ${label}`);
    if (result) passed++;
  });

  console.log(`\n   總計：${passed}/${checks.length} 通過　耗時 ${elapsed}ms`);
  return passed === checks.length;
}

// ── 主流程 ──────────────────────────────────────────────
console.log(`\n🚀 個金 Co-Pilot｜Demo 黃金測資驗收`);
console.log(`   後端：${BASE_URL}`);
console.log(`   場景數：${toRun.length}`);

let allPassed = true;
for (const scenario of toRun) {
  const ok = await runScenario(scenario);
  if (!ok) allPassed = false;
  // 場景間間隔 2 秒，讓 Teams 有時間接收
  if (toRun.indexOf(scenario) < toRun.length - 1) {
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log(`\n${DIVIDER}`);
console.log(allPassed
  ? '🎉 所有場景驗收通過！Demo 就緒。'
  : '⚠️  部分場景未通過，請檢查上方錯誤訊息。');
console.log(DIVIDER);
