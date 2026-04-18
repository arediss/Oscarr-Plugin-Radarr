import React, { useState, useEffect } from 'react';

interface AnalyticsData {
  overview: {
    totalMovies: number;
    totalSize: number;
    downloaded: number;
    missing: number;
    unmonitored: number;
  };
  qualityDistribution: { name: string; count: number }[];
  diskSpace: {
    path: string;
    label: string;
    freeSpace: number;
    totalSpace: number;
    usedSpace: number;
    usedPercent: number;
  }[];
  timeline: { month: string; count: number }[];
  rootFolders: { path: string; count: number; size: number }[];
  profileMap: Record<number, string>;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatSizeTB(bytes: number): string {
  const tb = bytes / Math.pow(1024, 4);
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  return formatSize(bytes);
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ndp-text-dim">{label}</p>
      <p className={'text-2xl font-bold mt-1 ' + (accent || 'text-ndp-text')}>{value}</p>
    </div>
  );
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/plugins/radarr/analytics', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-6 text-center">
        <p className="text-ndp-error">{error || 'No data available'}</p>
      </div>
    );
  }

  const maxTimelineCount = Math.max(...data.timeline.map((t) => t.count), 1);
  const maxQualityCount = Math.max(...data.qualityDistribution.map((q) => q.count), 1);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Movies" value={data.overview.totalMovies.toLocaleString()} />
        <StatCard label="Total Size" value={formatSizeTB(data.overview.totalSize)} />
        <StatCard label="Downloaded" value={data.overview.downloaded.toLocaleString()} accent="text-ndp-success" />
        <StatCard label="Missing" value={data.overview.missing.toLocaleString()} accent="text-ndp-error" />
        <StatCard label="Unmonitored" value={data.overview.unmonitored.toLocaleString()} accent="text-ndp-text-dim" />
      </div>

      {/* Disk Space */}
      {data.diskSpace.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ndp-text">Disk Space</h3>
          <div className="card p-5 space-y-4">
            {data.diskSpace.map((disk) => (
              <div key={disk.path}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-ndp-text truncate" title={disk.path}>
                    {disk.label || disk.path}
                  </span>
                  <span className="text-ndp-text-dim flex-shrink-0 ml-3">
                    {formatSize(disk.usedSpace)} / {formatSize(disk.totalSpace)} ({disk.usedPercent}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={
                      'h-full rounded-full transition-all duration-500 ' +
                      (disk.usedPercent > 90
                        ? 'bg-ndp-error'
                        : disk.usedPercent > 70
                          ? 'bg-yellow-500'
                          : 'bg-ndp-accent')
                    }
                    style={{ width: `${Math.min(disk.usedPercent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality Distribution */}
      {data.qualityDistribution.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ndp-text">Quality Distribution</h3>
          <div className="card p-5 space-y-3">
            {data.qualityDistribution.map((q) => (
              <div key={q.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ndp-text">{q.name}</span>
                  <span className="text-ndp-text-dim">{q.count}</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ndp-accent rounded-full transition-all duration-500"
                    style={{ width: `${(q.count / maxQualityCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ndp-text">Movies Added (Last 12 Months)</h3>
          <div className="card p-5">
            <div className="flex items-end gap-1.5 h-40">
              {data.timeline.map((t) => (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] text-ndp-text-dim">{t.count > 0 ? t.count : ''}</span>
                  <div
                    className="w-full bg-ndp-accent/80 rounded-t transition-all duration-500 min-h-[2px]"
                    style={{
                      height: t.count > 0 ? `${Math.max((t.count / maxTimelineCount) * 100, 5)}%` : '2px',
                    }}
                  />
                  <span className="text-[9px] text-ndp-text-dim whitespace-nowrap">{formatMonth(t.month)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Root Folders */}
      {data.rootFolders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ndp-text">Root Folders</h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-ndp-text-dim font-medium">Path</th>
                  <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[100px]">Movies</th>
                  <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[100px]">Size</th>
                </tr>
              </thead>
              <tbody>
                {data.rootFolders.map((rf) => (
                  <tr key={rf.path} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-ndp-text break-all">{rf.path}</td>
                    <td className="px-4 py-3 text-right text-ndp-text-dim">{rf.count}</td>
                    <td className="px-4 py-3 text-right text-ndp-text-dim">{formatSize(rf.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
