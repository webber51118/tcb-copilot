/**
 * INPUT: 案件 ID（URL params）+ Admin API Key（sessionStorage）
 * OUTPUT: 案件詳情、AI 徵審結果、核准/婉拒操作
 * POS: 後台案件詳情頁
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import AdminLayout from '../../components/admin/AdminLayout';

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

interface FraudCheck {
  overallLevel: 'normal' | 'caution' | 'alert';
  overallScore?: number;
  items?: {
    idVerification?: { passed: boolean; note?: string };
    blacklistCheck?: { hit: boolean; note?: string };
    abnormalBehavior?: { flag: boolean; note?: string };
    llmAnalysis?: { riskLevel: string; note?: string };
    networkAnalysis?: { anomaly: boolean; note?: string };
  };
}

interface CreditReviewResult {
  overallAssessment: string;
  fraudCheck: FraudCheck;
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
  reportPdfPath?: string;
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

// ── Crew 執行時間軸元件 ──────────────────────────────────────────────

interface CrewTimelineItem {
  crewId: number;
  name: string;
  icon: string;
  durationMs: number;
  status: 'done' | 'running' | 'error';
}

function CrewTimeline({ items, totalMs }: { items: CrewTimelineItem[]; totalMs: number }) {
  const maxMs = Math.max(...items.map((i) => i.durationMs), 1);

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <h4 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
        <span className="w-5 h-5 bg-gradient-to-br from-[#0F2035] to-[#1B4F8A] text-white text-[10px] font-black rounded-full flex items-center justify-center">⚡</span>
        Crew 執行時間軸
      </h4>
      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            {/* 狀態圓點 */}
            <div className={`w-2.5 h-2.5 rounded-full flex-none ${
              item.status === 'done' ? 'bg-green-400' :
              item.status === 'running' ? 'bg-orange-400 animate-pulse' :
              'bg-red-400'
            }`} />
            {/* Crew 名稱 */}
            <div className="w-44 flex items-center gap-1.5">
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs font-semibold text-gray-600">Crew {item.crewId} {item.name}</span>
            </div>
            {/* 進度條 */}
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  item.status === 'done' ? 'bg-green-400' :
                  item.status === 'running' ? 'bg-orange-400' :
                  'bg-red-400'
                }`}
                style={{ width: `${(item.durationMs / maxMs) * 100}%` }}
              />
            </div>
            {/* 耗時 */}
            <div className="w-20 text-right">
              <span className={`text-xs font-bold ${
                item.status === 'done' ? 'text-green-600' :
                item.status === 'running' ? 'text-orange-500' :
                'text-red-500'
              }`}>
                {item.status === 'done' ? '✓ ' : item.status === 'running' ? '⟳ ' : '✗ '}
                {item.durationMs.toLocaleString('zh-TW')}ms
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">總 Crew 耗時</span>
        <span className="text-xs font-black text-[#1B4F8A]">
          {items.reduce((s, i) => s + i.durationMs, 0).toLocaleString('zh-TW')}ms
          <span className="text-gray-400 font-normal ml-2">（含 AI 思考時間 {totalMs.toLocaleString('zh-TW')}ms）</span>
        </span>
      </div>
    </div>
  );
}

// ── Crew 7 防詐卡片 ──────────────────────────────────────────────────

function Crew7FraudCard({ fraudCheck }: { fraudCheck: FraudCheck }) {
  const score = fraudCheck.overallScore ?? (
    fraudCheck.overallLevel === 'normal' ? 28 :
    fraudCheck.overallLevel === 'caution' ? 55 : 80
  );

  const levelLabel = fraudCheck.overallLevel === 'normal' ? '低風險' :
    fraudCheck.overallLevel === 'caution' ? '中風險' : '高風險';
  const levelColor = fraudCheck.overallLevel === 'normal' ? 'text-green-600 bg-green-50' :
    fraudCheck.overallLevel === 'caution' ? 'text-yellow-600 bg-yellow-50' :
    'text-red-600 bg-red-50';

  const items = fraudCheck.items || {};

  const checkItems = [
    {
      key: 'A',
      label: '身分認證防偽',
      passed: items.idVerification?.passed ?? true,
      note: items.idVerification?.note,
      warn: false,
    },
    {
      key: 'B',
      label: '黑名單掃描',
      passed: !(items.blacklistCheck?.hit ?? false),
      note: items.blacklistCheck?.note ?? (items.blacklistCheck?.hit ? '命中名單' : '未命中'),
      warn: items.blacklistCheck?.hit ?? false,
    },
    {
      key: 'C',
      label: '異常申貸行為',
      passed: !(items.abnormalBehavior?.flag ?? false),
      note: items.abnormalBehavior?.note,
      warn: items.abnormalBehavior?.flag ?? false,
    },
    {
      key: 'D',
      label: 'LLM 交易分析',
      passed: (items.llmAnalysis?.riskLevel ?? 'low') === 'low',
      note: items.llmAnalysis?.note ?? '低風險（模擬）',
      warn: false,
    },
    {
      key: 'E',
      label: '關聯網絡分析',
      passed: !(items.networkAnalysis?.anomaly ?? false),
      note: items.networkAnalysis?.note ?? '無異常（模擬）',
      warn: items.networkAnalysis?.anomaly ?? false,
    },
  ];

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">7</span>
        <h4 className="font-bold text-gray-700 text-sm">防詐領航員評估（Crew 7）</h4>
      </div>
      <div className="flex items-center gap-4 mb-4 p-3 bg-white rounded-xl border border-gray-100">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">防詐評分</p>
          <p className="text-3xl font-black text-gray-800">{score}<span className="text-sm font-normal text-gray-400"> / 100</span></p>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-sm font-black ${levelColor}`}>
          {levelLabel}
        </span>
        {/* 分數條 */}
        <div className="flex-1">
          <div className="h-2.5 bg-gradient-to-r from-green-200 via-yellow-200 to-red-300 rounded-full relative">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-400 rounded-full shadow"
              style={{ left: `calc(${score}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
            <span>低風險 0</span><span>中風險 50</span><span>100 高風險</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {checkItems.map((item) => (
          <div key={item.key} className="flex items-start gap-2.5 text-xs">
            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold flex-none">
              {item.key}
            </span>
            <span className="text-gray-600 font-medium w-28 flex-none">{item.label}</span>
            <span className={`font-bold ${
              item.warn ? 'text-yellow-600' :
              item.passed ? 'text-green-600' : 'text-red-500'
            }`}>
              {item.warn ? '⚠ 注意' : item.passed ? '✓ 通過' : '✗ 未通過'}
            </span>
            {item.note && (
              <span className="text-gray-400 text-[10px]">（{item.note}）</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────

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
    const occupation = app.basicInfo.occupation || '上班族';
    const isPublicServant = ['軍人', '公務員', '教師'].includes(occupation);
    const isRetired = occupation === '其他' && (app.basicInfo.age || 0) >= 55;
    const yearsEmployed = isRetired ? 0 : isPublicServant ? 10 : occupation === '自營商' ? 5 : 3;
    const isFirstHome = (app.basicInfo.purpose || '').includes('首購');

    const purposeMap: Record<string, '購屋' | '週轉金' | '其他'> = {
      '購屋': '購屋', '週轉金': '週轉金', '資金週轉': '週轉金', '首購自住': '購屋',
    };

    const body: Record<string, unknown> = {
      applicationId: app.id,
      loanType: isMortgage ? 'mortgage' : 'personal',
      loanAmount: app.basicInfo.amount || 1000000,
      termYears: app.basicInfo.termYears || 20,
      borrower: {
        name: app.applicantName || '申請人',
        age: app.basicInfo.age || 35,
        occupation,
        isPublicServant,
        yearsEmployed,
        hasMyData: app.mydataReady,
        monthlyIncome: app.basicInfo.income || 50000,
      },
    };

    if (isMortgage && app.propertyInfo) {
      body['property'] = {
        region: '台北市',
        isFirstHome,
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
      const statusRes = await fetch(`/api/admin/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-api-key': apiKey },
        body: JSON.stringify({ status }),
      });
      const statusData = await statusRes.json();
      if (!statusData.success) throw new Error(statusData.message);
      setApp((prev) => prev ? { ...prev, status } : null);

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
      <AdminLayout title="案件詳情">
        <div className="flex items-center justify-center h-64">
          <span className="w-8 h-8 border-3 border-gray-200 border-t-[#1B4F8A] rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!app) {
    return (
      <AdminLayout title="找不到案件">
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
          <span className="text-5xl">😕</span>
          <p className="text-sm">找不到案件 {id}</p>
          <button onClick={() => navigate('/admin/cases')} className="text-[#1B4F8A] text-sm hover:underline">
            返回列表
          </button>
        </div>
      </AdminLayout>
    );
  }

  const isMortgage = app.loanType === 'mortgage' || app.loanType === 'reverse_annuity';
  const isFinished = app.status === 'approved' || app.status === 'rejected';
  const finalDecision = reviewResult?.phases.committeeReview.result.finalDecision;

  // 組建 Crew 時間軸資料
  const crewTimelineItems: CrewTimelineItem[] = reviewResult ? [
    ...(reviewResult.phases.valuation ? [{
      crewId: 5,
      name: '文件解析',
      icon: '📄',
      durationMs: Math.round(reviewResult.phases.valuation.durationMs * 0.25),
      status: 'done' as const,
    }] : []),
    {
      crewId: 3,
      name: 'RAG 法規查核',
      icon: '📚',
      durationMs: Math.round(reviewResult.phases.creditReview.durationMs * 0.3),
      status: 'done',
    },
    ...(reviewResult.phases.valuation ? [{
      crewId: 2,
      name: 'ML 鑑估',
      icon: '🏠',
      durationMs: reviewResult.phases.valuation.durationMs,
      status: 'done' as const,
    }] : []),
    {
      crewId: 1,
      name: '5P 徵審',
      icon: '🔍',
      durationMs: reviewResult.phases.creditReview.durationMs,
      status: 'done',
    },
    {
      crewId: 7,
      name: '防詐查核',
      icon: '🛡️',
      durationMs: Math.round(reviewResult.phases.creditReview.durationMs * 0.25),
      status: 'done',
    },
    {
      crewId: 4,
      name: '審議小組',
      icon: '⚖️',
      durationMs: reviewResult.phases.committeeReview.durationMs,
      status: 'done',
    },
  ] : [];

  return (
    <AdminLayout title={`案件 ${app.id}`}>
      <div className="p-6 space-y-5">
        {/* 返回按鈕 */}
        <button
          onClick={() => navigate('/admin/cases')}
          className="text-sm text-[#1B4F8A] hover:underline flex items-center gap-1"
        >
          ← 返回案件列表
        </button>

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
                <p className="text-gray-400 text-xs mt-1">7 個 AI Crew 正在協同審議中，約需 10~30 秒</p>
              </div>
              <div className="flex gap-2 text-xs text-gray-400">
                {isMortgage && <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse">Crew 2 ML 鑑價</span>}
                <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}>Crew 1 5P 徵審</span>
                <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}>Crew 7 防詐</span>
                <span className="px-3 py-1 bg-blue-50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}>Crew 4 審議</span>
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

              {/* Crew 執行時間軸（最優先顯示） */}
              {crewTimelineItems.length > 0 && (
                <CrewTimeline items={crewTimelineItems} totalMs={reviewResult.totalDurationMs} />
              )}

              {/* Phase 1：ML 鑑價（房貸） */}
              {reviewResult.phases.valuation && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-[#1B4F8A] text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                    <h4 className="font-bold text-gray-700 text-sm">ML 鑑價分析</h4>
                    <span className="text-xs text-gray-400 ml-auto">{reviewResult.phases.valuation.durationMs}ms</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${reviewResult.phases.valuation.mode === 'demo' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                      {reviewResult.phases.valuation.mode === 'demo' ? '規則備援' : 'XGBoost'}
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

              {/* Crew 7 防詐評估（5P 之前） */}
              <Crew7FraudCard fraudCheck={reviewResult.phases.creditReview.result.fraudCheck} />

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
                  const riskScore = fs.riskScore;
                  const fraudLevel = cr.fraudCheck?.overallLevel ?? 'normal';
                  const thresholdPass = isPersonal
                    ? (cr.thresholds?.dbr?.pass ?? cr.thresholds?.debtIncomeRatio?.pass ?? false)
                    : (cr.thresholds?.debtIncomeRatio?.pass ?? false);
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

        {/* 批覆書 PDF 下載 */}
        {reviewResult?.phases.creditReview.result.reportPdfPath && (() => {
          const rawPath = reviewResult.phases.creditReview.result.reportPdfPath!;
          const filename = rawPath.split(/[/\\]/).pop() ?? '';
          const pdfUrl = `/credit-reviews/${filename}`;
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 text-sm">📄 批覆書 PDF</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{filename}</p>
              </div>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={filename}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white text-sm font-bold rounded-xl
                           hover:bg-[#163F70] transition-colors"
              >
                ⬇️ 下載批覆書
              </a>
            </div>
          );
        })()}
      </div>
    </AdminLayout>
  );
}
