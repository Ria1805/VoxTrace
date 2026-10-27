import React from 'react';
import { useFX } from '../../context/FXContext';

interface ElectricBorderProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  active?: boolean;
}

export const ElectricBorder: React.FC<ElectricBorderProps> = ({
  children,
  className = '',
  glowColor = '#00F0FF',
  active = true,
}) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  return (
    <div
      className={`relative rounded-2xl p-[2px] transition-all duration-300 ${className}`}
      style={{
        boxShadow: !isOff && active ? `0 0 25px -4px ${glowColor}40` : 'none',
      }}
    >
      {!isOff && active && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-80"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${glowColor}60 0%, transparent 60%),
                         linear-gradient(90deg, ${glowColor}20, transparent 40%, ${glowColor}30 70%, transparent)`,
            filter: 'blur(2px)',
          }}
        />
      )}
      <div className="relative rounded-2xl bg-[#0A0E1F]/85 backdrop-blur-xl border border-cyan-500/20 w-full h-full">
        {children}
      </div>
    </div>
  );
};
