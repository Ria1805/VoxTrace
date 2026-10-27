import React from 'react';
import { useFX } from '../../context/FXContext';

interface ShinyTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  className = '',
  speed = 3,
}) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  if (isOff) {
    return <span className={`text-slate-300 ${className}`}>{text}</span>;
  }

  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-[linear-gradient(110deg,#94A3B8,45%,#00F0FF,55%,#94A3B8)] bg-[length:250%_100%] animate-[shine_4s_linear_infinite] ${className}`}
      style={{ animationDuration: `${speed}s` }}
    >
      {text}
    </span>
  );
};
