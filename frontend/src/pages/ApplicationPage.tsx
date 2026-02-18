import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import StepForm from '../components/StepForm/StepForm';
import StepLoanType from '../components/StepForm/StepLoanType';
import StepBasicInfo from '../components/StepForm/StepBasicInfo';
import StepPropertyInfo from '../components/StepForm/StepPropertyInfo';
import { useRecommend } from '../hooks/useRecommend';
import type { ApplicationFormData, LoanType, RecommendRequest } from '../types';
import { INITIAL_FORM_DATA } from '../types';

const STEP_TITLES = ['選擇貸款類型', '填寫基本資訊', '填寫房屋資訊', '分析中...'];

function isMortgageLike(type: LoanType | null) {
  return type === 'mortgage' || type === 'reverse_annuity';
}

export default function ApplicationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { recommend, loading } = useRecommend();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ApplicationFormData>({
    ...INITIAL_FORM_DATA,
    loanType: (params.get('type') as LoanType) || null,
  });

  // 如果 URL 帶入 type，直接從第 2 步開始
  useEffect(() => {
    const t = params.get('type');
    if (t) setStep(2);
  }, []);

  const patch = (p: Partial<ApplicationFormData>) =>
    setForm((prev) => ({ ...prev, ...p }));

  const totalSteps = isMortgageLike(form.loanType) ? 3 : 2;

  const isNextDisabled = () => {
    if (step === 1) return !form.loanType;
    if (step === 2) {
      const base = !form.age || (!form.income) || !form.termYears || !form.amount;
      if (form.loanType === 'reverse_annuity') return base;
      return base || !form.occupation || !form.purpose;
    }
    return false;
  };

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
      return;
    }
    // 最後一步：送出推薦
    const request: RecommendRequest = {
      loanType: form.loanType!,
      age: form.age!,
      occupation: form.occupation,
      income: form.income!,
      purpose: form.loanType === 'reverse_annuity' ? '以房養老' : form.purpose,
      termYears: form.termYears!,
      amount: form.amount!,
      propertyInfo: isMortgageLike(form.loanType)
        ? {
            propertyAge: form.propertyAge ?? undefined,
            areaPing: form.areaPing ?? undefined,
            hasParking: form.hasParking ?? undefined,
            layout: form.layout || undefined,
            floor: form.floor ?? undefined,
            buildingType: form.buildingType || undefined,
          }
        : undefined,
    };
    const result = await recommend(request);
    if (result) {
      navigate('/recommend', { state: { result, loanType: form.loanType, form } });
    }
  };

  const currentTitle = loading ? '正在為您分析...' : STEP_TITLES[step - 1];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header title="貸款試算" onBack={() => step > 1 ? setStep(s => s - 1) : navigate('/')} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-4 border-tcb-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">AI 正在分析您的最適方案...</p>
            <p className="text-sm text-gray-400">通常需要 1~2 秒</p>
          </div>
        ) : (
          <StepForm
            currentStep={step}
            totalSteps={totalSteps}
            title={currentTitle}
            onNext={handleNext}
            onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
            nextLabel={step === totalSteps ? '取得推薦方案' : '下一步'}
            nextDisabled={isNextDisabled()}
          >
            {step === 1 && (
              <StepLoanType value={form.loanType} onChange={(v) => patch({ loanType: v })} />
            )}
            {step === 2 && (
              <StepBasicInfo data={form} onChange={patch} />
            )}
            {step === 3 && (
              <StepPropertyInfo data={form} onChange={patch} />
            )}
          </StepForm>
        )}
      </div>
    </div>
  );
}
