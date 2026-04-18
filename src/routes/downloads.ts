import type { FastifyInstance } from 'fastify';
import type { RadarrPluginApi } from '../radarr-api.js';

export function downloadsRoutes(app: FastifyInstance) {
  // Get download queue
  app.get('/queue', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { page = '1', pageSize = '20' } = request.query as Record<string, string>;
    return api.getQueue(parseInt(page), parseInt(pageSize));
  });

  // Remove item from queue
  app.delete('/queue/:id', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    const { removeFromClient, blocklist } = request.query as Record<string, string>;
    await api.removeQueueItem(parseInt(id), {
      removeFromClient: removeFromClient === 'true',
      blocklist: blocklist === 'true',
    });
    return { ok: true };
  });

  // Search movie and return command ID for polling
  app.post('/search/:movieId', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { movieId } = request.params as { movieId: string };
    const result = await api.searchMovie(parseInt(movieId));
    return { ok: true, commandId: result.id };
  });

  // Poll command status
  app.get('/command/:id', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    return api.getCommandStatus(parseInt(id));
  });
}
