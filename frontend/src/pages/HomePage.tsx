import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import PromotionCarousel from '../components/PromotionCarousel';
import { usePromotions } from '../hooks/usePromotions';
import { useLiff } from '../hooks/useLiff';

export default function HomePage() {
  const navigate = useNavigate();
  const { promotions } = usePromotions();
  const { profile } = useLiff();

  return (
    <div className="min-h-screen bg-tcb-gray flex flex-col">
      <Header />

      <div className="flex-1 overflow-y-auto pb-8">
        {/* 歡迎區 */}
        <div className="bg-gradient-to-b from-tcb-blue to-blue-700 text-white px-4 pt-6 pb-10">
          {profile && (
            <p className="text-xs opacity-70 mb-1">
              👋 {profile.displayName}，您好！
            </p>
          )}
          <h1 className="text-xl font-black leading-tight">
            {profile ? '您的專屬貸款顧問' : '您的專屬貸款'}<br />智慧領航員
          </h1>
          <p className="text-sm opacity-80 mt-1">
            {profile
              ? `${profile.displayName.slice(0, 6)}，30 秒完成評估，AI 為您量身推薦最優惠方案`
              : '30秒完成評估，AI 為您量身推薦最優惠方案'}
          </p>
        </div>

        {/* 活動輪播 */}
        {promotions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-400 px-4 mb-2">限時優惠活動</p>
            <PromotionCarousel promotions={promotions} />
          </div>
        )}

        {/* 快速入口 */}
        <div className="px-4 mt-6 space-y-3">
          <p className="text-sm font-bold text-gray-600">選擇貸款類型開始試算</p>

          <button
            onClick={() => navigate('/apply?type=mortgage')}
            className="w-full card flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 bg-tcb-light rounded-2xl flex items-center justify-center text-2xl shrink-0">
              🏠
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-800">房屋貸款</p>
              <p className="text-xs text-gray-500">青安・國軍・Next貸・一般房貸</p>
              <p className="text-xs text-tcb-blue font-medium mt-0.5">利率 2.23% 起</p>
            </div>
            <span className="ml-auto text-gray-300 text-lg">›</span>
          </button>

          <button
            onClick={() => navigate('/apply?type=personal')}
            className="w-full card flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 bg-tcb-light rounded-2xl flex items-center justify-center text-2xl shrink-0">
              💳
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-800">信用貸款</p>
              <p className="text-xs text-gray-500">軍公教優惠・優職優利</p>
              <p className="text-xs text-tcb-blue font-medium mt-0.5">利率 1.78% 起</p>
            </div>
            <span className="ml-auto text-gray-300 text-lg">›</span>
          </button>

          <button
            onClick={() => navigate('/apply?type=reverse_annuity')}
            className="w-full card flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 bg-tcb-light rounded-2xl flex items-center justify-center text-2xl shrink-0">
              🌸
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-800">以房養老</p>
              <p className="text-xs text-gray-500">幸福滿袋・60歲以上長輩專屬</p>
              <p className="text-xs text-tcb-blue font-medium mt-0.5">每月穩定領取養老金</p>
            </div>
            <span className="ml-auto text-gray-300 text-lg">›</span>
          </button>
        </div>

        {/* 底部說明 */}
        <p className="text-center text-xs text-gray-400 mt-8 px-4">
          本工具提供參考試算，實際核貸利率與額度依申請時條件為準。
        </p>
      </div>
    </div>
  );
}
