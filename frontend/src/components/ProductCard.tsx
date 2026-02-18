import type { RecommendedProduct, Promotion } from '../types';

interface ProductCardProps {
  product: RecommendedProduct;
  isPrimary?: boolean;
  activePromotion?: Promotion;
  loanType?: string;
}

function formatMoney(n: number): string {
  return `NT$ ${n.toLocaleString('zh-TW')}`;
}

export default function ProductCard({
  product, isPrimary = false, activePromotion, loanType,
}: ProductCardProps) {
  const isReverseAnnuity = loanType === 'reverse_annuity';
  const monthlyLabel = isReverseAnnuity ? '預估每月撥付' : '預估月付金額';

  return (
    <div className={`card ${isPrimary ? 'border-2 border-tcb-blue' : 'border border-gray-100'}`}>
      {/* 活動標籤 */}
      {activePromotion && (
        <div className="bg-red-50 text-tcb-red text-xs font-bold px-3 py-1 rounded-lg mb-3 flex items-center gap-1">
          🎉 {activePromotion.holiday}限定：{activePromotion.bonusDescription}
        </div>
      )}

      {/* 主推標籤 */}
      {isPrimary && (
        <div className="bg-tcb-blue text-white text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2">
          為您主推
        </div>
      )}

      {/* 產品名稱 */}
      <h3 className={`font-bold ${isPrimary ? 'text-base' : 'text-sm'} text-gray-800 leading-tight`}>
        {product.name}
      </h3>

      {/* 利率 */}
      <div className={`mt-2 ${isPrimary ? 'text-2xl' : 'text-lg'} font-black text-tcb-blue`}>
        {product.rateRange}
      </div>

      {/* 月付 */}
      {product.monthlyPayment && (
        <div className="mt-1 text-sm text-gray-600">
          {monthlyLabel}：
          <span className="font-bold text-gray-800">{formatMoney(product.monthlyPayment)}</span>
        </div>
      )}

      {/* 產品特色（主推顯示更多） */}
      {isPrimary && (
        <ul className="mt-3 space-y-1">
          {product.features.slice(0, 4).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm text-gray-600">
              <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 亮點說明 */}
      <p className="mt-3 text-xs text-tcb-blue font-medium bg-tcb-light rounded-lg px-3 py-2">
        {product.savingsHighlight}
      </p>
    </div>
  );
}
