import { fontSize } from '../../lib/utils';
import { SOURCES } from '../../data/sources';

interface StepSourceProps {
  value: string;
  onChange: (value: string) => void;
  selectCls: string;
}

export default function StepSource({ value, onChange, selectCls }: StepSourceProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-black dark:text-white" style={{ fontSize: fontSize.base }}>From where did you hear about us?</label>
      <select
        className={selectCls}
        style={{ fontSize: fontSize.sm }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="" disabled>Select option</option>
        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
