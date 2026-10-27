import { useState, useEffect } from 'react';
import React from 'react';
import { FXProvider, useFX } from './context/FXContext';

import { TopBar } from './components/common/TopBar';
import { Dock } from './components/reactbits/Dock';

// 13 Pages
import { LandingPage } from './pages/LandingPage';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { LiveAnalysisPage } from './pages/LiveAnalysisPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { EvidenceLockerPage } from './pages/EvidenceLockerPage';
import { IncidentDatabasePage } from './pages/IncidentDatabasePage';
import { ThreatIntelPage } from './pages/ThreatIntelPage';
import { SiemAlertsPage } from './pages/SiemAlertsPage';
import { PlaybookPage } from './pages/PlaybookPage';
import { RobustnessLabPage } from './pages/RobustnessLabPage';
import { ModelsEvaluationPage } from './pages/ModelEvaluationPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutTeamPage } from './pages/AboutTeamPage';

const AppContent: React.FC = () => {
  const { currentPage } = useFX();
  const [apiError, setApiError] = useState('');
  useEffect(() => { window.scrollTo(0, 0); }, [currentPage]);
  useEffect(() => {
    const handler = (event: Event) => setApiError((event as CustomEvent<string>).detail);
    window.addEventListener('voxtrace-api-error', handler);
    return () => window.removeEventListener('voxtrace-api-error', handler);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage />;
      case 'dashboard':
        return <CommandCenterPage />;
      case 'live':
        return <LiveAnalysisPage />;
      case 'case_detail':
        return <CaseDetailPage />;
      case 'locker':
        return <EvidenceLockerPage />;
      case 'incidents':
        return <IncidentDatabasePage />;
      case 'threat_intel':
        return <ThreatIntelPage />;
      case 'siem':
        return <SiemAlertsPage />;
      case 'playbook':
        return <PlaybookPage />;
      case 'robustness':
        return <RobustnessLabPage />;
      case 'models':
        return <ModelsEvaluationPage />;
      case 'settings':
        return <SettingsPage />;
      case 'about':
        return <AboutTeamPage />;
      default:
        return <CommandCenterPage />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#05070F] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        <TopBar />
        {currentPage !== 'landing' && <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
          <div className="border border-amber-500/25 bg-amber-500/5 text-amber-200/80 rounded-lg px-3 py-2 text-[11px] font-mono">
            ACADEMIC PROTOTYPE · Audio metrics are recomputed from supplied held-out scores; source audio is unavailable for independent reproduction. Video is unscored.
            {['dashboard','incidents','case_detail','locker','live'].includes(currentPage) && ' Counts and scores refer to local evidence records, not benchmark performance.'}
            {currentPage === 'settings' && ' Settings are UI preferences only; model thresholds, keys and backend configuration are not changed here.'}
            {currentPage === 'threat_intel' && ' Example IOC feed only. Online enrichment is not connected.'}
            {currentPage === 'playbook' && ' Proposed response policy only. No calls, transactions or notifications are automatically controlled.'}
            {currentPage === 'siem' && ' Wazuh connection is not verified; no imported alerts.'}
          </div>
        </div>}
        {apiError && <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-500/40 bg-rose-950 p-3 text-sm text-rose-200">{apiError}<button className="ml-4 underline" onClick={() => { setApiError(''); window.location.reload(); }}>Retry connection</button></div>}
        <main className="flex-1 w-full">
          {renderPage()}
        </main>
        <Dock />
      </div>
    </>
  );
};

export function App() {
  return (
    <FXProvider>
      <AppContent />
    </FXProvider>
  );
}

export default App;
