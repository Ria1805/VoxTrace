import React, { useRef, useState } from 'react';
import { useFX } from '../../context/FXContext';

interface MagnetProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
  disabled?: boolean;
}

export const Magnet: React.FC<MagnetProps> = ({
  children,
  className = '',
  strength = 0.35,
  onClick,
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOff || disabled || !ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    setPos({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPos({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: !isOff ? `translate3d(${pos.x}px, ${pos.y}px, 0)` : 'none',
        transition: pos.x === 0 && pos.y === 0 ? 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'transform 0.1s ease-out',
      }}
      className={`inline-block ${className}`}
    >
      {children}
    </div>
  );
};
