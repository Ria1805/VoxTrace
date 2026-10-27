import React, { useEffect, useRef } from 'react';
import { Terminal, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFX } from '../../context/FXContext';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'success' | 'crit';
  step: string;
  message: string;
  hash?: string;
}

interface FaultyTerminalProps {
  logs: LogEntry[];
  title?: string;
  isRunning?: boolean;
}

export const FaultyTerminal: React.FC<FaultyTerminalProps> = ({
  logs,
  title = 'FORENSIC_PIPELINE_ORCHESTRATOR.SYS',
  isRunning = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="relative rounded-2xl bg-[#03050B] border border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.08)] font-mono text-xs">
      {/* Scanline CRT overlay */}
      {!isOff && <div className="absolute inset-0 scanlines opacity-40 pointer-events-none z-20" />}

      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#080C1D] border-b border-cyan-500/20 text-slate-300">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-cyan-200 tracking-wider text-[11px]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>PIPELINE RUNNING</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={containerRef}
        className="p-4 space-y-2 h-[260px] overflow-y-auto overflow-x-hidden relative z-10 scrollbar-thin"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 italic flex items-center gap-2 py-4">
            <Shield className="w-4 h-4 text-slate-600" />
            <span>Awaiting input files. Drop audio or video above to trigger cryptographic forensic verification.</span>
          </div>
        ) : (
          logs.map((log) => {
            let color = 'text-slate-300';
            let prefix = '>>>';
            let Icon = Terminal;

            if (log.level === 'success') {
              color = 'text-emerald-400';
              prefix = '[OK]';
              Icon = CheckCircle2;
            } else if (log.level === 'warn') {
              color = 'text-amber-400';
              prefix = '[WARN]';
              Icon = AlertTriangle;
            } else if (log.level === 'crit') {
              color = 'text-rose-400 font-bold';
              prefix = '[ALERT]';
              Icon = AlertTriangle;
            }

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-600 shrink-0 text-[10px]">{log.timestamp}</span>
                <span className="text-cyan-400/80 shrink-0 text-[11px] font-semibold">{log.step}</span>
                <span className={`${color} break-all`}>
                  {prefix} {log.message}
                  {log.hash && (
                    <span className="block mt-0.5 text-[10px] text-cyan-300/70 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                      SHA256: {log.hash}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
        {isRunning && (
          <div className="flex items-center gap-2 text-cyan-400 pt-1">
            <span className="w-2 h-4 bg-cyan-400 animate-pulse" />
            <span className="text-[11px] text-slate-400">Executing model weights & hash integrity check...</span>
          </div>
        )}
      </div>
    </div>
  );
};
