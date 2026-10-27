import React, { useState, useRef } from 'react';
import { useFX } from '../../context/FXContext';

interface ElasticSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  label?: string;
  unit?: string;
  className?: string;
}

export const ElasticSlider: React.FC<ElasticSliderProps> = ({
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
  label,
  unit = '',
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  const updateFromPosition = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rawRatio = (clientX - rect.left) / rect.width;
    const clampedRatio = Math.max(0, Math.min(1, rawRatio));
    const rawVal = min + clampedRatio * (max - min);
    const steppedVal = Math.round(rawVal / step) * step;
    onChange(Number(steppedVal.toFixed(2)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateFromPosition(e.clientX);
    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateFromPosition(moveEvent.clientX);
    };
    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className={`space-y-2 select-none ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-400">{label}</span>
          <span className="text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
            {value.toFixed(2)} {unit}
          </span>
        </div>
      )}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative h-6 w-full cursor-pointer flex items-center group touch-none"
      >
        {/* Track background */}
        <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-700/60 overflow-hidden relative">
          {/* Active fill */}
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-100 border-2 border-cyan-400 shadow-[0_0_12px_#00F0FF] transition-transform ${
            isDragging ? 'scale-125' : (!isOff ? 'group-hover:scale-110' : '')
          }`}
          style={{ left: `${percentage}%` }}
        >
          <div className="absolute inset-1 rounded-full bg-cyan-500" />
        </div>
      </div>
    </div>
  );
};
