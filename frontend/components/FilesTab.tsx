import React, { useState, useEffect, useMemo } from 'react';

interface MovieWithFile {
  id: number;
  title: string;
  year: number;
  sizeOnDisk: number;
  qualityProfileId: number;
  qualityName: string | null;
  hasFile: boolean;
  poster: string | null;
  // File-related fields populated from movieFile when available
  movieFile?: {
    id: number;
    path: string;
    size: number;
    quality: { quality: { id: number; name: string; resolution: number } };
    mediaInfo?: {
      videoCodec: string;
      audioCodec: string;
      audioChannels: number;
      resolution: string;
    };
  };
}

interface MovieRow {
  movieId: number;
  fileId: number;
  title: string;
  year: number;
  path: string;
  size: number;
  qualityName: string;
  videoCodec: string;
  audioCodec: string;
  resolution: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

type SortKey = 'title' | 'path' | 'size' | 'qualityName' | 'videoCodec' | 'audioCodec' | 'resolution';
type SortDir = 'asc' | 'desc';

export function FilesTab() {
  const [movies, setMovies] = useState<MovieWithFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;

    fetch('/api/plugins/radarr/movies', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setMovies(data.movies || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load movies');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Build rows from movies that have files, then fetch file details per movie
  // The /movies endpoint already includes basic quality info. For detailed file info,
  // we fetch individual movie details for the file data.
  const [fileDetails, setFileDetails] = useState<Map<number, MovieRow>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch file details for all movies with files
  useEffect(() => {
    const moviesWithFiles = movies.filter((m) => m.hasFile);
    if (moviesWithFiles.length === 0) return;

    setLoadingDetails(true);

    // Batch fetch movie details (up to 100 concurrently to be reasonable)
    const fetchBatch = async () => {
      const details = new Map<number, MovieRow>();

      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < moviesWithFiles.length; i += batchSize) {
        const batch = moviesWithFiles.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((m) =>
            fetch(`/api/plugins/radarr/movies/${m.id}`, { credentials: 'include' })
              .then((r) => r.json())
              .then((data) => ({ movie: m, data })),
          ),
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { movie, data } = result.value;
            const files = data.files || [];
            const file = files[0];
            if (file) {
              details.set(movie.id, {
                movieId: movie.id,
                fileId: file.id,
                title: movie.title,
                year: movie.year,
                path: file.path || file.relativePath || '-',
                size: file.size || movie.sizeOnDisk || 0,
                qualityName: file.quality?.quality?.name || movie.qualityName || '-',
                videoCodec: file.mediaInfo?.videoCodec || '-',
                audioCodec: file.mediaInfo?.audioCodec
                  ? `${file.mediaInfo.audioCodec}${file.mediaInfo.audioChannels ? ` ${file.mediaInfo.audioChannels}ch` : ''}`
                  : '-',
                resolution: file.mediaInfo?.resolution || '-',
              });
            }
          }
        }

        // Update state progressively
        setFileDetails(new Map(details));
      }

      setLoadingDetails(false);
    };

    fetchBatch();
  }, [movies]);

