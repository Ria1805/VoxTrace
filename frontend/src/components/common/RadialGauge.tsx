import React from 'react';
import { useFX } from '../../context/FXContext';

interface RadialGaugeProps {
  score: number | null;
  label: string;
  sublabel?: string;
  size?: number;
  threshold?: number;
  isPrimary?: boolean;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  score,
  label,
  sublabel,
  size = 180,
  threshold = 0.5,
  isPrimary = false,
}) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  const isUnscored = score === null || score === undefined;
  const isFake = !isUnscored && score >= threshold;

  // Arc calculation
  const strokeWidth = isPrimary ? 12 : 9;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degree arc
  const val = isUnscored ? 0 : Math.min(Math.max(score, 0), 1);
  const strokeDashoffset = arcLength - arcLength * val;

  let color = '#F59E0B'; // amber for unscored
  let glowColor = 'rgba(245, 158, 11, 0.4)';

  if (!isUnscored) {
    if (isFake) {
      color = '#FF0055'; // hot magenta-red
      glowColor = 'rgba(255, 0, 85, 0.4)';
    } else {
      color = '#00F5A0'; // mint green
      glowColor = 'rgba(0, 245, 160, 0.4)';
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-135 origin-center"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#151C33"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Value Arc */}
          {!isUnscored && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: isOff ? 'none' : 'stroke-dashoffset 1s ease-out',
                filter: !isOff ? `drop-shadow(0 0 8px ${glowColor})` : 'none',
              }}
            />
          )}
        </svg>

        {/* Center Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {isUnscored ? (
            <div className="space-y-0.5">
              <span className="text-sm font-mono font-bold text-amber-400 tracking-wider">
                UNSCORED
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                No telemetry
              </span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div
                className="text-2xl sm:text-3xl font-black font-orbitron tracking-tight"
                style={{ color }}
              >
                {(score * 100).toFixed(1)}%
              </div>
              <span
                className="text-[10px] font-mono uppercase font-bold tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${color}20`,
                  color,
                  border: `1px solid ${color}40`,
                }}
              >
                {isFake ? 'P(FAKE)' : 'P(REAL)'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="text-center mt-1">
        <h4 className="text-xs sm:text-sm font-semibold text-slate-200 font-space tracking-wide">
          {label}
        </h4>
        {sublabel && (
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
};
