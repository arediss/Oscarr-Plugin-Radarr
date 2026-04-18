import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface MovieFile {
  id: number;
  movieId: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  quality: { quality: { id: number; name: string; resolution: number } };
  mediaInfo?: {
    audioBitrate: number;
    audioChannels: number;
    audioCodec: string;
    audioLanguages: string;
    audioStreamCount: number;
    videoBitDepth: number;
    videoBitrate: number;
    videoCodec: string;
    videoDynamicRangeType: string;
    videoFps: number;
    resolution: string;
    runTime: string;
    scanType: string;
    subtitles: string;
  };
}

interface MovieDetail {
  id: number;
  title: string;
  year: number;
  overview?: string;
  monitored: boolean;
  hasFile: boolean;
  sizeOnDisk: number;
  qualityProfileId: number;
  path: string;
  runtime?: number;
  genres?: string[];
  imdbId?: string;
  tmdbId?: number;
  images: { coverType: string; remoteUrl?: string; url?: string }[];
  movieFile?: MovieFile;
}

interface Release {
  guid: string;
  quality: { quality: { id: number; name: string; resolution: number } };
  age: number;
  ageHours: number;
  ageMinutes: number;
  size: number;
  indexer: string;
  indexerId?: number;
  title: string;
  approved: boolean;
  rejections: string[];
  seeders?: number;
  leechers?: number;
  protocol: string;
  customFormatScore?: number;
}

interface HistoryItem {
  id: number;
  movieId: number;
  sourceTitle: string;
  quality: { quality: { id: number; name: string } };
  date: string;
  eventType: string;
  data?: Record<string, string>;
}

interface QueueItem {
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
}

interface BlocklistItem {
  id: number;
  movieId: number;
  sourceTitle: string;
  date: string;
  quality: { quality: { id: number; name: string } };
  message?: string;
}

