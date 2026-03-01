import { useState, useEffect, useRef } from 'react';
import type { Promotion } from '../types';

const AUTO_ADVANCE_MS = 4000;

const HOLIDAY_COLORS: Record<string, string> = {
  兒童節: 'from-yellow-400 to-orange-400',
  端午節: 'from-green-500 to-emerald-600',
  中秋節: 'from-orange-400 to-amber-500',
  雙11:   'from-red-500 to-rose-600',
  聖誕節: 'from-red-600 to-green-700',
};

interface PromotionCarouselProps {
  promotions: Promotion[];
}

export default function PromotionCarousel({ promotions }: PromotionCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 啟動自動輪播計時器 */
  const startTimer = () => {
    if (promotions.length <= 1) return;
    timerRef.current = setInterval(() => {
      // fade out → 換卡 → fade in
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % promotions.length);
        setVisible(true);
      }, 200);
    }, AUTO_ADVANCE_MS);
  };

  /** 重置計時器（用戶手動點擊後重新計時） */
  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimer();
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [promotions.length]);

  if (promotions.length === 0) return null;

  const promo = promotions[idx];
  const gradientClass = HOLIDAY_COLORS[promo.holiday] || 'from-tcb-blue to-blue-700';
  const description = promo.type === 'overlay'
    ? promo.bonusDescription
    : promo.standalone?.savingsHighlight;

  const handleDotClick = (i: number) => {
    if (i === idx) return;
    setVisible(false);
    setTimeout(() => {
      setIdx(i);
      setVisible(true);
    }, 200);
    resetTimer();
  };

  return (
    <div className="relative">
      {/* 輪播卡片（fade 動畫） */}
      <div
        className={`bg-gradient-to-r ${gradientClass} text-white rounded-2xl p-4 mx-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
              {promo.holiday} 限定
            </span>
            <h3 className="font-bold text-base mt-1">{promo.name}</h3>
            <p className="text-sm opacity-90 mt-0.5">{description}</p>
            <p className="text-xs opacity-75 mt-1">
              {promo.startDate} ~ {promo.endDate}
            </p>
          </div>
          <div className="text-3xl ml-2">🎉</div>
        </div>
      </div>

      {/* 分頁點（多張才顯示） */}
      {promotions.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {promotions.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? 'bg-tcb-blue w-4' : 'bg-gray-300 w-1.5'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
