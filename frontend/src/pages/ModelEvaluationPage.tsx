import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu,
  FileCode,
  ShieldCheck,
  TrendingUp,
  Hash,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { FadeContent } from '../components/reactbits/FadeContent';
import { DecryptedText } from '../components/reactbits/DecryptedText';

export const ModelsEvaluationPage: React.FC = () => {
  const [data, setData] = useState<{
    table: any[];
    roc_curve: any[];
    confusion_matrices: any;
    registry: any[];
    provenance_policy: string;
    message?: string;
    run_id?: string | null;
    split?: string | null;
  } | null>(null);

  useEffect(() => {
    apiFetch('/api/models/evaluation')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              MULTI-MODAL EVALUATION & REGISTRY
            </span>
            <span className="text-xs font-mono text-slate-400">
              EVALUATE.PY / IDENTITY-DISJOINT METRICS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            MODELS & BENCHMARK EVALUATION
          </h1>
        </div>
      </div>

      {/* Provenance Ground Rule Alert */}
      <FadeContent delay={0.1}>
        <div className="p-4 rounded-xl bg-[#080C1E] border border-cyan-500/20 font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-cyan-400">Provenance Rule Enforced: </strong>
              {data?.message || 'Loading evaluation provenance…'}
            </span>
          </div>
        </div>
      </FadeContent>

      {/* Comparison Table */}
      <FadeContent delay={0.2}>
        <div className="p-5 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              AUDIO MODEL BENCHMARKS: BASELINE AND PHONE-AUGMENTED
            </span>
            <span className="text-xs font-mono text-cyan-400">
              Run ID: {data?.run_id || 'Not run'} · Split: {data?.split || 'not evaluated'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-cyan-500/20 bg-[#080C1D] text-slate-400">
                  <th className="py-3 px-3">MODALITY</th>
                  <th className="py-3 px-3">MODEL ARCHITECTURE</th>
                  <th className="py-3 px-3">PRECISION</th>
                  <th className="py-3 px-3">RECALL</th>
                  <th className="py-3 px-3">F1-SCORE</th>
                  <th className="py-3 px-3">ROC-AUC</th>
                  <th className="py-3 px-3">FPR (FP RATE)</th>
                  <th className="py-3 px-3">EVAL SPLIT</th>
                  <th className="py-3 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data?.table?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-cyan-500/5 transition-colors">
                    <td className="py-3 px-3 font-bold text-white">
                      {row.modality}
                    </td>
                    <td className="py-3 px-3 text-cyan-300 font-semibold">
                      {row.model}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      {(row.precision * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      {(row.recall * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      {(row.f1 * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-violet-300 font-bold">
                      {row.roc_auc.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-amber-300 font-bold">
                      {(row.fpr * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {row.split}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'FUSED BEST'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : row.status === 'RECOMPUTED FROM SCORES'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FadeContent>

      {/* ROC Curves & Confusion Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ROC Curves (7 cols) */}
        <div className="lg:col-span-7">
          <FadeContent delay={0.3}>
            <div className="p-5 rounded-2xl glass-panel space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-slate-100">
                    RECEIVER OPERATING CHARACTERISTIC (ROC)
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    True Positive Rate vs. False Positive Rate across decision thresholds
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.roc_curve || []}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="fpr"
                      stroke="#64748B"
                      fontSize={10}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={10}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0A0E1F',
                        borderColor: '#00F0FF40',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="tpr_baseline"
                      name="Audio baseline"
                      stroke="#A855F7"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="tpr_audio"
                      name="Phone-augmented audio (clean)"
                      stroke="#00F0FF"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="tpr_phone"
                      name="Phone-band-limited audio"
                      stroke="#00F5A0"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FadeContent>
        </div>

        {/* Confusion Matrices (5 cols) */}
        <div className="lg:col-span-5">
          <FadeContent delay={0.35}>
            <div className="p-5 rounded-2xl glass-panel space-y-4 font-mono text-xs">
              <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                PHONE-AUGMENTED AUDIO CONFUSION MATRIX (CLEAN HELD-OUT SET)
              </span>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">True Positives (TP)</span>
                  <span className="text-2xl font-orbitron font-black text-emerald-400">
                    {data?.confusion_matrices?.audio?.tp ?? '?'}
                  </span>
                  <span className="text-[10px] text-emerald-300 block mt-1">Fakes Correctly Caught</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">False Positives (FP)</span>
                  <span className="text-2xl font-orbitron font-black text-amber-400">
                    {data?.confusion_matrices?.audio?.fp ?? '?'}
                  </span>
                  <span className="text-[10px] text-amber-300 block mt-1">Real Wrongly Flagged</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">False Negatives (FN)</span>
                  <span className="text-2xl font-orbitron font-black text-rose-400">
                    {data?.confusion_matrices?.audio?.fn ?? '?'}
                  </span>
                  <span className="text-[10px] text-rose-300 block mt-1">Evaded Fakes</span>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">True Negatives (TN)</span>
                  <span className="text-2xl font-orbitron font-black text-emerald-400">
                    {data?.confusion_matrices?.audio?.tn ?? '?'}
                  </span>
                  <span className="text-[10px] text-emerald-300 block mt-1">Authentic Calls Verified</span>
                </div>
              </div>
            </div>
          </FadeContent>
        </div>
      </div>

      {/* Model Registry */}
      <FadeContent delay={0.4}>
        <div className="p-5 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              MODEL REGISTRY & CRYPTOGRAPHIC WEIGHT CHECKSUMS
            </span>
            <span className="text-xs font-mono text-slate-400">
              Identity-Disjoint Verification
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {data?.registry?.map((reg, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#030612] border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{reg.name}</span>
                  <span className="text-[10px] text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  speaker-disjoint reported
                  </span>
                </div>
                <div className="text-[11px] text-cyan-300">
                  Version: {reg.version}
                </div>
                <div className="text-[10px] text-slate-400">
                  Dataset: {reg.dataset}
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 block text-[9px]">WEIGHTS SHA-256</span>
                  <div className="text-cyan-400 text-[10px] truncate">
                    {reg.weights_sha256}
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
