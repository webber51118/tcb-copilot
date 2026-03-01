/**
 * LIFF 消費者貸款申請書頁面（4步驟）
 * Step 1: 確認申貸資訊（auto-fill）
 * Step 2: 補充個人資料
 * Step 3: 閱讀同意條款
 * Step 4: 手寫電子簽名（Canvas）
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { initLiff, closeLiff } from '../services/liff';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface SessionData {
  loanType: string;
  isMortgage: boolean;
  applicantName: string | null;
  applicantPhone: string | null;
  idNumber: string | null;
  employer: string | null;
  basicInfo: {
    age: number | null;
    occupation: string | null;
    income: number | null;
    purpose: string | null;
    termYears: number | null;
    amount: number | null;
  };
  propertyInfo: {
    propertyAge: number | null;
    areaPing: number | null;
    floor: number | null;
    buildingType: string | null;
  } | null;
  recommendedProductId: string | null;
  mydataReady: boolean | null;
  landRegistryReady: boolean | null;
}

interface ExtraInfo {
  birthDate: string;
  maritalStatus: string;
  education: string;
  address: string;
}

export default function ApplicationFormPage() {
  const [token, setToken] = useState('');
  const [step, setStep] = useState(1);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [extraInfo, setExtraInfo] = useState<ExtraInfo>({
    birthDate: '',
    maritalStatus: '',
    education: '',
    address: '',
  });
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [error, setError] = useState('');

  // Canvas 簽名
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);

  // LIFF SDK 初始化
  useEffect(() => {
    initLiff().catch((err) => console.warn('[LIFF] 初始化失敗:', err));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (t) fetchSessionData(t);
  }, []);

  const fetchSessionData = async (t: string) => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/application-data/${t}`);
      if (res.data.success) {
        setSessionData(res.data.data);
      } else {
        setError('Token 無效或已過期，請重新開始申請流程');
      }
    } catch {
      setError('無法取得申請資料，請確認網路連線');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Canvas 簽名邏輯 ──
  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    // 修正 canvas 內部解析度與 CSS 渲染尺寸的比例差，避免手機上坐標偏移
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSig(true);
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  // ── 提交申請書 ──
  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureBase64 = canvas.toDataURL('image/png');

    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/api/submit-application`, {
        token,
        signatureBase64,
        extraInfo,
      });

      if (res.data.success) {
        setCaseId(res.data.data.caseId);
        setSubmitDone(true);
      } else {
        setError(res.data.message || '提交失敗，請重試');
      }
    } catch {
      setError('提交失敗，請確認網路連線');
    } finally {
      setIsLoading(false);
    }
  };

  const loanTypeLabel = (lt: string) => {
    if (lt === 'mortgage') return '房屋貸款';
    if (lt === 'reverse_annuity') return '以房養老';
    return '信用貸款';
  };

  // ── 載入中 ──
  if (isLoading && !sessionData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-3xl mb-3">🤖</div>
          <p>載入申請資料中...</p>
        </div>
      </div>
    );
  }

  // ── 錯誤 ──
  if (error && !sessionData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // ── 申請完成 ──
  if (submitDone) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="bg-gray-900 border border-green-700 rounded-2xl p-8">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-white mb-2">申請完成！</h1>
            <p className="text-sm text-gray-400 mb-6">您的貸款申請書已完成電子簽署</p>
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-400 mb-1">案件編號</p>
              <p className="text-lg font-bold text-green-400">{caseId}</p>
            </div>
            <p className="text-xs text-gray-500">合庫將於 3~5 個工作天內與您聯繫，請保持電話暢通</p>
            <button
              onClick={closeLiff}
              className="mt-6 w-full bg-green-700 hover:bg-green-600 text-white rounded-xl py-3 font-bold transition"
            >
              返回 LINE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 步驟指示列 ──
  const steps = ['確認資訊', '個人資料', '同意條款', '電子簽名'];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <h1 className="text-base font-bold">消費者貸款申請書</h1>
        <p className="text-xs text-gray-400">合庫個金Co-Pilot 領航員</p>
      </div>

      {/* 步驟列 */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${i + 1 < step ? 'bg-green-600 text-white'
                    : i + 1 === step ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'}`}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                <p className={`text-xxs mt-1 text-center leading-tight
                  ${i + 1 === step ? 'text-blue-400' : 'text-gray-500'}`}
                  style={{ fontSize: '9px' }}>
                  {s}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i + 1 < step ? 'bg-green-600' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* ── Step 1: 確認申貸資訊 ── */}
        {step === 1 && sessionData && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">① 確認申貸資訊</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              {[
                { label: '貸款類型', value: loanTypeLabel(sessionData.loanType) },
                { label: '申請人', value: sessionData.applicantName || '（待填寫）' },
                { label: '聯絡電話', value: sessionData.applicantPhone || '（待填寫）' },
                { label: '貸款金額', value: sessionData.basicInfo.amount ? `NT$ ${sessionData.basicInfo.amount.toLocaleString()}` : '—' },
                { label: '貸款年限', value: sessionData.basicInfo.termYears ? `${sessionData.basicInfo.termYears} 年` : '—' },
                { label: '月收入', value: sessionData.basicInfo.income ? `NT$ ${sessionData.basicInfo.income.toLocaleString()}` : '—' },
                { label: '職業', value: sessionData.basicInfo.occupation || '—' },
                { label: '貸款用途', value: sessionData.basicInfo.purpose || '—' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm text-gray-400">{r.label}</span>
                  <span className="text-sm text-white font-medium text-right">{r.value}</span>
                </div>
              ))}
              {sessionData.isMortgage && sessionData.propertyInfo && (
                <>
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <p className="text-xs text-blue-400 font-bold mb-2">🏡 房屋標的物資訊</p>
                    {[
                      { label: '建物類型', value: sessionData.propertyInfo.buildingType },
                      { label: '樓層', value: sessionData.propertyInfo.floor ? `${sessionData.propertyInfo.floor} 樓` : null },
                      { label: '坪數', value: sessionData.propertyInfo.areaPing ? `${sessionData.propertyInfo.areaPing} 坪` : null },
                      { label: '屋齡', value: sessionData.propertyInfo.propertyAge ? `${sessionData.propertyInfo.propertyAge} 年` : null },
                    ].filter((r) => r.value).map((r) => (
                      <div key={r.label} className="flex justify-between border-b border-gray-800 pb-2 last:border-0">
                        <span className="text-sm text-gray-400">{r.label}</span>
                        <span className="text-sm text-white">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white rounded-xl py-3 font-bold transition"
            >
              確認，下一步 →
            </button>
          </div>
        )}

        {/* ── Step 2: 補充個人資料 ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">② 補充個人資料</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">出生日期</label>
                <input
                  type="date"
                  value={extraInfo.birthDate}
                  onChange={(e) => setExtraInfo((p) => ({ ...p, birthDate: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">婚姻狀況</label>
                <select
                  value={extraInfo.maritalStatus}
                  onChange={(e) => setExtraInfo((p) => ({ ...p, maritalStatus: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm"
                >
                  <option value="">請選擇</option>
                  <option value="未婚">未婚</option>
                  <option value="已婚">已婚</option>
                  <option value="離婚">離婚</option>
                  <option value="喪偶">喪偶</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">最高學歷</label>
                <select
                  value={extraInfo.education}
                  onChange={(e) => setExtraInfo((p) => ({ ...p, education: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm"
                >
                  <option value="">請選擇</option>
                  <option value="國中（含）以下">國中（含）以下</option>
                  <option value="高中/職">高中/職</option>
                  <option value="大學/技術學院">大學/技術學院</option>
                  <option value="研究所（含）以上">研究所（含）以上</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">通訊地址</label>
                <input
                  type="text"
                  value={extraInfo.address}
                  onChange={(e) => setExtraInfo((p) => ({ ...p, address: e.target.value }))}
                  placeholder="請輸入通訊地址"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-medium transition"
              >
                ← 上一步
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-blue-700 hover:bg-blue-600 text-white rounded-xl py-3 font-bold transition"
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: 閱讀同意條款 ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">③ 閱讀並同意條款</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4 text-sm text-gray-300">
              <div>
                <p className="font-bold text-white mb-1">【房貸特別提醒】</p>
                <p className="text-xs leading-relaxed">
                  申請人確認所填寫之申請資料均屬實，如有虛偽不實，願負法律責任。
                  貸款利率依合庫金控公告利率調整，請詳閱利率調整說明。
                </p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">【個人資料告知事項】</p>
                <p className="text-xs leading-relaxed">
                  合作金庫商業銀行（以下稱本行）依個人資料保護法規定，
                  蒐集、處理及利用申請人個人資料，僅供本次貸款申請業務使用。
                  申請人得向本行請求查詢、閱覽、補充、更正、停止蒐集、處理、利用或刪除個人資料。
                </p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">【個人消費貸款契約說明】</p>
                <p className="text-xs leading-relaxed">
                  本貸款契約以新台幣計，還款方式為按月攤還，每月繳款日依核定通知書為準。
                  如有任何疑問請洽合庫各分行或客服電話。
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-blue-500"
              />
              <span className="text-sm text-gray-300">
                本人已詳閱並同意上述條款，所填資料均屬實。
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-medium transition"
              >
                ← 上一步
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!termsAgreed}
                className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-bold transition"
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: 電子簽名 ── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">④ 手寫電子簽名</h2>
            <p className="text-sm text-gray-400">請在下方白色區域，用手指書寫您的中文姓名（作為電子簽名）</p>
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={340}
                height={160}
                className="w-full bg-white rounded-xl border-2 border-gray-400 touch-none cursor-crosshair"
                style={{ touchAction: 'none' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              <p className="absolute bottom-2 right-3 text-xs text-gray-400 pointer-events-none">
                請在此簽名
              </p>
            </div>
            <button
              onClick={clearSignature}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              🗑 清除重簽
            </button>

            {error && (
              <div className="bg-red-900 border border-red-600 rounded-lg p-3 text-sm text-red-200">
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-medium transition"
              >
                ← 上一步
              </button>
              <button
                onClick={handleSubmit}
                disabled={!hasSig || isLoading}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-bold transition"
              >
                {isLoading ? '提交中...' : '✅ 確認送出申請'}
              </button>
            </div>
            <p className="text-xs text-center text-gray-500">
              點擊「確認送出申請」後，系統將生成申請書並發送至 LINE
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
