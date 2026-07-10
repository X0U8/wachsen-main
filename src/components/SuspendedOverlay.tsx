export default function SuspendedOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-black flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
      <h1 className="text-2xl text-zinc-900 dark:text-white mb-3">Account Suspended</h1>
      <p className="text-zinc-500 dark:text-gray-400 text-sm max-w-xs">
        Your account has been suspended. If you believe this is a mistake, please contact support.
      </p>
    </div>
  );
}
