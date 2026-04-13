/**
 * INPUT: 行員輸入法規問題（+選填貸款類型）
 * OUTPUT: Claude 合成答案 + 知識庫來源 + 信心度
 * POS: 後台 RAG 法規查詢頁
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import AdminLayout from '../../components/admin/AdminLayout';

// ── 型別 ─────────────────────────────────────────────────────────────

type LoanTypeFilter = 'all' | 'mortgage' | 'personal';
type Confidence = 'high' | 'medium' | 'low';
type KbSource = '央行規定' | '政策性貸款' | '授信規章';

interface RagResponse {
  success: boolean;
  answer: string;
  sources: KbSource[];
  confidence: Confidence;
  cached: boolean;
}

// ── 常用問題快捷鈕 ────────────────────────────────────────────────────

const QUICK_QUESTIONS: { label: string; question: string; loanType?: 'mortgage' | 'personal' }[] = [
  { label: '青安貸款成數', question: '青安貸款（青年安心成家貸款）最高可貸幾成？有哪些條件限制？', loanType: 'mortgage' },
  { label: 'DBR 上限規定', question: '個人信用貸款的 DBR 上限是幾倍？計算方式為何？', loanType: 'personal' },
  { label: '第 2 戶限制', question: '名下已有一戶，購買第二戶房屋的貸款成數限制為何？', loanType: 'mortgage' },
  { label: '寬限期規定', question: '房屋貸款寬限期最長幾年？有哪些限制？', loanType: 'mortgage' },
  { label: '負債比計算', question: '授信負債比如何計算？含哪些項目？基本生活費用18,000元如何適用？', loanType: 'mortgage' },
  { label: '軍公教優惠', question: '現役軍人、公務員申請房屋貸款有哪些優惠方案？', loanType: 'mortgage' },
  { label: '自營商認定', question: '自營商申請貸款，收入如何認定？需提供哪些文件？', loanType: 'personal' },
  { label: '高價住宅規定', question: '高價住宅的定義為何？貸款成數有何特別限制？', loanType: 'mortgage' },
];

// ── 信心度顯示 ────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; color: string; bg: string; icon: string }> = {
  high:   { label: '高信心度', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: '✅' },
  medium: { label: '中信心度', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: '⚠️' },
  low:    { label: '低信心度', color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       icon: '❓' },
};

// ── 來源標籤 ─────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<KbSource, { color: string; icon: string }> = {
  '央行規定':   { color: 'bg-[#1B4F8A] text-white',    icon: '🏦' },
  '政策性貸款': { color: 'bg-purple-600 text-white',    icon: '📋' },
  '授信規章':   { color: 'bg-gray-600 text-white',      icon: '📖' },
};

// ── 歷史記錄型別 ─────────────────────────────────────────────────────

interface HistoryItem {
  question: string;
  loanType: LoanTypeFilter;
  response: RagResponse;
  askedAt: string;
}

// ── 主元件 ────────────────────────────────────────────────────────────

export default function AdminRagPage() {
  const { apiKey } = useAdminAuth();
  const navigate = useNavigate();

  const [question, setQuestion] = useState('');
  const [loanType, setLoanType] = useState<LoanTypeFilter>('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RagResponse | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  if (!apiKey) {
    navigate('/admin', { replace: true });
    return null;
  }

  const handleQuery = async (q?: string, lt?: LoanTypeFilter) => {
    const queryText = (q ?? question).trim();
    const queryType = lt ?? loanType;
    if (!queryText) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body: Record<string, string> = { question: queryText };
      if (queryType !== 'all') body.loanType = queryType;

      const res = await fetch('/api/rag-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: RagResponse = await res.json();
      if (data.success) {
        setResult(data);
        setHistory((prev) => [
          { question: queryText, loanType: queryType, response: data, askedAt: new Date().toLocaleTimeString('zh-TW') },
          ...prev.slice(0, 9),
        ]);
      } else {
        setError('查詢失敗，請稍後再試');
      }
    } catch {
      setError('網路錯誤，請確認後端服務是否啟動');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (item: typeof QUICK_QUESTIONS[0]) => {
    const lt = item.loanType ?? 'all';
    setQuestion(item.question);
    setLoanType(lt);
    handleQuery(item.question, lt);
  };

  return (
    <AdminLayout title="RAG 法規查詢">
      <div className="p-6 space-y-5 max-w-5xl">

        {/* ── 頁面標題 ── */}
        <div>
          <h1 className="text-gray-800 text-xl font-black mb-1">📚 RAG 法規查詢</h1>
          <p className="text-xs text-gray-400">三層知識庫（央行規定 / 政策性貸款 / 授信規章）× Claude claude-sonnet-4-6 合成答案</p>
        </div>

        {/* ── 查詢區 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

          {/* 貸款類型篩選 */}
          <div className="flex gap-2">
            {([
              { key: 'all',      label: '全部類型', icon: '📁' },
              { key: 'mortgage', label: '房屋貸款', icon: '🏠' },
              { key: 'personal', label: '信用貸款', icon: '💳' },
            ] as { key: LoanTypeFilter; label: string; icon: string }[]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setLoanType(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  loanType === key
                    ? 'bg-[#1B4F8A] text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 問題輸入框 */}
          <div className="relative">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleQuery();
              }}
              placeholder="請輸入授信法規問題，例如：青安貸款第一戶最高可貸幾成？&#10;（Ctrl + Enter 送出）"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A]
                         placeholder-gray-300 resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-300">Ctrl + Enter 快速送出</p>
            <button
              onClick={() => handleQuery()}
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4F8A] text-white rounded-xl text-sm font-bold
                         hover:bg-[#163d6b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  查詢中…
                </>
              ) : (
                <>🔍 查詢法規</>
              )}
            </button>
          </div>
        </div>

        {/* ── 常用問題快捷鈕 ── */}
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-2">⚡ 常用問題快捷</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleQuickQuestion(item)}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600
                           hover:border-[#1B4F8A] hover:text-[#1B4F8A] transition-all disabled:opacity-40"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 錯誤提示 ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            ❌ {error}
          </div>
        )}

        {/* ── 查詢結果 ── */}
        {result && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 結果標題列 */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700">查詢結果</span>
                {/* 信心度 badge */}
                {(() => {
                  const cfg = CONFIDENCE_CONFIG[result.confidence];
                  return (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  );
                })()}
                {result.cached && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">⚡ 快取</span>
                )}
              </div>
              {/* 來源標籤 */}
              <div className="flex gap-1.5">
                {result.sources.map((src) => {
                  const cfg = SOURCE_CONFIG[src];
                  return (
                    <span key={src} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                      {cfg.icon} {src}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 答案內容 */}
            <div className="px-5 py-4">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </div>
            </div>
          </div>
        )}

        {/* ── 查詢歷史 ── */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-500">🕐 本次查詢歷史（最近 10 筆）</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {history.map((item, idx) => {
                const cfg = CONFIDENCE_CONFIG[item.response.confidence];
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuestion(item.question);
                      setLoanType(item.loanType);
                      setResult(item.response);
                    }}
                    className="w-full px-5 py-3 text-left hover:bg-blue-50/30 transition-colors flex items-center gap-3"
                  >
                    <span className="text-xs">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{item.question}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.askedAt}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {item.loanType === 'mortgage' ? '🏠' : item.loanType === 'personal' ? '💳' : '📁'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
