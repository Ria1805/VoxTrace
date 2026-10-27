import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  Flame,
  Globe,
  Phone,
  Cpu,
  ShieldAlert,
  Search,
  ExternalLink,
  Sliders,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import { useFX } from '../context/FXContext';
import { FadeContent } from '../components/reactbits/FadeContent';
import { LogoLoop } from '../components/reactbits/LogoLoop';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';

export const ThreatIntelPage: React.FC = () => {
  const { refreshTrigger } = useFX();
  const [data, setData] = useState<{
    iocs: any[];
    graph: { nodes: any[]; links: any[] };
    enrichment: any;
    rule_card: any;
  } | null>(null);

  const [selectedEnrichment, setSelectedEnrichment] = useState<'virustotal' | 'urlscan'>('virustotal');
  const [activeNode, setActiveNode] = useState<any | null>(null);

  useEffect(() => {
    apiFetch('/api/intel')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.graph?.nodes?.length > 0) setActiveNode(d.graph.nodes[0]);
      })
      .catch((err) => console.error(err));
  }, [refreshTrigger]);

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
              HARSHITA'S THREAT INTEL CORE
            </span>
            <span className="text-xs font-mono text-slate-400">
              OSINT CORRELATION & ATTRIBUTION GRAPH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            THREAT INTELLIGENCE & IOC FEED
          </h1>
        </div>
      </div>

      {/* Tool & Platform Logo Loop */}
      <FadeContent delay={0.1}>
        <div className="rounded-2xl glass-panel p-2">
          <LogoLoop />
        </div>
      </FadeContent>

      {/* Harshita's Rule Card (for score < 0.5 IOC match) */}
      {data?.rule_card && (
        <FadeContent delay={0.15}>
          <div className="p-5 rounded-2xl bg-[#0A0E1F]/90 border border-violet-500/30 glow-violet space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-orbitron font-bold text-sm text-violet-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-400" />
                {data.rule_card.title}
              </span>
              <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded border border-violet-500/40">
                {data.rule_card.status}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                <span className="text-slate-500 block text-[10px]">EVALUATION CONDITION</span>
                <span className="text-amber-300 font-bold">{data.rule_card.condition}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ENFORCEMENT ACTION</span>
                <span className="text-emerald-300 font-bold">{data.rule_card.action}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              <span className="text-cyan-400 font-semibold">Rationale: </span>
              {data.rule_card.rationale}
            </p>
          </div>
        </FadeContent>
      )}

      {/* Main Grid: Correlation Graph & Enrichment Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Interactive Correlation Graph */}
        <div className="lg:col-span-7 space-y-4">
          <FadeContent delay={0.2}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  CORRELATION & ATTRIBUTION GRAPH
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  Interactive Node Map
                </span>
              </div>

              <div className="relative h-[340px] w-full rounded-xl bg-[#03050C] border border-cyan-500/20 p-4 overflow-hidden flex flex-col justify-between">
                {data?.graph?.nodes?.length ? (
                  <div className="grid grid-cols-3 gap-3">
                    {data.graph.nodes.slice(0, 9).map((node) => {
                    const isSelected = activeNode?.id === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => setActiveNode(node)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_#00F0FF]'
                            : 'bg-[#0A0E1F]/70 border-slate-800 hover:border-cyan-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-mono font-bold uppercase ${
                            node.type === 'detection' ? 'text-rose-400' :
                            node.type === 'phone' ? 'text-amber-400' :
                            node.type === 'domain' ? 'text-cyan-400' :
                            'text-violet-400'
                          }`}>
                            {node.type}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        </div>
                        <div className="font-mono text-xs font-semibold text-white truncate my-1">
                          {node.label}
                        </div>
                        <div className="text-[8px] font-mono text-slate-500">
                          {node.severity ? `Sev: ${node.severity}` : 'Correlated'}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center font-mono text-xs text-slate-400">
                    No recorded IOC matches yet. Matches appear here after an analysis includes an observable found in a local feed.
                  </div>
                )}

                <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-900 flex flex-col gap-1">
                  <span>Selected Node: <strong className="text-cyan-300">{activeNode?.label || 'None'}</strong></span>
                  <span className="text-cyan-400">
                    {data?.graph?.links?.length || 0} recorded detection-to-indicator relationships
                  </span>
                </div>
              </div>
            </div>
          </FadeContent>
        </div>

        {/* Right Column (5 cols): Enrichment Drawer (VirusTotal / urlscan) */}
        <div className="lg:col-span-5 space-y-4">
          <FadeContent delay={0.25}>
            <div className="p-5 rounded-2xl glass-panel space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  OSINT ENRICHMENT DRAWER
                </span>
                <div className="flex rounded-lg bg-[#030612] p-0.5 border border-slate-800">
                  <button
                    onClick={() => setSelectedEnrichment('virustotal')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      selectedEnrichment === 'virustotal' ? 'bg-cyan-500 text-black' : 'text-slate-400'
                    }`}
                  >
                    VirusTotal
                  </button>
                  <button
                    onClick={() => setSelectedEnrichment('urlscan')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      selectedEnrichment === 'urlscan' ? 'bg-cyan-500 text-black' : 'text-slate-400'
                    }`}
                  >
                    urlscan.io
                  </button>
                </div>
              </div>

              {selectedEnrichment === 'virustotal' ? (
                <div className="space-y-3 bg-[#030612] p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Target Domain:</span>
                    <span className="text-rose-400 font-bold truncate max-w-[180px]">
                      {data?.enrichment?.virustotal?.domain}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Security Vendors:</span>
                    <span className="text-rose-400 font-bold">
                      {data?.enrichment?.virustotal?.positives} / {data?.enrichment?.virustotal?.total_engines} Flagged
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Reputation Score:</span>
                    <span className="text-rose-400 font-bold">
                      {data?.enrichment?.virustotal?.reputation_score} (not enriched)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Registrar:</span>
                    <span className="text-white">
                      {data?.enrichment?.virustotal?.registrar}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">RESOLVED INFRASTRUCTURE</span>
                    <span className="text-cyan-300">
                      {data?.enrichment?.virustotal?.dns_resolution}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-[#030612] p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Scanned URL:</span>
                    <span className="text-cyan-300 font-bold truncate max-w-[180px]">
                      {data?.enrichment?.urlscan?.url}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Verdict:</span>
                    <span className="text-rose-400 font-bold">
                      {data?.enrichment?.urlscan?.verdict}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Targeted Brand:</span>
                    <span className="text-white">
                      {data?.enrichment?.urlscan?.targeted_brand}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Server Geo:</span>
                    <span className="text-cyan-400">
                      {data?.enrichment?.urlscan?.server_location}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </FadeContent>
        </div>
      </div>

      {/* IOC Feed Table */}
      <FadeContent delay={0.3}>
        <div className="p-5 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              INDICATORS OF COMPROMISE (IOC) ACTIVE FEED
            </span>
            <span className="text-xs font-mono text-slate-400">
              Sources: local IOC feeds in data/iocs/*.json
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-cyan-500/20 text-slate-400 bg-[#080C1D]">
                  <th className="py-2.5 px-3">TYPE</th>
                  <th className="py-2.5 px-3">INDICATOR VALUE</th>
                  <th className="py-2.5 px-3">TAG</th>
                  <th className="py-2.5 px-3">SOURCE</th>
                  <th className="py-2.5 px-3">CONFIDENCE</th>
                  <th className="py-2.5 px-3">ATTRIBUTED CAMPAIGN</th>
                  <th className="py-2.5 px-3">LAST SEEN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data?.iocs?.map((ioc, idx) => (
                  <tr key={idx} className="hover:bg-cyan-500/5 transition-colors">
                    <td className="py-2.5 px-3 uppercase text-cyan-400 font-bold">
                      {ioc.type}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {ioc.value}
                    </td>
                    <td className="py-2.5 px-3 text-amber-300">
                      {ioc.tag}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {ioc.source}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">
                      {ioc.confidence}
                    </td>
                    <td className="py-2.5 px-3 text-violet-300">
                      {ioc.campaign || 'Not attributed'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {ioc.last_seen}
                    </td>
                  </tr>
                ))}
                {data?.iocs?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 px-3 text-center text-slate-400">
                      No local indicators loaded. Add a feed JSON file under data/iocs/.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FadeContent>
    </div>
  );
};
