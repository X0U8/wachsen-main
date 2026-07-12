import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { fontSize } from '../lib/utils';

const springValues = {
  damping: 30,
  stiffness: 100,
  mass: 2
};

interface TiltedCardProps {
  children: React.ReactNode;
  containerHeight?: string;
  containerWidth?: string;
  scaleOnHover?: number;
  rotateAmplitude?: number;
  showMobileWarning?: boolean;
}

export default function TiltedCard({
  children,
  containerHeight = 'auto',
  containerWidth = '100%',
  scaleOnHover = 1.05,
  rotateAmplitude = 12,
  showMobileWarning = false
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const [lastY, setLastY] = useState(0);

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);
    setLastY(offsetY);
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
    setLastY(0);
  }

  return (
    <div
      ref={ref}
      className="relative w-full h-full [perspective:1000px] flex flex-col items-center justify-center"
      style={{
        height: containerHeight,
        width: containerWidth
      }}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showMobileWarning && (
        <div
          className="absolute top-4 text-center block sm:hidden text-gray-500 dark:text-gray-400 text-sm">
          This effect is not optimized for mobile. Check on desktop.
        </div>
      )}
      <motion.div
        className="relative w-full h-full [transform-style:preserve-3d]"
        style={{
          rotateX,
          rotateY,
          scale
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
