import { fontSize } from '../../lib/utils';
import { DAYS, MONTHS, YEARS } from '../../data/dates';

interface StepDOBProps {
  day: string;
  month: string;
  year: string;
  onChange: (field: 'dobDay' | 'dobMonth' | 'dobYear', value: string) => void;
  selectCls: string;
}

export default function StepDOB({ day, month, year, onChange, selectCls }: StepDOBProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-black dark:text-white text-base">Date of Birth</label>
      <div className="flex gap-3">
        <select
          className={`${selectCls} text-sm`}
          value={day}
          onChange={e => onChange('dobDay', e.target.value)}>
          <option value="" disabled className="bg-white dark:bg-zinc-950">Day</option>
          {DAYS.map(d => <option key={d} value={d} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{d}</option>)}
        </select>
        <select
          className={`${selectCls} text-sm`}
          value={MONTHS[parseInt(month, 10) - 1] || ''}
          onChange={e => {
            const idx = MONTHS.indexOf(e.target.value) + 1;
            onChange('dobMonth', idx ? idx.toString() : '');
          }}>
          <option value="" disabled className="bg-white dark:bg-zinc-950">Month</option>
          {MONTHS.map(m => <option key={m} value={m} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{m}</option>)}
        </select>
        <select
          className={`${selectCls} text-sm`}
          value={year}
          onChange={e => onChange('dobYear', e.target.value)}>
          <option value="" disabled className="bg-white dark:bg-zinc-950">Year</option>
          {YEARS.map(y => <option key={y} value={y} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{y}</option>)}
        </select>
      </div>
    </div>
  );
}
