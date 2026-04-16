/**
 * VoicePage — 台語借款諮詢語音服務
 * 5 狀態 UI：idle → recording → recognizing → parsing → result
 */

import { useNavigate } from 'react-router-dom';
import { useVoiceRecognition, VoiceState } from '../hooks/useVoiceRecognition';

// ── 貸款類型標籤 ───────────────────────────────────────────────────
const LOAN_TYPE_LABEL: Record<string, string> = {
  mortgage: '🏠 房屋貸款',
  personal: '💳 信用貸款',
  reverse_annuity: '🌸 以房養老',
};

// ── 狀態說明文字 ───────────────────────────────────────────────────
const STATE_LABELS: Record<VoiceState, string> = {
  idle: '按住說話',
  recording: '🔴 錄音中… 放開送出',
  recognizing: '辨識中…',
  parsing: 'AI 解析中…',
  result: '解析完成',
};

// ── 格式化金額 ────────────────────────────────────────────────────
function fmtAmount(n: number | null): string {
  if (n == null) return '—';
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString('zh-TW')} 萬元`;
  return `${n.toLocaleString('zh-TW')} 元`;
}

export default function VoicePage() {
  const navigate = useNavigate();
  const { state, result, error, startRecording, stopRecording, runDemo, reset } =
    useVoiceRecognition();

  const isProcessing = state === 'recognizing' || state === 'parsing';

  // 確認後帶入欄位跳至推薦頁
  const handleConfirm = () => {
    if (!result) return;
    const params = new URLSearchParams();
    params.set('type', result.fields.loanType);
    if (result.fields.basicInfo.occupation)
      params.set('occupation', result.fields.basicInfo.occupation);
    if (result.fields.basicInfo.income)
      params.set('income', String(result.fields.basicInfo.income));
    if (result.fields.basicInfo.amount)
      params.set('amount', String(result.fields.basicInfo.amount));
    if (result.fields.basicInfo.purpose)
      params.set('purpose', result.fields.basicInfo.purpose);
    if (result.fields.basicInfo.termYears)
      params.set('termYears', String(result.fields.basicInfo.termYears));
    navigate(`/apply?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 頂部列 */}
      <header className="bg-gradient-to-r from-[#0F2035] to-[#1B4F8A] text-white px-4 py-3 flex items-center gap-3 shadow-lg">
        <button
          onClick={() => navigate('/')}
          className="text-white/70 hover:text-white text-lg leading-none"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="font-black text-base">台語借款諮詢</h1>
          <p className="text-[10px] text-blue-200/80">Breeze-ASR-26 ｜ Claude AI 解析</p>
        </div>
        <span className="text-2xl">🎤</span>
      </header>

      <div className="flex-1 overflow-y-auto pb-8 px-4 pt-6 space-y-5">

        {/* 說話示範 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 mb-2">📢 說話示範</p>
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-[#1B4F8A] font-medium leading-relaxed border border-blue-100">
            「我是護理師，月薪六萬，<br />
            &nbsp;想借五百萬，買第一間厝」
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            說完所有需求後放開按鈕，AI 自動填寫申請表單
          </p>
        </div>

        {/* 錄音按鈕區 */}
        <div className="flex flex-col items-center gap-4">
          {/* 主按鈕 */}
          <div className="relative">
            {/* 錄音動畫環 */}
            {state === 'recording' && (
              <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-50" />
            )}
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              disabled={isProcessing}
              className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 font-bold text-sm
                          shadow-xl transition-all select-none
                          ${state === 'recording'
                            ? 'bg-red-500 text-white scale-110 shadow-red-200'
                            : state === 'result'
                            ? 'bg-green-500 text-white'
                            : isProcessing
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-[#1B4F8A] text-white hover:bg-[#163F70] active:scale-95'
                          }`}
            >
              <span className="text-3xl">
                {isProcessing ? '⟳' : state === 'result' ? '✓' : '🎤'}
              </span>
              <span className="text-xs text-center px-2 leading-tight">
                {STATE_LABELS[state]}
              </span>
            </button>
          </div>

          {/* Demo 按鈕（供黑客松展示） */}
          {(state === 'idle' || state === 'result') && (
            <button
              onClick={state === 'result' ? reset : runDemo}
              className="text-xs text-[#1B4F8A] border border-[#1B4F8A]/30 px-4 py-2 rounded-xl
                         hover:bg-blue-50 transition-colors font-medium"
            >
              {state === 'result' ? '🔄 重新錄音' : '🎬 Demo 展示（無需麥克風）'}
            </button>
          )}
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600 flex gap-2">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        {/* 處理中提示 */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
            <div className="flex justify-center mb-2">
              <span className="w-6 h-6 border-2 border-blue-200 border-t-[#1B4F8A] rounded-full animate-spin" />
            </div>
            <p className="text-sm font-bold text-[#1B4F8A]">
              {state === 'recognizing' ? '台語語音辨識中…' : 'Claude AI 解析中…'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {state === 'recognizing' ? 'Breeze-ASR-26 正在轉換語音' : '提取貸款需求欄位'}
            </p>
          </div>
        )}

        {/* 辨識結果 */}
        {result && state === 'result' && (
          <div className="space-y-4">
            {/* 台語原文 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400">🎤 辨識文字</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  result.mode === 'demo'
                    ? 'bg-blue-50 text-blue-500'
                    : 'bg-green-50 text-green-600'
                }`}>
                  {result.mode === 'demo' ? 'Demo 模式' : 'ASR 辨識'}
                </span>
              </div>
              {result.taiwaneseDisplay && (
                <p className="text-sm text-gray-500 italic mb-1">{result.taiwaneseDisplay}</p>
              )}
              <p className="text-sm text-gray-800 font-medium leading-relaxed">
                「{result.transcript}」
              </p>
            </div>

            {/* Claude AI 解析結果 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 mb-3">🤖 Claude AI 解析</p>

              <div className="space-y-2">
                <ParseRow
                  label="貸款類型"
                  value={LOAN_TYPE_LABEL[result.fields.loanType] || result.fields.loanType}
                  ok
                />
                <ParseRow
                  label="職業"
                  value={result.fields.basicInfo.occupation}
                  ok={!!result.fields.basicInfo.occupation}
                />
                <ParseRow
                  label="月收入"
                  value={result.fields.basicInfo.income != null
                    ? `${(result.fields.basicInfo.income / 10000).toFixed(0)} 萬元`
                    : null}
                  ok={result.fields.basicInfo.income != null}
                />
                <ParseRow
                  label="申貸金額"
                  value={fmtAmount(result.fields.basicInfo.amount)}
                  ok={result.fields.basicInfo.amount != null}
                />
                <ParseRow
                  label="貸款用途"
                  value={result.fields.basicInfo.purpose}
                  ok={!!result.fields.basicInfo.purpose}
                />
                {result.fields.basicInfo.termYears && (
                  <ParseRow
                    label="貸款年限"
                    value={`${result.fields.basicInfo.termYears} 年`}
                    ok
                  />
                )}
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-500
                           hover:bg-gray-50 transition-colors font-medium"
              >
                重新錄音
              </button>
              <button
                onClick={handleConfirm}
                className="flex-2 flex-[2] py-3 bg-[#1B4F8A] text-white rounded-xl text-sm font-bold
                           hover:bg-[#163F70] active:scale-95 transition-all shadow-lg shadow-blue-900/20"
              >
                確認，查看推薦方案 →
              </button>
            </div>
          </div>
        )}

        {/* 底部說明 */}
        {state === 'idle' && (
          <p className="text-center text-xs text-gray-400 mt-4">
            支援台語、台灣國語 ｜ 最長錄音 30 秒
          </p>
        )}
      </div>
    </div>
  );
}

// ── 解析欄位列 ─────────────────────────────────────────────────────

function ParseRow({ label, value, ok }: {
  label: string;
  value: string | number | null | undefined;
  ok: boolean;
}) {
  const display = value == null || value === '' ? '（未偵測）' : String(value);
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className={`text-sm w-5 flex-none ${ok ? 'text-green-500' : 'text-gray-300'}`}>
        {ok ? '✅' : '○'}
      </span>
      <span className="text-xs text-gray-400 flex-none w-20">{label}</span>
      <span className={`text-sm font-bold ${ok ? 'text-gray-800' : 'text-gray-400'}`}>
        {display}
      </span>
    </div>
  );
}
