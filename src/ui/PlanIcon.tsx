import { Sprout, Star, Crown } from 'lucide-react';

interface PlanIconProps {
  planName?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PlanIcon({ planName, className = '', style }: PlanIconProps) {
  if (!planName) return null;
  
  const basePlan = planName.replace(/_monthly|_yearly|_month|_year$/, '');

  switch (basePlan) {
    case 'Glix Lite':
      return (
        <div className={`relative inline-flex items-center justify-center p-1 group ${className}`} style={style}>
          <div className="absolute inset-0 bg-emerald-500/15 dark:bg-emerald-500/30 rounded-full blur-[6px]" />
          <Sprout 
            className="w-4 h-4 text-emerald-600 dark:text-emerald-300 fill-emerald-400 dark:fill-emerald-500 relative z-10" 
            style={{
              filter: 'drop-shadow(0 0 2px #10b981) drop-shadow(0 0 8px #047857)'
            }}
          />
        </div>
      );
      
    case 'Glix Rise':
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
