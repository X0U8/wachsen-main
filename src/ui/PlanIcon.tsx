import { BadgeCheck, Star, Crown } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext.tsx';

interface PlanIconProps {
  planName?: string;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'header' | 'profileCard';
}

export default function PlanIcon({ planName, className = '', style, variant }: PlanIconProps) {
  const { theme } = useTheme();
  if (!planName) return null;
  
  const basePlan = planName.replace(/_monthly|_yearly|_month|_year$/, '');

  // Render solid-outlined design if theme is light
  const showSolid = theme === 'light';
  const defaultSizeClass = variant === 'profileCard' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';

  switch (basePlan) {
    case 'Glix Lite':
      if (showSolid) {
        return (
          <BadgeCheck 
            className={`${defaultSizeClass} shrink-0 ${className}`} 
            style={{ stroke: '#ffffff', fill: '#10b981', ...style }} 
          />
        );
      }
      return (
        <div className={`relative inline-flex items-center justify-center p-1 group ${className}`} style={style}>
          <div className="absolute inset-0 bg-emerald-500/15 dark:bg-emerald-500/30 rounded-full blur-[6px]" />
          <BadgeCheck 
            className="w-4 h-4 text-emerald-600 dark:text-emerald-300 fill-emerald-450 dark:fill-emerald-500 relative z-10" 
            style={{
              filter: 'drop-shadow(0 0 2px #10b981) drop-shadow(0 0 8px #047857)'
            }}
          />
        </div>
      );
      
    case 'Glix Rise':
      if (showSolid) {
        return (
          <Star 
            className={`${defaultSizeClass} shrink-0 ${className}`} 
            style={{ stroke: '#ffffff', fill: '#3b82f6', ...style }} 
          />
        );
      }
      return (
        <div className={`relative inline-flex items-center justify-center p-1 group ${className}`} style={style}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/25 to-cyan-400/20 dark:from-blue-500/35 dark:to-cyan-500/30 rounded-full blur-[8px]" />
          <div className="absolute inset-0.5 bg-blue-400/15 dark:bg-blue-500/20 rounded-full blur-[4px]" />
          <Star 
            className="w-4 h-4 text-blue-600 dark:text-blue-300 fill-blue-400 dark:fill-blue-500 relative z-10" 
            style={{
              filter: 'drop-shadow(0 0 2px #3b82f6) drop-shadow(0 0 8px #1d4ed8) drop-shadow(0 0 14px #1e40af)'
            }}
          />
        </div>
      );
      
    case 'Glix Peak':
      if (showSolid) {
        return (
          <Crown 
            className={`${defaultSizeClass} shrink-0 ${className}`} 
            style={{ stroke: '#ffffff', fill: '#f59e0b', ...style }} 
          />
        );
      }
      return (
        <div className={`relative inline-flex items-center justify-center p-1 group ${className}`} style={style}>
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/30 to-yellow-400/25 dark:from-amber-500/40 dark:to-yellow-500/30 rounded-full blur-[10px]" />
          <div className="absolute inset-0.5 bg-amber-400/20 dark:bg-amber-400/30 rounded-full blur-[5px]" />
          <div className="absolute inset-1 bg-yellow-300/15 dark:bg-yellow-300/20 rounded-full blur-[2px]" />
          <Crown 
            className="w-4 h-4 text-amber-600 dark:text-amber-300 fill-amber-500 dark:fill-amber-400 relative z-10" 
            style={{
              filter: 'drop-shadow(0 0 2px #fef08a) drop-shadow(0 0 6px #f59e0b) drop-shadow(0 0 14px #d97706) drop-shadow(0 0 22px #78350f)'
            }}
          />
        </div>
      );
      
    default:
      return null;
  }
}
