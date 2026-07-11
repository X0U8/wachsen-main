import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Theme = 'light' | 'dark';
type FontSizeLevel = 'small' | 'medium' | 'large' | 'larger';

const FONT_SIZE_VALUES: Record<FontSizeLevel, Record<string, string>> = {
  small: {
    xs: 'clamp(0.65rem, 0.6rem + 0.25vw, 0.75rem)',
    sm: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
    base: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
    lg: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
    xl: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
    '2xl': 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
    '3xl': 'clamp(1.875rem, 1.5rem + 1.5vw, 2.5rem)',
    '4xl': 'clamp(1.75rem, 1.45rem + 1.5vw, 2.5rem)',
    '5xl': 'clamp(2.25rem, 1.75rem + 2vw, 3.5rem)',
  },
  medium: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.125rem',
    '4xl': '2.5rem',
    '5xl': '3.25rem',
  },
  large: {
    xs: '0.85rem',
    sm: '1rem',
    base: '1.15rem',
    lg: '1.35rem',
    xl: '1.65rem',
    '2xl': '2rem',
    '3xl': '2.5rem',
    '4xl': '2.85rem',
    '5xl': '3.75rem',
  },
  larger: {
    xs: '1rem',
    sm: '1.125rem',
    base: '1.3rem',
    lg: '1.5rem',
    xl: '1.85rem',
    '2xl': '2.25rem',
    '3xl': '2.75rem',
    '4xl': '3.25rem',
    '5xl': '4.25rem',
  },
};

const getInitialTheme = (): Theme => {
  const saved = localStorage.getItem('theme');
  const theme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  return theme;
};

const getInitialFontSize = (): FontSizeLevel => {
  const saved = localStorage.getItem('fontSizeLevel');
  const level = (saved === 'small' || saved === 'medium' || saved === 'large' || saved === 'larger') ? saved : 'small';
  const values = FONT_SIZE_VALUES[level];
  const root = document.documentElement;
  (Object.entries(values) as [string, string][]).forEach(([key, val]) => {
    root.style.setProperty(`--fs-${key}`, val);
  });
  return level;
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontSizeLevel: FontSizeLevel;
  setFontSizeLevel: (level: FontSizeLevel) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const [fontSizeLevel, setFontSizeLevelState] = useState<FontSizeLevel>(getInitialFontSize);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('fontSizeLevel', fontSizeLevel);
    const values = FONT_SIZE_VALUES[fontSizeLevel];
    const root = document.documentElement;
    (Object.entries(values) as [string, string][]).forEach(([key, val]) => {
      root.style.setProperty(`--fs-${key}`, val);
    });
  }, [fontSizeLevel]);

  const toggleTheme = () => setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  const setTheme = (t: Theme) => setThemeState(t);
  const setFontSizeLevel = useCallback((level: FontSizeLevel) => setFontSizeLevelState(level), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, fontSizeLevel, setFontSizeLevel }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
