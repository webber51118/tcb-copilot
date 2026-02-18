import type { LoanType } from '../../types';

const LOAN_OPTIONS: { value: LoanType; label: string; desc: string; emoji: string }[] = [
  {
    value: 'mortgage',
    label: '房屋貸款',
    desc: '購屋、週轉金、首購族首選',
    emoji: '🏠',
  },
  {
    value: 'personal',
    label: '信用貸款',
    desc: '資金周轉、裝潢、醫療需求',
    emoji: '💳',
  },
  {
    value: 'reverse_annuity',
    label: '以房養老',
    desc: '60歲以上，將房屋轉換為每月養老金',
    emoji: '🌸',
  },
];

interface StepLoanTypeProps {
  value: LoanType | null;
  onChange: (v: LoanType) => void;
}

export default function StepLoanType({ value, onChange }: StepLoanTypeProps) {
  return (
    <div className="space-y-3 mt-2">
      {LOAN_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
            value === opt.value
              ? 'border-tcb-blue bg-tcb-light'
              : 'border-gray-200 bg-white active:border-tcb-blue'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{opt.emoji}</span>
            <div>
              <p className="font-bold text-gray-800">{opt.label}</p>
              <p className="text-sm text-gray-500">{opt.desc}</p>
            </div>
            {value === opt.value && (
              <div className="ml-auto w-5 h-5 bg-tcb-blue rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
