/**
 * INPUT: 進行中活動清單、推薦產品
 * OUTPUT: 活動疊加後的推薦產品、活動輪播 Flex 卡片
 * POS: 服務層，活動引擎，負責活動篩選、疊加與 Flex 卡片建構
 */

import { LoanType } from '../models/enums';
import { RecommendedProduct, LineReplyMessage } from '../models/types';
import { Promotion } from '../models/promotion';
import { getActivePromotions } from '../config/promotionStore';

export { getActivePromotions };

/**
 * 將 Type A（Overlay）活動優惠疊加至推薦產品
 */
export function applyOverlay(
  product: RecommendedProduct,
  promotions: Promotion[],
): RecommendedProduct {
  const applicable = promotions.filter(
    (p) => p.type === 'overlay' && p.targetProducts?.includes(product.id as any),
  );
  if (applicable.length === 0) return product;

  const overlay = applicable[0];
  return {
    ...product,
    rateValue: product.rateValue + (overlay.bonusRateReduction ?? 0),
    rateRange: overlay.bonusDescription
      ? `${product.rateRange}（${overlay.bonusDescription}）`
      : product.rateRange,
    features: [
      ...(overlay.bonusFeatures ?? []),
      ...product.features,
    ],
    savingsHighlight: overlay.bonusDescription
      ? `🎉 ${overlay.name}：${overlay.bonusDescription}\n${product.savingsHighlight}`
      : product.savingsHighlight,
  };
}

/**
 * 取得 Type B（Standalone）獨立活動產品
 * 依貸款類型過濾
 */
export function getStandaloneProducts(
  loanType: LoanType | null,
  promotions: Promotion[],
): RecommendedProduct[] {
  return promotions
    .filter((p) => p.type === 'standalone' && p.standalone?.loanType === loanType)
    .map((p, i): RecommendedProduct => ({
      id: `promo-${p.id}`,
      name: p.name,
      rank: 0, // 活動產品顯示在最前
      rateRange: p.standalone!.rateRange,
      rateValue: p.standalone!.rateValue,
      maxAmount: p.standalone!.maxAmount,
      maxTermYears: p.standalone!.maxTermYears,
      features: p.standalone!.features,
      savingsHighlight: `🎉 限時活動：${p.standalone!.savingsHighlight}`,
    }));
}

/**
 * 建構活動輪播 Flex Carousel（最多3張）
 */
export function buildPromotionFlexCarousel(promotions: Promotion[]): LineReplyMessage {
  const bubbles = promotions.slice(0, 3).map((p) => ({
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `🎉 ${p.holiday}限定`, size: 'xs', color: '#ffffff' },
        { type: 'text', text: p.name, weight: 'bold', size: 'md', color: '#ffffff', wrap: true },
      ],
      backgroundColor: '#C0392B',
      paddingAll: '15px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'text',
          text: p.type === 'overlay'
            ? (p.bonusDescription ?? '限時加碼優惠')
            : (p.standalone?.savingsHighlight ?? '限時獨家產品'),
          size: 'sm',
          wrap: true,
          color: '#555555',
        },
        {
          type: 'text',
          text: `活動期間：${p.startDate} ~ ${p.endDate}`,
          size: 'xxs',
          color: '#aaaaaa',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#C0392B',
          height: 'sm',
          action: { type: 'message', label: '了解詳情', text: `我想了解${p.name}` },
        },
      ],
    },
  }));

  return {
    type: 'flex',
    altText: `合庫限時活動：${promotions.map((p) => p.name).join('、')}`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}