interface MovieModalProps {
  movieId: number;
  onClose: () => void;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatAge(days: number, hours?: number, minutes?: number): string {
  if (days === 0 && hours !== undefined) {
    if (hours === 0 && minutes !== undefined) return `${minutes}m`;
    return `${hours}h`;
  }
  if (days === 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';
type SearchPhase = 'idle' | 'searching' | 'polling' | 'fetching-releases' | 'done' | 'error';
type TabId = 'overview' | 'releases' | 'history' | 'queue' | 'blocklist';

interface InlineMessage {
  text: string;
  type: 'success' | 'error';
}

const EVENT_META: Record<string, { label: string; color: string; bg: string }> = {
  grabbed: { label: 'Grabbed', color: 'text-sky-300', bg: 'bg-sky-500/15' },
  downloadFolderImported: { label: 'Imported', color: 'text-ndp-success', bg: 'bg-ndp-success/15' },
  downloadFailed: { label: 'Failed', color: 'text-ndp-error', bg: 'bg-ndp-error/15' },
  movieFileDeleted: { label: 'Deleted', color: 'text-ndp-text-dim', bg: 'bg-white/5' },
  movieFileRenamed: { label: 'Renamed', color: 'text-ndp-text-dim', bg: 'bg-white/5' },
  movieFolderImported: { label: 'Imported', color: 'text-ndp-success', bg: 'bg-ndp-success/15' },
  downloadIgnored: { label: 'Ignored', color: 'text-amber-300', bg: 'bg-amber-500/15' },
};

function eventMeta(eventType: string) {
  return EVENT_META[eventType] ?? { label: eventType, color: 'text-ndp-text-dim', bg: 'bg-white/5' };
}

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export function MovieModal({ movieId, onClose }: MovieModalProps) {
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [files, setFiles] = useState<MovieFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  // Slide-in panel: starts off-screen to the right, animates to 0 after mount.
  const [panelVisible, setPanelVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPanelVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const [searchPhase, setSearchPhase] = useState<SearchPhase>('idle');
  const [refreshState, setRefreshState] = useState<ActionState>('idle');
  const [monitorState, setMonitorState] = useState<ActionState>('idle');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteState, setDeleteState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<InlineMessage | null>(null);

  const [releases, setReleases] = useState<Release[]>([]);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [grabbedGuids, setGrabbedGuids] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);

  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [removingQueue, setRemovingQueue] = useState<number | null>(null);

  const [blocklist, setBlocklist] = useState<BlocklistItem[] | null>(null);
  const [blocklistLoading, setBlocklistLoading] = useState(false);
  const [unblocking, setUnblocking] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Load movie details on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plugins/radarr/movies/${movieId}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMovie(data.movie);
        setFiles(data.files || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load movie details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [movieId]);

  // Queue is fetched on mount too — we need the badge count for the tab header.
  useEffect(() => {
    let cancelled = false;
    setQueueLoading(true);
    fetch(`/api/plugins/radarr/movies/${movieId}/queue`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((data) => { if (!cancelled) setQueue(data.items ?? []); })
      .catch(() => { if (!cancelled) setQueue([]); })
      .finally(() => { if (!cancelled) setQueueLoading(false); });
    return () => { cancelled = true; };
  }, [movieId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Lazy-load history when its tab is first opened.
  const loadHistory = useCallback(async () => {
    if (history !== null) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/history`, { credentials: 'include' });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setHistory(data.items ?? []);
    } catch {
      setHistory([]);
      showMessage('Failed to load history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [history, movieId]);

  const loadBlocklist = useCallback(async () => {
    if (blocklist !== null) return;
    setBlocklistLoading(true);
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/blocklist`, { credentials: 'include' });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setBlocklist(data.items ?? []);
    } catch {
      setBlocklist([]);
      showMessage('Failed to load blocklist', 'error');
    } finally {
      setBlocklistLoading(false);
    }
  }, [blocklist, movieId]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'blocklist') loadBlocklist();
  }, [activeTab, loadHistory, loadBlocklist]);

  const fetchReleases = useCallback(async () => {
    setSearchPhase('fetching-releases');
    try {
      const r = await fetch(`/api/plugins/radarr/releases/${movieId}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch releases');
      const data = await r.json();
      setReleases(data || []);
      setSearchPhase('done');
    } catch {
      setSearchPhase('error');
      showMessage('Failed to fetch releases', 'error');
    }
  }, [movieId]);

  const handleSearch = async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setActiveTab('releases');
    setSearchPhase('searching');
    setReleases([]);
    setGrabbedGuids(new Set());

    try {
      const r = await fetch(`/api/plugins/radarr/search/${movieId}`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('Search failed');
      const data = await r.json();
      const commandId = data.commandId;

      if (!commandId) {
        await fetchReleases();
        return;
      }

      setSearchPhase('polling');
      pollRef.current = setInterval(async () => {
        try {
          const statusR = await fetch(`/api/plugins/radarr/command/${commandId}`, { credentials: 'include' });
          if (!statusR.ok) throw new Error('Poll failed');
          const statusData = await statusR.json();

          if (statusData.status === 'completed') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await fetchReleases();
          } else if (statusData.status === 'failed') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            showMessage('Search command failed — showing cached releases if any', 'error');
            await fetchReleases();
          }
        } catch {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setSearchPhase('error');
          showMessage('Failed to poll search status', 'error');
        }
      }, 2000);
    } catch {
      setSearchPhase('error');
      showMessage('Search failed', 'error');
    }
  };

  const handleRefresh = async () => {
    setRefreshState('loading');
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/refresh`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error();
      setRefreshState('success');
      showMessage('Refresh command sent', 'success');
    } catch {
      setRefreshState('error');
      showMessage('Refresh failed', 'error');
    }
    setTimeout(() => setRefreshState('idle'), 2000);
  };

  const handleToggleMonitored = async () => {
    if (!movie) return;
    setMonitorState('loading');
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/monitored`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: !movie.monitored }),
      });
      if (!r.ok) throw new Error();
      setMovie({ ...movie, monitored: !movie.monitored });
      setMonitorState('success');
      showMessage(`Movie ${movie.monitored ? 'unmonitored' : 'monitored'}`, 'success');
    } catch {
      setMonitorState('error');
      showMessage('Toggle monitored failed', 'error');
    }
    setTimeout(() => setMonitorState('idle'), 2000);
  };

  const handleDeleteFile = async (fileId: number) => {
    setDeleteState('loading');
    try {
      const r = await fetch(`/api/plugins/radarr/files/${fileId}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error();
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (movie) setMovie({ ...movie, hasFile: false, sizeOnDisk: 0 });
      setDeleteState('success');
      setDeleteConfirm(false);
      showMessage('File deleted', 'success');
    } catch {
      setDeleteState('error');
      showMessage('Delete failed', 'error');
    }
    setTimeout(() => setDeleteState('idle'), 2000);
  };

  const handleGrab = async (release: Release) => {
    setGrabbing(release.guid);
    try {
      const r = await fetch('/api/plugins/radarr/releases/grab', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guid: release.guid, indexerId: release.indexerId || 0 }),
      });
      if (!r.ok) throw new Error();
      setGrabbedGuids((prev) => new Set(prev).add(release.guid));
      showMessage('Release grabbed', 'success');
    } catch {
      showMessage('Failed to grab release', 'error');
    }
    setGrabbing(null);
  };

