import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Volume2,
  Video,
  Layers,
  Lock,
  Flame,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Key,
  ShieldCheck,
  Eye,
  Sliders,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { FadeContent } from '../components/reactbits/FadeContent';
import { DecryptedText } from '../components/reactbits/DecryptedText';
import { VerdictChip } from '../components/common/VerdictChip';
import { StarBorder } from '../components/reactbits/StarBorder';
import type { Incident } from '../types';

export const CaseDetailPage: React.FC = () => {
  const { selectedCaseId, setSelectedCaseId, refreshTrigger } = useFX();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [gradCamActive, setGradCamActive] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  useEffect(() => {
    const idToFetch = selectedCaseId || 1;
    setLoading(true);
    apiFetch(`/api/incidents/${idToFetch}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setIncident(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedCaseId, refreshTrigger]);

  const handleExportBundle = async () => {
    if (!incident) return;
    try {
      const res = await apiFetch(`/api/evidence/bundle/${incident.seq}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VOXTRACE_EVIDENCE_BUNDLE_SEQ_${incident.seq}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifyStatus('CHECKING');
    try {
      const res = await apiFetch('/api/verify');
      const data = await res.json();
      if (data.chain_intact) {
        setVerifyStatus('INTACT');
      } else {
        setVerifyStatus('COMPROMISED');
      }
    } catch {
      setVerifyStatus('ERROR');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cyan-400 font-mono text-xs">
        LOADING FORENSIC DOSSIER...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 font-mono text-xs space-y-4">
        <span>No incident record selected.</span>
        <button
          onClick={() => setSelectedCaseId(1)}
          className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
        >
          Load Incident #1
        </button>
      </div>
    );
  }

  const isFake = incident.verdict === 'FAKE';

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              CASE FILE #{incident.seq}
            </span>
            <span className="text-xs font-mono text-slate-400">
              ACTOR: <span className="text-white font-semibold">{incident.actor}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            {incident.evidence_path.split(/[/\\]/).pop()}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <VerdictChip verdict={incident.verdict} size="lg" />

          <button
            onClick={handleVerifyIntegrity}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all ${
              verifyStatus === 'INTACT'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : verifyStatus === 'COMPROMISED'
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-bounce'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-500'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>{verifyStatus ? `STATUS: ${verifyStatus}` : 'Verify Integrity'}</span>
          </button>

          <StarBorder onClick={handleExportBundle} color="#00F0FF">
            <div className="flex items-center gap-2 text-cyan-300">
              <Download className="w-4 h-4" />
              <span>Export Evidence Bundle (JSON)</span>
            </div>
          </StarBorder>
        </div>
      </div>

      {/* Main Grid Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Audio & Video Panels */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Audio Forensics Panel */}
          <FadeContent delay={0.1}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  AUDIO MODALITY FORENSICS
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  Acoustic Score: {incident.audio_score !== null ? `${(incident.audio_score * 100).toFixed(1)}%` : 'UNSCORED'}
                </span>
              </div>

              {/* Suspicious Per-Segment Timeline */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                  <span>Suspicion Timeline Segments (0.5s windows):</span>
                  <span className="text-[10px] text-rose-400 font-semibold">
                    Red = Synthetic Artifacts Detected
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 h-16 bg-[#030611] p-2 rounded-xl border border-slate-800">
                  {incident.audio_timeline?.map((seg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col justify-end items-center rounded p-1 transition-all ${
                        seg.suspicious
                          ? 'bg-rose-500/25 border border-rose-500/50 glow-fake'
                          : 'bg-cyan-500/10 border border-cyan-500/20'
                      }`}
                    >
                      <span className={`text-[10px] font-mono font-bold ${seg.suspicious ? 'text-rose-400' : 'text-cyan-300'}`}>
                        {(seg.score * 100).toFixed(0)}%
                      </span>
                      <span className="text-[8px] font-mono text-slate-500">
                        {seg.start}s-{seg.end}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulated MFCC & Spectrogram Frequency View */}
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-slate-400">
                  Spectral Energy & Mel-Frequency Cepstral Coefficients (MFCC-20):
                </span>
                <div className="h-28 w-full rounded-xl bg-[#03050C] border border-cyan-500/20 p-2 flex items-end justify-between gap-1 overflow-hidden relative">
                  {/* Frequency bars */}
                  {Array.from({ length: 48 }).map((_, idx) => {
                    const h = isFake && idx > 18 && idx < 34 ? 85 + (idx % 4) * 3 : 20 + (idx % 7) * 9;
                    const isHighEnergyAnomaly = isFake && idx > 18 && idx < 34;
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${h}%`,
                          backgroundColor: isHighEnergyAnomaly ? '#FF0055' : '#00F0FF',
                          opacity: isHighEnergyAnomaly ? 0.9 : 0.45,
                        }}
                      />
                    );
                  })}
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-300 bg-black/60 px-2 py-0.5 rounded">
                    ILLUSTRATIVE WAVEFORM ? not extracted from evidence
                  </div>
                </div>
              </div>
            </div>
          </FadeContent>

          {/* 2. Video Forensics Panel */}
          <FadeContent delay={0.2}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Video className="w-4 h-4 text-violet-400" />
                  VIDEO MODALITY FORENSICS
                </span>
                <div className="flex items-center gap-3">
                  <button
                    disabled title="Grad-CAM is not implemented" onClick={() => setGradCamActive(false)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      gradCamActive
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Grad-CAM Overlay: {gradCamActive ? 'ON' : 'OFF'}</span>
                  </button>
                  <span className="text-xs font-mono text-violet-400">
                    Score: {incident.video_score !== null ? `${(incident.video_score * 100).toFixed(1)}%` : 'UNSCORED'}
                  </span>
                </div>
              </div>

              {/* Extracted Face-Crop Strip */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-slate-400">
                  MediaPipe Face Crops & EfficientNet-B0:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {incident.video_frames?.map((frame) => (
                    <div
                      key={frame.frame_id}
                      className="rounded-xl bg-[#030612] border border-slate-800 p-2 text-center space-y-1 relative overflow-hidden group"
                    >
                      {/* Simulated face avatar thumbnail with Grad-CAM heat */}
                      <div
                        className="w-full h-14 rounded-lg bg-slate-900 flex items-center justify-center relative overflow-hidden"
                        style={{
                          background: gradCamActive && isFake
                            ? 'radial-gradient(circle at 50% 60%, rgba(255, 0, 85, 0.6) 0%, rgba(0, 240, 255, 0.2) 70%, #030612 100%)'
                            : '#0E1326',
                        }}
                      >
                        <span className="text-[9px] font-mono text-slate-400">
                          F#{frame.frame_id}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-300">
                        {frame.timestamp}s
                      </div>
                      {/* Per-frame score bar */}
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${frame.fake_prob * 100}%`,
                            backgroundColor: frame.fake_prob >= 0.5 ? '#FF0055' : '#00F5A0',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeContent>

          {/* 3. Fusion Panel */}
          <FadeContent delay={0.3}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                MULTI-MODAL FUSION BREAKDOWN
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">WEIGHT CONFIGURATION</span>
                  <span className="text-white font-bold text-sm">
                    w_audio: {incident.fusion_breakdown?.w_audio ?? 0} | w_video: {incident.fusion_breakdown?.w_video ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">AUDIO CONTRIBUTION</span>
                  <span className="text-cyan-300 font-bold text-sm">
                    {incident.fusion_breakdown?.audio_contribution !== null
                      ? `${((incident.fusion_breakdown?.audio_contribution || 0) * 100).toFixed(1)}%`
                      : 'None (Unscored)'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">VIDEO CONTRIBUTION</span>
                  <span className="text-violet-300 font-bold text-sm">
                    {incident.fusion_breakdown?.video_contribution !== null
                      ? `${((incident.fusion_breakdown?.video_contribution || 0) * 100).toFixed(1)}%`
                      : 'None (Unscored)'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                <span className="text-cyan-400 font-bold">Fusion Logic: </span>
                {incident.fusion_breakdown?.rationale}
              </div>
            </div>
          </FadeContent>
        </div>

        {/* Right Column (4 cols): Evidence Cryptography & Threat Intel */}
        <div className="lg:col-span-4 space-y-6">
          {/* 4. Evidence Integrity Panel */}
          <FadeContent delay={0.2}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                EVIDENCE CUSTODY PROOF
              </span>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">RECORD HASH</span>
                  <span className="text-cyan-300 font-bold break-all text-[11px]">
                    <DecryptedText text={incident.record_hash} speed={25} />
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">PREVIOUS CHAIN HASH</span>
                  <span className="text-slate-400 break-all text-[11px]">
                    {incident.prev_hash}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">HMAC-SHA256 SIGNATURE</span>
                  <span className="text-violet-300 break-all text-[11px]">
                    {incident.signature}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-slate-500 text-[10px]">SIGNING KEY FINGERPRINT</span>
                  <span className="text-cyan-400 font-bold">{incident.key_fp}</span>
                </div>
              </div>
            </div>
          </FadeContent>

          {/* 5. Threat Intel & Playbook Panel */}
          <FadeContent delay={0.3}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                THREAT INTEL & PLAYBOOK
              </span>

              {/* IOC Matches */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-slate-400">Matched Threat Indicators:</span>
                {incident.ioc_matches && incident.ioc_matches.length > 0 ? (
                  incident.ioc_matches.map((ioc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#030612] border border-rose-500/30 text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-rose-400 font-bold uppercase">{ioc.type}</span>
                        <span className="text-[10px] text-slate-400">{ioc.source}</span>
                      </div>
                      <div className="text-white font-semibold truncate">{ioc.value}</div>
                      <div className="text-[10px] text-amber-300">Tag: {ioc.tag}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs font-mono text-slate-500 italic p-3 rounded-xl bg-slate-900/30">
                    No malicious IOC indicators correlated.
                  </div>
                )}
              </div>

              {/* Playbook Actions */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-mono text-slate-400">Playbook Actions Executed:</span>
                <div className="space-y-1.5">
                  {incident.playbook_actions?.map((act, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/40 p-2 rounded-lg border border-slate-800"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeContent>
        </div>
      </div>
    </div>
  );
};
