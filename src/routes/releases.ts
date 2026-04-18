import type { FastifyInstance } from 'fastify';
import type { RadarrPluginApi } from '../radarr-api.js';

export function releasesRoutes(app: FastifyInstance) {
  // Get available releases for a movie
  app.get('/releases/:movieId', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { movieId } = request.params as { movieId: string };
    return api.getReleasesForMovie(parseInt(movieId));
  });

  // Grab a specific release
  app.post('/releases/grab', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { guid, indexerId } = request.body as { guid: string; indexerId: number };
    await api.grabRelease(guid, indexerId);
    return { ok: true };
  });

  // Get blocklist (paginated)
  app.get('/blocklist', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { page = '1', pageSize = '20' } = request.query as Record<string, string>;
    return api.getBlocklist(parseInt(page), parseInt(pageSize));
  });

  // Delete blocklist item
  app.delete('/blocklist/:id', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    await api.deleteBlocklistItem(parseInt(id));
    return { ok: true };
  });
}
