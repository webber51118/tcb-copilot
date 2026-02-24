/**
 * LIFF 文件上傳頁面
 * - 顯示上傳 MyData 所得資料 + 土地建物謄本（依貸款類型）
 * - 上傳圖片後呼叫 /api/parse-document（Claude Vision 解析）
 * - 顯示解析結果預覽
 */

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface ParsedData {
  mydata?: {
    name?: string;
    idNumber?: string;
    annualIncome?: number;
    employer?: string;
    phone?: string;
  };
  landRegistry?: {
    buildingType?: string;
    floor?: number;
    areaPing?: number;
    propertyAge?: number;
  };
}

export default function UploadDocsPage() {
  const [token, setToken] = useState('');
  const [loanType, setLoanType] = useState('');
  const [step, setStep] = useState<'mydata' | 'landReg' | 'done'>('mydata');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData>({});
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ mydata: boolean; landReg: boolean }>({
    mydata: false, landReg: false,
  });

  const mydataInputRef = useRef<HTMLInputElement>(null);
  const landRegInputRef = useRef<HTMLInputElement>(null);

  const isMortgage = loanType === 'mortgage' || loanType === 'reverse_annuity';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
    setLoanType(params.get('loanType') || '');
  }, []);

  /** 轉換 File 為 base64 */
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** 上傳並解析文件 */
  const handleUpload = async (
    file: File,
    docType: 'mydata' | 'landRegistry',
  ) => {
    setIsLoading(true);
    setError('');
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await axios.post(`${API_BASE}/api/parse-document`, {
        token,
        docType,
        imageBase64,
      });

      if (res.data.success) {
        const result = res.data.data;
        if (docType === 'mydata') {
          setParsedData((prev) => ({ ...prev, mydata: result.mydata }));
          setUploadedFiles((prev) => ({ ...prev, mydata: true }));
          // 房貸：繼續上傳謄本
          if (isMortgage) {
            setStep('landReg');
          } else {
            setStep('done');
          }
        } else {
          setParsedData((prev) => ({ ...prev, landRegistry: result.landRegistry }));
          setUploadedFiles((prev) => ({ ...prev, landReg: true }));
          setStep('done');
        }
      } else {
        setError(res.data.message || '解析失敗，請重試');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.status
        ? `上傳失敗（${err.response?.status}）：${err.response?.data?.message || '請重試'}`
        : '上傳失敗，請確認網路連線後重試';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'mydata' | 'landRegistry',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file, docType);
  };

  // ── UI ──
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">📤 AI 文件辨識</h1>
        <p className="text-sm text-gray-400 mt-1">上傳文件，AI 自動辨識並填入申請資料</p>
      </div>

      {/* 上傳步驟指示 */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
          ${uploadedFiles.mydata ? 'bg-green-600 text-white' : 'bg-blue-700 text-white'}`}>
          {uploadedFiles.mydata ? '✓' : '1'}
        </div>
        <div className={`flex-1 h-1 rounded ${uploadedFiles.mydata ? 'bg-green-600' : 'bg-gray-700'}`} />
        {isMortgage && (
          <>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
              ${uploadedFiles.landReg ? 'bg-green-600 text-white' : step === 'landReg' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'}`}>
              {uploadedFiles.landReg ? '✓' : '2'}
            </div>
          </>
        )}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-900 border border-red-600 rounded-lg p-3 mb-4 text-sm text-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-blue-900 border border-blue-600 rounded-lg p-4 mb-4 text-center">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-sm text-blue-200">AI 正在辨識文件，請稍候...</p>
        </div>
      )}

      {/* Step: 上傳 MyData */}
      {!isLoading && step === 'mydata' && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="font-bold text-white">MYDATA 所得資料</h2>
              <p className="text-xs text-gray-400">mydata.nat.gov.tw 下載的所得資料</p>
            </div>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            AI 將自動辨識：姓名、年所得、雇主、身分證字號
          </p>
          <input
            ref={mydataInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileChange(e, 'mydata')}
          />
          <button
            onClick={() => mydataInputRef.current?.click()}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white rounded-lg py-3 font-bold transition"
          >
            📷 選擇或拍攝 MyData 圖片
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">支援 JPG / PNG，建議拍攝清晰完整的畫面</p>
        </div>
      )}

      {/* Step: 上傳謄本（房貸/以房養老） */}
      {!isLoading && step === 'landReg' && isMortgage && (
        <div className="space-y-4">
          {/* MyData 已解析結果 */}
          {parsedData.mydata && (
            <div className="bg-green-900 border border-green-700 rounded-xl p-4">
              <p className="text-xs text-green-400 font-bold mb-2">✅ MyData 解析完成</p>
              {parsedData.mydata.name && <p className="text-sm text-white">姓名：{parsedData.mydata.name}</p>}
              {parsedData.mydata.annualIncome && (
                <p className="text-sm text-white">年所得：NT$ {parsedData.mydata.annualIncome.toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🏡</span>
              <div>
                <h2 className="font-bold text-white">土地建物謄本</h2>
                <p className="text-xs text-gray-400">eland.nat.gov.tw 或地政事務所取得</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              AI 將自動辨識：建物種類、樓層、坪數、屋齡
            </p>
            <input
              ref={landRegInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'landRegistry')}
            />
            <button
              onClick={() => landRegInputRef.current?.click()}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white rounded-lg py-3 font-bold transition"
            >
              📷 選擇或拍攝謄本圖片
            </button>
            <button
              onClick={() => setStep('done')}
              className="w-full mt-2 text-gray-400 text-sm py-2 hover:text-white transition"
            >
              略過謄本（可後續補件）
            </button>
          </div>
        </div>
      )}

      {/* Step: 完成 */}
      {!isLoading && step === 'done' && (
        <div className="space-y-4">
          <div className="bg-green-900 border border-green-700 rounded-xl p-5 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold text-white mb-1">文件上傳完成！</h2>
            <p className="text-sm text-green-300">AI 已辨識資料，請返回 LINE 確認解析結果</p>
          </div>

          {/* 解析摘要 */}
          {parsedData.mydata && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-blue-400 font-bold mb-3">📊 MyData 解析結果</p>
              {[
                { label: '姓名', value: parsedData.mydata.name },
                { label: '身分證字號', value: parsedData.mydata.idNumber },
                { label: '年所得', value: parsedData.mydata.annualIncome ? `NT$ ${parsedData.mydata.annualIncome.toLocaleString()}` : undefined },
                { label: '就業單位', value: parsedData.mydata.employer },
                { label: '月收入（換算）', value: parsedData.mydata.annualIncome ? `NT$ ${Math.round(parsedData.mydata.annualIncome / 12).toLocaleString()}` : undefined },
              ].filter((r) => r.value).map((r) => (
                <div key={r.label} className="flex justify-between py-1 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-400">{r.label}</span>
                  <span className="text-sm text-white font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {parsedData.landRegistry && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-blue-400 font-bold mb-3">🏡 謄本解析結果</p>
              {[
                { label: '建物種類', value: parsedData.landRegistry.buildingType },
                { label: '所在樓層', value: parsedData.landRegistry.floor ? `${parsedData.landRegistry.floor} 樓` : undefined },
                { label: '建築面積', value: parsedData.landRegistry.areaPing ? `${parsedData.landRegistry.areaPing} 坪` : undefined },
                { label: '屋齡', value: parsedData.landRegistry.propertyAge ? `${parsedData.landRegistry.propertyAge} 年` : undefined },
              ].filter((r) => r.value).map((r) => (
                <div key={r.label} className="flex justify-between py-1 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-400">{r.label}</span>
                  <span className="text-sm text-white font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-center text-gray-500">請返回 LINE 繼續完成申請流程</p>
        </div>
      )}
    </div>
  );
}
