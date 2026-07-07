import { useNavigate } from 'react-router-dom';
import { useTheme } from '../lib/ThemeContext.tsx';
import { fontSize } from '../lib/utils';
import { ArrowLeft, Sun, Moon, Type } from 'lucide-react';

const FONT_OPTIONS = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' },
  { value: 'larger' as const, label: 'Larger' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme, fontSizeLevel, setFontSizeLevel } = useTheme();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100 font-sans antialiased">
      <header className="sticky top-0 z-40 w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-900/80 flex items-center gap-3 transition-colors duration-300">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.lg }}>Settings</h1>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="font-medium text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.sm }}>Theme</p>
                <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-gray-700'
              }`}
              aria-label="Toggle theme"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
          <div className="flex items-center gap-3">
            <Type className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <div>
              <p className="font-medium text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.sm }}>Font Size</p>
              <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>Adjust text size across the app</p>
            </div>
          </div>
          <div className="flex gap-2">
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFontSizeLevel(opt.value)}
                className={`flex-1 py-2.5 px-3 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
                  fontSizeLevel === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-gray-700'
                }`}
                style={{ fontSize: fontSize.sm }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-gray-800">
            <p className="text-zinc-400 dark:text-gray-500 text-center" style={{ fontSize: fontSize.xs }}>
              Preview: The quick brown fox jumps over the lazy dog
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
