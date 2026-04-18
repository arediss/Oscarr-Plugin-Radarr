import React, { useState } from 'react';
import { LibraryTab } from './components/LibraryTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { QualityTab } from './components/QualityTab';
import { ReleasesTab } from './components/ReleasesTab';
import { FilesTab } from './components/FilesTab';
import { DownloadsTab } from './components/DownloadsTab';

const TABS = [
  { id: 'library', label: 'Library' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'quality', label: 'Quality' },
  { id: 'releases', label: 'Releases' },
  { id: 'files', label: 'Files' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function getInitialTab(): TabId {
  const hash = window.location.hash.replace('#', '');
  if (TABS.some((t) => t.id === hash)) return hash as TabId;
  return 'library';
}

export default function RadarrManager() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <svg className="w-6 h-6 text-ndp-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
          <line x1="17" y1="17" x2="22" y2="17" />
        </svg>
        <h1 className="text-2xl font-bold text-ndp-text">Radarr Manager</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={
              'px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ' +
              (activeTab === id
                ? 'bg-ndp-accent text-white'
                : 'bg-ndp-surface text-ndp-text-muted hover:bg-ndp-surface-light')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'downloads' && <DownloadsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'quality' && <QualityTab />}
        {activeTab === 'releases' && <ReleasesTab />}
        {activeTab === 'files' && <FilesTab />}
      </div>
    </div>
  );
}
