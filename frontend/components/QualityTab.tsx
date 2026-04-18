import React, { useState, useEffect, useCallback } from 'react';

interface CutoffUnmetMovie {
  id: number;
  title: string;
  year: number;
  hasFile: boolean;
  sizeOnDisk: number;
  movieFile?: {
    quality: { quality: { id: number; name: string } };
    size: number;
  };
  qualityProfileId: number;
}

interface QualityProfile {
  id: number;
  name: string;
  cutoff: { id: number; name: string };
}

interface PaginatedResult {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: CutoffUnmetMovie[];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export function QualityTab() {
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [searchingIds, setSearchingIds] = useState<Set<number>>(new Set());
  const [searchedIds, setSearchedIds] = useState<Set<number>>(new Set());
  const [bulkSearching, setBulkSearching] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/plugins/radarr/quality/cutoff-unmet?page=${page}&pageSize=${pageSize}`, {
        credentials: 'include',
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch('/api/plugins/radarr/profiles', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([cutoffData, profilesData]) => {
        setData(cutoffData);
        setProfiles(profilesData || []);
      })
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const profileMap: Record<number, QualityProfile> = {};
  for (const p of profiles) profileMap[p.id] = p;

  const handleSearchUpgrade = async (movieId: number) => {
    setSearchingIds((prev) => new Set(prev).add(movieId));
    try {
      const r = await fetch(`/api/plugins/radarr/quality/search/${movieId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Search failed');
      setSearchedIds((prev) => new Set(prev).add(movieId));
      showMessage('Search upgrade command sent', 'success');
    } catch {
      showMessage('Search upgrade failed', 'error');
    }
    setSearchingIds((prev) => {
      const next = new Set(prev);
      next.delete(movieId);
      return next;
    });
  };

  const handleSearchAll = async () => {
    if (!data || data.records.length === 0) return;
    setBulkSearching(true);
    try {
      const movieIds = data.records.map((m) => m.id);
      const r = await fetch('/api/plugins/radarr/quality/search-bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieIds }),
      });
      if (!r.ok) throw new Error('Bulk search failed');
      const result = await r.json();
      const successCount = result.results?.filter((r: any) => r.ok).length || 0;
      setSearchedIds((prev) => {
        const next = new Set(prev);
        movieIds.forEach((id) => next.add(id));
        return next;
      });
      showMessage(`Search sent for ${successCount} movie${successCount !== 1 ? 's' : ''}`, 'success');
    } catch {
      showMessage('Bulk search failed', 'error');
    }
    setBulkSearching(false);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.totalRecords / data.pageSize)) : 1;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-ndp-error">{error}</p>
        <button onClick={fetchData} className="btn-primary text-sm mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ndp-text">Cutoff Unmet</h2>
          <p className="text-sm text-ndp-text-dim mt-0.5">
            {data?.totalRecords || 0} movie{(data?.totalRecords || 0) !== 1 ? 's' : ''} below quality cutoff
          </p>
        </div>
        <button
          onClick={handleSearchAll}
          disabled={bulkSearching || !data || data.records.length === 0}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {bulkSearching ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Searching All...
            </span>
          ) : (
            'Search All'
          )}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={
            'px-4 py-2 rounded-lg text-sm font-medium ' +
            (message.type === 'success' ? 'bg-ndp-success/15 text-ndp-success' : 'bg-ndp-error/15 text-ndp-error')
          }
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-ndp-text-dim font-medium">Title</th>
                <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[130px]">Current Quality</th>
                <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[130px]">Cutoff</th>
                <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[90px]">Size</th>
                <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[120px]"></th>
              </tr>
            </thead>
            <tbody>
              {data?.records.map((movie) => {
                const profile = profileMap[movie.qualityProfileId];
                const currentQuality = movie.movieFile?.quality?.quality?.name || 'No file';
                const cutoffQuality = profile?.cutoff?.name || '-';
                const isSearching = searchingIds.has(movie.id);
                const wasSearched = searchedIds.has(movie.id);

                return (
                  <tr key={movie.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <span className="text-ndp-text font-medium">{movie.title}</span>
                      <span className="text-ndp-text-dim ml-1.5">({movie.year})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-ndp-error/15 text-ndp-error">
                        {currentQuality}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-ndp-success/15 text-ndp-success">
                        {cutoffQuality}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ndp-text-dim">
                      {movie.sizeOnDisk > 0 ? formatSize(movie.sizeOnDisk) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {wasSearched ? (
                        <span className="text-xs text-ndp-success">Sent</span>
                      ) : (
                        <button
                          onClick={() => handleSearchUpgrade(movie.id)}
                          disabled={isSearching}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-ndp-accent/20 text-ndp-accent hover:bg-ndp-accent/30 transition-colors disabled:opacity-50"
                        >
                          {isSearching ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 border border-ndp-accent border-t-transparent rounded-full animate-spin" />
                              Searching
                            </span>
                          ) : (
                            'Search Upgrade'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!data || data.records.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ndp-text-dim">
                    No movies below quality cutoff
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ndp-text-dim">
            Page {data?.page || 1} of {totalPages} ({data?.totalRecords || 0} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