  // Build sorted rows from fileDetails or fallback to basic info
  const rows = useMemo(() => {
    const result: MovieRow[] = [];

    for (const movie of movies) {
      if (!movie.hasFile) continue;

      const detail = fileDetails.get(movie.id);
      if (detail) {
        result.push(detail);
      } else {
        // Fallback with limited info while details load
        result.push({
          movieId: movie.id,
          fileId: 0,
          title: movie.title,
          year: movie.year,
          path: '-',
          size: movie.sizeOnDisk || 0,
          qualityName: movie.qualityName || '-',
          videoCodec: '-',
          audioCodec: '-',
          resolution: '-',
        });
      }
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'size') {
        cmp = a.size - b.size;
      } else {
        const aVal = a[sortKey].toLowerCase();
        const bVal = b[sortKey].toLowerCase();
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [movies, fileDetails, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDelete = async (row: MovieRow) => {
    if (row.fileId === 0) return;
    setDeletingId(row.fileId);
    try {
      const r = await fetch(`/api/plugins/radarr/files/${row.fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Delete failed');
      // Remove from both movies and fileDetails
      setMovies((prev) => prev.map((m) => (m.id === row.movieId ? { ...m, hasFile: false, sizeOnDisk: 0 } : m)));
      setFileDetails((prev) => {
        const next = new Map(prev);
        next.delete(row.movieId);
        return next;
      });
      setConfirmDeleteId(null);
      showMessage(`Deleted file for ${row.title}`, 'success');
    } catch {
      showMessage('Failed to delete file', 'error');
    }
    setDeletingId(null);
  };

  const handleRename = async (row: MovieRow) => {
    setRenamingId(row.movieId);
    try {
      const r = await fetch(`/api/plugins/radarr/files/${row.movieId}/rename`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Rename failed');
      showMessage(`Rename command sent for ${row.title}`, 'success');
    } catch {
      showMessage('Failed to rename file', 'error');
    }
    setRenamingId(null);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ndp-text">File Management</h2>
          <p className="text-sm text-ndp-text-dim mt-0.5">
            {rows.length} file{rows.length !== 1 ? 's' : ''}
            {loadingDetails && ' (loading details...)'}
          </p>
        </div>
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
      {rows.length === 0 ? (
        <div className="card p-6 text-center text-ndp-text-dim text-sm">No movie files found</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th
                    className="text-left px-4 py-3 text-ndp-text-dim font-medium cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('title')}
                  >
                    Title{sortIndicator('title')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-ndp-text-dim font-medium cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('path')}
                  >
                    File Path{sortIndicator('path')}
                  </th>
                  <th
                    className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px] cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('size')}
                  >
                    Size{sortIndicator('size')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[90px] cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('qualityName')}
                  >
                    Quality{sortIndicator('qualityName')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[80px] cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('videoCodec')}
                  >
                    Video{sortIndicator('videoCodec')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[90px] cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('audioCodec')}
                  >
                    Audio{sortIndicator('audioCodec')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-ndp-text-dim font-medium w-[80px] cursor-pointer hover:text-ndp-text select-none"
                    onClick={() => handleSort('resolution')}
                  >
                    Res{sortIndicator('resolution')}
                  </th>
                  <th className="text-right px-4 py-3 text-ndp-text-dim font-medium w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.movieId} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2">
                      <span className="text-ndp-text font-medium">{row.title}</span>
                      <span className="text-ndp-text-dim ml-1.5 text-xs">({row.year})</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-ndp-text-dim text-xs break-all line-clamp-2">{row.path}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-ndp-text-dim">{formatSize(row.size)}</td>
                    <td className="px-4 py-2 text-ndp-text-dim">{row.qualityName}</td>
                    <td className="px-4 py-2 text-ndp-text-dim text-xs">{row.videoCodec}</td>
                    <td className="px-4 py-2 text-ndp-text-dim text-xs">{row.audioCodec}</td>
                    <td className="px-4 py-2 text-ndp-text-dim text-xs">{row.resolution}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRename(row)}
                          disabled={renamingId === row.movieId}
                          className="px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-ndp-text-dim hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          {renamingId === row.movieId ? (
                            <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            'Rename'
                          )}
                        </button>

                        {confirmDeleteId === row.movieId ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(row)}
                              disabled={deletingId === row.fileId}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-ndp-error text-white hover:bg-ndp-error/80 transition-colors disabled:opacity-50"
                            >
                              {deletingId === row.fileId ? 'Deleting' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-ndp-text-dim hover:bg-white/10 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(row.movieId)}
                            disabled={row.fileId === 0}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-ndp-error/10 text-ndp-error hover:bg-ndp-error/20 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
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
