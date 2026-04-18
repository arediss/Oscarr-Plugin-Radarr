import axios, { type AxiosInstance } from 'axios';

export interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  overview?: string;
  monitored: boolean;
  status: string;
  hasFile: boolean;
  sizeOnDisk: number;
  qualityProfileId: number;
  rootFolderPath: string;
  path: string;
  added: string;
  tags: number[];
  images: { coverType: string; remoteUrl?: string; url?: string }[];
  movieFile?: RadarrMovieFile;
  statistics?: { sizeOnDisk: number; releaseGroups: string[] };
}

export interface RadarrMovieFile {
  id: number;
  movieId: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  quality: { quality: { id: number; name: string; resolution: number } };
  mediaInfo?: {
    audioBitrate: number;
    audioChannels: number;
    audioCodec: string;
    audioLanguages: string;
    audioStreamCount: number;
    videoBitDepth: number;
    videoBitrate: number;
    videoCodec: string;
    videoDynamicRangeType: string;
    videoFps: number;
    resolution: string;
    runTime: string;
    scanType: string;
    subtitles: string;
  };
  customFormats?: { id: number; name: string }[];
}

export interface RadarrQualityProfile {
  id: number;
  name: string;
  cutoff: { id: number; name: string };
  items: { quality: { id: number; name: string } }[];
}

export interface RadarrRelease {
  guid: string;
  quality: { quality: { id: number; name: string; resolution: number } };
  age: number;
  ageHours: number;
  ageMinutes: number;
  size: number;
  indexer: string;
  releaseGroup?: string;
  title: string;
  approved: boolean;
  rejections: string[];
  seeders?: number;
  leechers?: number;
  protocol: string;
  downloadUrl?: string;
  infoUrl?: string;
}

export interface RadarrBlocklistItem {
  id: number;
  movieId: number;
  sourceTitle: string;
  date: string;
  quality: { quality: { id: number; name: string } };
  message?: string;
  movie?: { title: string; year: number };
}

export interface RadarrDiskSpace {
  path: string;
  label: string;
  freeSpace: number;
  totalSpace: number;
}

export interface RadarrHistoryItem {
  id: number;
  movieId: number;
  sourceTitle: string;
  quality: { quality: { id: number; name: string } };
  date: string;
  eventType: string;
  data: Record<string, string>;
  movie?: { title: string; year: number };
}

export interface QueueItem {
  id: number;
  movieId: number;
  title: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: { title: string; messages: string[] }[];
  size: number;
  sizeleft: number;
  timeleft?: string;
  estimatedCompletionTime?: string;
  protocol: string;
  downloadClient?: string;
  quality: { quality: { id: number; name: string } };
  movie?: { title: string; year: number };
}

export interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: T[];
}

export class RadarrPluginApi {
  private api: AxiosInstance;

