import React from 'react';
import { useFX } from '../../context/FXContext';

interface StarBorderProps {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  as: Component = 'button',
  className = '',
  color = '#00F0FF',
  speed = '4s',
  children,
  onClick,
  disabled = false,
}) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  return (
    <Component
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-block overflow-hidden rounded-xl p-[1px] focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed group ${className}`}
    >
      {!isOff && (
        <span
          className="absolute inset-[-100%] animate-[spin_4s_linear_infinite]"
          style={{
            animationDuration: speed,
            background: `conic-gradient(from 0deg, transparent 0 320deg, ${color} 360deg)`,
          }}
        />
      )}
      <span className="relative block rounded-xl bg-[#0A0E1F]/90 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-slate-100 group-hover:bg-[#0A0E1F]/70 transition-colors">
        {children}
      </span>
    </Component>
  );
};
