import { fontSize } from '../../lib/utils';
import { COUNTRIES } from '../../data/countries';

interface StepCountryProps {
  value: string;
  onChange: (value: string) => void;
  selectCls: string;
}

export default function StepCountry({ value, onChange, selectCls }: StepCountryProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-black dark:text-white text-base">Country</label>
      <select
        className={`${selectCls} text-sm`}
        value={value}
        onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Select Country</option>
        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
