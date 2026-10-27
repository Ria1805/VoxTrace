import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileAudio,
  FileVideo,
  Play,
  RotateCcw,
  Radio,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  Hash,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { ElectricBorder } from '../components/reactbits/ElectricBorder';
import { FaultyTerminal, type LogEntry } from '../components/reactbits/FaultyTerminal';
import { RadialGauge } from '../components/common/RadialGauge';
import { DecryptedText } from '../components/reactbits/DecryptedText';
import { VerdictChip } from '../components/common/VerdictChip';
import { FadeContent } from '../components/reactbits/FadeContent';
import { Magnet } from '../components/reactbits/Magnet';
import { StarBorder } from '../components/reactbits/StarBorder';
import type { Verdict } from '../types';

export const LiveAnalysisPage: React.FC = () => {
  const { triggerRefresh } = useFX();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [observables, setObservables] = useState({ phone: '', domain: '', tts_tool: '' });
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [pipelineLogs, setPipelineLogs] = useState<LogEntry[]>([]);
  const [audioModelStatus, setAudioModelStatus] = useState<{
    available: boolean;
    version: string;
  } | null>(null);
  const [videoModelStatus, setVideoModelStatus] = useState<{
    available: boolean;
    version: string;
    reason: string | null;
  } | null>(null);

  // Analysis result state
  const [results, setResults] = useState<{
    audio_score: number | null;
    video_score: number | null;
    fused_score: number | null;
    verdict: Verdict;
    severity: string;
    actions: string[];
    evidence_sha256: string[];
    record_hash: string;
    ioc_matches: Array<{ type: string; value: string; source?: string; tag?: string }>;
    video_details?: {
      status: string;
      p_fake: number | null;
      n_frames: number;
      model_version: string;
      error: string | null;
    } | null;
    warnings?: string[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/status')
      .then((response) => response.json())
      .then((data) => {
        if (active) {
          setAudioModelStatus(data.audio);
          setVideoModelStatus(data.video);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAudioModelStatus({
            available: false,
            version: error instanceof Error ? error.message : 'unavailable',
          });
          setVideoModelStatus({
            available: false,
            version: 'unavailable',
            reason: error instanceof Error ? error.message : 'Could not read video model status.',
          });
        }
      });
      return () => { active = false; };
  }, []);

  const addLog = (step: string, message: string, level: LogEntry['level'] = 'info', hash?: string) => {
    const time = new Date().toLocaleTimeString();
    setPipelineLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        timestamp: time,
        step,
        message,
        level,
        hash,
      },
    ]);
  };

  const handleRunAnalysis = async () => {
    if (!audioFile && !videoFile) return;

    setIsAnalyzing(true);
    setResults(null);
    setPipelineLogs([]);

    // Sequential simulation of pipeline steps in Faulty Terminal
    addLog('RECEIPT', 'Ingesting evidence payload. Initializing pre-scoring cryptographic pipeline.', 'info');

    addLog('HASH_ON_RECEIPT', 'Computing SHA-256 for all uploaded files before passing to detector models...', 'info');

    const formData = new FormData();
    if (audioFile) formData.append('audio', audioFile);
    if (videoFile) formData.append('video', videoFile);
    const observableValues = Object.fromEntries(
      Object.entries(observables).map(([type, value]) => [
        type,
        value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
      ]),
    );
    formData.append('observables', JSON.stringify(
      Object.fromEntries(Object.entries(observableValues).filter(([, values]) => values.length > 0)),
    ));

    try {
      const response = await apiFetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const data = await response.json();

      // Step-by-step logs
      if (data.evidence_sha256?.[0]) {
        addLog('SHA256_VERIFIED', `Pre-scoring evidence hash locked: ${data.evidence_sha256[0]}`, 'success', data.evidence_sha256[0]);
      }

      if (data.audio_score !== null) {
        addLog('AUDIO_DETECTOR', `Librosa MFCC extraction finished. Acoustic P(fake): ${(data.audio_score * 100).toFixed(1)}%`, 'info');
      } else {
        addLog('AUDIO_DETECTOR', 'Audio missing, unreadable, or model not trained. UNSCORED.', 'warn');
      }

      if (data.video_score !== null) {
        const frames = data.video_details?.n_frames;
        addLog('VIDEO_DETECTOR', `Video model P(fake): ${(data.video_score * 100).toFixed(1)}%${frames ? ` across ${frames} face frames` : ''}`, 'info');
      } else {
        addLog('VIDEO_DETECTOR', `UNSCORED: ${data.video_details?.error || 'Video missing, unreadable, no usable face, or model not trained.'}`, 'warn');
      }

      addLog('MULTI_MODAL_FUSION', `Normalizing modal weights. Fused Score: ${data.fused_score == null ? 'UNSCORED' : (data.fused_score * 100).toFixed(1) + '%'} -> Verdict: ${data.verdict}`, data.verdict === 'FAKE' ? 'crit' : 'success');

      addLog('THREAT_INTEL', `Checked indicators against local threat feeds. ${data.ioc_matches?.length || 0} IOC hits found.`, 'info');

      addLog('PLAYBOOK', `Playbook triggered: Severity [${data.severity}] with ${data.actions?.length || 0} response actions.`, 'info');

      addLog('LEDGER_WRITE', `Cryptographic hash chain updated. Record hash: ${data.record_hash?.substring(0, 24)}... (HMAC-SHA256 signed)`, 'success', data.record_hash);

      setResults(data);
      triggerRefresh();
    } catch (err: any) {
      addLog('PIPELINE_ERROR', err.message || 'Analysis failed', 'crit');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSimulateQuickFake = () => {
    // Quick demo preset
    const fakeAudio = new File(['VOXTRACE_SIMULATED_CEO_CLONE_WAV_BYTES'], 'synthetic_unscorable_test.wav', { type: 'audio/wav' });
    setAudioFile(fakeAudio);
    setVideoFile(null);
  };

  const handleSimulateUnscoredVideo = () => {
    // Unreadable video preset to prove the bug fix!
    const badVideo = new File(['CORRUPT_ZERO_FRAME_VIDEO_BYTES'], 'corrupt_feed_unreadable.mp4', { type: 'video/mp4' });
    setAudioFile(null);
    setVideoFile(badVideo);
  };

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Live monitor (pending)ing Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cyan-500/15">
        <div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            LIVE FORENSIC ANALYSIS
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Upload analysis returns detector, evidence, and ledger results when processing completes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="status" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0E1F] border border-cyan-500/30">
            <Radio className={`w-4 h-4 ${audioModelStatus?.available ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-xs font-mono font-medium text-slate-200">
              Audio model: {audioModelStatus ? (audioModelStatus.available ? 'READY' : 'NOT TRAINED') : 'CHECKING'}
            </span>
          </div>
          <div role="status" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0E1F] border border-cyan-500/30">
            <Radio className={`w-4 h-4 ${videoModelStatus?.available ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-xs font-mono font-medium text-slate-200">
              Video model: {videoModelStatus ? (videoModelStatus.available ? 'READY' : 'NOT TRAINED') : 'CHECKING'}
            </span>
          </div>
        </div>
      </div>
      {videoModelStatus && !videoModelStatus.available && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs font-mono text-amber-200">
          Video clips are accepted, but video scores remain UNSCORED until trained weights are installed.
          {videoModelStatus.reason && <span className="block mt-1 text-amber-300/80">{videoModelStatus.reason}</span>}
          <span className="block mt-1 text-slate-400">The downloaded 10-clip preview is for inspection only; it is not used to train or validate this model.</span>
        </div>
      )}

      {/* Main Analysis Section: Drag & Drop + Faulty Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Ingestion Zone with Electric Border */}
        <div className="lg:col-span-5 space-y-4">
          <ElectricBorder active={isAnalyzing}>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-cyan-400" />
                  EVIDENCE INGESTION ZONE
                </span>
                <span className="text-[10px] font-mono text-cyan-400">/analyze</span>
              </div>

              {/* Audio Upload Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
                    Audio Modality (.wav, .mp3, .flac)
                  </span>
                  {audioFile && <span className="text-emerald-400 text-[10px]">READY</span>}
                </label>
                <div className="relative border border-dashed border-slate-700 hover:border-cyan-400/60 rounded-xl p-3 bg-[#030611] transition-colors text-center cursor-pointer">
                  <input
                    type="file" aria-label="Audio recording"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="text-xs text-slate-400 font-mono truncate">
                    {audioFile ? audioFile.name : 'Select or drag audio track'}
                  </div>
                </div>
              </div>

              {/* Video Upload Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileVideo className="w-3.5 h-3.5 text-violet-400" />
                    Video Modality (.mp4, .avi, .mov)
                  </span>
                  {videoFile && <span className="text-emerald-400 text-[10px]">READY</span>}
                </label>
                <div className="relative border border-dashed border-slate-700 hover:border-violet-400/60 rounded-xl p-3 bg-[#030611] transition-colors text-center cursor-pointer">
                  <input
                    type="file" aria-label="Video recording"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="text-xs text-slate-400 font-mono truncate">
                    {videoFile ? videoFile.name : 'Select or drag video clip (optional for fusion)'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-cyan-500/10 pt-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Optional IOC observables
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Enter values from call metadata; separate multiple values with commas.
                  </span>
                </div>
                {([
                  ['phone', 'Phone observable'],
                  ['domain', 'Domain observable'],
                  ['tts_tool', 'Claimed TTS tool'],
                ] as const).map(([type, label]) => (
                  <label key={type} className="block">
                    <span className="sr-only">{label}</span>
                    <input
                      type="text"
                      aria-label={label}
                      value={observables[type]}
                      onChange={(event) => setObservables((current) => ({ ...current, [type]: event.target.value }))}
                      placeholder={`${label} (optional)`}
                      className="w-full rounded-lg border border-slate-800 bg-[#030611] px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/60 focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              {/* Quick Demo Sample Presets */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Demo Fast-Presets:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSimulateQuickFake}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono hover:bg-rose-500/20 text-left transition-colors"
                  >
                    Synthetic Audio (Unscored Test)
                  </button>
                  <button
                    onClick={handleSimulateUnscoredVideo}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono hover:bg-amber-500/20 text-left transition-colors"
                  >
                    Corrupt Video (Unscored Test)
                  </button>
                </div>
              </div>

              {/* Analyze Execution Button */}
              <Magnet className="w-full pt-2">
                <StarBorder
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || (!audioFile && !videoFile)}
                  className="w-full"
                >
                  <div className="flex items-center justify-center gap-2 font-orbitron font-bold tracking-wider py-1 text-cyan-300">
                    <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                    <span>{isAnalyzing ? 'RUNNING FORENSIC PIPELINE...' : 'EXECUTE ANALYSIS'}</span>
                  </div>
                </StarBorder>
              </Magnet>
            </div>
          </ElectricBorder>
        </div>

        {/* Right Column (7 cols): Faulty Terminal Output */}
        <div className="lg:col-span-7">
          <FaultyTerminal logs={pipelineLogs} isRunning={isAnalyzing} />
        </div>
      </div>

      {/* Results Section: 3 Radial Gauges & Verdict Banner */}
      {results && (
        <FadeContent>
          <div className="p-6 rounded-2xl glass-panel space-y-6">
            {/* Verdict Banner */}
            <div
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md ${
                results.verdict === 'FAKE'
                  ? 'bg-rose-950/40 border-rose-500/50 glow-fake'
                  : results.verdict === 'REAL'
                  ? 'bg-emerald-950/40 border-emerald-500/50 glow-real'
                  : 'bg-amber-950/40 border-amber-500/50 glow-unscored'
              }`}
            >
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="p-3 rounded-xl bg-black/40">
                  {results.verdict === 'FAKE' ? (
                    <AlertOctagon className="w-8 h-8 text-rose-400" />
                  ) : results.verdict === 'REAL' ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <HelpCircle className="w-8 h-8 text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300 uppercase tracking-widest">
                    Multi-Modal Forensic Verdict
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-orbitron tracking-wide text-white">
                    {results.verdict === 'FAKE'
                      ? 'SYNTHETIC CLONE DETECTED'
                      : results.verdict === 'REAL'
                      ? 'MODEL LABEL: REAL (REVIEW REQUIRED)'
                      : 'UNSCORED — INSUFFICIENT OR UNREADABLE MEDIA'}
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-1">
                    Playbook Action Level: <span className="font-bold text-cyan-300">{results.severity}</span>
                  </div>
                </div>
              </div>

              <VerdictChip verdict={results.verdict} size="lg" />
            </div>

            {/* 3 Radial Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Gauge 1: Audio */}
              <div className="p-4 rounded-xl bg-[#030612]/70 border border-slate-800 text-center">
                <RadialGauge
                  score={results.audio_score}
                  label="Audio P(fake)"
                  sublabel={results.audio_score !== null ? 'Librosa Logistic Model' : 'No audio input'}
                  size={160}
                />
                {results.audio_score === null && (
                  <div className="text-[11px] font-mono text-amber-400 mt-2 bg-amber-950/30 py-1 px-2 rounded">
                    fused using video only
                  </div>
                )}
              </div>

              {/* Gauge 2: Video */}
              <div className="p-4 rounded-xl bg-[#030612]/70 border border-slate-800 text-center">
                <RadialGauge
                  score={results.video_score}
                  label="Video P(fake)"
                  sublabel={results.video_score !== null ? 'Face crops · EfficientNet-B0' : 'No video or unreadable'}
                  size={160}
                />
                {results.video_score === null && (
                  <div className="text-[11px] font-mono text-amber-400 mt-2 bg-amber-950/30 py-1 px-2 rounded">
                    fused using audio only
                  </div>
                )}
              </div>

              {/* Gauge 3: Fused */}
              <div className="p-4 rounded-xl bg-[#030612]/70 border border-cyan-500/30 text-center glow-cyan">
                <RadialGauge
                  score={results.fused_score}
                  label="Multi-Modal Fused"
                  sublabel="Renormalized Dynamic Combination"
                  size={160}
                  isPrimary={true}
                />
                <div className="text-[11px] font-mono text-cyan-300 mt-2 bg-cyan-950/40 py-1 px-2 rounded border border-cyan-500/20">
                  {results.fused_score !== null
                    ? `Final Decision Score: ${(results.fused_score * 100).toFixed(1)}%`
                    : 'Modality missing/unreadable'}
                </div>
              </div>
            </div>

            {/* Evidence Hash Decrypted Text Reveal */}
            {results.video_details && (
              <div role="status" className={`rounded-xl border px-4 py-3 text-xs font-mono ${
                results.video_details.p_fake === null
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                  : 'border-cyan-500/20 bg-cyan-950/20 text-cyan-200'
              }`}>
                {results.video_details.p_fake === null
                  ? `VIDEO UNSCORED: ${results.video_details.error || 'No video score was produced.'}`
                  : `Video analyzed across ${results.video_details.n_frames} face frames using ${results.video_details.model_version}. Scores are not calibrated research results.`}
              </div>
            )}
            {results.warnings && results.warnings.length > 0 && (
              <div className="space-y-1 text-xs font-mono text-amber-300">
                {results.warnings.map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}
              </div>
            )}

            {/* Evidence Hash Decrypted Text Reveal */}
            <div className="p-4 rounded-xl bg-[#030612] border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <Hash className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-400">EVIDENCE SHA-256:</span>
                <span className="text-cyan-300 font-bold break-all">
                  <DecryptedText
                    text={results.evidence_sha256?.[0] || results.record_hash}
                    speed={20}
                  />
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
                <span>SIGNED TO LEDGER (SEQ RECORD)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-[#030612]/70 p-4 space-y-2">
                <h3 className="text-xs font-orbitron font-bold text-cyan-300">IOC MATCHES</h3>
                {results.ioc_matches.length ? results.ioc_matches.map((match, index) => (
                  <div key={`${match.type}-${match.value}-${index}`} className="text-xs font-mono text-slate-300">
                    <span className="text-violet-300">{match.type}</span>: {match.value}
                    {match.tag && <span className="ml-2 text-slate-500">[{match.tag}]</span>}
                  </div>
                )) : <p className="text-xs font-mono text-slate-500">No local feed matches for the supplied observables.</p>}
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#030612]/70 p-4 space-y-2">
                <h3 className="text-xs font-orbitron font-bold text-cyan-300">RESPONSE PLAYBOOK</h3>
                {results.actions.map((action, index) => (
                  <p key={`${index}-${action}`} className="text-xs font-mono text-slate-300">{action}</p>
                ))}
              </div>
            </div>
          </div>
        </FadeContent>
      )}
    </div>
  );
};