  const handleRetryFailed = async (historyId: number) => {
    setRetrying(historyId);
    try {
      const r = await fetch(`/api/plugins/radarr/history/failed/${historyId}`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error();
      showMessage('Retry triggered — a new search will run', 'success');
    } catch {
      showMessage('Retry failed', 'error');
    }
    setRetrying(null);
  };

  const handleRemoveQueue = async (itemId: number, blocklistFlag: boolean) => {
    setRemovingQueue(itemId);
    try {
      const params = new URLSearchParams({ removeFromClient: 'true', blocklist: String(blocklistFlag) });
      const r = await fetch(`/api/plugins/radarr/queue/${itemId}?${params}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error();
      setQueue((prev) => (prev ?? []).filter((q) => q.id !== itemId));
      showMessage(blocklistFlag ? 'Removed & blocklisted' : 'Removed from queue', 'success');
    } catch {
      showMessage('Failed to remove queue item', 'error');
    }
    setRemovingQueue(null);
  };

  const handleUnblock = async (blocklistId: number) => {
    setUnblocking(blocklistId);
    try {
      const r = await fetch(`/api/plugins/radarr/blocklist/${blocklistId}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error();
      setBlocklist((prev) => (prev ?? []).filter((b) => b.id !== blocklistId));
      showMessage('Removed from blocklist', 'success');
    } catch {
      showMessage('Failed to remove from blocklist', 'error');
    }
    setUnblocking(null);
  };

  const isSearchBusy = searchPhase === 'searching' || searchPhase === 'polling' || searchPhase === 'fetching-releases';

  const searchButtonLabel = () => {
    switch (searchPhase) {
      case 'searching': return 'Sending search…';
      case 'polling': return 'Waiting for results…';
      case 'fetching-releases': return 'Loading releases…';
      default: return 'Search';
    }
  };

  const poster = movie?.images?.find((i) => i.coverType === 'poster');
  const posterUrl = poster?.remoteUrl || poster?.url || null;
  const primaryFile = files[0] || movie?.movieFile || null;
  const mediaInfo = primaryFile?.mediaInfo;

  const queueCount = queue?.length ?? 0;
  const blocklistCount = blocklist?.length ?? 0;

  const TABS: { id: TabId; label: string; badge?: number; badgeTone?: 'accent' | 'dim' }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'releases', label: 'Releases', badge: releases.length || undefined, badgeTone: 'dim' },
    { id: 'history', label: 'History' },
    { id: 'queue', label: 'Queue', badge: queueCount || undefined, badgeTone: 'accent' },
    { id: 'blocklist', label: 'Blocklist', badge: blocklistCount || undefined, badgeTone: 'dim' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={
          'w-full max-w-5xl bg-ndp-surface border-l border-white/5 ' +
          'flex flex-col shadow-2xl shadow-black/60 transition-transform duration-300 ease-out ' +
          (panelVisible ? 'translate-x-0' : 'translate-x-full')
        }
        style={{ position: 'fixed', top: 0, right: 0, height: '100dvh' }}
      >
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-ndp-text-dim hover:text-ndp-text transition-colors"
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, zIndex: 10 }}
          aria-label="Close"
        >
          <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-6 text-center">
            <p className="text-ndp-error">{error}</p>
          </div>
        )}

        {movie && !loading && (
          <>
            {/* Header — always visible */}
            <div className="flex gap-5 p-6 pr-14 border-b border-white/5 flex-shrink-0">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie.title}
                  className="object-cover rounded-xl flex-shrink-0"
                  style={{ width: 128, height: 192 }}
                />
              ) : (
                <div
                  className="bg-white/5 rounded-xl flex items-center justify-center text-ndp-text-dim flex-shrink-0 text-xs"
                  style={{ width: 128, height: 192 }}
                >
                  No Poster
                </div>
              )}
              <div className="min-w-0 flex-1 flex flex-col">
                <h2 className="text-xl sm:text-2xl font-bold text-ndp-text leading-tight">
                  {movie.title}
                  <span className="text-ndp-text-dim font-normal ml-2">({movie.year})</span>
                </h2>

                <div className="flex items-center flex-wrap gap-2 mt-2 text-xs">
                  <span
                    className={
                      'inline-block px-2.5 py-0.5 rounded-full font-medium ' +
                      (!movie.monitored
                        ? 'bg-white/10 text-ndp-text-dim'
                        : movie.hasFile
                          ? 'bg-ndp-success/15 text-ndp-success'
                          : 'bg-ndp-error/15 text-ndp-error')
                    }
                  >
                    {!movie.monitored ? 'Unmonitored' : movie.hasFile ? 'Downloaded' : 'Missing'}
                  </span>
                  {queueCount > 0 && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full font-medium bg-sky-500/20 text-sky-300">
                      Downloading
                    </span>
                  )}
                  {movie.sizeOnDisk > 0 && (
                    <span className="text-ndp-text-dim">{formatSize(movie.sizeOnDisk)}</span>
                  )}
                  {formatRuntime(movie.runtime) && (
                    <span className="text-ndp-text-dim">· {formatRuntime(movie.runtime)}</span>
                  )}
                  {movie.genres && movie.genres.length > 0 && (
                    <span className="text-ndp-text-dim truncate">· {movie.genres.slice(0, 3).join(', ')}</span>
                  )}
                </div>

                {movie.overview && (
                  <p className="text-sm text-ndp-text-dim leading-relaxed mt-3 line-clamp-3">
                    {movie.overview}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs">
                  {movie.tmdbId && (
                    <a
                      href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ndp-accent hover:underline"
                    >
                      TMDB
                    </a>
                  )}
                  {movie.imdbId && (
                    <a
                      href={`https://www.imdb.com/title/${movie.imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ndp-accent hover:underline"
                    >
                      IMDb
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs + actions — single horizontal strip */}
            <div className="flex items-center justify-between gap-3 border-b border-white/5 flex-shrink-0 pl-4 pr-3">
              <div
                className="flex gap-1 overflow-x-auto flex-1 min-w-0 pt-3"
                style={{ scrollbarWidth: 'none' }}
              >
                {TABS.map(({ id, label, badge, badgeTone }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={
                        'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ' +
                        (active
                          ? 'border-ndp-accent text-ndp-accent'
                          : 'border-transparent text-ndp-text-dim hover:text-ndp-text')
                      }
                    >
                      {label}
                      {badge !== undefined && (
                        <span
                          className={
                            'text-[10px] px-1.5 py-0.5 rounded-full font-semibold ' +
                            (badgeTone === 'accent'
                              ? 'bg-sky-500/25 text-sky-300'
                              : 'bg-white/10 text-ndp-text-dim')
                          }
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 py-2">
                <button
                  onClick={handleSearch}
                  disabled={isSearchBusy}
                  className="text-xs font-medium rounded-lg bg-ndp-accent text-white hover:bg-ndp-accent/90 transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap"
                >
                  {isSearchBusy ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                      Searching
                    </span>
                  ) : 'Search'}
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshState === 'loading'}
                  className="text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-ndp-text transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap"
                >
                  {refreshState === 'loading' ? 'Refreshing…' : 'Refresh'}
                </button>

                <button
                  onClick={handleToggleMonitored}
                  disabled={monitorState === 'loading'}
                  className={
                    'text-xs font-medium rounded-lg transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap ' +
                    (movie.monitored
                      ? 'bg-white/10 hover:bg-white/15 text-ndp-text'
                      : 'bg-ndp-accent/20 hover:bg-ndp-accent/30 text-ndp-accent')
                  }
                >
                  {monitorState === 'loading' ? '…' : (movie.monitored ? 'Unmonitor' : 'Monitor')}
                </button>

                {primaryFile && (!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="text-xs font-medium rounded-lg bg-ndp-error/10 hover:bg-ndp-error/20 text-ndp-error transition-colors px-3 py-1.5 whitespace-nowrap"
                  >
                    Delete
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleDeleteFile(primaryFile.id)}
                      disabled={deleteState === 'loading'}
                      className="text-xs font-medium rounded-lg bg-ndp-error text-white hover:bg-ndp-error/80 transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap"
                    >
                      {deleteState === 'loading' ? '…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="text-xs font-medium rounded-lg bg-white/10 text-ndp-text-dim hover:bg-white/15 transition-colors px-3 py-1.5 whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </>
                ))}
              </div>
            </div>

            {/* Inline Message */}
            {message && (
              <div
                className={
                  'mx-6 mt-3 rounded-lg text-sm font-medium px-4 py-2 flex-shrink-0 ' +
                  (message.type === 'success'
                    ? 'bg-ndp-success/15 text-ndp-success'
                    : 'bg-ndp-error/15 text-ndp-error')
                }
              >
                {message.text}
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <OverviewTab movie={movie} file={primaryFile} mediaInfo={mediaInfo} />
              )}

              {activeTab === 'releases' && (
                <ReleasesTab
                  releases={releases}
                  phase={searchPhase}
                  searchLabel={searchButtonLabel()}
                  grabbing={grabbing}
                  grabbedGuids={grabbedGuids}
                  onGrab={handleGrab}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  items={history}
                  loading={historyLoading}
                  retrying={retrying}
                  onRetry={handleRetryFailed}
                />
              )}

              {activeTab === 'queue' && (
                <QueueTab
                  items={queue}
                  loading={queueLoading}
                  removing={removingQueue}
                  onRemove={handleRemoveQueue}
                />
              )}

              {activeTab === 'blocklist' && (
                <BlocklistTab
                  items={blocklist}
                  loading={blocklistLoading}
                  unblocking={unblocking}
                  onUnblock={handleUnblock}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tabs
// ──────────────────────────────────────────────────────────────────

function OverviewTab({
  movie,
  file,
  mediaInfo,
}: {
  movie: MovieDetail;
  file: MovieFile | null;
  mediaInfo: MovieFile['mediaInfo'] | undefined;
}) {
  if (!file) {
    return (
      <div className="text-center py-12 text-sm text-ndp-text-dim">
        No file on disk for this movie yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section title="File Information">
        <Grid>
          <Field label="Path"><span className="break-all">{file.path}</span></Field>
          <Field label="Size">{formatSize(file.size)}</Field>
          {mediaInfo && (
            <>
              <Field label="Video">
                {mediaInfo.videoCodec}{mediaInfo.videoDynamicRangeType ? ` (${mediaInfo.videoDynamicRangeType})` : ''}
              </Field>
              <Field label="Resolution">{mediaInfo.resolution}</Field>
              <Field label="Audio">{mediaInfo.audioCodec} {mediaInfo.audioChannels}ch</Field>
              <Field label="Languages">{mediaInfo.audioLanguages || '—'}</Field>
              {mediaInfo.subtitles && <Field label="Subtitles" span>{mediaInfo.subtitles}</Field>}
              {mediaInfo.runTime && <Field label="Runtime">{mediaInfo.runTime}</Field>}
            </>
          )}
          <Field label="Added">{formatRelativeDate(file.dateAdded)}</Field>
        </Grid>
      </Section>

      <Section title="Quality">
        <div className="card p-4">
          <span className="text-sm text-ndp-text">
            {file.quality?.quality?.name || 'Unknown'}
            {file.quality?.quality?.resolution ? ` (${file.quality.quality.resolution}p)` : ''}
          </span>
        </div>
      </Section>
    </div>
  );
}

function ReleasesTab({
  releases,
  phase,
  searchLabel,
  grabbing,
  grabbedGuids,
  onGrab,
}: {
  releases: Release[];
  phase: SearchPhase;
  searchLabel: string;
  grabbing: string | null;
  grabbedGuids: Set<string>;
  onGrab: (r: Release) => void;
}) {
  const isBusy = phase === 'searching' || phase === 'polling' || phase === 'fetching-releases';
  const approved = releases.filter((r) => r.approved);
  const rejected = releases.filter((r) => !r.approved);

  if (isBusy && releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-ndp-text-dim">
        <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">{searchLabel}</span>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ndp-text-dim">
        {phase === 'done'
          ? 'No releases found. Check indexer configuration in Radarr.'
          : 'Click Search above to look for available releases.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-ndp-text-dim">
        {approved.length} approved · {rejected.length} rejected
      </div>

      {approved.length > 0 && (
        <ReleaseList
          title={`Approved (${approved.length})`}
          releases={approved}
          grabbing={grabbing}
          grabbedGuids={grabbedGuids}
          onGrab={onGrab}
        />
      )}

      {rejected.length > 0 && (
        <ReleaseList
          title={`Rejected (${rejected.length})`}
          releases={rejected}
          grabbing={grabbing}
          grabbedGuids={grabbedGuids}
          onGrab={onGrab}
          showRejections
        />
      )}
    </div>
  );
}

function ReleaseList({
  title,
  releases,
  grabbing,
  grabbedGuids,
  onGrab,
  showRejections = false,
}: {
  title: string;
  releases: Release[];
  grabbing: string | null;
  grabbedGuids: Set<string>;
  onGrab: (r: Release) => void;
  showRejections?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-ndp-text-dim">{title}</h4>
      <div className="space-y-2">
        {releases.map((r) => {
          const isGrabbed = grabbedGuids.has(r.guid);
          return (
            <div
              key={r.guid}
              className={
                'card p-3 space-y-2 ' +
                (showRejections ? 'opacity-75' : '')
              }
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ndp-text break-all leading-snug">{r.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim">
                    <span className="text-ndp-text">{r.quality?.quality?.name || '—'}</span>
                    <span>·</span>
                    <span>{formatSize(r.size)}</span>
                    <span>·</span>
                    <span>{r.indexer || '—'}</span>
                    <span>·</span>
                    <span>{formatAge(r.age, r.ageHours, r.ageMinutes)}</span>
                    {r.protocol === 'torrent' && (
                      <>
                        <span>·</span>
                        <span>{r.seeders ?? '—'}/{r.leechers ?? '—'} S/L</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="uppercase tracking-wider">{r.protocol === 'torrent' ? 'Torrent' : 'Usenet'}</span>
                    {typeof r.customFormatScore === 'number' && r.customFormatScore !== 0 && (
                      <>
                        <span>·</span>
                        <span className={r.customFormatScore > 0 ? 'text-ndp-success' : 'text-ndp-error'}>
                          CF {r.customFormatScore > 0 ? '+' : ''}{r.customFormatScore}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isGrabbed ? (
                    <span className="text-[11px] text-ndp-success font-medium">Grabbed</span>
                  ) : (
                    <button
                      onClick={() => onGrab(r)}
                      disabled={grabbing === r.guid}
                      className="rounded-lg text-xs font-medium bg-ndp-accent/20 text-ndp-accent hover:bg-ndp-accent/30 transition-colors disabled:opacity-50 px-3 py-1.5"
                    >
                      {grabbing === r.guid ? (
                        <span className="w-2.5 h-2.5 border border-ndp-accent border-t-transparent rounded-full animate-spin block" />
                      ) : 'Grab'}
                    </button>
                  )}
                </div>
              </div>

              {showRejections && r.rejections && r.rejections.length > 0 && (
                <ul className="border-t border-white/5 pt-2 space-y-1">
                  {r.rejections.map((reason, i) => (
                    <li key={i} className="text-[11px] text-ndp-error/80 flex items-start gap-1.5">
                      <span className="text-ndp-error mt-0.5">✕</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab({
  items,
  loading,
  retrying,
  onRetry,
}: {
  items: HistoryItem[] | null;
  loading: boolean;
  retrying: number | null;
  onRetry: (id: number) => void;
}) {
  if (loading && items === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ndp-text-dim">
        No history events for this movie yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const meta = eventMeta(item.eventType);
        const isFailed = item.eventType === 'downloadFailed';
        return (
          <div key={item.id} className="card p-3 flex items-start gap-3">
            <span
              className={`flex-shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}
            >
              {meta.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ndp-text break-all leading-snug">{item.sourceTitle}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim">
                <span className="text-ndp-text">{item.quality?.quality?.name || '—'}</span>
                <span>·</span>
                <span>{formatRelativeDate(item.date)}</span>
                {item.data?.downloadClient && (
                  <>
                    <span>·</span>
                    <span>{item.data.downloadClient}</span>
                  </>
                )}
                {item.data?.reason && (
                  <>
                    <span>·</span>
                    <span className="text-ndp-error/80">{item.data.reason}</span>
                  </>
                )}
              </div>
            </div>
            {isFailed && (
              <button
                onClick={() => onRetry(item.id)}
                disabled={retrying === item.id}
                className="flex-shrink-0 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 px-3 py-1.5"
              >
                {retrying === item.id ? 'Retrying…' : 'Retry'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QueueTab({
  items,
  loading,
  removing,
  onRemove,
}: {
  items: QueueItem[] | null;
  loading: boolean;
  removing: number | null;
  onRemove: (id: number, blocklistFlag: boolean) => void;
}) {
  if (loading && items === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ndp-text-dim">
        Nothing in the download queue for this movie.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const total = item.size || 0;
        const left = item.sizeleft || 0;
        const done = Math.max(0, total - left);
        const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        return (
          <div key={item.id} className="card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ndp-text break-all leading-snug">{item.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim">
                  <span className="text-ndp-text">{item.quality?.quality?.name || '—'}</span>
                  <span>·</span>
                  <span>{formatSize(total)}</span>
                  <span>·</span>
                  <span>{item.downloadClient || '—'}</span>
                  <span>·</span>
                  <span className="uppercase tracking-wider">{item.protocol}</span>
                  {item.timeleft && (
                    <>
                      <span>·</span>
                      <span>ETA {item.timeleft}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="flex-shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
                {item.status}
              </span>
            </div>

            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-ndp-accent transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-ndp-text-dim">
              <span>{formatSize(done)} / {formatSize(total)}</span>
              <span className="font-semibold text-ndp-accent">{pct}%</span>
            </div>

            {item.statusMessages && item.statusMessages.length > 0 && (
              <ul className="border-t border-white/5 pt-2 space-y-1">
                {item.statusMessages.flatMap((m) =>
                  m.messages.map((msg, i) => (
                    <li key={`${m.title}-${i}`} className="text-[11px] text-amber-300/80 flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">⚠</span>
                      <span>{msg}</span>
                    </li>
                  ))
                )}
              </ul>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onRemove(item.id, false)}
                disabled={removing === item.id}
                className="rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-ndp-text transition-colors disabled:opacity-50 px-3 py-1.5"
              >
                {removing === item.id ? 'Removing…' : 'Remove'}
              </button>
              <button
                onClick={() => onRemove(item.id, true)}
                disabled={removing === item.id}
                className="rounded-lg text-xs font-medium bg-ndp-error/10 hover:bg-ndp-error/20 text-ndp-error transition-colors disabled:opacity-50 px-3 py-1.5"
              >
                Remove & Blocklist
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlocklistTab({
  items,
  loading,
  unblocking,
  onUnblock,
}: {
  items: BlocklistItem[] | null;
  loading: boolean;
  unblocking: number | null;
  onUnblock: (id: number) => void;
}) {
  if (loading && items === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ndp-text-dim">
        No blocklisted releases for this movie.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="card p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ndp-text break-all leading-snug">{item.sourceTitle}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim">
              <span className="text-ndp-text">{item.quality?.quality?.name || '—'}</span>
              <span>·</span>
              <span>{formatRelativeDate(item.date)}</span>
              {item.message && (
                <>
                  <span>·</span>
                  <span className="text-ndp-error/80">{item.message}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => onUnblock(item.id)}
            disabled={unblocking === item.id}
            className="flex-shrink-0 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-ndp-text transition-colors disabled:opacity-50 px-3 py-1.5"
          >
            {unblocking === item.id ? 'Removing…' : 'Unblock'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Shared layout bits
// ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ndp-text-dim">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="card p-4 text-sm grid gap-y-2 gap-x-6"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
    >
      {children}
    </div>
  );
}

function Field({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <span className="text-ndp-text-dim">{label}: </span>
      <span className="text-ndp-text">{children}</span>
    </div>
  );
}
