import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import StepForm from '../components/StepForm/StepForm';
import { useValuation } from '../hooks/useValuation';
import type { ValuationFormData, LandRegistryParsed, XGBoostValuationResult } from '../types';
import { TAIWAN_CITIES } from '../types';

const BUILDING_TYPES = ['大樓', '華廈', '公寓', '透天', '別墅'];

/** 從完整地址萃取縣市（例：「台北市大安區...」→「台北市」） */
function extractRegionFromAddress(address: string): string {
  const match = TAIWAN_CITIES.find((city) => address.includes(city));
  return match || '';
}

/** 從完整地址萃取行政區（例：「台北市大安區...」→「大安區」） */
function extractDistrictFromAddress(address: string): string {
  const match = address.match(/[縣市]([^\s,，]{2,4}[區鎮鄉])/);
  return match?.[1] || '';
}

const INITIAL: ValuationFormData = {
  imageBase64:  null,
  address:      '',
  region:       '',
  district:     '',
  buildingType: '',
  areaPing:     null,
  propertyAge:  null,
  floor:        null,
  totalFloors:  null,
  layout:       '',
  hasParking:   null,
  loanAmount:   null,
  valuationResult: null,
};

function formatWan(n: number): string {
  return `${(n / 10000).toFixed(0)} 萬`;
}

