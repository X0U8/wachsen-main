import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );
}
