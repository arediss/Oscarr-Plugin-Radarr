import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MovieModal } from './MovieModal';

interface MovieSummary {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  monitored: boolean;
  status: string;
  hasFile: boolean;
  sizeOnDisk: number;
  qualityProfileId: number;
  rootFolderPath: string;
  added: string;
  poster: string | null;
  qualityName: string | null;
}

interface QualityProfile {
  id: number;
  name: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function getStatusInfo(movie: MovieSummary): { label: string; className: string } {
  if (!movie.monitored) return { label: 'Unmonitored', className: 'bg-white/10 text-ndp-text-dim' };
  if (movie.hasFile) return { label: 'Downloaded', className: 'bg-ndp-success/15 text-ndp-success' };
  return { label: 'Missing', className: 'bg-ndp-error/15 text-ndp-error' };
}

const PAGE_SIZE = 50;

export function LibraryTab() {
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try { return (localStorage.getItem('plugin-radarr-library-view') as 'table' | 'cards') || 'table'; }
    catch { return 'table'; }
  });

  const updateViewMode = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try { localStorage.setItem('plugin-radarr-library-view', mode); } catch {}
  };

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build query string
  const buildQuery = useCallback((p: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (profileFilter !== 'all') params.set('qualityProfileId', profileFilter);
    return params.toString();
  }, [debouncedSearch, statusFilter, profileFilter]);

  // Fetch a page of movies
  const fetchPage = useCallback(async (p: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetch(`/api/plugins/radarr/movies?${buildQuery(p)}`, { credentials: 'include' });
      const data = await res.json();
      if (append) {
        setMovies(prev => [...prev, ...(data.movies || [])]);
      } else {
        setMovies(data.movies || []);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(p);
    } catch (err: any) {
      setError(err.message || 'Failed to load movies');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  // Initial load + reload on filter change
  useEffect(() => {
    setMovies([]);
    setPage(1);
    fetchPage(1, false);
  }, [debouncedSearch, statusFilter, profileFilter]);

  // Load profiles once
  useEffect(() => {
    fetch('/api/plugins/radarr/profiles', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setProfiles(data || []))
      .catch(() => {});
  }, []);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPage(page + 1, true);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchPage]);

  const profileMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of profiles) map[p.id] = p.name;
    return map;
  }, [profiles]);

  if (loading && movies.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div style={{ width: 32, height: 32, border: '2px solid', borderColor: 'var(--ndp-accent, #6366f1) transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error && movies.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-ndp-error">{error}</p>
      </div>
    );
  }

  return (<>
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[200px] text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input text-sm min-w-[150px]"
        >
          <option value="all">All Status</option>
          <option value="downloaded">Downloaded</option>
          <option value="missing">Missing</option>
          <option value="unmonitored">Unmonitored</option>
        </select>
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="input text-sm min-w-[150px]"
        >
          <option value="all">All Profiles</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Count + View Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-ndp-text-dim">
          {movies.length} of {total} movie{total !== 1 ? 's' : ''}
        </p>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <button
            onClick={() => updateViewMode('table')}
            style={{ padding: '6px 12px', fontSize: 13, background: viewMode === 'table' ? 'rgba(255,255,255,0.1)' : 'transparent', color: viewMode === 'table' ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}
          >
            Table
          </button>
          <button
            onClick={() => updateViewMode('cards')}
            style={{ padding: '6px 12px', fontSize: 13, background: viewMode === 'cards' ? 'rgba(255,255,255,0.1)' : 'transparent', color: viewMode === 'cards' ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {movies.map((movie) => {
            const status = getStatusInfo(movie);
            return (
              <div
                key={movie.id}
                onClick={() => setSelectedMovieId(movie.id)}
                className="card cursor-pointer hover:ring-1 hover:ring-ndp-accent/50 transition-all"
                style={{ overflow: 'hidden', borderRadius: 8 }}
              >
                <div style={{ position: 'relative', aspectRatio: '2/3', background: 'rgba(255,255,255,0.03)' }}>
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-ndp-text-dim text-xs">
                      No Poster
                    </div>
                  )}
                  <span
                    className={status.className}
                    style={{ position: 'absolute', top: 6, right: 6, padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600 }}
                  >
                    {status.label}
                  </span>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <p className="text-ndp-text" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {movie.title}
                  </p>
                  <div className="text-ndp-text-dim" style={{ fontSize: 11, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{movie.year}</span>
                    <span>{movie.qualityName || profileMap[movie.qualityProfileId] || ''}</span>
                  </div>
                  {movie.sizeOnDisk > 0 && (
                    <p className="text-ndp-text-dim" style={{ fontSize: 10, marginTop: 2 }}>
                      {formatSize(movie.sizeOnDisk)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {movies.length === 0 && !loading && (
            <p className="text-ndp-text-dim text-center" style={{ gridColumn: '1 / -1', padding: '48px 0' }}>
              No movies found
            </p>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-ndp-text-dim font-medium" style={{ width: 60 }}></th>
                  <th className="text-left px-4 py-3 text-ndp-text-dim font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-ndp-text-dim font-medium" style={{ width: 70 }}>Year</th>
                  <th className="text-left px-4 py-3 text-ndp-text-dim font-medium" style={{ width: 120 }}>Status</th>
                  <th className="text-left px-4 py-3 text-ndp-text-dim font-medium" style={{ width: 120 }}>Quality</th>
                  <th className="text-right px-4 py-3 text-ndp-text-dim font-medium" style={{ width: 100 }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {movies.map((movie) => {
                  const status = getStatusInfo(movie);
                  return (
                    <tr
                      key={movie.id}
                      onClick={() => setSelectedMovieId(movie.id)}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2">
                        {movie.poster ? (
                          <img
                            src={movie.poster}
                            alt=""
                            style={{ width: 40, height: 60, objectFit: 'cover', borderRadius: 4 }}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            style={{ width: 40, height: 60, borderRadius: 4 }}
                            className="bg-white/5 flex items-center justify-center text-ndp-text-dim text-xs"
                          >
                            N/A
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-ndp-text font-medium">{movie.title}</span>
                      </td>
                      <td className="px-4 py-2 text-ndp-text-dim">{movie.year}</td>
                      <td className="px-4 py-2">
                        <span className={'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ' + status.className}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-ndp-text-dim">
                        {movie.qualityName || profileMap[movie.qualityProfileId] || '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-ndp-text-dim">
                        {movie.sizeOnDisk > 0 ? formatSize(movie.sizeOnDisk) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {movies.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-ndp-text-dim">
                      No movies found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div style={{ width: 24, height: 24, border: '2px solid', borderColor: 'var(--ndp-accent, #6366f1) transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      )}
    </div>

    {/* Movie Modal — outside space-y wrapper */}
    {selectedMovieId !== null && (
      <MovieModal
        movieId={selectedMovieId}
        onClose={() => setSelectedMovieId(null)}
      />
    )}
  </>);
}
