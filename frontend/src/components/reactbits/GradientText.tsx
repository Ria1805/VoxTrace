import React from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  className = '',
  colors = ['#00F0FF', '#A855F7', '#00F5A0', '#00F0FF'],
  animationSpeed = 6,
}) => {
  const gradientString = colors.join(', ');

  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-[length:300%_auto] animate-[gradient_6s_ease_infinite] font-semibold ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, ${gradientString})`,
        animationDuration: `${animationSpeed}s`,
      }}
    >
      {children}
    </span>
  );
};
