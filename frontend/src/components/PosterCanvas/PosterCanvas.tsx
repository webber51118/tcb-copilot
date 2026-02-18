import { forwardRef } from 'react';
import { useCanvas } from './useCanvas';
import type { RecommendedProduct, Promotion, LoanType } from '../../types';

interface PosterCanvasProps {
  product: RecommendedProduct;
  loanType: LoanType;
  formData: any;
  activePromotion?: Promotion;
}

const PosterCanvas = forwardRef<HTMLCanvasElement, PosterCanvasProps>(
  ({ product, loanType, formData, activePromotion }, ref) => {
    useCanvas(ref as React.RefObject<HTMLCanvasElement>, {
      product,
      loanType,
      formData,
      activePromotion,
    });

    return (
      <canvas
        ref={ref}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    );
  },
);

PosterCanvas.displayName = 'PosterCanvas';

export default PosterCanvas;
