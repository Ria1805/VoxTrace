import React, { useState } from 'react';
import {
  ListOrdered,
  ShieldAlert,
  PhoneOff,
  UserCheck,
  Send,
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { FadeContent } from '../components/reactbits/FadeContent';
import { StarBorder } from '../components/reactbits/StarBorder';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';

const PLAYBOOK_SEVERITIES = [
  {
    level: 'CRITICAL',
    minScore: 0.90,
    color: '#FF0055',
    justification: 'Acoustic and visual confidence >= 0.90 is a proposed escalation threshold, not proof of synthetic media. High risk of immediate irreversible wire transfer or credential handover.',
    steps: [
      { step: 'DETECT', desc: 'Real-time multi-modal score breaches 0.90 threshold; SHA-256 evidence lock triggered.' },
      { step: 'VERIFY', desc: 'Pre-scoring hash comparison in SQLite ledger; verify against off-box head anchor.' },
      { step: 'CONTAIN', desc: 'Proposed manual containment; telecom API integration is not implemented.' },
      { step: 'NOTIFY', desc: 'Proposed: dispatch SMS/Push alert to designated executive security officer and target employee.' },
      { step: 'ESCALATE', desc: 'Auto-generate DFIR evidence dossier for SOC triage and law enforcement reporting.' },
    ],
    defaultActions: ['Block caller number', 'Freeze pending transaction', 'Escalate to Tier-3 SOC'],
  },
  {
    level: 'HIGH',
    minScore: 0.70,
    color: '#F43F5E',
    justification: 'Score between 0.70 and 0.89 indicates strong synthetic indicators or presence of known malicious caller ID / domain infrastructure in active threat intelligence feeds.',
    steps: [
      { step: 'DETECT', desc: 'Fused score >= 0.70 or Harshita IOC match on borderline sample.' },
      { step: 'VERIFY', desc: 'Examine spectral centroid anomalies and mouth sync delta in Case Detail.' },
      { step: 'CONTAIN', desc: 'Hold transaction pending out-of-band identity verification.' },
      { step: 'NOTIFY', desc: 'Alert financial desk to halt release of funds until callback confirmed.' },
      { step: 'ESCALATE', desc: 'Escalate to Tier-2 SOC analyst for manual voice-print review.' },
    ],
    defaultActions: ['Hold transaction', 'Request callback on known-good number', 'Preserve evidence'],
  },
  {
    level: 'MEDIUM',
    minScore: 0.50,
    color: '#F59E0B',
    justification: 'Score between 0.50 and 0.69 represents borderline anomaly, potentially exacerbated by telephony 300-3400Hz band-limiting or low microphone quality. Requires human analyst inspection.',
    steps: [
      { step: 'DETECT', desc: 'Borderline detection score above binary threshold 0.50.' },
      { step: 'VERIFY', desc: 'Cross-check against known customer baseline acoustic profiles.' },
      { step: 'CONTAIN', desc: 'Tag session for human analyst triage; do not auto-terminate.' },
      { step: 'NOTIFY', desc: 'In-app warning to operator: "Potential synthetic audio detected".' },
      { step: 'ESCALATE', desc: 'Flag for post-call audit.' },
    ],
    defaultActions: ['Flag for analyst triage', 'Request callback on known-good number'],
  },
  {
    level: 'LOW / NONE',
    minScore: 0.00,
    color: '#00F5A0',
    justification: 'Score below 0.50 indicates natural human speech acoustics and facial movements without synthetic artifacts.',
    steps: [
      { step: 'DETECT', desc: 'Score conforms to natural human distribution (< 0.50).' },
      { step: 'VERIFY', desc: 'Routine ledger sequence append.' },
      { step: 'CONTAIN', desc: 'No containment necessary.' },
      { step: 'NOTIFY', desc: 'Normal call progression.' },
      { step: 'ESCALATE', desc: 'Record committed to tamper-evident audit trail.' },
    ],
    defaultActions: ['Log only'],
  },
];

export const PlaybookPage: React.FC = () => {
  const [activeSeverity, setActiveSeverity] = useState<string>('CRITICAL');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const currentPlaybook = PLAYBOOK_SEVERITIES.find((p) => p.level === activeSeverity) || PLAYBOOK_SEVERITIES[0];

  const triggerAction = (actionName: string) => {
    setFeedbackMsg(`Action "${actionName}" executed: Dispatch recorded in audit log.`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              HARSHITA'S IR PLAYBOOK CORE
            </span>
            <span className="text-xs font-mono text-slate-400">
              STEPPER ESCALATION & DOCUMENTED THRESHOLD RATIONALE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            INCIDENT RESPONSE PLAYBOOK
          </h1>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Severity Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        {PLAYBOOK_SEVERITIES.map((p) => (
          <button
            key={p.level}
            onClick={() => setActiveSeverity(p.level)}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeSeverity === p.level
                ? 'bg-slate-900 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                : 'bg-[#0A0E1F]/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-[10px] text-slate-500">Min Score: {p.minScore.toFixed(2)}</div>
            <div className="font-orbitron font-bold text-sm mt-0.5" style={{ color: p.color }}>
              {p.level}
            </div>
          </button>
        ))}
      </div>

      {/* Threshold Justification Card */}
      <FadeContent delay={0.1}>
        <div className="p-5 rounded-2xl glass-panel space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <Info className="w-4 h-4" />
            <span>Harshita's Threshold Justification & Risk Policy ({currentPlaybook.level}):</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-xs">
            {currentPlaybook.justification}
          </p>
        </div>
      </FadeContent>

      {/* 5-Step Stepper Component */}
      <FadeContent delay={0.2}>
        <div className="p-6 rounded-2xl glass-panel space-y-6">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-cyan-400" />
              5-STAGE INCIDENT ESCALATION STEPPER
            </span>
            <span className="text-xs font-mono text-cyan-400">
              Automated IR Workflow
            </span>
          </div>

          {/* Stepper Track */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {currentPlaybook.steps.map((s, idx) => (
              <div
                key={s.step}
                className="p-4 rounded-xl bg-[#030612] border border-slate-800 flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-500">STAGE {idx + 1}</span>
                  </div>
                  <h4 className="font-orbitron font-bold text-xs text-white tracking-wide">
                    {s.step}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400 mt-1 leading-snug">
                    {s.desc}
                  </p>
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-transparent rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </FadeContent>

      {/* Star Border Playbook Action Buttons */}
      <FadeContent delay={0.3}>
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            DIRECT INCIDENT RESPONSE ACTIONS
          </span>

          <div className="flex items-center gap-4 flex-wrap">
            <StarBorder onClick={() => triggerAction('Block number via Telecom Gateway API')} color="#FF0055">
              <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold py-1">
                <PhoneOff className="w-4 h-4 text-rose-400" />
                <span>Block Number</span>
              </div>
            </StarBorder>

            <StarBorder onClick={() => triggerAction('Notify potential victim via Push/SMS')} color="#00F0FF">
              <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold py-1">
                <Send className="w-4 h-4 text-cyan-400" />
                <span>Notify Victim</span>
              </div>
            </StarBorder>

            <StarBorder onClick={() => triggerAction('Escalate to Tier-3 SOC Incident Commander')} color="#A855F7">
              <div className="flex items-center gap-2 text-violet-300 font-mono text-xs font-bold py-1">
                <UserCheck className="w-4 h-4 text-violet-400" />
                <span>Escalate to SOC</span>
              </div>
            </StarBorder>
          </div>
        </div>
      </FadeContent>
    </div>
  );
};
