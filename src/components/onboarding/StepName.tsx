import { fontSize } from '../../lib/utils';

interface StepNameProps {
  value: string;
  onChange: (value: string) => void;
  inputCls: string;
}

export default function StepName({ value, onChange, inputCls }: StepNameProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-zinc-600 dark:text-zinc-350" style={{ fontSize: fontSize.sm }}>What's your name?</label>
      <input
        maxLength={10}
        className={inputCls}
        style={{ fontSize: fontSize.sm }}
        placeholder="Your name"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
