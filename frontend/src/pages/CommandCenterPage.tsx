import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Flame,
  CheckCircle,
  AlertTriangle,
  Radio,
  Clock,
  ArrowUpRight,
  Database,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import { useFX } from '../context/FXContext';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { CountUp } from '../components/reactbits/CountUp';
import { FadeContent } from '../components/reactbits/FadeContent';
import { CyberGridBackground } from '../components/reactbits/CyberGridBackground';
import { VerdictChip } from '../components/common/VerdictChip';
import type { Incident, SystemMetrics } from '../types';

export const CommandCenterPage: React.FC = () => {
  const { setCurrentPage, setSelectedCaseId, refreshTrigger } = useFX();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [preview, setPreview] = useState<{
    dataset: string;
    license: string;
    purpose: string;
    total_videos: number;
    classes: Array<{ label: string; count: number; files: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      const previewRequest = apiFetch('/api/dataset/preview')
        .then((r) => r.json())
        .catch((err: unknown) => {
          console.error(err);
          if (active) {
            setPreview(null);
            setPreviewError(err instanceof Error ? err.message : 'Dataset inventory unavailable.');
          }
          return null;
        });
      Promise.all([
        apiFetch('/api/metrics').then((r) => r.json()),
        apiFetch('/api/incidents?limit=10').then((r) => r.json()),
        previewRequest,
      ])
        .then(([m, inc, dataset]) => {
          if (!active) return;
          setMetrics(m);
          setIncidents(inc);
          if (dataset) {
            setPreview(dataset);
            setPreviewError(null);
          }
          setDashboardError(null);
        })
        .catch((err: unknown) => {
          console.error(err);
          if (active) setDashboardError(err instanceof Error ? err.message : 'Dashboard data unavailable.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refresh();
    const interval = window.setInterval(refresh, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshTrigger]);

  const handleSelectCase = (seq: number) => {
    setSelectedCaseId(seq);
    setCurrentPage('case_detail');
  };

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Sci-Fi Grid Background */}
      <CyberGridBackground />

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-cyan-500/15">
        <div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            COMMAND CENTER
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Real-time forensic telemetry, threat indicators, and cryptographic ledger verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage('live')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 text-xs font-mono font-semibold transition-all glow-cyan"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>OPEN LIVE ANALYSIS DEMO</span>
          </button>
        </div>
      </div>

      {dashboardError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-xs font-mono text-rose-200">
          Could not load dashboard data: {dashboardError}
        </div>
      )}

      {/* Row 1: KPI Count Up Tiles */}
      <FadeContent delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Tile 1: Samples Analysed */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(0, 240, 255, 0.15)">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Samples Analysed</span>
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-white">
              {metrics ? <CountUp to={metrics.samples_analyzed} /> : '?'}
            </div>
            <div className="text-[10px] font-mono text-cyan-400/80 mt-1">Multi-modal audio/video</div>
          </SpotlightCard>

          {/* Tile 2: Fakes Flagged */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(255, 0, 85, 0.15)">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Fakes Flagged</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-rose-400 text-glow-fake">
              {metrics ? <CountUp to={metrics.fakes_flagged} /> : '?'}
            </div>
            <div className="text-[10px] font-mono text-rose-400/80 mt-1">Model flags requiring review</div>
          </SpotlightCard>

          {/* Tile 3: Open Incidents */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(245, 158, 11, 0.15)">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Open Incidents</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-amber-300">
              {metrics ? <CountUp to={metrics.open_incidents} /> : '?'}
            </div>
            <div className="text-[10px] font-mono text-amber-400/80 mt-1">High/Critical severity triage</div>
          </SpotlightCard>

          {/* Tile 4: Ledger Integrity */}
          <SpotlightCard className="glass-panel" spotlightColor="rgba(0, 245, 160, 0.15)">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">Ledger Integrity</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-orbitron font-black text-emerald-400 flex items-center gap-1.5 text-glow-real">
              <span>✔</span>
              <span>{metrics ? metrics.ledger_integrity ? 'VERIFIED' : 'FAILED' : 'UNKNOWN'}</span>
            </div>
            <div className="text-[10px] font-mono text-emerald-400/80 mt-1">Latest ledger check</div>
          </SpotlightCard>

          {/* Tile 5: IOC Matches */}
          <SpotlightCard className="glass-panel col-span-2 md:col-span-1" spotlightColor="rgba(168, 85, 247, 0.15)">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">IOC Matches Today</span>
              <Flame className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-violet-300">
              {metrics ? <CountUp to={metrics.ioc_matches_today} /> : '?'}
            </div>
            <div className="text-[10px] font-mono text-violet-400/80 mt-1">Domains, caller IDs, TTS tools</div>
          </SpotlightCard>
        </div>
      </FadeContent>

      {/* Row 2: Charts (Fused Distribution & Detections over Time) */}
      <FadeContent delay={0.2}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fused Score Distribution */}
          <div className="p-5 rounded-2xl glass-panel">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-orbitron font-bold text-sm text-slate-100">
                  FUSED-SCORE DISTRIBUTION
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Confidence histogram across analyzed multi-modal samples
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Threshold: 0.50
              </span>
            </div>
            <div className="h-56 w-full relative">
              {metrics && metrics.samples_analyzed > metrics.unscored_count ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.fused_score_distribution.filter((item) => item.count > 0)}>
                  <XAxis dataKey="range" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A0E1F',
                      borderColor: '#00F0FF40',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" fill="#00F0FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center font-mono text-xs text-slate-400">
                  <span>{loading ? 'Loading analysis records…' : 'No scored samples yet.'}</span>
                  <span className="text-[10px] text-slate-500">Unscored uploads are not included in this histogram.</span>
                </div>
              )}
            </div>
          </div>

          {/* Detections Over Time */}
          <div className="p-5 rounded-2xl glass-panel">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-orbitron font-bold text-sm text-slate-100">
                  DETECTIONS OVER TIME
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Recorded model labels by UTC day
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Fakes
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Reals
                </span>
              </div>
            </div>
            <div className="h-56 w-full relative">
              {metrics && metrics.detections_over_time.some((item) => item.fakes + item.reals > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.detections_over_time}>
                  <defs>
                    <linearGradient id="colorFakes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF0055" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF0055" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorReals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00F5A0" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A0E1F',
                      borderColor: '#00F0FF40',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fakes"
                    stroke="#FF0055"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFakes)"
                  />
                  <Area
                    type="monotone"
                    dataKey="reals"
                    stroke="#00F5A0"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorReals)"
                  />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center font-mono text-xs text-slate-400">
                  <span>{loading ? 'Loading analysis records…' : 'No scored detections yet.'}</span>
                  <span className="text-[10px] text-slate-500">
                    {metrics?.unscored_count
                      ? `${metrics.unscored_count} upload(s) recorded as unscored.`
                      : 'Upload media to create analysis records; charts update automatically.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeContent>

      <FadeContent delay={0.25}>
        <div className="p-5 rounded-2xl glass-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-orbitron font-bold text-sm text-slate-100">DOWNLOADED VIDEO PREVIEW INVENTORY</h3>
              <p className="text-[11px] font-mono text-slate-400">
                Dataset files on disk, not detector predictions or evaluation results
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              INSPECTION ONLY · {preview?.license || 'CHECKING'}
            </span>
          </div>
          {preview ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {preview.classes.map((item) => (
                  <div key={item.label} className="rounded-xl bg-[#030712]/60 border border-slate-800 p-3">
                    <div className="text-[10px] font-mono uppercase text-slate-400">{item.label} clips</div>
                    <div className="text-2xl font-orbitron font-bold text-cyan-300">{item.count}</div>
                  </div>
                ))}
                <div className="rounded-xl bg-[#030712]/60 border border-slate-800 p-3">
                  <div className="text-[10px] font-mono uppercase text-slate-400">Total files</div>
                  <div className="text-2xl font-orbitron font-bold text-white">{preview.total_videos}</div>
                </div>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={preview.classes}>
                    <XAxis dataKey="label" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis allowDecimals={false} stroke="#64748B" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0A0E1F',
                        borderColor: '#00F0FF40',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="count" name="Downloaded clips" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-[10px] font-mono text-amber-200/80">{preview.purpose}</p>
            </>
          ) : (
            <div className="py-8 text-center font-mono text-xs text-slate-400">
              {loading ? 'Loading local dataset inventory…' : previewError || 'Dataset inventory is unavailable.'}
            </div>
          )}
        </div>
      </FadeContent>

      {/* Row 3: Live Detection Feed */}
      <FadeContent delay={0.3}>
        <div className="p-5 rounded-2xl glass-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <h3 className="font-orbitron font-bold text-base text-white">
                LIVE FORENSIC DETECTION FEED
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage('incidents')}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>View All In Incident DB</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {incidents.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-[#030712]/60 px-4 py-8 text-center font-mono text-xs text-slate-400">
                {loading ? 'Loading incidents…' : 'No analysis records yet. Upload audio or video in Live Analysis to populate this feed.'}
              </div>
            )}
            {incidents.slice(0, 5).map((inc) => (
              <div
                key={inc.seq}
                onClick={() => handleSelectCase(inc.seq)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#030712]/60 border border-slate-800/80 hover:border-cyan-500/40 hover:bg-[#0A0E1F] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded">
                    #{inc.seq}
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-slate-200 font-semibold truncate group-hover:text-cyan-300 transition-colors">
                      {inc.evidence_path.split(/[/\\]/).pop()}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date((inc.ts || Date.now() / 1000) * 1000).toLocaleTimeString()}
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[140px]">SHA: {inc.evidence_sha256?.substring(0, 12)}...</span>
                      <span>•</span>
                      <span className="text-cyan-400">{inc.actor}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <div className="text-right font-mono text-xs">
                    <span className="text-slate-400 text-[10px] block">Fused Score</span>
                    <span className="font-bold text-white">
                      {inc.fused_score !== null ? `${(inc.fused_score * 100).toFixed(1)}%` : 'UNSCORED'}
                    </span>
                  </div>
                  <VerdictChip verdict={inc.verdict} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeContent>

      {/* Row 4: System Health Strip */}
      <FadeContent delay={0.4}>
        <div className="p-4 rounded-xl bg-[#0A0E1F]/90 border border-cyan-500/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">API Gateway:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {metrics?.system_health.api || 'OPERATIONAL'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Audio Model:</span>
              <span className="text-cyan-300 font-semibold">
                {metrics?.system_health.model_audio || 'audio-baseline-0.1'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Video Model:</span>
              <span className="text-cyan-300 font-semibold">
                {metrics?.system_health.model_video || 'video-PLACEHOLDER-0.0'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Wazuh SIEM:</span>
              <span className="text-emerald-300 font-semibold">
                {metrics?.system_health.wazuh_agent || 'NOT VERIFIED'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Ledger Head:</span>
              <span className="text-violet-300 font-semibold">
                {metrics?.system_health.ledger || 'SYNCHRONIZED (WAL)'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Node: <span className="text-cyan-400">voxtrace-sensor-gateway-01</span>
          </div>
        </div>
      </FadeContent>
    </div>
  );
};