export default function ValuationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledLoanAmount = (location.state as { loanAmount?: number | null } | null)?.loanAmount ?? null;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ValuationFormData>({ ...INITIAL, loanAmount: prefilledLoanAmount });
  const [parsed, setParsed] = useState<LandRegistryParsed | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading, loadingStep, error, runXGBoostValuation, reset } = useValuation();
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // ── Step 1：圖片上傳 ──────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setForm((f) => ({ ...f, imageBase64: base64 }));
      setThumbUrl(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // 是否為圖片模式（上傳謄本）
  const isImageMode = !!form.imageBase64;

  // ── Step 2 → 3：送出 XGBoost 鑑估 ────────────────────────
  const handleSubmitValuation = async () => {
    const { imageBase64, district, buildingType, areaPing, propertyAge, floor, totalFloors, layout, hasParking, loanAmount } = form;

    const result = await runXGBoostValuation(imageBase64, {
      district:     district     || '',
      buildingType: buildingType || '',
      areaPing:     areaPing     ?? 0,
      propertyAge:  propertyAge  ?? 0,
      floor:        floor        ?? 0,
      totalFloors:  totalFloors  ?? 0,
      layout,
      hasParking:   hasParking   ?? false,
      loanAmount:   loanAmount   ?? 0,
    });

    if (result) {
      setParsed(result.parsed);
      setForm((f) => ({ ...f, valuationResult: result.valuation }));
      setStep(3);

      // 非同步呼叫 Qwen2.5 說明（失敗不影響主流程）
      const v = result.valuation;
      setAiLoading(true);
      fetch('/api/valuate/xgboost/explain', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          district:       district || '',
          buildingType:   buildingType || '',
          areaPing:       areaPing ?? 0,
          propertyAge:    propertyAge ?? 0,
          floor:          floor ?? 0,
          pricePerPing:   v.pricePerPing,
          estimatedValue: v.estimatedValue,
          ltvRatio:       v.ltvRatio,
          riskLevel:      v.riskLevel,
          loanAmount:     loanAmount ?? 0,
        }),
      })
        .then((r) => r.ok ? r.json() : { explanation: '' })
        .then((d: { explanation?: string }) => setAiExplanation(d.explanation ?? ''))
        .catch(() => setAiExplanation(''))
        .finally(() => setAiLoading(false));
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      reset();
    } else if (step === 3) {
      setStep(2);
      setAiExplanation('');
      reset();
    }
  };

  // ── Step 2 是否可送出 ─────────────────────────────────────
  const canSubmit = isImageMode
    ? !!form.layout && form.hasParking !== null && !!form.loanAmount && !!form.totalFloors && !loading
    : !!form.address && !!form.district && !!form.buildingType && !!form.areaPing && !!form.propertyAge &&
      form.floor !== null && !!form.totalFloors && !!form.layout && form.hasParking !== null && !!form.loanAmount && !loading;

  const val = form.valuationResult as XGBoostValuationResult | null;

  return (
    <div className="min-h-screen bg-tcb-gray flex flex-col">
      <Header />

      <div className="flex-1 overflow-y-auto">
        {/* ── Step 1：上傳謄本 ── */}
        {step === 1 && (
          <StepForm
            currentStep={1}
            totalSteps={3}
            title="上傳不動產建物謄本（可略過）"
            onNext={() => setStep(2)}
            nextLabel="下一步：填寫物件資訊"
          >
            <p className="text-xs text-gray-500 mb-4">
              上傳謄本後，AI 將自動解析坪數、屋齡等欄位，協助您快速填寫。
            </p>

            {/* 拖放 / 點選上傳區 */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-tcb-blue rounded-2xl p-6 text-center cursor-pointer bg-tcb-light active:bg-blue-100 transition-colors"
            >
              {thumbUrl ? (
                <img src={thumbUrl} alt="謄本預覽" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <>
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-sm font-medium text-tcb-blue">點擊或拖曳上傳謄本</p>
                  <p className="text-xs text-gray-400 mt-1">支援 JPG / PNG / WEBP</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {thumbUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setForm((f) => ({ ...f, imageBase64: null }));
                  setThumbUrl(null);
                }}
                className="mt-3 text-xs text-red-400 underline w-full text-center"
              >
                移除圖片
              </button>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              沒有謄本？直接點「下一步」手動填寫即可。
            </p>
          </StepForm>
        )}

        {/* ── Step 2：確認物件資訊 ── */}
        {step === 2 && (
          <StepForm
            currentStep={2}
            totalSteps={3}
            title={isImageMode ? '補充資訊' : '填寫物件資訊'}
            onNext={handleSubmitValuation}
            onBack={handleBack}
            nextLabel={loading ? (loadingStep === 'parsing' ? '解析謄本中...' : '鑑估中...') : '開始鑑估'}
            nextDisabled={!canSubmit}
          >
            {/* 圖片模式：顯示 AI 解析說明 */}
            {isImageMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
                <p className="font-bold mb-1">AI 將自動從謄本解析物件資料</p>
                <p>行政區、坪數、屋齡、樓層、建物類型由 AI 自動辨識。請補充謄本上通常未記載的欄位。</p>
              </div>
            )}

            <div className="space-y-4">
              {/* 圖片模式才顯示：總樓層（謄本通常未記載）+ 行政區（可選，AI 不確定時手動補） */}
              {isImageMode && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      總樓層數 <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-400 ml-1">（謄本未記載，請手動填寫）</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="例：12"
                      value={form.totalFloors ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, totalFloors: parseInt(e.target.value, 10) || null }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      行政區
                      <span className="text-xs text-gray-400 ml-1">（AI 自動辨識；若解析失敗可在此補填）</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例：大安區、板橋區（可留空讓 AI 自動辨識）"
                      value={form.district ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                    />
                  </div>
                </>
              )}

              {/* 手動模式才顯示：完整地址（自動萃取縣市） */}
              {!isImageMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">物件地址 *</label>
                  <input
                    type="text"
                    placeholder="例：台北市大安區忠孝東路四段100號"
                    value={form.address ?? ''}
                    onChange={(e) => {
                      const addr = e.target.value;
                      const region   = extractRegionFromAddress(addr);
                      const district = extractDistrictFromAddress(addr);
                      setForm((f) => ({ ...f, address: addr, region, district }));
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                  />
                  {form.address && !form.district && (
                    <p className="text-xs text-orange-500 mt-1">請輸入包含縣市行政區的完整地址（例：台北市大安區...）</p>
                  )}
                  {form.district && (
                    <p className="text-xs text-green-600 mt-1">已識別行政區：{form.region} {form.district}</p>
                  )}
                </div>
              )}

              {/* 手動模式才顯示：建物類型 */}
              {!isImageMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">建物類型 *</label>
                  <div className="flex flex-wrap gap-2">
                    {BUILDING_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm((f) => ({ ...f, buildingType: t }))}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.buildingType === t ? 'bg-tcb-blue text-white border-tcb-blue' : 'bg-white text-gray-600 border-gray-300'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 手動模式才顯示：坪數 */}
              {!isImageMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">坪數 *</label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    placeholder="例：32.5"
                    value={form.areaPing ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, areaPing: parseFloat(e.target.value) || null }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                  />
                </div>
              )}

              {/* 手動模式才顯示：屋齡 */}
              {!isImageMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">屋齡（年）*</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    placeholder="例：15"
                    value={form.propertyAge ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, propertyAge: parseInt(e.target.value, 10) || null }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                  />
                </div>
              )}

              {/* 手動模式才顯示：樓層 + 總樓層 */}
              {!isImageMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">所在樓層 *</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="例：8"
                      value={form.floor ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, floor: parseInt(e.target.value, 10) || null }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">總樓層數 *</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="例：12"
                      value={form.totalFloors ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, totalFloors: parseInt(e.target.value, 10) || null }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                    />
                  </div>
                </div>
              )}

              {/* 格局（圖片 + 手動模式都顯示） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">格局 *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['2房1廳1衛', '3房2廳1衛', '3房2廳2衛', '4房2廳2衛'].map((l) => (
                    <button
                      key={l}
                      onClick={() => setForm((f) => ({ ...f, layout: l }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.layout === l ? 'bg-tcb-blue text-white border-tcb-blue' : 'bg-white text-gray-600 border-gray-300'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="或自行輸入，例：3房2廳2衛"
                  value={form.layout}
                  onChange={(e) => setForm((f) => ({ ...f, layout: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                />
              </div>

              {/* 車位（圖片 + 手動模式都顯示） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">含車位？*</label>
                <div className="flex gap-3">
                  {[['有車位', true], ['無車位', false]].map(([label, v]) => (
                    <button
                      key={String(label)}
                      onClick={() => setForm((f) => ({ ...f, hasParking: v as boolean }))}
                      className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${form.hasParking === v ? 'bg-tcb-blue text-white border-tcb-blue' : 'bg-white text-gray-600 border-gray-300'}`}
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>

              {/* 申請貸款金額（圖片 + 手動模式都顯示） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請貸款金額（元）*</label>
                <input
                  type="number"
                  min={0}
                  step={100000}
                  placeholder="例：8000000"
                  value={form.loanAmount ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, loanAmount: parseInt(e.target.value, 10) || null }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tcb-blue"
                />
                {form.loanAmount && (
                  <p className="text-xs text-gray-400 mt-1">{formatWan(form.loanAmount)}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {error}
              </div>
            )}
          </StepForm>
        )}

        {/* ── Step 3：鑑估結果 ── */}
        {step === 3 && val && (
          <div className="flex flex-col pb-8">
            {/* 標題列 */}
            <div className="bg-gradient-to-b from-tcb-blue to-blue-700 text-white px-4 pt-6 pb-8">
              <p className="text-xs opacity-70 mb-1">AI 自動鑑價結果</p>
              <p className="text-3xl font-black">{formatWan(val.estimatedValue)}</p>
              <p className="text-sm opacity-80 mt-1">P50 建議鑑估值 · {form.district || form.region} {form.buildingType}</p>
            </div>

            <div className="px-4 -mt-4 space-y-4">
              {/* 信心區間 */}
              <div className="card">
                <p className="text-xs font-bold text-gray-500 mb-3">蒙地卡羅信心區間</p>
                <div className="grid grid-cols-3 text-center gap-2">
                  <div>
                    <p className="text-xs text-gray-400">P5 悲觀</p>
                    <p className="font-bold text-gray-700 text-sm">{formatWan(val.confidenceInterval.p5)}</p>
                  </div>
                  <div className="border-x border-gray-100">
                    <p className="text-xs text-tcb-blue font-bold">P50 建議</p>
                    <p className="font-black text-tcb-blue">{formatWan(val.confidenceInterval.p50)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">P95 樂觀</p>
                    <p className="font-bold text-gray-700 text-sm">{formatWan(val.confidenceInterval.p95)}</p>
                  </div>
                </div>
              </div>

              {/* LTV 進度條 */}
              <div className="card">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-gray-700">貸款成數（LTV）</span>
                  <span className={val.ltvRatio > 0.8 ? 'text-red-500 font-bold' : 'text-gray-500'}>
                    {(val.ltvRatio * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${val.ltvRatio > 0.8 ? 'bg-red-400' : val.ltvRatio > 0.65 ? 'bg-yellow-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.min(val.ltvRatio * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  貸款 {form.loanAmount ? formatWan(form.loanAmount) : '—'} ÷ 鑑估值 {formatWan(val.estimatedValue)}
                </p>
              </div>

              {/* 風險等級 + 單價 */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500">風險等級</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      val.riskLevel === '低風險' ? 'bg-green-100 text-green-700' :
                      val.riskLevel === '中風險' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}
                  >
                    {val.riskLevel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-gray-400 mb-0.5">估計單價</p>
                    <p className="font-bold text-gray-800">{formatWan(val.pricePerPing)} / 坪</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-gray-400 mb-0.5">鑑價模型</p>
                    <p className={`font-bold ${val.model === 'demo' ? 'text-orange-500' : 'text-tcb-blue'}`}>
                      {val.model === 'demo' ? 'Demo 查表' : 'XGBoost'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Qwen2.5 AI 白話說明 */}
              {(aiLoading || aiExplanation) && (
                <div className="card border border-purple-100 bg-purple-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-purple-700">AI 估價說明</span>
                    <span className="text-xs text-purple-400 bg-purple-100 px-1.5 py-0.5 rounded-full">Qwen2.5</span>
                  </div>
                  {aiLoading ? (
                    <p className="text-xs text-purple-400 animate-pulse">AI 分析中...</p>
                  ) : (
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{aiExplanation}</p>
                  )}
                </div>
              )}

              {form.address && (
                <p className="text-center text-xs text-gray-400">物件地址：{form.address}</p>
              )}
              <p className="text-center text-xs text-gray-400">
                {val.model === 'demo'
                  ? '* Demo 模式（XGBoost 模型訓練前）：以行政區查表估算，僅供參考'
                  : '* 本結果由 XGBoost 實價登錄模型估算，僅供參考，實際價格依市場交易為準'
                }
              </p>

              {/* CTA */}
              <button
                onClick={() => navigate('/apply?type=mortgage')}
                className="btn-primary"
              >
                申請房貸諮詢
              </button>
              <button
                onClick={() => {
                  setStep(1);
                  setForm(INITIAL);
                  setThumbUrl(null);
                  setParsed(null);
                  setAiExplanation('');
                  reset();
                }}
                className="btn-secondary"
              >
                重新鑑估
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
