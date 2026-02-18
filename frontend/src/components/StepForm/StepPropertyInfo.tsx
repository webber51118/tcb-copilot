import type { ApplicationFormData } from '../../types';

const BUILDING_TYPES = ['大樓', '華廈', '公寓', '透天', '套房'];
const LAYOUTS = ['1房1廳1衛', '2房1廳1衛', '3房2廳2衛', '4房2廳2衛'];

interface StepPropertyInfoProps {
  data: ApplicationFormData;
  onChange: (patch: Partial<ApplicationFormData>) => void;
}

function Slider({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number | null; min: number; max: number;
  step: number; display: string; onChange: (v: number) => void;
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

function ChipGroup({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
              value === o
                ? 'bg-tcb-blue text-white border-tcb-blue'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StepPropertyInfo({ data, onChange }: StepPropertyInfoProps) {
  return (
    <div className="space-y-5 mt-2">
      <Slider
        label="屋齡"
        value={data.propertyAge} min={0} max={60} step={1}
        display={data.propertyAge !== null ? `${data.propertyAge} 年` : '請選擇'}
        onChange={(v) => onChange({ propertyAge: v })}
      />

      <Slider
        label="坪數"
        value={data.areaPing} min={10} max={200} step={1}
        display={data.areaPing ? `${data.areaPing} 坪` : '請選擇'}
        onChange={(v) => onChange({ areaPing: v })}
      />

      <Slider
        label="樓層"
        value={data.floor} min={1} max={50} step={1}
        display={data.floor ? `${data.floor} 樓` : '請選擇'}
        onChange={(v) => onChange({ floor: v })}
      />

      {/* 車位 */}
      <div>
        <p className="text-sm text-gray-500 mb-2">是否有車位</p>
        <div className="flex gap-3">
          {[
            { label: '有車位', value: true },
            { label: '無車位', value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => onChange({ hasParking: opt.value })}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                data.hasParking === opt.value
                  ? 'bg-tcb-blue text-white border-tcb-blue'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ChipGroup
        label="格局"
        options={LAYOUTS}
        value={data.layout}
        onChange={(v) => onChange({ layout: v })}
      />

      <ChipGroup
        label="建物類型"
        options={BUILDING_TYPES}
        value={data.buildingType}
        onChange={(v) => onChange({ buildingType: v })}
      />
    </div>
  );
}
