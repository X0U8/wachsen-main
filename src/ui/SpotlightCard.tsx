import { useRef, useState, useEffect, ReactNode } from 'react';
import { useTheme } from '../lib/ThemeContext';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
} 

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor,
  style,
  onClick,
}: SpotlightCardProps) {
  const { theme } = useTheme();
  const effectiveSpotlightColor = spotlightColor ?? (theme === 'dark' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(0, 229, 255, 0.2)');
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const isHovered = useRef(false);
  const animFrameRef = useRef<number>(0);
  const autoAngleRef = useRef<number>(Math.random() * Math.PI * 2);

  useEffect(() => {
    const speed = 0.008 + Math.random() * 0.006;

    const animate = () => {
      if (!isHovered.current && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rx = cx * 0.7;
        const ry = cy * 0.7;
        autoAngleRef.current += speed;
        const x = cx + Math.cos(autoAngleRef.current) * rx;
        const y = cy + Math.sin(autoAngleRef.current) * ry;
        setPos({ x, y });
        setOpacity(0.6);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseEnter = () => {
    isHovered.current = true;
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    isHovered.current = false;
    setOpacity(0.6);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    isHovered.current = true;
    setPos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
    setOpacity(1);
  };

  const handleTouchEnd = () => {
    isHovered.current = false;
    setOpacity(0.6);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {children}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl z-20"
        style={{
          opacity,
          transition: 'opacity 0.4s ease',
          background: `radial-gradient(280px circle at ${pos.x}px ${pos.y}px, ${effectiveSpotlightColor}, transparent 70%)`,
        }}
      />
    </div>
  );
}
