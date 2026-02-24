import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import MonthlyCalculator from '../components/MonthlyCalculator';
import RecommendExplanation from '../components/RecommendExplanation';
import type { RecommendResponse, LoanType, Promotion } from '../types';

interface LocationState {
  result: RecommendResponse;
  loanType: LoanType;
  form: any;
}

/** 取得適用於主推產品的 Overlay 活動（若有） */
function findOverlay(promotions: Promotion[], productId: string): Promotion | undefined {
  return promotions.find(
    (p) => p.type === 'overlay' && p.targetProducts?.includes(productId),
  );
}

export default function RecommendPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  if (!state?.result) {
    navigate('/', { replace: true });
    return null;
  }

  const { result, loanType, form } = state;
  const { primary, alternatives, activePromotions } = result;
  const overlay = findOverlay(activePromotions, primary.id);
  const isReverseAnnuity = loanType === 'reverse_annuity';

  return (
    <div className="min-h-screen bg-tcb-gray flex flex-col">
      <Header title="推薦結果" onBack={() => navigate('/apply')} />

      <div className="flex-1 overflow-y-auto pb-8">
        {/* 頂部說明 */}
        <div className="bg-tcb-blue text-white px-4 py-4">
          <p className="text-sm opacity-80">根據您的條件，為您主推</p>
          <h2 className="font-black text-lg leading-tight mt-0.5">{primary.name}</h2>
        </div>

        <div className="px-4 mt-4 space-y-4">
          {/* 主推產品卡 */}
          <ProductCard
            product={primary}
            isPrimary
            activePromotion={overlay}
            loanType={loanType}
          />

          {/* 月付試算器 */}
          <MonthlyCalculator
            initialAmount={form?.amount ?? 5_000_000}
            initialTerm={form?.termYears ?? (isReverseAnnuity ? 20 : 30)}
            rateValue={primary.rateValue}
            isReverseAnnuity={isReverseAnnuity}
          />

          {/* 推薦理由詳解 */}
          <RecommendExplanation
            loanType={loanType}
            form={{
              income: form?.income ?? 50000,
              amount: form?.amount ?? 5_000_000,
              termYears: form?.termYears ?? (isReverseAnnuity ? 20 : 30),
              occupation: form?.occupation ?? '',
              age: form?.age ?? 35,
            }}
            primary={primary}
            alternatives={alternatives}
          />

          {/* 備選方案 */}
          {alternatives.length > 0 && (
            <div>
              <p className="text-sm font-bold text-gray-500 mb-2">其他備選方案</p>
              <div className="space-y-2">
                {alternatives.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    loanType={loanType}
                    activePromotion={findOverlay(activePromotions, p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* CTA 按鈕 */}
          <button
            onClick={() => navigate('/poster', { state: { result, loanType, form } })}
            className="btn-primary"
          >
            生成我的專屬海報
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            重新試算
          </button>

          <p className="text-center text-xs text-gray-400 px-2">
            本試算僅供參考，實際核貸利率與額度依申請時條件為準。
          </p>
        </div>
      </div>
    </div>
  );
}
