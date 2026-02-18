import type { ApplicationFormData, LoanType, OccupationType } from '../../types';

const OCCUPATIONS: OccupationType[] = ['軍人', '公務員', '教師', '上班族', '自營商', '其他'];

const MORTGAGE_PURPOSES = ['首購自住', '自住', '資金週轉', '投資理財', '其他'];
const PERSONAL_PURPOSES = ['資金周轉', '裝潢修繕', '投資理財', '醫療支出', '其他'];

interface StepBasicInfoProps {
  data: ApplicationFormData;
  onChange: (patch: Partial<ApplicationFormData>) => void;
}

function Slider({
  label, value, min, max, step, unit, display, onChange,
}: {
  label: string; value: number | null; min: number; max: number;
  step: number; unit: string; display: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold text-tcb-blue">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value ?? min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-tcb-blue"
      />
    </div>
  );
}

export default function StepBasicInfo({ data, onChange }: StepBasicInfoProps) {
  const purposes = data.loanType === 'mortgage' ? MORTGAGE_PURPOSES
    : data.loanType === 'reverse_annuity' ? ['以房養老']
    : PERSONAL_PURPOSES;
  const isReverseAnnuity = data.loanType === 'reverse_annuity';
  const minAge = isReverseAnnuity ? 60 : 20;

  return (
    <div className="space-y-5 mt-2">
      {/* 年齡 */}
      <Slider
        label="年齡"
        value={data.age}
        min={minAge} max={75} step={1}
        unit="歲"
        display={data.age ? `${data.age} 歲` : `請選擇（${minAge}~75）`}
        onChange={(v) => onChange({ age: v })}
      />

      {/* 職業（以房養老不收職業） */}
      {!isReverseAnnuity && (
        <div>
          <p className="text-sm text-gray-500 mb-2">職業</p>
          <div className="grid grid-cols-3 gap-2">
            {OCCUPATIONS.map((occ) => (
              <button
                key={occ}
                onClick={() => onChange({ occupation: occ })}
                className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                  data.occupation === occ
                    ? 'bg-tcb-blue text-white border-tcb-blue'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {occ}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 月收入 */}
      <Slider
        label={isReverseAnnuity ? '目前月收入/退休金' : '月收入'}
        value={data.income}
        min={10000} max={300000} step={5000}
        unit="元"
        display={data.income ? `NT$ ${(data.income / 10000).toFixed(1)}萬` : '請選擇'}
        onChange={(v) => onChange({ income: v })}
      />

      {/* 用途 */}
      {!isReverseAnnuity && (
        <div>
          <p className="text-sm text-gray-500 mb-2">貸款用途</p>
          <div className="flex flex-wrap gap-2">
            {purposes.map((p) => (
              <button
                key={p}
                onClick={() => onChange({ purpose: p })}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  data.purpose === p
                    ? 'bg-tcb-blue text-white border-tcb-blue'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 年限 */}
      <Slider
        label={isReverseAnnuity ? '撥付年限' : '貸款年限'}
        value={data.termYears}
        min={isReverseAnnuity ? 10 : (data.loanType === 'personal' ? 1 : 10)}
        max={isReverseAnnuity ? 35 : (data.loanType === 'personal' ? 7 : 40)}
        step={1}
        unit="年"
        display={data.termYears ? `${data.termYears} 年` : '請選擇'}
        onChange={(v) => onChange({ termYears: v })}
      />

      {/* 金額 */}
      <Slider
        label={isReverseAnnuity ? '預計核貸金額' : '貸款金額'}
        value={data.amount}
        min={data.loanType === 'personal' ? 100000 : 500000}
        max={data.loanType === 'personal' ? 3000000 : 20000000}
        step={data.loanType === 'personal' ? 50000 : 100000}
        unit="元"
        display={data.amount ? `NT$ ${(data.amount / 10000).toFixed(0)}萬` : '請選擇'}
        onChange={(v) => onChange({ amount: v })}
      />
    </div>
  );
}
