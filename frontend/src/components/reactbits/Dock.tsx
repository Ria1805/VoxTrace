import React from 'react';
import {
  LayoutDashboard,
  Radio,
  FileSearch,
  Lock,
  Database,
  ShieldAlert,
  Flame,
  ListOrdered,
  FlaskConical,
  BarChart3,
  Settings,
  Users,
} from 'lucide-react';
import { useFX } from '../../context/FXContext';

interface DockItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const DOCK_ITEMS: DockItem[] = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
  { id: 'live', label: 'Live Analysis', icon: Radio, badge: 'DEMO' },
  { id: 'case_detail', label: 'Case Detail', icon: FileSearch },
  { id: 'locker', label: 'Evidence Locker', icon: Lock },
  { id: 'incidents', label: 'Incident DB', icon: Database },
  { id: 'threat_intel', label: 'Threat Intel', icon: Flame },
  { id: 'siem', label: 'SIEM & Alerts', icon: ShieldAlert },
  { id: 'playbook', label: 'Playbook', icon: ListOrdered },
  { id: 'robustness', label: 'Robustness Lab', icon: FlaskConical },
  { id: 'models', label: 'Models & Eval', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'Team', icon: Users },
];

export const Dock: React.FC = () => {
  const { currentPage, setCurrentPage, fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  // Do not show dock on landing page
  if (currentPage === 'landing') return null;

  return (
    <nav aria-label="Main Navigation" className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] overflow-x-auto pt-12 pb-2">
      <div className="flex items-center gap-1 sm:gap-2 px-3 py-2 rounded-2xl bg-[#0A0E1F]/90 border border-cyan-500/20 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setCurrentPage(item.id)}
              className={`group relative flex flex-col items-center justify-center p-2 sm:px-2.5 sm:py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${!isOff ? 'group-hover:scale-110' : ''}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-500 text-black font-bold tracking-tighter">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Tooltip on Hover */}
              <div className="pointer-events-none absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2 py-1 rounded-md bg-[#05070F] border border-cyan-500/30 text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-lg">
                {item.label}
              </div>

              {/* Active glow dot */}
              {isActive && (
                <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00F0FF]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
