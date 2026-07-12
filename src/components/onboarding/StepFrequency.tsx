import { fontSize } from '../../lib/utils';

interface StepFrequencyProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputCls: string;
}

export default function StepFrequency({ value, onChange, inputCls }: StepFrequencyProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-black dark:text-white text-base">How many exams do you give per week?</label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        className={`${inputCls} text-sm`}
        placeholder="e.g. 5"
        value={value}
        onChange={onChange} />
    </div>
  );
}
