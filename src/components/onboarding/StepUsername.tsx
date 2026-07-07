import { fontSize } from '../../lib/utils';

interface StepUsernameProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  message: string | null;
  verified: boolean;
  inputCls: string;
}

export default function StepUsername({ value, onChange, message, verified, inputCls }: StepUsernameProps) {
  return (
    <div className="space-y-4">
      <label className="block font-medium text-zinc-600 dark:text-zinc-350" style={{ fontSize: fontSize.sm }}>Choose a username</label>
      <div className="relative flex items-center">
        <span className="absolute left-4 text-zinc-500 dark:text-zinc-400 font-medium">@</span>
        <input
          type="text"
          placeholder="username"
          maxLength={8}
          className={`${inputCls} pl-8 lowercase`}
          style={{ fontSize: fontSize.sm }}
          value={value}
          onChange={onChange}
        />
      </div>
      {message && (
        <p className={`text-zinc-500 dark:text-zinc-400 ${verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-450'} animate-fade-in`} style={{ fontSize: fontSize.xs }}>
          {message}
        </p>
      )}
    </div>
  );
}
