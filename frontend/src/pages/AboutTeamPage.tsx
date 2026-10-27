import React from 'react';
import {
  Users,
  Layers,
  Shield,
  Volume2,
  Video,
  Zap,
  Globe,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { FadeContent } from '../components/reactbits/FadeContent';
import { TiltedCard } from '../components/reactbits/TiltedCard';

interface TeamMember {
  name: string;
  role: string;
  module: string;
  responsibilities: string[];
  techStack: string[];
  color: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Ria',
    role: 'Audio Detection Lead',
    module: 'Acoustic Deepfake Detection Core',
    responsibilities: [
      'Librosa spectral feature extraction (MFCC-20, spectral centroid, rolloff, zero-crossing)',
      'Acoustic voice-clone classifier training on WaveFake & In-the-Wild datasets',
      'Real-time streaming monitoring layer for incoming telephony voice calls',
    ],
    techStack: ['Librosa', 'Scikit-Learn', 'Wav2Vec2', 'SoundFile'],
    color: '#00F0FF',
  },
  {
    name: 'Bhavika',
    role: 'Video Detection & Fusion Lead',
    module: 'Video Landmarks & Adaptive Fusion',
    responsibilities: [
      'MediaPipe facial landmark extraction for lip-sync mismatch and blink anomaly detection',
      'Lightweight CNN (EfficientNet-B0) fine-tuned on FaceForensics++ and Celeb-DF v2',
      'Multi-modal dynamic fusion renormalizing missing modalities (fixed unscored video bug)',
    ],
    techStack: ['OpenCV', 'MediaPipe', 'PyTorch / Torchvision', 'NumPy'],
    color: '#A855F7',
  },
  {
    name: 'Shaurya',
    role: 'Adversarial Robustness Lead',
    module: 'Model Attack Harness & Evasion Lab',
    responsibilities: [
      'Black-box perturbations: additive noise, time-shifting, gain, and random search',
      'White-box gradient attacks (FGSM / PGD) on PyTorch detector weights',
      'Realistic telephony 300-3400Hz band-limiting trade-off evaluation & honest reporting',
    ],
    techStack: ['PyTorch', 'SciPy Signal', 'Robustness Harness', 'NumPy'],
    color: '#FF0055',
  },
  {
    name: 'Harshita',
    role: 'Threat Intelligence Lead',
    module: 'OSINT Correlation & Incident Playbooks',
    responsibilities: [
      'Scam caller ID, malicious domain, and commercial voice-cloning tool IOC feeds',
      'Automated OSINT enrichment via VirusTotal and urlscan.io APIs',
      'Multi-stage incident response playbook with documented threshold justifications',
    ],
    techStack: ['Threat Intel Feeds', 'OSINT APIs', 'Splunk / SIEM', 'JSON Feeds'],
    color: '#F59E0B',
  },
  {
    name: 'Tanay',
    role: 'Forensics & Systems Lead',
    module: 'Tamper-Evident Ledger & SIEM Telemetry',
    responsibilities: [
      'HMAC-SHA256 hash chaining, signed head anchors, and off-box event verification',
      'Wazuh SIEM integration mapping to MITRE ATT&CK rules (T1566.004, T1656)',
      'FastAPI service architecture, concurrent WAL locking, and Forensic Command Center',
    ],
    techStack: ['FastAPI', 'SQLite WAL', 'HMAC-SHA256', 'Wazuh SIEM'],
    color: '#00F5A0',
  },
];

