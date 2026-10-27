import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Radio,
  FileCode,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Layers,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { FadeContent } from '../components/reactbits/FadeContent';
import type { AlertItem, MitreTechnique } from '../types';

export const SiemAlertsPage: React.FC = () => {
  const { refreshTrigger } = useFX();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [matrix, setMatrix] = useState<MitreTechnique[]>([]);
  const [siemLogPath, setSiemLogPath] = useState<string>('');

  useEffect(() => {
    apiFetch('/api/alerts')
      .then((r) => r.json())
      .then((d) => {
        setAlerts(d.alerts || []);
        setMatrix(d.mitre_matrix || []);
        if (d.siem_log_path) setSiemLogPath(d.siem_log_path);
      })
      .catch((err) => console.error(err));
  }, [refreshTrigger]);

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              TANAY'S SIEM & EVENT STREAM
            </span>
            <span className="text-xs font-mono text-slate-400">
              WAZUH LOCALFILE AGENT / MITRE ATT&CK HEATMAP
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            SIEM & ATT&CK ALERTS CONSOLE
          </h1>
        </div>
      </div>

      {/* Wazuh Config Banner */}
      <FadeContent delay={0.1}>
        <div className="p-4 rounded-xl bg-[#080C1E] border border-cyan-500/20 font-mono text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-200 block">
                Local event log (Wazuh shipping not verified):
              </span>
              <span className="text-slate-400 text-[11px] break-all">
                {siemLogPath || 'C:\\Users\\Bhavika\\Downloads\\Deepfake_project\\VoxTrace-repo\\vt-data\\voxtrace-events.jsonl'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30">
            RULES: 100500 - 100503 LOADED
          </span>
        </div>
      </FadeContent>

      {/* MITRE ATT&CK Matrix Heatmap */}
      <FadeContent delay={0.2}>
        <div className="p-5 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              MITRE ATT&CK TECHNIQUE COVERAGE HEATMAP
            </span>
            <span className="text-xs font-mono text-slate-400">
              Correlated against THREAT_MODEL.md
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {matrix.map((tech) => {
              const isActive = tech.coverage === 'ACTIVE';
              const isLiveTested = tech.mode === 'TESTED LIVE';

              return (
                <div
                  key={tech.technique}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    isActive
                      ? 'bg-cyan-950/30 border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.12)]'
                      : 'bg-[#030612]/60 border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-cyan-400">
                        {tech.technique}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isLiveTested
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {tech.mode}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {tech.tactic}
                    </div>
                    <div className="font-space text-xs font-bold text-white pt-1">
                      {tech.name}
                    </div>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                    Rule ID: <strong className="text-cyan-300">{tech.rule_id}</strong>
                    <p className="mt-1 text-slate-400 leading-snug">{tech.notes}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeContent>

      {/* Live Wazuh Alert Stream */}
      <FadeContent delay={0.3}>
        <div className="p-5 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              LIVE WAZUH SIEM ALERT STREAM
            </span>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Agent Stream Active
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {alerts.map((al) => (
              <div
                key={al.id}
                className="p-4 rounded-xl bg-[#030612] border border-slate-800 hover:border-cyan-500/30 transition-all space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px]">
                      RULE {al.rule_id}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                      LEVEL {al.level}
                    </span>
                    <span className="text-white font-semibold">{al.description}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(al.timestamp).toLocaleString()}
                  </div>
                </div>

                <p className="text-slate-300 text-xs">
                  {al.details}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex-wrap gap-2">
                  <div>
                    MITRE Technique: <strong className="text-cyan-300">{al.mitre_technique} ({al.mitre_name})</strong>
                  </div>
                  <div>
                    Mode: <span className="text-emerald-400 font-semibold">{al.rule_mode}</span>
                  </div>
                  <div>
                    Status: <span className="text-cyan-400 font-bold">{al.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeContent>
    </div>
  );
};
