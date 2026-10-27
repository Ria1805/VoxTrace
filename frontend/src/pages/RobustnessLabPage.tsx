import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Shield,
  Zap,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
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
import { ElasticSlider } from '../components/reactbits/ElasticSlider';
import { StarBorder } from '../components/reactbits/StarBorder';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';

const ATTACK_TYPES = [
  { id: 'telephony_300-3400Hz', name: 'Telephony Band-Limiting (300-3400Hz)', mode: 'Black-Box Acoustic' },
  { id: 'random_search', name: 'Random-Search Blackbox Perturbation', mode: 'Query-Only (budget=50)' },
  { id: 'noise', name: 'Additive Gaussian Noise (SNR)', mode: 'Acoustic Degradation' },
  { id: 'fgsm', name: 'Fast Gradient Sign Method (FGSM)', mode: 'White-Box PyTorch Gradient' },
  { id: 'pgd', name: 'Projected Gradient Descent (PGD)', mode: 'White-Box Iterative Gradient' },
];

export const RobustnessLabPage: React.FC = () => {
  const [selectedAttack, setSelectedAttack] = useState<string>('telephony_300-3400Hz');
  const [strength, setStrength] = useState<number>(0.5);
  const [simResults, setSimResults] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const runSimulation = () => {
    setLoading(true);
    apiFetch('/api/robustness/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attack_type: selectedAttack,
        strength,
      }),
    })
      .then((r) => r.json())
      .then((data) => setSimResults(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runSimulation();
  }, [selectedAttack, strength]);

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              SHAURYA'S ADVERSARIAL HARNESS
            </span>
            <span className="text-xs font-mono text-slate-400">
              WHITE-BOX & BLACK-BOX EVASION REPORTING
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            ROBUSTNESS & ADVERSARIAL LAB
          </h1>
        </div>
      </div>

      {/* Honest Reporting Card (Prompt requirement!) */}
      <FadeContent delay={0.1}>
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 font-mono text-xs space-y-2 glow-unscored">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              HONEST SCIENTIFIC REPORTING STATEMENT
            </span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              TEAM GROUND RULE
            </span>
          </div>
          <p className="text-amber-100 text-xs sm:text-sm font-semibold leading-relaxed">
            "{simResults?.honest_reporting || 'No robustness evaluations have been run. Controls configure a proposed experiment; no measured results are available.'}"
          </p>
          <div className="text-[11px] text-slate-400 flex items-center gap-4 pt-1">
            <span>Run ID: <strong className="text-cyan-300">{simResults?.provenance?.run_id}</strong></span>
            <span>Split: <strong className="text-slate-300">Not evaluated</strong></span>
            <span className="text-amber-400 font-bold">[{simResults?.provenance?.status}]</span>
          </div>
        </div>
      </FadeContent>

      {/* Interactive Controls & Slider */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (5 cols): Attack Selection & Elastic Slider */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl glass-panel space-y-4">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              ATTACK VECTOR SELECTION
            </span>

            {/* Attack Types */}
            <div className="space-y-2">
              {ATTACK_TYPES.map((atk) => (
                <button
                  key={atk.id}
                  onClick={() => setSelectedAttack(atk.id)}
                  className={`w-full p-3 rounded-xl border text-left font-mono transition-all ${
                    selectedAttack === atk.id
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                      : 'bg-[#030612] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{atk.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Mode: {atk.mode}</div>
                </button>
              ))}
            </div>

            {/* Elastic Slider for Strength */}
            <div className="pt-2">
              <ElasticSlider
                label="Attack Perturbation Strength (Epsilon / SNR)"
                value={strength}
                min={0.1}
                max={1.0}
                step={0.05}
                onChange={(val) => setStrength(val)}
                unit="ε"
              />
            </div>
          </div>
        </div>

        {/* Right (7 cols): Evasion Rate Curve & False Positive Tradeoff */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-orbitron font-bold text-sm text-slate-100">
                  EVASION RATE VS. PERTURBATION STRENGTH
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Adversarial degradation of detection models across perturbation levels
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Evasion Rate
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Real Flagged As Fake
                </span>
              </div>
            </div>

            {/* Line Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simResults?.curve || []}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="strength"
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
                  <Line
                    type="monotone"
                    dataKey="evasion_rate"
                    name="Evasion Rate"
                    stroke="#FF0055"
                    strokeWidth={2.5}
                    dot={{ fill: '#FF0055', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="real_flagged_as_fake"
                    name="Real Flagged As Fake"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ fill: '#F59E0B', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Current Point Stats */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                <span className="text-slate-400 block text-[10px]">CURRENT EVASION RATE</span>
                <span className="text-rose-400 font-bold text-base">
                  {simResults?.evasion_rate != null ? `${(simResults.evasion_rate * 100).toFixed(1)}%` : 'Unmeasured'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#030612] border border-slate-800">
                <span className="text-slate-400 block text-[10px]">LEGITIMATE CALLS COMPROMISED</span>
                <span className="text-amber-400 font-bold text-base">
                  {simResults?.real_flagged_as_fake != null ? `${(simResults.real_flagged_as_fake * 100).toFixed(1)}%` : 'Unmeasured'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
