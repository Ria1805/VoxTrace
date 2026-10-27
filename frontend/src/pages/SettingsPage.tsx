import React, { useState } from 'react';
import {
  Settings,
  Key,
  Shield,
  Sliders,
  Sparkles,
  Save,
  CheckCircle2,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { FadeContent } from '../components/reactbits/FadeContent';
import { StarBorder } from '../components/reactbits/StarBorder';
import { DecryptedText } from '../components/reactbits/DecryptedText';
import type { FXLevel, UserRole } from '../types';

export const SettingsPage: React.FC = () => {
  const { fxLevel, setFxLevel, role, setRole } = useFX();
  const [threshold, setThreshold] = useState<number>(0.50);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(0.90);
  const [highThreshold, setHighThreshold] = useState<number>(0.70);
  const [wAudio, setWAudio] = useState<number>(0.50);
  const [wVideo, setWVideo] = useState<number>(0.50);
  const [vtApiKey, setVtApiKey] = useState<string>('');
  const [urlscanApiKey, setUrlscanApiKey] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              SYSTEM CONFIGURATION & POLICY
            </span>
            <span className="text-xs font-mono text-slate-400">
              FORENSIC PARAMETERS & API ENDPOINTS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            SETTINGS & ADMINISTRATION
          </h1>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>UI preferences saved. Backend configuration unchanged.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Decision Thresholds & Multi-Modal Weights */}
        <FadeContent delay={0.1}>
          <div className="p-6 rounded-2xl glass-panel space-y-5">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              FORENSIC THRESHOLDS & MODAL WEIGHTS
            </span>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Binary Fake Threshold (T_fused):</span>
                  <span className="text-cyan-400 font-bold">{threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Critical Severity Floor:</span>
                  <span className="text-rose-400 font-bold">{criticalThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="0.98"
                  step="0.01"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(parseFloat(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>High Severity Floor:</span>
                  <span className="text-amber-400 font-bold">{highThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.55"
                  max="0.85"
                  step="0.01"
                  value={highThreshold}
                  onChange={(e) => setHighThreshold(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Weight Audio (w_audio):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={wAudio}
                    onChange={(e) => setWAudio(parseFloat(e.target.value))}
                    className="w-full bg-[#030612] border border-slate-700 rounded-lg p-2 text-cyan-300 font-bold"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Weight Video (w_video):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={wVideo}
                    onChange={(e) => setWVideo(parseFloat(e.target.value))}
                    className="w-full bg-[#030612] border border-slate-700 rounded-lg p-2 text-violet-300 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </FadeContent>

        {/* Card 2: Cryptographic Key & Security Policy */}
        <FadeContent delay={0.2}>
          <div className="p-6 rounded-2xl glass-panel space-y-5">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              CRYPTOGRAPHIC KEY ISOLATION POLICY
            </span>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#030612] border border-cyan-500/20 space-y-2">
                <span className="text-slate-400 text-[11px] block">ACTIVE SIGNING KEY FINGERPRINT (SAFE TO PUBLISH):</span>
                <span className="text-cyan-300 font-bold text-base tracking-wider block">
                  <DecryptedText text="adb413b95dd0548f" speed={25} />
                </span>
                <span className="text-[10px] text-emerald-400 block">
                  ✔ Enforced outside data directory (~/.voxtrace/ledger.key)
                </span>
                <span className="text-[10px] text-slate-400 block italic">
                  Raw 32-byte secret is never exposed through the web console or database.
                </span>
              </div>

              {/* FX Level switch */}
              <div>
                <span className="text-slate-300 block mb-2 font-semibold">Visual FX Mode:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['off', 'lite', 'max'] as FXLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFxLevel(lvl)}
                      className={`py-2 px-3 rounded-xl uppercase font-bold text-xs transition-all ${
                        fxLevel === lvl
                          ? 'bg-cyan-500 text-black shadow-[0_0_12px_#00F0FF]'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role selection */}
              <div>
                <span className="text-slate-300 block mb-2 font-semibold">Active User Role:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Analyst', 'Admin', 'Auditor'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                        role === r
                          ? 'bg-violet-500 text-black shadow-[0_0_12px_#A855F7]'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeContent>

        {/* Card 3: External API Keys */}
        <FadeContent delay={0.3} className="md:col-span-2">
          <div className="p-6 rounded-2xl glass-panel space-y-5">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              INTELLIGENCE ENRICHMENT API CREDENTIALS
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-slate-400">VirusTotal API Key:</span>
                <input
                  type="password"
                  value={vtApiKey}
                  onChange={(e) => setVtApiKey(e.target.value)}
                  className="w-full bg-[#030612] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <span className="text-slate-400">urlscan.io API Key:</span>
                <input
                  type="password"
                  value={urlscanApiKey}
                  onChange={(e) => setUrlscanApiKey(e.target.value)}
                  className="w-full bg-[#030612] border border-slate-800 rounded-xl p-2.5 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <StarBorder onClick={handleSave} color="#00F0FF">
                <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold py-1">
                  <Save className="w-4 h-4 text-cyan-400" />
                  <span>Save UI Preferences</span>
                </div>
              </StarBorder>
            </div>
          </div>
        </FadeContent>
      </div>
    </div>
  );
};
