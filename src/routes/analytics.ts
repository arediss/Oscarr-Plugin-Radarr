import type { FastifyInstance } from 'fastify';
import type { RadarrPluginApi } from '../radarr-api.js';

export function analyticsRoutes(app: FastifyInstance) {
  // Full analytics dashboard data in one call
  app.get('/analytics', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;

    const [movies, diskSpace, profiles] = await Promise.all([
      api.getMovies(),
      api.getDiskSpace(),
      api.getQualityProfiles(),
    ]);

    // Status distribution
    const statusCounts = { downloaded: 0, missing: 0, unmonitored: 0, searching: 0 };
    for (const m of movies) {
      if (!m.monitored) statusCounts.unmonitored++;
      else if (m.hasFile) statusCounts.downloaded++;
      else statusCounts.missing++;
    }

    // Quality distribution (from movies with files)
    const qualityDist: Record<string, number> = {};
    let totalSize = 0;
    for (const m of movies) {
      totalSize += m.sizeOnDisk || 0;
      const qName = m.movieFile?.quality?.quality?.name || 'Unknown';
      if (m.hasFile) {
        qualityDist[qName] = (qualityDist[qName] || 0) + 1;
      }
    }

    // Movies added per month (last 12 months)
    const now = new Date();
    const timeline: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      timeline[key] = 0;
    }
    for (const m of movies) {
      if (!m.added) continue;
      const d = new Date(m.added);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in timeline) timeline[key]++;
    }

    // Root folder sizes
    const rootFolders: Record<string, { count: number; size: number }> = {};
    for (const m of movies) {
      const rf = m.rootFolderPath || 'Unknown';
      if (!rootFolders[rf]) rootFolders[rf] = { count: 0, size: 0 };
      rootFolders[rf].count++;
      rootFolders[rf].size += m.sizeOnDisk || 0;
    }

    // Profile name mapping
    const profileMap: Record<number, string> = {};
    for (const p of profiles) profileMap[p.id] = p.name;

    return {
      overview: {
        totalMovies: movies.length,
        totalSize,
        ...statusCounts,
      },
      qualityDistribution: Object.entries(qualityDist)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      diskSpace: diskSpace.map(d => ({
        path: d.path,
        label: d.label,
        freeSpace: d.freeSpace,
        totalSpace: d.totalSpace,
        usedSpace: d.totalSpace - d.freeSpace,
        usedPercent: Math.round(((d.totalSpace - d.freeSpace) / d.totalSpace) * 100),
      })),
      timeline: Object.entries(timeline).map(([month, count]) => ({ month, count })),
      rootFolders: Object.entries(rootFolders)
        .map(([path, data]) => ({ path, ...data }))
        .sort((a, b) => b.size - a.size),
      profileMap,
    };
  });

  // Retry a failed history item — tells Radarr to mark it failed (will trigger search).
  app.post('/history/failed/:id', async (request) => {
    const api: RadarrPluginApi = (request as any).radarrApi;
    const { id } = request.params as { id: string };
    await api.retryFailedHistoryItem(parseInt(id));
    return { ok: true };
  });
}
