import { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import PosterCanvas from '../components/PosterCanvas/PosterCanvas';
import { initLiff, shareToLine } from '../services/liff';
import type { RecommendResponse, LoanType } from '../types';

interface LocationState {
  result: RecommendResponse;
  loanType: LoanType;
  form: any;
}

export default function PosterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = location.state as LocationState | null;

  useEffect(() => {
    initLiff().catch((err) => console.warn('[LIFF] 初始化失敗:', err));
  }, []);

  if (!state?.result) {
    navigate('/', { replace: true });
    return null;
  }

  const { result, loanType, form } = state;
  const { primary, activePromotions } = result;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `合庫貸款推薦_${primary.name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageUrl = canvas.toDataURL('image/png');
    const text = `合庫個金Co-Pilot為我推薦：${primary.name}\n利率 ${primary.rateRange}，立即了解！`;
    await shareToLine(imageUrl, text);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Header title="我的專屬海報" onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto py-4 flex flex-col items-center gap-4">
        {/* Canvas 預覽（縮小顯示） */}
        <div className="w-full max-w-xs px-4">
          <div className="rounded-2xl overflow-hidden shadow-2xl">
            <PosterCanvas
              ref={canvasRef}
              product={primary}
              loanType={loanType}
              formData={form}
              activePromotion={activePromotions[0]}
            />
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="w-full max-w-xs px-4 space-y-3">
          <button
            onClick={handleDownload}
            className="btn-primary"
          >
            下載海報（PNG）
          </button>
          <button
            onClick={handleShare}
            className="w-full bg-green-500 text-white font-bold py-3 px-6 rounded-xl active:opacity-80 transition-opacity text-center"
          >
            分享至 LINE
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            重新試算
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center px-8">
          海報僅供參考，實際核貸條件以合庫銀行審核結果為準
        </p>
      </div>
    </div>
  );
}
