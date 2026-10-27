import React, { useRef, useState } from 'react';
import { useFX } from '../../context/FXContext';

interface GlareHoverProps {
  children: React.ReactNode;
  className?: string;
  glareColor?: string;
  onClick?: () => void;
}

export const GlareHover: React.FC<GlareHoverProps> = ({
  children,
  className = '',
  glareColor = 'rgba(0, 240, 255, 0.15)',
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOff || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlarePos({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    if (isOff) return;
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden transition-all duration-200 ${className}`}
    >
      {!isOff && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle 180px at ${glarePos.x}% ${glarePos.y}%, ${glareColor}, transparent 80%)`,
          }}
        />
      )}
      {children}
    </div>
  );
};
