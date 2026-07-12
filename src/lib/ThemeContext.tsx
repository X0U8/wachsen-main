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
    xs: 'clamp(0.7rem, 0.65rem + 0.2vw, 0.75rem)',
    sm: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem)',
    base: 'clamp(0.9rem, 0.85rem + 0.3vw, 1rem)',
    lg: 'clamp(1rem, 0.95rem + 0.4vw, 1.125rem)',
    xl: 'clamp(1.2rem, 1.1rem + 0.6vw, 1.375rem)',
    '2xl': 'clamp(1.5rem, 1.35rem + 0.8vw, 1.75rem)',
    '3xl': 'clamp(1.8rem, 1.6rem + 1.2vw, 2.125rem)',
    '4xl': 'clamp(2.1rem, 1.9rem + 1.4vw, 2.5rem)',
    '5xl': 'clamp(2.75rem, 2.45rem + 1.8vw, 3.25rem)',
  },
  large: {
    xs: 'clamp(0.775rem, 0.725rem + 0.25vw, 0.85rem)',
    sm: 'clamp(0.9rem, 0.825rem + 0.35vw, 1rem)',
    base: 'clamp(1.025rem, 0.95rem + 0.45vw, 1.15rem)',
    lg: 'clamp(1.2rem, 1.1rem + 0.6vw, 1.35rem)',
    xl: 'clamp(1.45rem, 1.3rem + 0.8vw, 1.65rem)',
    '2xl': 'clamp(1.75rem, 1.55rem + 1vw, 2rem)',
    '3xl': 'clamp(2.15rem, 1.9rem + 1.35vw, 2.5rem)',
    '4xl': 'clamp(2.45rem, 2.15rem + 1.6vw, 2.85rem)',
    '5xl': 'clamp(3.15rem, 2.75rem + 2.2vw, 3.75rem)',
  },
  larger: {
    xs: 'clamp(0.9rem, 0.825rem + 0.35vw, 1rem)',
    sm: 'clamp(1rem, 0.925rem + 0.45vw, 1.125rem)',
    base: 'clamp(1.15rem, 1.05rem + 0.55vw, 1.3rem)',
    lg: 'clamp(1.3rem, 1.2rem + 0.7vw, 1.5rem)',
    xl: 'clamp(1.6rem, 1.45rem + 0.9vw, 1.85rem)',
    '2xl': 'clamp(1.95rem, 1.75rem + 1.1vw, 2.25rem)',
    '3xl': 'clamp(2.35rem, 2.1rem + 1.45vw, 2.75rem)',
    '4xl': 'clamp(2.75rem, 2.45rem + 1.8vw, 3.25rem)',
    '5xl': 'clamp(3.6rem, 3.15rem + 2.4vw, 4.25rem)',
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
