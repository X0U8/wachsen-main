import { fontSize } from '../../lib/utils';

interface StepGenderProps {
  value: string;
  onChange: (value: string) => void;
  selectCls: string;
}

export default function StepGender({ value, onChange, selectCls }: StepGenderProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-black dark:text-white" style={{ fontSize: fontSize.base }}>Gender</label>
      <select
        className={selectCls}
        style={{ fontSize: fontSize.sm }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="" disabled>Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>
    </div>
  );
}
