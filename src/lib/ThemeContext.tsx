import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Theme = 'light' | 'dark';
type FontSizeLevel = 'small' | 'medium' | 'large' | 'larger';

const FONT_SIZE_VALUES: Record<FontSizeLevel, Record<string, string>> = {
  small: {
    xs: 'clamp(0.6rem, 0.55rem + 0.2vw, 0.7rem)',
    sm: 'clamp(0.7rem, 0.65rem + 0.2vw, 0.8rem)',
    base: 'clamp(0.8rem, 0.75rem + 0.2vw, 0.9rem)',
    lg: 'clamp(0.9rem, 0.85rem + 0.25vw, 1.05rem)',
    xl: 'clamp(1.05rem, 0.95rem + 0.3vw, 1.25rem)',
    '2xl': 'clamp(1.25rem, 1.15rem + 0.4vw, 1.5rem)',
    '3xl': 'clamp(1.5rem, 1.35rem + 0.5vw, 1.85rem)',
    '4xl': 'clamp(1.5rem, 1.35rem + 0.5vw, 1.85rem)',
    '5xl': 'clamp(2rem, 1.75rem + 0.8vw, 2.5rem)',
  },
  medium: {
    xs: 'clamp(0.75rem, 0.7rem + 0.2vw, 0.85rem)',
    sm: 'clamp(0.875rem, 0.8rem + 0.25vw, 1.025rem)',
    base: 'clamp(1rem, 0.9rem + 0.3vw, 1.15rem)',
    lg: 'clamp(1.15rem, 1.05rem + 0.4vw, 1.35rem)',
    xl: 'clamp(1.35rem, 1.2rem + 0.5vw, 1.65rem)',
    '2xl': 'clamp(1.65rem, 1.45rem + 0.75vw, 2.1rem)',
    '3xl': 'clamp(2rem, 1.75rem + 1vw, 2.6rem)',
    '4xl': 'clamp(2.35rem, 2.1rem + 1.2vw, 3.15rem)',
    '5xl': 'clamp(3rem, 2.6rem + 1.5vw, 4.15rem)',
  },
  large: {
    xs: 'clamp(0.9rem, 0.85rem + 0.2vw, 1rem)',
    sm: 'clamp(1.05rem, 0.95rem + 0.3vw, 1.25rem)',
    base: 'clamp(1.25rem, 1.15rem + 0.4vw, 1.45rem)',
    lg: 'clamp(1.45rem, 1.35rem + 0.5vw, 1.75rem)',
    xl: 'clamp(1.75rem, 1.6rem + 0.6vw, 2.1rem)',
    '2xl': 'clamp(2.1rem, 1.9rem + 0.8vw, 2.65rem)',
    '3xl': 'clamp(2.55rem, 2.3rem + 1vw, 3.25rem)',
    '4xl': 'clamp(3rem, 2.7rem + 1.2vw, 3.85rem)',
    '5xl': 'clamp(3.75rem, 3.3rem + 1.5vw, 5rem)',
  },
  larger: {
    xs: 'clamp(1.05rem, 0.95rem + 0.3vw, 1.25rem)',
    sm: 'clamp(1.25rem, 1.15rem + 0.4vw, 1.55rem)',
    base: 'clamp(1.5rem, 1.35rem + 0.5vw, 1.8rem)',
    lg: 'clamp(1.8rem, 1.6rem + 0.6vw, 2.2rem)',
    xl: 'clamp(2.2rem, 1.95rem + 0.8vw, 2.75rem)',
    '2xl': 'clamp(2.65rem, 2.35rem + 1vw, 3.35rem)',
    '3xl': 'clamp(3.25rem, 2.85rem + 1.2vw, 4.15rem)',
    '4xl': 'clamp(3.85rem, 3.35rem + 1.5vw, 4.95rem)',
    '5xl': 'clamp(4.75rem, 4.1rem + 2vw, 6.25rem)',
  },
};

const getInitialTheme = (): Theme => {
  const saved = localStorage.getItem('theme');
  const theme = (saved === 'light' || saved === 'dark') ? saved : 'light';
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
