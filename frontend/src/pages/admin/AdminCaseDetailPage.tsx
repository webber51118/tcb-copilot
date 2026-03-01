/**
 * INPUT: 案件 ID（URL params）+ Admin API Key（sessionStorage）
 * OUTPUT: 案件詳情、AI 徵審結果、核准/婉拒操作
 * POS: 後台案件詳情頁
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// ── 型別定義 ──────────────────────────────────────────────────────

interface BasicInfo {
  age: number | null;
  occupation: string | null;
  income: number | null;
  purpose: string | null;
  termYears: number | null;
  amount: number | null;
}

interface PropertyInfo {
  propertyAge: number | null;
  areaPing: number | null;
  hasParking: boolean | null;
  layout: string | null;
  floor: number | null;
  buildingType: string | null;
}

interface LoanApplication {
  id: string;
  lineUserId: string;
  applicantName: string;
  applicantPhone: string;
  loanType: string;
  basicInfo: BasicInfo;
  propertyInfo: PropertyInfo;
  recommendedProductId: string;
  mydataReady: boolean;
  landRegistryReady: boolean | null;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  appliedAt: string;
}

interface ValuationResult {
  estimatedValue: number;
  ltvRatio: number;
  riskLevel: '低風險' | '中風險' | '高風險';
  sentimentScore: number;
  confidenceInterval: { p5: number; p50: number; p95: number };
  mode: 'demo' | 'production';
}

interface CreditReviewResult {
  overallAssessment: string;
  fraudCheck: { overallLevel: 'normal' | 'caution' | 'alert' };
  thresholds: {
    debtIncomeRatio: { value: number; pass: boolean };
    dbr?: { value: number; pass: boolean };
  };
  riskFactors: {
    employmentStability: { level: number };
    incomeGrowth: { level: number };
    netWorthLevel: { level: number };
    netWorthRatio: { level: number };
    liquidityRatio: { level: number };
    debtRatio: { level: number };
  };
}

interface AgentOpinion {
  agent: string;
  opinion: string;
  recommendation: string;
  keyPoints: string[];
}

interface CommitteeRound {
  roundNumber: number;
  roundTitle: string;
  opinions: AgentOpinion[];
}

interface CommitteeFinalDecision {
  decision: '核准' | '有條件核准' | '婉拒';
  approvedAmount: number;
  approvedTermYears: number;
  interestRateHint: string;
  conditions: string[];
  summary: string;
  votes: { agent: string; recommendation: string }[];
}

interface FullReviewResponse {
  success: true;
  applicationId: string;
  loanType: string;
  phases: {
    valuation?: { mode: string; result: ValuationResult; durationMs: number };
    creditReview: { result: CreditReviewResult; durationMs: number };
    committeeReview: { result: { rounds: CommitteeRound[]; finalDecision: CommitteeFinalDecision }; durationMs: number };
  };
  finalSummary: {
    decision: '核准' | '有條件核準' | '婉拒';
    approvedAmount: number;
    approvedTermYears: number;
    interestRateHint: string;
    conditions: string[];
    riskScore: number;
    fraudLevel: string;
  };
  totalDurationMs: number;
}

// ── 輔助常數 & 函式 ───────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: '待審核', reviewing: '徵審中', approved: '已核准', rejected: '已婉拒',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};
const LOAN_TYPE_LABEL: Record<string, string> = {
  mortgage: '🏠 房屋貸款',
  reverse_annuity: '🌸 以房養老',
  personal: '💳 信用貸款',
};
const FRAUD_LABEL: Record<string, string> = {
  normal: '✅ 正常', caution: '⚠️ 注意', alert: '🚨 高風險',
};
const FRAUD_COLOR: Record<string, string> = {
  normal: 'text-green-600', caution: 'text-yellow-600', alert: 'text-red-600',
};
const DECISION_COLOR: Record<string, string> = {
  '核准': 'text-green-600 bg-green-50 border-green-200',
  '有條件核准': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  '婉拒': 'text-red-600 bg-red-50 border-red-200',
};

function fmt(n: number | null | undefined, unit = '') {
  if (n == null) return '—';
  return `${n.toLocaleString('zh-TW')}${unit}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-none w-24">{label}</span>
      <span className="text-xs text-gray-800 font-semibold">{value}</span>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────

export default function AdminCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { apiKey, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [app, setApp] = useState<LoanApplication | null>(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [reviewResult, setReviewResult] = useState<FullReviewResponse | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    if (!apiKey) { navigate('/admin', { replace: true }); return; }
    fetch(`/api/admin/applications/${id}`, {
      headers: { 'x-admin-api-key': apiKey },
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) setApp(d.data as LoanApplication); })
      .catch(console.error)
      .finally(() => setLoadingCase(false));
  }, [id, apiKey, navigate]);

  // ── AI 徵審 ──────────────────────────────────────────────────
  const runReview = async () => {
    if (!app) return;
    setReviewing(true);
    setReviewError('');

    const isMortgage = app.loanType === 'mortgage' || app.loanType === 'reverse_annuity';
    const isPublicServant = ['軍人', '公務員', '教師'].includes(app.basicInfo.occupation || '');

    const purposeMap: Record<string, '購屋' | '週轉金' | '其他'> = {
      '購屋': '購屋', '週轉金': '週轉金', '資金週轉': '週轉金',
    };

    const body: Record<string, unknown> = {
      applicationId: app.id,
      loanType: isMortgage ? 'mortgage' : 'personal',
      loanAmount: app.basicInfo.amount || 1000000,
      termYears: app.basicInfo.termYears || 20,
      borrower: {
        name: app.applicantName || '申請人',
        age: app.basicInfo.age || 35,
        occupation: app.basicInfo.occupation || '上班族',
        isPublicServant,
        yearsEmployed: 3,
        hasMyData: app.mydataReady,
        monthlyIncome: app.basicInfo.income || 50000,
      },
    };

    if (isMortgage && app.propertyInfo) {
      body['property'] = {
        region: '台北市',
        isFirstHome: true,
        isOwnerOccupied: true,
        purpose: purposeMap[app.basicInfo.purpose || ''] || '購屋',
      };
      body['valuationInput'] = {
        areaPing: app.propertyInfo.areaPing || 35,
        propertyAge: app.propertyInfo.propertyAge || 10,
        buildingType: app.propertyInfo.buildingType || '大樓',
        floor: app.propertyInfo.floor || 5,
        hasParking: app.propertyInfo.hasParking ?? false,
        layout: app.propertyInfo.layout || '3房2廳',
      };
    }

    try {
      // 先將狀態更新為徵審中
      await fetch(`/api/admin/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': apiKey },
        body: JSON.stringify({ status: 'reviewing' }),
      });
      setApp((prev) => prev ? { ...prev, status: 'reviewing' } : null);

      const res = await fetch('/api/workflow/full-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as FullReviewResponse;
      if (!data.success) throw new Error((data as unknown as { message: string }).message);
      setReviewResult(data);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '徵審失敗，請稍後再試');
    } finally {
      setReviewing(false);
    }
  };

  // ── 核准 / 婉拒 ───────────────────────────────────────────────
  const handleDecision = async (status: 'approved' | 'rejected') => {
    if (!app) return;
    setActionLoading(true);
    setActionMsg('');
    setConfirmAction(null);

    try {
      // 更新案件狀態
      const statusRes = await fetch(`/api/admin/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': apiKey },
        body: JSON.stringify({ status }),
      });
      const statusData = await statusRes.json();
      if (!statusData.success) throw new Error(statusData.message);
      setApp((prev) => prev ? { ...prev, status } : null);

      // 推播 LINE 通知給客戶
      const notifyRes = await fetch(`/api/admin/applications/${id}/notify-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': apiKey },
      });
      const notifyData = await notifyRes.json();
      setActionMsg(
        notifyData.success
          ? `案件已${status === 'approved' ? '核准' : '婉拒'}，LINE 通知已發送給客戶 ✓`
          : `案件狀態已更新，但 LINE 通知發送失敗`,
      );
    } catch (err) {
      setActionMsg('操作失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loadingCase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-gray-200 border-t-[#1B4F8A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-gray-400">
        <span className="text-5xl">😕</span>
        <p className="text-sm">找不到案件 {id}</p>
        <button onClick={() => navigate('/admin/cases')} className="text-[#1B4F8A] text-sm hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  const isMortgage = app.loanType === 'mortgage' || app.loanType === 'reverse_annuity';
  const isFinished = app.status === 'approved' || app.status === 'rejected';
  const finalDecision = reviewResult?.phases.committeeReview.result.finalDecision;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導覽 */}
      <header className="bg-[#1B4F8A] shadow-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/cases')}
              className="text-blue-200 hover:text-white text-sm flex items-center gap-1 transition-colors"
            >
              ← 案件列表
            </button>
            <span className="text-blue-300/40">|</span>
            <span className="text-white text-sm font-bold font-mono">{app.id}</span>
          </div>
          <button onClick={() => { logout(); navigate('/admin', { replace: true }); }}
            className="text-blue-200 hover:text-white text-xs transition-colors">
            登出
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* ── 案件基本資訊 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 左：申請人資訊 */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-gray-800 font-black text-lg">{app.applicantName || '（未填）'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">{app.applicantPhone || '—'}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_COLOR[app.status]}`}>
                {STATUS_LABEL[app.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <InfoRow label="案件編號" value={app.id} />
                <InfoRow label="貸款類型" value={LOAN_TYPE_LABEL[app.loanType] || app.loanType} />
                <InfoRow label="申貸金額" value={`NT$ ${fmt(app.basicInfo.amount)} 元`} />
                <InfoRow label="貸款年限" value={`${app.basicInfo.termYears ?? '—'} 年`} />
                <InfoRow label="申請時間" value={new Date(app.appliedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })} />
              </div>
              <div>
                <InfoRow label="年齡" value={`${app.basicInfo.age ?? '—'} 歲`} />
                <InfoRow label="職業" value={app.basicInfo.occupation || '—'} />
                <InfoRow label="月收入" value={`NT$ ${fmt(app.basicInfo.income)}`} />
                <InfoRow label="貸款用途" value={app.basicInfo.purpose || '—'} />
                <InfoRow label="文件狀態" value={
                  app.mydataReady
                    ? (app.landRegistryReady ? '✅ MyData + 謄本' : '✅ MyData 已備')
                    : '⚠️ 文件待上傳'
                } />
              </div>
            </div>
          </div>

          {/* 右：房產資訊（房貸才顯示） */}
          {isMortgage && (
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h3 className="font-bold text-gray-700 text-sm mb-3">🏠 標的物資訊</h3>
              <InfoRow label="建物類型" value={app.propertyInfo.buildingType || '—'} />
              <InfoRow label="坪數" value={`${app.propertyInfo.areaPing ?? '—'} 坪`} />
              <InfoRow label="樓層" value={`${app.propertyInfo.floor ?? '—'} 樓`} />
              <InfoRow label="屋齡" value={`${app.propertyInfo.propertyAge ?? '—'} 年`} />
              <InfoRow label="格局" value={app.propertyInfo.layout || '—'} />
              <InfoRow label="車位" value={app.propertyInfo.hasParking ? '有車位' : '無車位'} />
            </div>
          )}
        </div>

        {/* ── AI 徵審區塊 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-black text-gray-800">🤖 AI 智慧徵審</h3>
            {!reviewResult && !reviewing && (
              <button
                onClick={runReview}
                disabled={isFinished}
                className="px-5 py-2 bg-[#1B4F8A] text-white text-sm font-bold rounded-xl
                           hover:bg-[#163F70] active:scale-95 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                啟動 AI 徵審
              </button>
            )}
          </div>

          {/* 等待狀態 */}
          {!reviewResult && !reviewing && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <span className="text-5xl mb-3">🔍</span>
              <p className="text-sm">
                {isFinished
                  ? `此案件已${app.status === 'approved' ? '核准' : '婉拒'}，無需再次徵審`
                  : '點擊「啟動 AI 徵審」開始三階段審核流程'}
              </p>
            </div>
          )}

          {/* 徵審進行中 */}
          {reviewing && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-[#1B4F8A] rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-gray-700 font-bold text-sm">AI 徵審進行中…</p>
                <p className="text-gray-400 text-xs mt-1">三位 AI 委員正在審議中，約需 10~30 秒</p>
              </div>
              <div className="flex gap-2 text-xs text-gray-400">
                {isMortgage && <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse">Phase 1：ML 鑑價</span>}
                <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}>Phase 2：5P 徵審</span>
                <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}>Phase 3：審議小組</span>
              </div>
            </div>
          )}

          {reviewError && (
            <div className="mx-5 mb-5 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs flex gap-2">
              <span>⚠️</span><span>{reviewError}</span>
            </div>
          )}

          {/* 徵審結果 */}
          {reviewResult && (
            <div className="p-5 space-y-4">
              {/* Phase 1：ML 鑑價（房貸） */}
              {reviewResult.phases.valuation && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-[#1B4F8A] text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                    <h4 className="font-bold text-gray-700 text-sm">ML 鑑價分析</h4>
                    <span className="text-xs text-gray-400 ml-auto">{reviewResult.phases.valuation.durationMs}ms</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${reviewResult.phases.valuation.mode === 'demo' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                      {reviewResult.phases.valuation.mode === 'demo' ? 'Demo 模式' : 'Live'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '建議鑑估值', value: `NT$ ${fmt(Math.round((reviewResult.phases.valuation.result.estimatedValue || 0) / 10000))} 萬` },
                      { label: '貸款成數', value: `${((reviewResult.phases.valuation.result.ltvRatio || 0) * 100).toFixed(1)}%` },
                      { label: '風險等級', value: reviewResult.phases.valuation.result.riskLevel || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400 mb-1">{label}</div>
                        <div className="text-sm font-black text-[#1B4F8A]">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 2：5P 徵審 */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-[#1B4F8A] text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {isMortgage ? '2' : '1'}
                  </span>
                  <h4 className="font-bold text-gray-700 text-sm">5P 徵審分析</h4>
                  <span className="text-xs text-gray-400 ml-auto">{reviewResult.phases.creditReview.durationMs}ms</span>
                </div>
                {(() => {
                  const cr = reviewResult.phases.creditReview.result;
                  const fs = reviewResult.finalSummary;
                  const isPersonal = reviewResult.loanType === 'personal';
                  // riskScore 由 workflowService buildCreditReviewSummary 計算，存在 finalSummary
                  const riskScore = fs.riskScore;
                  // fraudLevel 在 creditReview.result.fraudCheck.overallLevel
                  const fraudLevel = cr.fraudCheck?.overallLevel ?? 'normal';
                  // 合規門檻：信貸看 dbr.pass，房貸看 debtIncomeRatio.pass
                  const thresholdPass = isPersonal
                    ? (cr.thresholds?.dbr?.pass ?? cr.thresholds?.debtIncomeRatio?.pass ?? false)
                    : (cr.thresholds?.debtIncomeRatio?.pass ?? false);
                  // 主要指標值
                  const metricVal = isPersonal
                    ? (cr.thresholds?.dbr?.value ?? cr.thresholds?.debtIncomeRatio?.value ?? 0)
                    : (cr.thresholds?.debtIncomeRatio?.value ?? 0);
                  const metricLabel = isPersonal ? 'DBR' : '負債比';
                  const metricValue = isPersonal
                    ? `${metricVal.toFixed(1)} 倍`
                    : `${(metricVal * 100).toFixed(1)}%`;
                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: '5P 風控評分', value: `${riskScore ?? '—'} 分` },
                          { label: '防詐查核', value: FRAUD_LABEL[fraudLevel] || '—' },
                          { label: '合規門檻', value: thresholdPass ? '✅ 通過' : '❌ 未通過' },
                          { label: metricLabel, value: metricValue },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 mb-1">{label}</div>
                            <div className="text-sm font-black text-[#1B4F8A]">{value}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-3 bg-blue-50 rounded-lg p-2.5 leading-relaxed">
                        {cr.overallAssessment}
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Phase 3：審議小組 */}
              {reviewResult.phases.committeeReview.result.finalDecision && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-[#1B4F8A] text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {isMortgage ? '3' : '2'}
                    </span>
                    <h4 className="font-bold text-gray-700 text-sm">AI 審議小組</h4>
                    <span className="text-xs text-gray-400 ml-auto">{reviewResult.phases.committeeReview.durationMs}ms</span>
                  </div>

                  {/* 三輪投票 */}
                  {reviewResult.phases.committeeReview.result.rounds.map((round) => (
                    <div key={round.roundNumber} className="mb-4">
                      <p className="text-xs font-bold text-gray-500 mb-2">{round.roundTitle}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {round.opinions.map((op) => (
                          <div key={op.agent} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-[#1B4F8A]">{op.agent}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                op.recommendation.includes('核准') ? 'bg-green-100 text-green-700' :
                                op.recommendation.includes('婉拒') ? 'bg-red-100 text-red-600' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{op.recommendation}</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">{op.opinion}</p>
                            {op.keyPoints.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {op.keyPoints.map((pt, i) => (
                                  <li key={i} className="text-xs text-gray-400 flex gap-1">
                                    <span className="text-[#1B4F8A] shrink-0">·</span><span>{pt}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* 最終決議 */}
                  {finalDecision && (
                    <div className={`border rounded-xl p-4 ${DECISION_COLOR[finalDecision.decision] || 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-black text-sm">AI 最終建議決議</h5>
                        <span className="text-lg font-black">{finalDecision.decision}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div><span className="text-gray-500">建議核准金額：</span><strong>NT$ {fmt(finalDecision.approvedAmount)} 元</strong></div>
                        <div><span className="text-gray-500">建議核准年限：</span><strong>{finalDecision.approvedTermYears} 年</strong></div>
                        <div className="col-span-2"><span className="text-gray-500">利率建議：</span><strong>{finalDecision.interestRateHint}</strong></div>
                      </div>
                      {finalDecision.conditions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-600 mb-1">附加條件：</p>
                          <ul className="space-y-1">
                            {finalDecision.conditions.map((c, i) => (
                              <li key={i} className="text-xs flex gap-1"><span>•</span><span>{c}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs mt-3 italic text-gray-500">{finalDecision.summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 行員決策操作區 ── */}
        {!isFinished && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-black text-gray-800 mb-1">行員最終決策</h3>
            <p className="text-xs text-gray-400 mb-4">確認後將更新案件狀態並推播 LINE 通知給客戶</p>

            {actionMsg && (
              <div className={`mb-4 p-3 rounded-xl text-xs ${
                actionMsg.includes('失敗') || actionMsg.includes('error')
                  ? 'bg-red-50 border border-red-100 text-red-600'
                  : 'bg-green-50 border border-green-100 text-green-700'
              }`}>
                {actionMsg}
              </div>
            )}

            {!confirmAction ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction('approved')}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-green-600 text-white font-bold text-sm rounded-xl
                             hover:bg-green-700 active:scale-95 transition-all disabled:opacity-40"
                >
                  ✅ 核准此案件
                </button>
                <button
                  onClick={() => setConfirmAction('rejected')}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-red-600 text-white font-bold text-sm rounded-xl
                             hover:bg-red-700 active:scale-95 transition-all disabled:opacity-40"
                >
                  ❌ 婉拒此案件
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center space-y-3">
                <p className="text-sm font-bold text-gray-700">
                  確定要{confirmAction === 'approved' ? '【核准】' : '【婉拒】'}這件申請嗎？
                </p>
                <p className="text-xs text-gray-400">操作後將立即推播 LINE 通知給申請人，無法復原</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setConfirmAction(null)}
                    disabled={actionLoading}
                    className="px-6 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDecision(confirmAction)}
                    disabled={actionLoading}
                    className={`px-6 py-2 text-white text-sm font-bold rounded-xl transition-all active:scale-95
                      ${confirmAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                      disabled:opacity-40`}
                  >
                    {actionLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        處理中…
                      </span>
                    ) : `確認${confirmAction === 'approved' ? '核准' : '婉拒'}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 已完成狀態 */}
        {isFinished && (
          <div className={`rounded-2xl border-2 p-5 text-center ${
            app.status === 'approved'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className="font-black text-lg mb-1">
              {app.status === 'approved' ? '✅ 此案件已核准' : '❌ 此案件已婉拒'}
            </p>
            <p className="text-xs text-gray-500">LINE 通知已發送給申請人</p>
          </div>
        )}
      </main>
    </div>
  );
}
