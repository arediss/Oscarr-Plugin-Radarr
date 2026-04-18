import type { FastifyInstance } from 'fastify';
import type { RadarrPluginApi, RadarrMovie } from '../radarr-api.js';

// In-memory cache to avoid re-fetching 2600+ movies from Radarr on every page request
let moviesCache: { data: RadarrMovie[]; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

async function getCachedMovies(api: RadarrPluginApi): Promise<RadarrMovie[]> {
  const now = Date.now();
  if (moviesCache && now - moviesCache.timestamp < CACHE_TTL) {
    return moviesCache.data;
  }
  const data = await api.getMovies();
  moviesCache = { data, timestamp: now };
  return data;
}

function mapMovie(m: RadarrMovie) {
  return {
    id: m.id,
    title: m.title,
    year: m.year,
    tmdbId: m.tmdbId,
    monitored: m.monitored,
    status: m.status,
    hasFile: m.hasFile,
    sizeOnDisk: m.sizeOnDisk,
    qualityProfileId: m.qualityProfileId,
    rootFolderPath: m.rootFolderPath,
    added: m.added,
    poster: m.images?.find(i => i.coverType === 'poster')?.remoteUrl || null,
    qualityName: m.movieFile?.quality?.quality?.name || null,
  };
}

export function libraryRoutes(app: FastifyInstance) {
  // Get movies — paginated, filtered, cached
  app.get('/movies', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const {
      search, status, qualityProfileId, rootFolderPath,
      page = '1', pageSize = '50',
    } = request.query as Record<string, string>;

    let movies = await getCachedMovies(api);

    // Server-side filtering
    if (search) {
      const q = search.toLowerCase();
      movies = movies.filter(m => m.title.toLowerCase().includes(q));
    }
    if (status === 'downloaded') movies = movies.filter(m => m.hasFile);
    else if (status === 'missing') movies = movies.filter(m => !m.hasFile && m.monitored);
    else if (status === 'unmonitored') movies = movies.filter(m => !m.monitored);

    if (qualityProfileId) movies = movies.filter(m => m.qualityProfileId === parseInt(qualityProfileId));
    if (rootFolderPath) movies = movies.filter(m => m.rootFolderPath === rootFolderPath);

    const total = movies.length;
    const p = Math.max(1, parseInt(page));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize)));
    const start = (p - 1) * ps;
    const slice = movies.slice(start, start + ps);

    return {
      total,
      page: p,
      pageSize: ps,
      hasMore: start + ps < total,
      movies: slice.map(mapMovie),
    };
  });

  // Invalidate cache (useful after actions)
  app.post('/movies/invalidate-cache', async () => {
    moviesCache = null;
    return { ok: true };
  });

  // Get single movie with full details
  app.get('/movies/:id', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const movie = await api.getMovie(parseInt(id));
    const files = await api.getMovieFiles(parseInt(id));
    return { movie, files };
  });

  // Toggle monitored
  app.put('/movies/:id/monitored', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const { monitored } = request.body as { monitored: boolean };
    await api.editMovie(parseInt(id), { monitored });
    moviesCache = null; // invalidate
    return { ok: true };
  });

  // Update tags
  app.put('/movies/:id/tags', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const { tags } = request.body as { tags: number[] };
    await api.editMovie(parseInt(id), { tags });
    moviesCache = null;
    return { ok: true };
  });

  // Search movie
  app.post('/movies/:id/search', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    await api.searchMovie(parseInt(id));
    return { ok: true };
  });

  // Refresh/rescan movie
  app.post('/movies/:id/refresh', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    await api.refreshMovie(parseInt(id));
    return { ok: true };
  });

  // Get tags list
  app.get('/tags', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    return api.getTags();
  });

  // Get quality profiles
  app.get('/profiles', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    return api.getQualityProfiles();
  });

  // Movie download history (grabbed / imported / failed / deleted …)
  app.get('/movies/:id/history', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const items = await api.getMovieHistory(parseInt(id));
    return { items };
  });

  // Current queue items for this movie (empty array = nothing in flight).
  app.get('/movies/:id/queue', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const items = await api.getQueueForMovie(parseInt(id));
    return { items };
  });

  // Blocklist entries for this movie.
  app.get('/movies/:id/blocklist', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const items = await api.getBlocklistForMovie(parseInt(id));
    return { items };
  });
}
