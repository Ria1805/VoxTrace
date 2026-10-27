import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  Key,
  Download,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { FadeContent } from '../components/reactbits/FadeContent';
import { DecryptedText } from '../components/reactbits/DecryptedText';
import { StarBorder } from '../components/reactbits/StarBorder';
import { VerdictChip } from '../components/common/VerdictChip';
import type { LedgerBlock, LedgerVerification } from '../types';

export const EvidenceLockerPage: React.FC = () => {
  const { tamperedState, setTamperedState, refreshTrigger, triggerRefresh } = useFX();
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [keyFp, setKeyFp] = useState<string>('Unavailable');
  const [verification, setVerification] = useState<LedgerVerification | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedIndex, setScannedIndex] = useState<number>(-1);
  const [tamperLoading, setTamperLoading] = useState<boolean>(false);

  const fetchLedger = () => {
    apiFetch('/api/ledger/chain')
      .then((r) => r.json())
      .then((data) => {
        setBlocks(data.blocks || []);
        if (data.key_fp) setKeyFp(data.key_fp);
      })
      .catch((err) => console.error(err));

    apiFetch('/api/verify')
      .then((r) => r.json())
      .then((data) => {
        setVerification(data);
        setTamperedState(!data.chain_intact);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchLedger();
  }, [refreshTrigger]);

  const handleVerifyLedgerScan = async () => {
    setIsScanning(true);
    setScannedIndex(0);

    for (let i = 0; i < blocks.length; i++) {
      setScannedIndex(i);
      await new Promise((r) => setTimeout(r, 250));
    }

    try {
      const res = await apiFetch('/api/ledger/verify', { method: 'POST' });
      const data = await res.json();
      setVerification(data);
      setTamperedState(!data.chain_intact);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
      setScannedIndex(-1);
    }
  };

  const handleToggleTamperDemo = async () => {
    setTamperLoading(true);
    const newTamperState = !tamperedState;
    try {
      const res = await apiFetch('/api/ledger/tamper-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tamper: newTamperState,
          seq: 2,
          tampered_value: 0.12,
        }),
      });
      const data = await res.json();
      setTamperedState(data.tampered);
      triggerRefresh();
      fetchLedger();
    } catch (err) {
      console.error(err);
    } finally {
      setTamperLoading(false);
    }
  };

  const handleExportBundle = async (seq: number) => {
    try {
      const res = await apiFetch(`/api/evidence/bundle/${seq}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VOXTRACE_SIGNED_BUNDLE_SEQ_${seq}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              CRYPTOGRAPHIC CHAIN OF CUSTODY
            </span>
            <span className="text-xs font-mono text-slate-400">
              TAMPER-EVIDENT EVIDENCE LOG (THREAT_MODEL MATRIX)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            EVIDENCE LOCKER
          </h1>
        </div>

        {/* Controls: Verify Ledger + Real Tamper Demo Switch */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Key Fingerprint Display */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0A0E1F] border border-cyan-500/30 text-xs font-mono">
            <Key className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">SIGNING_KEY_FP:</span>
            <span className="text-cyan-300 font-bold">
              <DecryptedText text={keyFp} speed={25} />
            </span>
          </div>

          {/* Real Tamper Demo Toggle */}
          <button
            disabled title="Disabled on the evidence ledger; use isolated tests for tamper demonstrations" onClick={handleToggleTamperDemo}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-xs font-bold transition-all ${
              tamperedState
                ? 'bg-rose-500/30 border border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(255,0,85,0.4)] animate-pulse'
                : 'bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>
              {tamperedState ? 'TAMPER ACTIVE ON SEQ #2 (CLICK TO RESTORE)' : 'TAMPER DEMO (ATTACK SEQ #2)'}
            </span>
          </button>

          {/* Block-by-block Verify Scan */}
          <StarBorder onClick={handleVerifyLedgerScan} disabled={isScanning} color="#00F0FF">
            <div className="flex items-center gap-2 text-cyan-300 py-0.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>{isScanning ? 'SCANNING CHAIN...' : 'Verify Ledger Scan'}</span>
            </div>
          </StarBorder>
        </div>
      </div>

      {/* Tamper Warning Banner if chain is broken */}
      {verification && !verification.chain_intact && (
        <FadeContent>
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500 flex items-center justify-between gap-4 text-rose-200 text-xs font-mono shadow-[0_0_25px_rgba(255,0,85,0.3)] animate-shake">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />
              <div>
                <span className="font-bold text-sm text-white block">
                  CHAIN INTEGRITY VIOLATION DETECTED!
                </span>
                <span>
                  {verification.problems.join(' • ')} (SQLite row modified without key HMAC signature re-computation)
                </span>
              </div>
            </div>
            <button
              disabled title="Disabled on the evidence ledger; use isolated tests for tamper demonstrations" onClick={handleToggleTamperDemo}
              className="px-3 py-1.5 rounded-lg bg-rose-500 text-black font-bold uppercase shrink-0 text-xs hover:bg-rose-400 transition-colors"
            >
              Repair Ledger
            </button>
          </div>
        </FadeContent>
      )}

      {/* Horizontal Linked Blocks Chain */}
      <FadeContent delay={0.1}>
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              HASH CHAIN TOPOLOGY (CHRONOLOGICAL SEQUENCES)
            </span>
            <span className="text-xs font-mono text-slate-400">
              Genesis: <span className="text-cyan-400">0000000000000000...</span>
            </span>
          </div>

          {/* Horizontal Scrollable Blocks Track */}
          <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-2 scrollbar-thin">
            {blocks.map((block, index) => {
              const isTamperedBlock = tamperedState && block.seq === 2;
              const isScanned = scannedIndex === index;
              const linkValid = !isTamperedBlock && (!verification || verification.chain_intact);

              return (
                <React.Fragment key={block.seq}>
                  {/* Block Card */}
                  <div
                    className={`relative shrink-0 w-72 p-4 rounded-2xl border backdrop-blur-md transition-all duration-300 ${
                      isTamperedBlock
                        ? 'bg-rose-950/50 border-rose-500 shadow-[0_0_25px_rgba(255,0,85,0.4)] animate-shake'
                        : isScanned
                        ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_#00F0FF]'
                        : 'bg-[#0A0E1F]/80 border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    {/* Block Header */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron font-bold text-xs text-white">
                          BLOCK #{block.seq}
                        </span>
                        {isTamperedBlock && (
                          <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-500/30 px-1.5 py-0.2 rounded">
                            TAMPERED
                          </span>
                        )}
                      </div>
                      <VerdictChip verdict={block.verdict} size="sm" showIcon={false} />
                    </div>

                    {/* Block Hashes */}
                    <div className="space-y-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500 block text-[9px]">RECORD_HASH</span>
                        <div className="text-cyan-300 font-bold truncate">
                          {block.record_hash}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[9px]">PREV_HASH</span>
                        <div className="text-slate-400 truncate">
                          {block.prev_hash}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Score: {block.fused_score !== null ? `${(block.fused_score * 100).toFixed(1)}%` : 'N/A'}</span>
                        <span>{new Date((block.ts || Date.now() / 1000) * 1000).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Export Bundle Button */}
                    <button
                      onClick={() => handleExportBundle(block.seq)}
                      className="mt-3 w-full py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 text-[10px] font-mono flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export Signed Bundle</span>
                    </button>
                  </div>

                  {/* Cryptographic Link Arrow between Blocks */}
                  {index < blocks.length - 1 && (
                    <div className="shrink-0 flex flex-col items-center justify-center px-1">
                      <div
                        className={`w-6 h-0.5 transition-all ${
                          tamperedState && (index === 0 || index === 1)
                            ? 'bg-rose-500 shadow-[0_0_8px_#FF0055]'
                            : 'bg-emerald-400 shadow-[0_0_8px_#00F5A0]'
                        }`}
                      />
                      <span className={`text-[9px] font-mono mt-1 ${
                        tamperedState && (index === 0 || index === 1) ? 'text-rose-400 font-bold' : 'text-emerald-400'
                      }`}>
                        {verification?.chain_intact ? 'VERIFIED' : 'NOT VERIFIED'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </FadeContent>

      {/* ISO/IEC 27037 & BSA 2023 s.63 DFIR Novelty Section */}
      <FadeContent delay={0.2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl glass-panel space-y-3 font-mono text-xs">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              EVIDENCE INTEGRITY ARCHITECTURE
            </span>
            <p className="text-slate-300 text-xs leading-relaxed">
              Evidence files are SHA-256 hashed before scoring and checked again at ledger write. Verification checks signed records and stored evidence; limitations are documented in THREAT_MODEL.md.
            </p>
            <div className="p-3 rounded-xl bg-[#030612] border border-cyan-500/20 text-cyan-300 text-[11px]">
              ✔ See the tested threat model and current pytest results
            </div>
          </div>

          <div className="p-5 rounded-2xl glass-panel space-y-3 font-mono text-xs">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-400" />
              EVIDENCE EXPORT LIMITATIONS
            </span>
            <p className="text-slate-300 text-xs leading-relaxed">
              JSON exports contain hashes, HMAC signatures and verification results. They are research records, not certificates of legal admissibility or non-repudiation. Independent off-host anchoring remains necessary.
            </p>
            <div className="p-3 rounded-xl bg-[#030612] border border-violet-500/20 text-violet-300 text-[11px]">
              ✔ Independent signing key isolation outside data repository
            </div>
          </div>
        </div>
      </FadeContent>
    </div>
  );
};
