import React, { useState, useEffect, useCallback, useRef } from 'react';

interface QueueRecord {
  id: number;
  movieId: number;
  title: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: { title: string; messages: string[] }[];
  size: number;
  sizeleft: number;
  timeleft?: string;
  estimatedCompletionTime?: string;
  protocol: string;
  downloadClient?: string;
  quality: { quality: { id: number; name: string } };
  movie?: { title: string; year: number };
}

interface QueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: QueueRecord[];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function getStatusColor(status: string, trackedState?: string): string {
  const s = (trackedState || status || '').toLowerCase();
  if (s === 'completed' || s === 'importpending' || s === 'imported') return 'text-ndp-success';
  if (s === 'failed') return 'text-ndp-error';
  if (s === 'warning') return 'text-yellow-400';
  if (s === 'downloading' || s === 'delay') return 'text-ndp-accent';
  return 'text-ndp-text-dim';
}

function getStatusLabel(status: string, trackedState?: string): string {
  const s = trackedState || status || 'unknown';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DownloadsTab() {
  const [queue, setQueue] = useState<QueueRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchQueue = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const r = await fetch('/api/plugins/radarr/queue?page=1&pageSize=50', {
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: QueueResponse = await r.json();
      setQueue(data.records || []);
      setTotalRecords(data.totalRecords || 0);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(true);
    intervalRef.current = setInterval(() => fetchQueue(false), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchQueue]);

  const handleRemove = async (id: number, blocklist = false) => {
    setRemovingId(id);
    try {
      const params = blocklist ? '?blocklist=true&removeFromClient=true' : '';
      const r = await fetch(`/api/plugins/radarr/queue/${id}${params}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Remove failed');
      setQueue((prev) => prev.filter((item) => item.id !== id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      showMessage(blocklist ? 'Removed and blocklisted' : 'Removed from queue', 'success');
    } catch {
      showMessage('Failed to remove from queue', 'error');
    }
    setRemovingId(null);
  };

  const totalSize = queue.reduce((sum, item) => sum + item.size, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Message */}
      {message && (
        <div
          className={
            'rounded-lg text-sm font-medium ' +
            (message.type === 'success'
              ? 'bg-ndp-success/15 text-ndp-success'
              : 'bg-ndp-error/15 text-ndp-error')
          }
          style={{ padding: '8px 16px' }}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ndp-text">Active Downloads</h2>
        <div className="flex items-center" style={{ gap: 16 }}>
          <span className="text-sm text-ndp-text-dim">
            {totalRecords} item{totalRecords !== 1 ? 's' : ''}
          </span>
          {totalSize > 0 && (
            <span className="text-sm text-ndp-text-dim">{formatSize(totalSize)} total</span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center" style={{ padding: '48px 0' }}>
          <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card text-center" style={{ padding: 24 }}>
          <p className="text-ndp-error text-sm">{error}</p>
          <button
            onClick={() => fetchQueue(true)}
            className="btn-primary text-sm"
            style={{ marginTop: 12, padding: '6px 16px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && queue.length === 0 && (
        <div className="card text-center text-ndp-text-dim text-sm" style={{ padding: 48 }}>
          No active downloads
        </div>
      )}

      {/* Queue table */}
      {!loading && !error && queue.length > 0 && (
        <div className="card overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead>
                <tr className="border-b border-white/5">
                  <th
                    className="text-left text-ndp-text-dim font-medium"
                    style={{ padding: '12px 16px' }}
                  >
                    Movie
                  </th>
                  <th
                    className="text-left text-ndp-text-dim font-medium"
                    style={{ padding: '12px 16px', width: 90 }}
                  >
                    Quality
                  </th>
                  <th
                    className="text-left text-ndp-text-dim font-medium"
                    style={{ padding: '12px 16px', width: 200 }}
                  >
                    Progress
                  </th>
                  <th
                    className="text-right text-ndp-text-dim font-medium"
                    style={{ padding: '12px 16px', width: 80 }}
                  >
                    Time Left
                  </th>
                  <th
                    className="text-center text-ndp-text-dim font-medium"
                    style={{ padding: '12px 16px', width: 100 }}
                  >
                    Status
                  </th>
                  <th
                    className="text-left text-ndp-text-dim font-medium"
                    style={{ padding: '12px 16px', width: 110 }}
                  >
                    Client
                  </th>
                  <th style={{ padding: '12px 16px', width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const progress =
                    item.size > 0 ? ((item.size - item.sizeleft) / item.size) * 100 : 0;
                  const progressPct = Math.min(100, Math.max(0, progress));
                  const statusColor = getStatusColor(
                    item.status,
                    item.trackedDownloadState,
                  );
                  const statusLabel = getStatusLabel(
                    item.status,
                    item.trackedDownloadState,
                  );
                  const isRemoving = removingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Movie title */}
                      <td style={{ padding: '10px 16px' }}>
                        <div>
                          <span className="text-ndp-text text-sm font-medium">
                            {item.movie?.title || item.title}
                          </span>
                          {item.movie?.year && (
                            <span className="text-ndp-text-dim" style={{ marginLeft: 6 }}>
                              ({item.movie.year})
                            </span>
                          )}
                        </div>
                        {item.statusMessages && item.statusMessages.length > 0 && (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {item.statusMessages.map((sm, i) => (
                              <div key={i}>
                                {sm.messages.map((msg, j) => (
                                  <span
                                    key={j}
                                    className="text-ndp-text-dim"
                                    style={{ fontSize: 10, lineHeight: '14px', display: 'block' }}
                                  >
                                    {msg}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Quality */}
                      <td className="text-xs text-ndp-text-dim" style={{ padding: '10px 16px' }}>
                        {item.quality?.quality?.name || '-'}
                      </td>

                      {/* Progress */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: 'rgba(255,255,255,0.08)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: '100%',
                                borderRadius: 3,
                                backgroundColor:
                                  progressPct >= 100
                                    ? 'var(--color-ndp-success, #22c55e)'
                                    : 'var(--color-ndp-accent, #3b82f6)',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span
                            className="text-xs text-ndp-text-dim"
                            style={{ minWidth: 38, textAlign: 'right' }}
                          >
                            {progressPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-ndp-text-dim" style={{ marginTop: 2 }}>
                          {formatSize(item.size - item.sizeleft)} / {formatSize(item.size)}
                        </div>
                      </td>

                      {/* Time left */}
                      <td
                        className="text-right text-xs text-ndp-text-dim"
                        style={{ padding: '10px 16px' }}
                      >
                        {item.timeleft || '-'}
                      </td>

                      {/* Status */}
                      <td className="text-center" style={{ padding: '10px 16px' }}>
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>

                      {/* Client */}
                      <td className="text-xs text-ndp-text-dim" style={{ padding: '10px 16px' }}>
                        {item.downloadClient || '-'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 16px' }}>
                        <div className="flex items-center justify-end" style={{ gap: 6 }}>
                          <button
                            onClick={() => handleRemove(item.id, false)}
                            disabled={isRemoving}
                            className="rounded-lg text-xs font-medium bg-white/10 text-ndp-text-dim hover:bg-white/15 hover:text-ndp-text transition-colors disabled:opacity-50"
                            style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}
                            title="Remove from queue"
                          >
                            {isRemoving ? (
                              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              'Remove'
                            )}
                          </button>
                          <button
                            onClick={() => handleRemove(item.id, true)}
                            disabled={isRemoving}
                            className="rounded-lg text-xs font-medium bg-ndp-error/10 text-ndp-error hover:bg-ndp-error/20 transition-colors disabled:opacity-50"
                            style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}
                            title="Remove and add to blocklist"
                          >
                            Blocklist
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
