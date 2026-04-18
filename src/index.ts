import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FastifyInstance } from 'fastify';
import { RadarrPluginApi } from './radarr-api.js';
import { libraryRoutes } from './routes/library.js';
import { qualityRoutes } from './routes/quality.js';
import { releasesRoutes } from './routes/releases.js';
import { analyticsRoutes } from './routes/analytics.js';
import { filesRoutes } from './routes/files.js';
import { downloadsRoutes } from './routes/downloads.js';

interface PluginContext {
  log: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };
  getServiceConfig(serviceType: string): Promise<{ url: string; apiKey: string } | null>;
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<void>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'manifest.json'), 'utf-8'));

let radarrApi: RadarrPluginApi | null = null;

async function getApi(ctx: PluginContext): Promise<RadarrPluginApi> {
  if (radarrApi) return radarrApi;
  const config = await ctx.getServiceConfig('radarr');
  if (!config) throw new Error('Radarr service not configured in Oscarr');
  radarrApi = new RadarrPluginApi(config.url, config.apiKey);
  return radarrApi;
}

export function register(ctx: PluginContext) {
  return {
    manifest,

    async registerRoutes(app: FastifyInstance) {
      app.addHook('preHandler', async (request, reply) => {
        try {
          (request as any).radarrApi = await getApi(ctx);
        } catch {
          return reply.status(503).send({ error: 'Radarr not configured or unreachable' });
        }
      });

      libraryRoutes(app);
      qualityRoutes(app);
      releasesRoutes(app);
      analyticsRoutes(app);
      filesRoutes(app);
      downloadsRoutes(app);

      ctx.log.info('Radarr Manager plugin routes registered');
    },
  };
}
