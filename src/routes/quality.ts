import type { FastifyInstance } from 'fastify';
import type { RadarrPluginApi } from '../radarr-api.js';

export function qualityRoutes(app: FastifyInstance) {
  // Get cutoff unmet movies (paginated)
  app.get('/quality/cutoff-unmet', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { page = '1', pageSize = '20' } = request.query as Record<string, string>;
    return api.getCutoffUnmet(parseInt(page), parseInt(pageSize));
  });

  // Search upgrade for a specific movie
  app.post('/quality/search/:id', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    await api.searchMovie(parseInt(id));
    return { ok: true };
  });

  // Bulk search upgrade for multiple movies
  app.post('/quality/search-bulk', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { movieIds } = request.body as { movieIds: number[] };
    const results = [];
    for (const movieId of movieIds) {
      try {
        await api.searchMovie(movieId);
        results.push({ movieId, ok: true });
      } catch (err) {
        results.push({ movieId, ok: false, error: String(err) });
      }
    }
    return { results };
  });
}
