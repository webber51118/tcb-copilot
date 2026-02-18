import { useState } from 'react';
import type { Promotion } from '../types';

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
  if (promotions.length === 0) return null;

  const promo = promotions[idx];
  const gradientClass = HOLIDAY_COLORS[promo.holiday] || 'from-tcb-blue to-blue-700';
  const description = promo.type === 'overlay'
    ? promo.bonusDescription
    : promo.standalone?.savingsHighlight;

  return (
    <div className="relative">
      <div className={`bg-gradient-to-r ${gradientClass} text-white rounded-2xl p-4 mx-4`}>
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

      {promotions.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {promotions.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === idx ? 'bg-tcb-blue w-4' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
