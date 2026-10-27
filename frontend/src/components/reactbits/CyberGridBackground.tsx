import React from 'react';
import { useFX } from '../../context/FXContext';

export const CyberGridBackground: React.FC<{ dense?: boolean }> = ({ dense = false }) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Sci-fi grid texture */}
      <div className={`w-full h-full ${dense ? 'bg-cyber-grid-dense' : 'bg-cyber-grid'} opacity-60`} />

      {/* Laser scan line in Max FX mode */}
      {!isOff && fxLevel === 'max' && (
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-[scan_8s_linear_infinite]" />
      )}
    </div>
  );
};