  constructor(baseUrl: string, apiKey: string) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    this.api = axios.create({
      baseURL: `${cleanUrl}/api/v3`,
      headers: { 'X-Api-Key': apiKey },
      timeout: 30000,
    });
  }

  // ── Library ────────────────────────────────────────────────────────

  async getMovies(): Promise<RadarrMovie[]> {
    const { data } = await this.api.get('/movie');
    return data;
  }

  async getMovie(id: number): Promise<RadarrMovie> {
    const { data } = await this.api.get(`/movie/${id}`);
    return data;
  }

  async getMovieFiles(movieId: number): Promise<RadarrMovieFile[]> {
    const { data } = await this.api.get('/moviefile', { params: { movieId } });
    return data;
  }

  async editMovie(id: number, updates: Partial<RadarrMovie>): Promise<RadarrMovie> {
    const current = await this.getMovie(id);
    const { data } = await this.api.put(`/movie/${id}`, { ...current, ...updates });
    return data;
  }

  // ── Quality ────────────────────────────────────────────────────────

  async getCutoffUnmet(page = 1, pageSize = 20): Promise<PaginatedResult<RadarrMovie>> {
    const { data } = await this.api.get('/wanted/cutoff', { params: { page, pageSize, sortKey: 'movies.sortTitle', sortDirection: 'ascending' } });
    return { page: data.page, pageSize: data.pageSize, totalRecords: data.totalRecords, records: data.records };
  }

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    const { data } = await this.api.get('/qualityprofile');
    return data;
  }

  // ── Releases ───────────────────────────────────────────────────────

  async getReleasesForMovie(movieId: number): Promise<RadarrRelease[]> {
    const { data } = await this.api.get('/release', { params: { movieId } });
    return data;
  }

  async grabRelease(guid: string, indexerId: number): Promise<void> {
    await this.api.post('/release', { guid, indexerId });
  }

  async getBlocklist(page = 1, pageSize = 20): Promise<PaginatedResult<RadarrBlocklistItem>> {
    const { data } = await this.api.get('/blocklist', { params: { page, pageSize, sortKey: 'date', sortDirection: 'descending' } });
    return { page: data.page, pageSize: data.pageSize, totalRecords: data.totalRecords, records: data.records };
  }

  async deleteBlocklistItem(id: number): Promise<void> {
    await this.api.delete(`/blocklist/${id}`);
  }

  // ── Analytics ──────────────────────────────────────────────────────

  async getDiskSpace(): Promise<RadarrDiskSpace[]> {
    const { data } = await this.api.get('/diskspace');
    return data;
  }

  async getHistory(page = 1, pageSize = 20, eventType?: string): Promise<PaginatedResult<RadarrHistoryItem>> {
    const params: Record<string, unknown> = { page, pageSize, sortKey: 'date', sortDirection: 'descending', includeMovie: true };
    if (eventType) params.eventType = eventType;
    const { data } = await this.api.get('/history', { params });
    return { page: data.page, pageSize: data.pageSize, totalRecords: data.totalRecords, records: data.records };
  }

  // `/history/movie` returns a flat array (not paginated) for a single movie.
  async getMovieHistory(movieId: number): Promise<RadarrHistoryItem[]> {
    const { data } = await this.api.get('/history/movie', {
      params: { movieId, includeMovie: false },
    });
    return Array.isArray(data) ? data : (data?.records ?? []);
  }

  async retryFailedHistoryItem(historyId: number): Promise<void> {
    await this.api.post(`/history/failed/${historyId}`);
  }

  // ── Actions ────────────────────────────────────────────────────────

  async searchMovie(movieId: number): Promise<{ id: number }> {
    const { data } = await this.api.post('/command', { name: 'MoviesSearch', movieIds: [movieId] });
    return { id: data.id };
  }

  async getCommandStatus(commandId: number): Promise<{ status: string; started?: string; ended?: string }> {
    const { data } = await this.api.get(`/command/${commandId}`);
    return { status: data.status, started: data.started, ended: data.ended };
  }

  // ── Queue / Downloads ──────────────────────────────────────────────

  async getQueue(page = 1, pageSize = 20): Promise<PaginatedResult<QueueItem>> {
    const { data } = await this.api.get('/queue', {
      params: { page, pageSize, sortKey: 'progress', sortDirection: 'ascending', includeMovie: true, includeUnknownMovieItems: false },
    });
    return { page: data.page, pageSize: data.pageSize, totalRecords: data.totalRecords, records: data.records };
  }

  // Radarr's /queue doesn't filter by movieId directly — fetch a wide page and filter client-side.
  // 200 is generous: typical user has < 50 active downloads.
  async getQueueForMovie(movieId: number): Promise<QueueItem[]> {
    const { data } = await this.api.get('/queue', {
      params: { page: 1, pageSize: 200, sortKey: 'progress', sortDirection: 'ascending', includeMovie: false, includeUnknownMovieItems: false },
    });
    const records: QueueItem[] = Array.isArray(data?.records) ? data.records : [];
    return records.filter((r) => r.movieId === movieId);
  }

  async getBlocklistForMovie(movieId: number): Promise<RadarrBlocklistItem[]> {
    const { data } = await this.api.get('/blocklist', {
      params: { page: 1, pageSize: 500, sortKey: 'date', sortDirection: 'descending' },
    });
    const records: RadarrBlocklistItem[] = Array.isArray(data?.records) ? data.records : [];
    return records.filter((r) => r.movieId === movieId);
  }

  async removeQueueItem(id: number, options?: { removeFromClient?: boolean; blocklist?: boolean }): Promise<void> {
    await this.api.delete(`/queue/${id}`, {
      params: { removeFromClient: options?.removeFromClient ?? false, blocklist: options?.blocklist ?? false },
    });
  }

  async refreshMovie(movieId: number): Promise<void> {
    await this.api.post('/command', { name: 'RefreshMovie', movieIds: [movieId] });
  }

  async deleteMovieFile(fileId: number): Promise<void> {
    await this.api.delete(`/moviefile/${fileId}`);
  }

  async renameMovie(movieId: number): Promise<void> {
    await this.api.post('/command', { name: 'RenameMovie', movieIds: [movieId] });
  }

  // ── Tags ───────────────────────────────────────────────────────────

  async getTags(): Promise<{ id: number; label: string }[]> {
    const { data } = await this.api.get('/tag');
    return data;
  }
}
