import { ReactNode } from 'react';

interface StepFormProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export default function StepForm({
  currentStep, totalSteps, title, children,
  onNext, onBack, nextLabel = '下一步', nextDisabled = false,
}: StepFormProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* 進度條 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>步驟 {currentStep}/{totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-tcb-blue rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <h2 className="font-bold text-gray-800 text-base mt-3">{title}</h2>
      </div>

      {/* 內容區 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {children}
      </div>

      {/* 按鈕區 */}
      <div className="px-4 pb-6 pt-2 space-y-2 border-t border-gray-100 bg-white">
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className={`btn-primary ${nextDisabled ? 'opacity-40' : ''}`}
        >
          {nextLabel}
        </button>
        {onBack && (
          <button onClick={onBack} className="btn-secondary">
            上一步
          </button>
        )}
      </div>
    </div>
  );
}
