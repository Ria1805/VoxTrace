import React from 'react';
import { useFX } from '../../context/FXContext';

interface LogoItem {
  name: string;
  category: string;
  tag: string;
}

const DEFAULT_LOGOS: LogoItem[] = [
  { name: 'ElevenLabs API', category: 'Commercial TTS', tag: 'Acoustic Fingerprint' },
  { name: 'Coqui-TTS', category: 'Open-Source Voice', tag: 'Model Fingerprint' },
  { name: 'Tortoise-TTS v2', category: 'Zero-Shot Clone', tag: 'Diffusion Mel' },
  { name: 'RVC v2 (Retrieval)', category: 'Voice Conversion', tag: 'Pitch Shift Artifact' },
  { name: 'FaceForensics++', category: 'Video Benchmark', tag: 'Identity-Disjoint' },
  { name: 'Celeb-DF v2', category: 'Deepfake Dataset', tag: 'Blink / Landmark' },
  { name: 'Wazuh SIEM', category: 'DFIR Telemetry', tag: 'MITRE ATT&CK' },
  { name: 'VirusTotal & urlscan', category: 'Threat Enrichment', tag: 'OSINT API' },
];

export const LogoLoop: React.FC<{ logos?: LogoItem[]; speed?: number }> = ({
  logos = DEFAULT_LOGOS,
  speed = 28,
}) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  const doubled = [...logos, ...logos];

  return (
    <div className="relative w-full overflow-hidden py-3">
      {/* Gradient edge masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#05070F] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#05070F] to-transparent z-10" />

      <div
        className={`flex gap-4 w-max ${!isOff ? 'animate-[marquee_linear_infinite]' : ''}`}
        style={{
          animationDuration: `${speed}s`,
        }}
      >
        {doubled.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#0A0E1F]/80 border border-cyan-500/15 backdrop-blur-sm whitespace-nowrap shadow-sm hover:border-cyan-500/40 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]" />
            <div>
              <div className="text-xs font-semibold text-slate-200 font-mono">{item.name}</div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>{item.category}</span>
                <span className="text-cyan-400 font-mono">[{item.tag}]</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
