# Oscarr Plugin — Radarr Manager

Advanced Radarr management for [Oscarr](https://github.com/arediss/Oscarr). Browse your Radarr library, run manual searches with rejection reasons visible, drill into history + queue + blocklist per movie, retry failed downloads — all from the Oscarr admin panel.

## Features

- **Library browser** — paginated + filterable (search, status, quality profile, root folder) with server-side caching.
- **Movie modal** with tabbed detail view: Overview, Releases, History, Queue, Blocklist.
  - Releases: approved vs rejected groups, rejection reasons always visible (no hidden toggle), custom format scores.
  - History: grabbed / imported / failed / deleted / renamed events, retry failed button.
  - Queue: live progress bars, status messages, remove + blocklist actions.
  - Blocklist: per-movie entries with unblock.
- **Analytics** — disk space, quality distribution, timeline of adds, root folder breakdown.
- **Quality profiles** — read-only view of cutoff-unmet.
- **Actions** — manual search, refresh, monitor/unmonitor, delete file.

## Requirements

- **Oscarr core** ≥ 0.6.0 with plugin API `v1`.
- A configured Radarr service in Oscarr (Settings → Services).
- **Node 20+**.

## Install

From Oscarr admin:
1. **Admin → Plugins → Discover** → find "Radarr Manager" → **Install**
2. Review the capabilities consent prompt (requests `services:radarr`)
3. Toggle the plugin on in **Installed**

Or manually:
```bash
cd packages/plugins
git clone https://github.com/arediss/Oscarr-Plugin-Radarr.git radarr
# dist/ is pre-built in the repo, no npm install needed
```
Then restart Oscarr.

## Manifest declarations

```jsonc
{
  "services": ["radarr"],
  "capabilities": [],
  "engines": { "oscarr": ">=0.6.0 <1.0.0", "testedAgainst": ["0.6.3"] }
}
```

## Development

```bash
npm install
npm run dev   # esbuild watch
```

Sources in `src/` (backend) and `frontend/` (admin UI). `npm run build` produces `dist/index.js` + `dist/frontend/index.js`.

## License

MIT.
