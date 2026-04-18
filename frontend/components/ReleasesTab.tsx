import React, { useState, useEffect, useCallback } from 'react';

interface Release {
  guid: string;
  quality: { quality: { id: number; name: string; resolution: number } };
  age: number;
  size: number;
  indexer: string;
  title: string;
  approved: boolean;
  rejections: string[];
  seeders?: number;
  leechers?: number;
  protocol: string;
}

interface BlocklistItem {
  id: number;
  movieId: number;
  sourceTitle: string;
  date: string;
  quality: { quality: { id: number; name: string } };
  movie?: { title: string; year: number };
}

interface MovieSummary {
  id: number;
  title: string;
  year: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatAge(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ReleasesTab() {
  // Release search state
  const [searchQuery, setSearchQuery] = useState('');
  const [movieResults, setMovieResults] = useState<MovieSummary[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MovieSummary | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [searchingMovies, setSearchingMovies] = useState(false);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [grabbing, setGrabbing] = useState<string | null>(null);

  // Blocklist state
  const [blocklist, setBlocklist] = useState<BlocklistItem[]>([]);
  const [blocklistTotal, setBlocklistTotal] = useState(0);
  const [blocklistPage, setBlocklistPage] = useState(1);
  const [loadingBlocklist, setLoadingBlocklist] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Search movies by title
  const handleSearchMovies = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchingMovies(true);
    setMovieResults([]);
    setSelectedMovie(null);
    setReleases([]);

    try {
      const r = await fetch(`/api/plugins/radarr/movies?search=${encodeURIComponent(searchQuery.trim())}`, {
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setMovieResults((data.movies || []).slice(0, 20));
    } catch {
      showMessage('Failed to search movies', 'error');
    }
    setSearchingMovies(false);
  }, [searchQuery]);

  // Fetch releases for a movie
  const handleFetchReleases = async (movie: MovieSummary) => {
    setSelectedMovie(movie);
    setLoadingReleases(true);
    setReleases([]);

    try {
      const r = await fetch(`/api/plugins/radarr/releases/${movie.id}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setReleases(data || []);
    } catch {
      showMessage('Failed to load releases', 'error');
    }
    setLoadingReleases(false);
  };

  // Grab a release
  const handleGrab = async (release: Release) => {
    setGrabbing(release.guid);
    try {
      const r = await fetch('/api/plugins/radarr/releases/grab', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guid: release.guid, indexerId: 0 }),
      });
      if (!r.ok) throw new Error('Grab failed');
      showMessage('Release grabbed', 'success');
    } catch {
      showMessage('Failed to grab release', 'error');
    }
    setGrabbing(null);
  };

  // Fetch blocklist
  const fetchBlocklist = useCallback(async () => {
    setLoadingBlocklist(true);
    try {
      const r = await fetch(`/api/plugins/radarr/blocklist?page=${blocklistPage}&pageSize=20`, {
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setBlocklist(data.records || []);
      setBlocklistTotal(data.totalRecords || 0);
    } catch {
      showMessage('Failed to load blocklist', 'error');
    }
    setLoadingBlocklist(false);
  }, [blocklistPage]);

  useEffect(() => {
    fetchBlocklist();
  }, [fetchBlocklist]);

  // Remove blocklist item
  const handleRemoveBlocklistItem = async (id: number) => {
    setRemovingId(id);
    try {
      const r = await fetch(`/api/plugins/radarr/blocklist/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Remove failed');
      setBlocklist((prev) => prev.filter((item) => item.id !== id));
      setBlocklistTotal((prev) => prev - 1);
      showMessage('Blocklist item removed', 'success');
    } catch {
      showMessage('Failed to remove blocklist item', 'error');
    }
    setRemovingId(null);
  };

  const blocklistTotalPages = Math.max(1, Math.ceil(blocklistTotal / 20));

  return (
    <div className="space-y-8">
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

      {/* Release Search Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ndp-text">Release Search</h2>

        {/* Search input */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by movie title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchMovies();
            }}
            className="input flex-1 text-sm"
          />
          <button
            onClick={handleSearchMovies}
            disabled={searchingMovies || !searchQuery.trim()}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {searchingMovies ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Searching
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Movie results (pick a movie to get releases) */}
        {movieResults.length > 0 && !selectedMovie && (
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5">
              <p className="text-xs text-ndp-text-dim">Select a movie to browse releases</p>
            </div>
            {movieResults.map((movie) => (
              <button
                key={movie.id}
                onClick={() => handleFetchReleases(movie)}
                className="w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-sm text-ndp-text font-medium">{movie.title}</span>
                <span className="text-sm text-ndp-text-dim ml-2">({movie.year})</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected movie + releases */}
        {selectedMovie && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ndp-text">
                Releases for{' '}
                <span className="font-semibold">
                  {selectedMovie.title} ({selectedMovie.year})
                </span>
              </p>
              <button
                onClick={() => {
                  setSelectedMovie(null);
                  setReleases([]);
                }}
                className="text-xs text-ndp-text-dim hover:text-ndp-text transition-colors"
              >
                Clear
              </button>
            </div>

            {loadingReleases ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : releases.length === 0 ? (
              <div className="card p-6 text-center text-ndp-text-dim text-sm">No releases found</div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-3 text-ndp-text-dim font-medium">Title</th>
                        <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[90px]">Quality</th>
                        <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px]">Size</th>
                        <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[100px]">Indexer</th>
                        <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[60px]">Age</th>
                        <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[70px]">Seeders</th>
                        <th className="text-center px-4 py-3 text-ndp-text-dim font-medium w-[80px]">Status</th>
                        <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {releases.map((release) => (
                        <tr key={release.guid} className="border-b border-white/5 last:border-0">
                          <td className="px-4 py-2">
                            <span className="text-ndp-text text-xs break-all line-clamp-2">{release.title}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-xs text-ndp-text-dim">
                              {release.quality?.quality?.name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-ndp-text-dim">
                            {formatSize(release.size)}
                          </td>
                          <td className="px-4 py-2 text-xs text-ndp-text-dim">{release.indexer || '-'}</td>
                          <td className="px-4 py-2 text-right text-xs text-ndp-text-dim">
                            {formatAge(release.age)}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-ndp-text-dim">
                            {release.protocol === 'torrent'
                              ? release.seeders !== undefined
                                ? release.seeders
                                : '-'
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {release.approved ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-ndp-success/15 text-ndp-success">
                                Approved
                              </span>
                            ) : (
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-ndp-error/15 text-ndp-error cursor-help"
                                title={release.rejections?.join(', ') || 'Rejected'}
                              >
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleGrab(release)}
                              disabled={grabbing === release.guid}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-ndp-accent/20 text-ndp-accent hover:bg-ndp-accent/30 transition-colors disabled:opacity-50"
                            >
                              {grabbing === release.guid ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 border border-ndp-accent border-t-transparent rounded-full animate-spin" />
                                </span>
                              ) : (
                                'Grab'
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Blocklist Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ndp-text">Blocklist</h2>
          <span className="text-sm text-ndp-text-dim">{blocklistTotal} item{blocklistTotal !== 1 ? 's' : ''}</span>
        </div>

        {loadingBlocklist ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : blocklist.length === 0 ? (
          <div className="card p-6 text-center text-ndp-text-dim text-sm">Blocklist is empty</div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-ndp-text-dim font-medium">Source Title</th>
                      <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[150px]">Movie</th>
                      <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[110px]">Date</th>
                      <th className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[100px]">Quality</th>
                      <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocklist.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2">
                          <span className="text-ndp-text text-xs break-all line-clamp-2">
                            {item.sourceTitle}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-ndp-text-dim">
                          {item.movie ? `${item.movie.title} (${item.movie.year})` : `ID ${item.movieId}`}
                        </td>
                        <td className="px-4 py-2 text-xs text-ndp-text-dim">{formatDate(item.date)}</td>
                        <td className="px-4 py-2 text-xs text-ndp-text-dim">
                          {item.quality?.quality?.name || '-'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleRemoveBlocklistItem(item.id)}
                            disabled={removingId === item.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-ndp-error/10 text-ndp-error hover:bg-ndp-error/20 transition-colors disabled:opacity-50"
                          >
                            {removingId === item.id ? (
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 border border-ndp-error border-t-transparent rounded-full animate-spin" />
                              </span>
                            ) : (
                              'Remove'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Blocklist Pagination */}
            {blocklistTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-ndp-text-dim">
                  Page {blocklistPage} of {blocklistTotalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBlocklistPage((p) => Math.max(1, p - 1))}
                    disabled={blocklistPage <= 1}
                    className="px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setBlocklistPage((p) => Math.min(blocklistTotalPages, p + 1))}
                    disabled={blocklistPage >= blocklistTotalPages}
                    className="px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
