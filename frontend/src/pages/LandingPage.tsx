import React from 'react';
import { Shield, Lock, Globe, Terminal, ArrowRight, UserCheck } from 'lucide-react';
import { useFX } from '../context/FXContext';
import { GalaxyBackground } from '../components/reactbits/GalaxyBackground';
import { SplitText } from '../components/reactbits/SplitText';
import { ShinyText } from '../components/reactbits/ShinyText';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { Magnet } from '../components/reactbits/Magnet';
import { StarBorder } from '../components/reactbits/StarBorder';
import type { UserRole } from '../types';

export const LandingPage: React.FC = () => {
  const { role, setRole, setCurrentPage } = useFX();

  const handleEnter = () => {
    setCurrentPage('dashboard');
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#05070F] text-slate-100 selection:bg-cyan-500/30">
      {/* Dynamic Galaxy Background */}
      <GalaxyBackground />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center glow-cyan">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <span className="font-orbitron font-extrabold text-base tracking-widest text-white">
              VOXTRACE
            </span>
            <span className="block text-[10px] font-mono text-cyan-400 tracking-wider">
              DFIR + THREAT-INTEL FORENSIC PIPELINE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ACADEMIC PROTOTYPE</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10 flex flex-col items-center text-center">
        {/* Animated Title */}
        <div className="mb-3">
          <h1 className="text-5xl sm:text-7xl font-black font-orbitron tracking-tight text-white mb-2">
            <SplitText text="VoxTrace" delay={0.06} />
          </h1>
          <div className="text-lg sm:text-xl font-space font-medium tracking-wide">
            <ShinyText text="Detect. Preserve. Correlate." speed={3.5} />
          </div>
        </div>

        <p className="max-w-2xl text-slate-300 text-sm sm:text-base leading-relaxed mb-10">
          Multi-modal deepfake detection for synthetic voice and video scam calls, backed by an
          HMAC-signed, tamper-evident evidence log and local example-feed correlation.
        </p>

        {/* 3 Pillars: Spotlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mb-12">
          {/* Pillar 1 */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(0, 240, 255, 0.18)">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white mb-2">
              Deepfake Detection
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Audio-first Librosa classifier with supplied held-out evaluation scores, plus MediaPipe/EfficientNet video code. Video weights and independent source-dataset reproduction are unavailable.
            </p>
            <div className="mt-4 text-[10px] font-mono text-cyan-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Multi-Modal Telephony Baseline</span>
            </div>
          </SpotlightCard>

          {/* Pillar 2 */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(168, 85, 247, 0.18)">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mb-4 text-violet-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white mb-2">
              Forensic Evidence Log
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cryptographic SHA-256 hash chaining, isolated HMAC-SHA256 signatures, signed anchor heads,
              and local event-log cross-checks. Off-host SIEM anchoring remains pending.
            </p>
            <div className="mt-4 text-[10px] font-mono text-violet-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span>SHA-256 & HMAC evidence records</span>
            </div>
          </SpotlightCard>

          {/* Pillar 3 */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(0, 245, 160, 0.18)">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-orbitron font-bold text-base text-white mb-2">
              Threat Intelligence
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Local example-feed indicator matching with recorded response recommendations. Real OSINT feeds and online enrichment remain pending.
            </p>
            <div className="mt-4 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Wazuh integration pending</span>
            </div>
          </SpotlightCard>
        </div>

        {/* Login & Role Selection Box */}
        <div className="w-full max-w-md p-6 rounded-2xl bg-[#0A0E1F]/90 border border-cyan-500/30 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              Workspace role (UI only)
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              LOCAL PROTOTYPE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {(['Analyst', 'Admin', 'Auditor'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all ${
                  role === r
                    ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_#00F0FF]'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <Magnet className="w-full">
            <StarBorder
              onClick={handleEnter}
              color="#00F0FF"
              className="w-full"
            >
              <div className="flex items-center justify-center gap-2 font-orbitron font-bold tracking-wider py-1">
                <span>ENTER COMMAND CENTER</span>
                <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </StarBorder>
          </Magnet>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs font-mono text-slate-300 border-t border-slate-900/80">
        VoxTrace Project Team: Ria, Bhavika, Shaurya, Harshita, Tanay • College Cybersecurity Research
      </footer>
    </div>
  );
};
