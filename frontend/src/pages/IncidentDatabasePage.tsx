import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Filter,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { GlareHover } from '../components/reactbits/GlareHover';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { VerdictChip } from '../components/common/VerdictChip';
import { FadeContent } from '../components/reactbits/FadeContent';
import type { Incident } from '../types';

export const IncidentDatabasePage: React.FC = () => {
  const { setSelectedCaseId, setCurrentPage, refreshTrigger } = useFX();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  useEffect(() => {
    setLoading(true);
    let url = '/api/incidents?limit=100';
    if (verdictFilter !== 'ALL') url += `&verdict=${verdictFilter}`;
    if (severityFilter !== 'ALL') url += `&severity=${severityFilter}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    apiFetch(url)
      .then((r) => r.json())
      .then((data) => setIncidents(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [verdictFilter, severityFilter, search, refreshTrigger]);

  const handleOpenDetail = (seq: number) => {
    setSelectedCaseId(seq);
    setCurrentPage('case_detail');
  };

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            INCIDENT FORENSIC DATABASE
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Filterable archive of cryptographically signed multi-modal forensic records
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded-xl border border-cyan-500/20">
          Total Records: {incidents.length}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <FadeContent delay={0.1}>
        <div className="p-4 rounded-2xl glass-panel flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, SHA-256, sensor ID..."
              className="w-full bg-[#030612] border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Verdict:</span>
              <select
                value={verdictFilter}
                onChange={(e) => setVerdictFilter(e.target.value)}
                className="bg-[#030612] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">ALL VERDICTS</option>
                <option value="FAKE">FAKE (Synthetic)</option>
                <option value="REAL">REAL (Authentic)</option>
                <option value="UNSCORED">UNSCORED</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-[#030612] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">ALL SEVERITIES</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
          </div>
        </div>
      </FadeContent>

      {/* Desktop Table View (Hidden on mobile) */}
      <FadeContent delay={0.2} className="hidden md:block">
        <div className="rounded-2xl glass-panel overflow-hidden border border-cyan-500/15">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-cyan-500/20 bg-[#080C1D] text-slate-400 text-[11px]">
                  <th className="py-3 px-4">SEQ #</th>
                  <th className="py-3 px-4">EVIDENCE FILENAME</th>
                  <th className="py-3 px-4">TIMESTAMP</th>
                  <th className="py-3 px-4">FUSED SCORE</th>
                  <th className="py-3 px-4">VERDICT</th>
                  <th className="py-3 px-4">SEVERITY</th>
                  <th className="py-3 px-4">SENSOR / ACTOR</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {incidents.map((inc) => (
                  <tr
                    key={inc.seq}
                    onClick={() => handleOpenDetail(inc.seq)}
                    className="hover:bg-cyan-500/5 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-bold text-cyan-400">
                      #{inc.seq}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors truncate max-w-[220px]">
                        {inc.evidence_path.split(/[/\\]/).pop()}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[220px]">
                        SHA: {inc.evidence_sha256?.substring(0, 16)}...
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date((inc.ts || Date.now() / 1000) * 1000).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {inc.fused_score !== null ? `${(inc.fused_score * 100).toFixed(1)}%` : 'UNSCORED'}
                    </td>
                    <td className="py-3.5 px-4">
                      <VerdictChip verdict={inc.verdict} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                        inc.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        inc.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {inc.actor}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-cyan-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        <span>Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FadeContent>

      {/* Mobile Card View (Rows turn into Spotlight Cards) */}
      <div className="md:hidden space-y-3">
        {incidents.map((inc) => (
          <SpotlightCard
            key={inc.seq}
            onClick={() => handleOpenDetail(inc.seq)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-cyan-400">#{inc.seq}</span>
              <VerdictChip verdict={inc.verdict} size="sm" />
            </div>
            <div className="font-mono text-xs text-white font-semibold truncate mb-1">
              {inc.evidence_path.split(/[/\\]/).pop()}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
              <span>Score: {inc.fused_score !== null ? `${(inc.fused_score * 100).toFixed(1)}%` : 'UNSCORED'}</span>
              <span>{inc.severity}</span>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
};
