import { apiFetch } from '../../api';
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Sparkles,
  User,
  Activity,
  RotateCcw,
  LogOut,
} from 'lucide-react';
import { useFX } from '../../context/FXContext';
import { DecryptedText } from '../reactbits/DecryptedText';
import type { FXLevel, UserRole } from '../../types';

export const TopBar: React.FC = () => {
  const {
    fxLevel,
    setFxLevel,
    role,
    setRole,
    currentPage,
    setCurrentPage,
    tamperedState,
    refreshTrigger,
    triggerRefresh,
  } = useFX();

  const [keyFp, setKeyFp] = useState<string>('Unavailable');
  const [chainOk, setChainOk] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    apiFetch('/api/verify')
      .then((res) => res.json())
      .then((data) => {
        if (data.key_fp) setKeyFp(data.key_fp);
        setChainOk(data.chain_intact);
      })
      .catch(() => {});
  }, [refreshTrigger, tamperedState]);

  const handleQuickVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await apiFetch('/api/ledger/verify', { method: 'POST' });
      const data = await res.json();
      setChainOk(data.chain_intact);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  if (currentPage === 'landing') return null;

  return (
    <header className="sticky top-0 z-30 w-full bg-[#05070F]/85 backdrop-blur-md border-b border-cyan-500/15 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('dashboard')}>
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/40 glow-cyan">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron font-black text-sm tracking-widest text-slate-100">
                VOXTRACE
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                SOC-CORE
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-400 tracking-wider">
              FORENSIC COMMAND CENTER
            </div>
          </div>
        </div>

        {/* Middle telemetry pills */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
          {/* Key Fingerprint */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0A0E1F] border border-slate-700/60 text-slate-300">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">KEY_FP:</span>
            <DecryptedText text={keyFp} speed={25} className="text-cyan-300 font-bold" />
          </div>

          {/* Ledger Status Pill */}
          <button
            onClick={handleQuickVerify}
            disabled={isVerifying}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all ${
              chainOk
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse hover:bg-rose-500/30'
            }`}
          >
            {chainOk ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="font-semibold">
              {chainOk ? 'LEDGER: INTACT' : 'CHAIN COMPROMISED!'}
            </span>
            {isVerifying ? (
              <RotateCcw className="w-3 h-3 animate-spin text-slate-400" />
            ) : (
              <span className="text-[10px] text-slate-400 underline ml-1">Re-check</span>
            )}
          </button>
        </div>

        {/* Right side controls: FX level switch & Role selector */}
        <div className="flex items-center gap-3">
          {/* FX Level Switch */}
          <div className="flex items-center rounded-xl bg-[#0A0E1F] p-0.5 border border-slate-800 text-xs font-mono">
            <span className="px-2 text-[10px] text-slate-400 hidden sm:inline flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              FX:
            </span>
            {(['off', 'lite', 'max'] as FXLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFxLevel(level)}
                className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold tracking-wider transition-all ${
                  fxLevel === level
                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_#00F0FF]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* User Role Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0A0E1F] border border-slate-800 text-xs font-mono">
            <User className="w-3.5 h-3.5 text-violet-400" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="Analyst" className="bg-[#0A0E1F]">Analyst</option>
              <option value="Admin" className="bg-[#0A0E1F]">Admin</option>
              <option value="Auditor" className="bg-[#0A0E1F]">Auditor</option>
            </select>
          </div>

          {/* Exit / Landing */}
          <button
            onClick={() => setCurrentPage('landing')}
            title="Return to Landing"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
