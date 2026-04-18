import type { FastifyInstance } from 'fastify';
import type { RadarrPluginApi } from '../radarr-api.js';

export function filesRoutes(app: FastifyInstance) {
  // Get movie files for a specific movie
  app.get('/files/:movieId', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { movieId } = request.params as { movieId: string };
    return api.getMovieFiles(parseInt(movieId));
  });

  // Delete a movie file
  app.delete('/files/:fileId', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { fileId } = request.params as { fileId: string };
    await api.deleteMovieFile(parseInt(fileId));
    return { ok: true };
  });

  // Rename movie files (trigger Radarr rename command)
  app.post('/files/:movieId/rename', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { movieId } = request.params as { movieId: string };
    await api.renameMovie(parseInt(movieId));
    return { ok: true };
  });
}