export const AboutTeamPage: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full pb-28 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              RESEARCH & ENGINEERING TEAM
            </span>
            <span className="text-xs font-mono text-slate-400">
              COLLEGE CYBERSECURITY CAPSTONE PROJECT (30 MARKS)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-orbitron font-extrabold text-white tracking-wide">
            PROJECT ARCHITECTURE & TEAM
          </h1>
        </div>
      </div>

      {/* Presentation to Ma'am Pipeline Architecture Diagram */}
      <FadeContent delay={0.1}>
        <div className="p-6 rounded-2xl glass-panel space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              END-TO-END SYSTEM PIPELINE ARCHITECTURE (PRESENTATION TO MA'AM)
            </span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              NOVELTY: DFIR + INTEL + DETECTION
            </span>
          </div>

          {/* Interactive Pipeline Workflow Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 pt-2">
            {/* Step 1 */}
            <div className="p-3.5 rounded-xl bg-[#030612] border border-cyan-500/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 01</span>
                <h4 className="font-orbitron font-bold text-xs text-white mt-1">Ingest & Pre-Hash</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug">
                  SHA-256 hash locked immediately on receipt BEFORE models execute.
                </p>
              </div>
              <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold">Owner: Tanay</div>
            </div>

            {/* Step 2 */}
            <div className="p-3.5 rounded-xl bg-[#030612] border border-cyan-500/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 02</span>
                <h4 className="font-orbitron font-bold text-xs text-white mt-1">Multi-Modal Models</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug">
                  Acoustic spectral features (Ria) + Facial landmark crops (Bhavika).
                </p>
              </div>
              <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold">Owners: Ria & Bhavika</div>
            </div>

            {/* Step 3 */}
            <div className="p-3.5 rounded-xl bg-[#030612] border border-cyan-500/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 03</span>
                <h4 className="font-orbitron font-bold text-xs text-white mt-1">Adaptive Fusion</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug">
                  Renormalizes missing modalities; unreadable video returns UNSCORED.
                </p>
              </div>
              <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold">Owner: Bhavika</div>
            </div>

            {/* Step 4 */}
            <div className="p-3.5 rounded-xl bg-[#030612] border border-cyan-500/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 04</span>
                <h4 className="font-orbitron font-bold text-xs text-white mt-1">Threat Correlation</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug">
                  Matches caller IDs, domains, and voice-cloning tools against OSINT.
                </p>
              </div>
              <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold">Owner: Harshita</div>
            </div>

            {/* Step 5 */}
            <div className="p-3.5 rounded-xl bg-[#030612] border border-cyan-500/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 05</span>
                <h4 className="font-orbitron font-bold text-xs text-white mt-1">IR Playbook</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug">
                  Maps score & intel to severity (CRITICAL/HIGH/MED) and actions.
                </p>
              </div>
              <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold">Owner: Harshita</div>
            </div>

            {/* Step 6 */}
            <div className="p-3.5 rounded-xl bg-[#030612] border border-cyan-500/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 06</span>
                <h4 className="font-orbitron font-bold text-xs text-white mt-1">Custody Ledger</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-snug">
                  HMAC-SHA256 signed chain + signed anchor + Wazuh event stream.
                </p>
              </div>
              <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold">Owner: Tanay</div>
            </div>
          </div>
        </div>
      </FadeContent>

      {/* Team Member Tilted Cards */}
      <FadeContent delay={0.2}>
        <div className="space-y-4">
          <span className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            INDIVIDUAL MODULE RESEARCHERS & RESPONSIBILITIES
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM_MEMBERS.map((member) => (
              <TiltedCard key={member.name} maxTilt={10}>
                <div className="p-6 rounded-2xl glass-panel h-full flex flex-col justify-between space-y-4 border hover:border-cyan-400/50 transition-all">
                  <div>
                    {/* Top Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-orbitron font-black text-xl text-white">
                        {member.name}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${member.color}15`,
                          color: member.color,
                          border: `1px solid ${member.color}40`,
                        }}
                      >
                        {member.role}
                      </span>
                    </div>

                    <div className="text-xs font-mono font-semibold text-cyan-300 mb-3">
                      {member.module}
                    </div>

                    {/* Responsibilities */}
                    <ul className="space-y-2 text-xs font-mono text-slate-300">
                      {member.responsibilities.map((resp, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-cyan-400 mt-1 shrink-0">•</span>
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tech Stack Pills */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex flex-wrap gap-1.5">
                      {member.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 rounded-md bg-[#030612] border border-slate-800 text-[10px] font-mono text-slate-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </TiltedCard>
            ))}
          </div>
        </div>
      </FadeContent>
    </div>
  );
};
