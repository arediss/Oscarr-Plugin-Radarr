// frontend/index.tsx
import { useState as useState8 } from "react";

// frontend/components/LibraryTab.tsx
import { useState as useState2, useEffect as useEffect2, useRef as useRef2, useCallback as useCallback2, useMemo as useMemo2 } from "react";

// frontend/components/MovieModal.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function formatAge(days, hours, minutes) {
  if (days === 0 && hours !== void 0) {
    if (hours === 0 && minutes !== void 0) return `${minutes}m`;
    return `${hours}h`;
  }
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
function formatRelativeDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 6e4);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" });
}
function formatRuntime(minutes) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}
var EVENT_META = {
  grabbed: { label: "Grabbed", color: "text-sky-300", bg: "bg-sky-500/15" },
  downloadFolderImported: { label: "Imported", color: "text-ndp-success", bg: "bg-ndp-success/15" },
  downloadFailed: { label: "Failed", color: "text-ndp-error", bg: "bg-ndp-error/15" },
  movieFileDeleted: { label: "Deleted", color: "text-ndp-text-dim", bg: "bg-white/5" },
  movieFileRenamed: { label: "Renamed", color: "text-ndp-text-dim", bg: "bg-white/5" },
  movieFolderImported: { label: "Imported", color: "text-ndp-success", bg: "bg-ndp-success/15" },
  downloadIgnored: { label: "Ignored", color: "text-amber-300", bg: "bg-amber-500/15" }
};
function eventMeta(eventType) {
  return EVENT_META[eventType] ?? { label: eventType, color: "text-ndp-text-dim", bg: "bg-white/5" };
}
function MovieModal({ movieId, onClose }) {
  const [movie, setMovie] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [panelVisible, setPanelVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPanelVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const [searchPhase, setSearchPhase] = useState("idle");
  const [refreshState, setRefreshState] = useState("idle");
  const [monitorState, setMonitorState] = useState("idle");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteState, setDeleteState] = useState("idle");
  const [message, setMessage] = useState(null);
  const [releases, setReleases] = useState([]);
  const [grabbing, setGrabbing] = useState(null);
  const [grabbedGuids, setGrabbedGuids] = useState(/* @__PURE__ */ new Set());
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retrying, setRetrying] = useState(null);
  const [queue, setQueue] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [removingQueue, setRemovingQueue] = useState(null);
  const [blocklist, setBlocklist] = useState(null);
  const [blocklistLoading, setBlocklistLoading] = useState(false);
  const [unblocking, setUnblocking] = useState(null);
  const pollRef = useRef(null);
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plugins/radarr/movies/${movieId}`, { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then((data) => {
      if (cancelled) return;
      setMovie(data.movie);
      setFiles(data.files || []);
    }).catch((err) => {
      if (cancelled) return;
      setError(err.message || "Failed to load movie details");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [movieId]);
  useEffect(() => {
    let cancelled = false;
    setQueueLoading(true);
    fetch(`/api/plugins/radarr/movies/${movieId}/queue`, { credentials: "include" }).then((r) => r.ok ? r.json() : { items: [] }).then((data) => {
      if (!cancelled) setQueue(data.items ?? []);
    }).catch(() => {
      if (!cancelled) setQueue([]);
    }).finally(() => {
      if (!cancelled) setQueueLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [movieId]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3e3);
  };
  const loadHistory = useCallback(async () => {
    if (history !== null) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/history`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setHistory(data.items ?? []);
    } catch {
      setHistory([]);
      showMessage("Failed to load history", "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [history, movieId]);
  const loadBlocklist = useCallback(async () => {
    if (blocklist !== null) return;
    setBlocklistLoading(true);
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/blocklist`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setBlocklist(data.items ?? []);
    } catch {
      setBlocklist([]);
      showMessage("Failed to load blocklist", "error");
    } finally {
      setBlocklistLoading(false);
    }
  }, [blocklist, movieId]);
  useEffect(() => {
    if (activeTab === "history") loadHistory();
    if (activeTab === "blocklist") loadBlocklist();
  }, [activeTab, loadHistory, loadBlocklist]);
  const fetchReleases = useCallback(async () => {
    setSearchPhase("fetching-releases");
    try {
      const r = await fetch(`/api/plugins/radarr/releases/${movieId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch releases");
      const data = await r.json();
      setReleases(data || []);
      setSearchPhase("done");
    } catch {
      setSearchPhase("error");
      showMessage("Failed to fetch releases", "error");
    }
  }, [movieId]);
  const handleSearch = async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setActiveTab("releases");
    setSearchPhase("searching");
    setReleases([]);
    setGrabbedGuids(/* @__PURE__ */ new Set());
    try {
      const r = await fetch(`/api/plugins/radarr/search/${movieId}`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("Search failed");
      const data = await r.json();
      const commandId = data.commandId;
      if (!commandId) {
        await fetchReleases();
        return;
      }
      setSearchPhase("polling");
      pollRef.current = setInterval(async () => {
        try {
          const statusR = await fetch(`/api/plugins/radarr/command/${commandId}`, { credentials: "include" });
          if (!statusR.ok) throw new Error("Poll failed");
          const statusData = await statusR.json();
          if (statusData.status === "completed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            await fetchReleases();
          } else if (statusData.status === "failed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            showMessage("Search command failed \u2014 showing cached releases if any", "error");
            await fetchReleases();
          }
        } catch {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setSearchPhase("error");
          showMessage("Failed to poll search status", "error");
        }
      }, 2e3);
    } catch {
      setSearchPhase("error");
      showMessage("Search failed", "error");
    }
  };
  const handleRefresh = async () => {
    setRefreshState("loading");
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/refresh`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      setRefreshState("success");
      showMessage("Refresh command sent", "success");
    } catch {
      setRefreshState("error");
      showMessage("Refresh failed", "error");
    }
    setTimeout(() => setRefreshState("idle"), 2e3);
  };
  const handleToggleMonitored = async () => {
    if (!movie) return;
    setMonitorState("loading");
    try {
      const r = await fetch(`/api/plugins/radarr/movies/${movieId}/monitored`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitored: !movie.monitored })
      });
      if (!r.ok) throw new Error();
      setMovie({ ...movie, monitored: !movie.monitored });
      setMonitorState("success");
      showMessage(`Movie ${movie.monitored ? "unmonitored" : "monitored"}`, "success");
    } catch {
      setMonitorState("error");
      showMessage("Toggle monitored failed", "error");
    }
    setTimeout(() => setMonitorState("idle"), 2e3);
  };
  const handleDeleteFile = async (fileId) => {
    setDeleteState("loading");
    try {
      const r = await fetch(`/api/plugins/radarr/files/${fileId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (movie) setMovie({ ...movie, hasFile: false, sizeOnDisk: 0 });
      setDeleteState("success");
      setDeleteConfirm(false);
      showMessage("File deleted", "success");
    } catch {
      setDeleteState("error");
      showMessage("Delete failed", "error");
    }
    setTimeout(() => setDeleteState("idle"), 2e3);
  };
  const handleGrab = async (release) => {
    setGrabbing(release.guid);
    try {
      const r = await fetch("/api/plugins/radarr/releases/grab", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guid: release.guid, indexerId: release.indexerId || 0 })
      });
      if (!r.ok) throw new Error();
      setGrabbedGuids((prev) => new Set(prev).add(release.guid));
      showMessage("Release grabbed", "success");
    } catch {
      showMessage("Failed to grab release", "error");
    }
    setGrabbing(null);
  };
  const handleRetryFailed = async (historyId) => {
    setRetrying(historyId);
    try {
      const r = await fetch(`/api/plugins/radarr/history/failed/${historyId}`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      showMessage("Retry triggered \u2014 a new search will run", "success");
    } catch {
      showMessage("Retry failed", "error");
    }
    setRetrying(null);
  };
  const handleRemoveQueue = async (itemId, blocklistFlag) => {
    setRemovingQueue(itemId);
    try {
      const params = new URLSearchParams({ removeFromClient: "true", blocklist: String(blocklistFlag) });
      const r = await fetch(`/api/plugins/radarr/queue/${itemId}?${params}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      setQueue((prev) => (prev ?? []).filter((q) => q.id !== itemId));
      showMessage(blocklistFlag ? "Removed & blocklisted" : "Removed from queue", "success");
    } catch {
      showMessage("Failed to remove queue item", "error");
    }
    setRemovingQueue(null);
  };
  const handleUnblock = async (blocklistId) => {
    setUnblocking(blocklistId);
    try {
      const r = await fetch(`/api/plugins/radarr/blocklist/${blocklistId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      setBlocklist((prev) => (prev ?? []).filter((b) => b.id !== blocklistId));
      showMessage("Removed from blocklist", "success");
    } catch {
      showMessage("Failed to remove from blocklist", "error");
    }
    setUnblocking(null);
  };
  const isSearchBusy = searchPhase === "searching" || searchPhase === "polling" || searchPhase === "fetching-releases";
  const searchButtonLabel = () => {
    switch (searchPhase) {
      case "searching":
        return "Sending search\u2026";
      case "polling":
        return "Waiting for results\u2026";
      case "fetching-releases":
        return "Loading releases\u2026";
      default:
        return "Search";
    }
  };
  const poster = movie?.images?.find((i) => i.coverType === "poster");
  const posterUrl = poster?.remoteUrl || poster?.url || null;
  const primaryFile = files[0] || movie?.movieFile || null;
  const mediaInfo = primaryFile?.mediaInfo;
  const queueCount = queue?.length ?? 0;
  const blocklistCount = blocklist?.length ?? 0;
  const TABS2 = [
    { id: "overview", label: "Overview" },
    { id: "releases", label: "Releases", badge: releases.length || void 0, badgeTone: "dim" },
    { id: "history", label: "History" },
    { id: "queue", label: "Queue", badge: queueCount || void 0, badgeTone: "accent" },
    { id: "blocklist", label: "Blocklist", badge: blocklistCount || void 0, badgeTone: "dim" }
  ];
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: "w-full max-w-5xl bg-ndp-surface border-l border-white/5 flex flex-col shadow-2xl shadow-black/60 transition-transform duration-300 ease-out " + (panelVisible ? "translate-x-0" : "translate-x-full"),
          style: { position: "fixed", top: 0, right: 0, height: "100dvh" },
          children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: onClose,
                className: "flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-ndp-text-dim hover:text-ndp-text transition-colors",
                style: { position: "absolute", top: 16, right: 16, width: 32, height: 32, zIndex: 10 },
                "aria-label": "Close",
                children: /* @__PURE__ */ jsxs("svg", { style: { width: 16, height: 16 }, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                  /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                ] })
              }
            ),
            loading && /* @__PURE__ */ jsx("div", { className: "flex justify-center py-16", children: /* @__PURE__ */ jsx("div", { className: "w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) }),
            error && /* @__PURE__ */ jsx("div", { className: "p-6 text-center", children: /* @__PURE__ */ jsx("p", { className: "text-ndp-error", children: error }) }),
            movie && !loading && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex gap-5 p-6 pr-14 border-b border-white/5 flex-shrink-0", children: [
                posterUrl ? /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: posterUrl,
                    alt: movie.title,
                    className: "object-cover rounded-xl flex-shrink-0",
                    style: { width: 128, height: 192 }
                  }
                ) : /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "bg-white/5 rounded-xl flex items-center justify-center text-ndp-text-dim flex-shrink-0 text-xs",
                    style: { width: 128, height: 192 },
                    children: "No Poster"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 flex flex-col", children: [
                  /* @__PURE__ */ jsxs("h2", { className: "text-xl sm:text-2xl font-bold text-ndp-text leading-tight", children: [
                    movie.title,
                    /* @__PURE__ */ jsxs("span", { className: "text-ndp-text-dim font-normal ml-2", children: [
                      "(",
                      movie.year,
                      ")"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center flex-wrap gap-2 mt-2 text-xs", children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "inline-block px-2.5 py-0.5 rounded-full font-medium " + (!movie.monitored ? "bg-white/10 text-ndp-text-dim" : movie.hasFile ? "bg-ndp-success/15 text-ndp-success" : "bg-ndp-error/15 text-ndp-error"),
                        children: !movie.monitored ? "Unmonitored" : movie.hasFile ? "Downloaded" : "Missing"
                      }
                    ),
                    queueCount > 0 && /* @__PURE__ */ jsx("span", { className: "inline-block px-2.5 py-0.5 rounded-full font-medium bg-sky-500/20 text-sky-300", children: "Downloading" }),
                    movie.sizeOnDisk > 0 && /* @__PURE__ */ jsx("span", { className: "text-ndp-text-dim", children: formatSize(movie.sizeOnDisk) }),
                    formatRuntime(movie.runtime) && /* @__PURE__ */ jsxs("span", { className: "text-ndp-text-dim", children: [
                      "\xB7 ",
                      formatRuntime(movie.runtime)
                    ] }),
                    movie.genres && movie.genres.length > 0 && /* @__PURE__ */ jsxs("span", { className: "text-ndp-text-dim truncate", children: [
                      "\xB7 ",
                      movie.genres.slice(0, 3).join(", ")
                    ] })
                  ] }),
                  movie.overview && /* @__PURE__ */ jsx("p", { className: "text-sm text-ndp-text-dim leading-relaxed mt-3 line-clamp-3", children: movie.overview }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mt-3 text-xs", children: [
                    movie.tmdbId && /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "text-ndp-accent hover:underline",
                        children: "TMDB"
                      }
                    ),
                    movie.imdbId && /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: `https://www.imdb.com/title/${movie.imdbId}`,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "text-ndp-accent hover:underline",
                        children: "IMDb"
                      }
                    )
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 border-b border-white/5 flex-shrink-0 pl-4 pr-3", children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "flex gap-1 overflow-x-auto flex-1 min-w-0 pt-3",
                    style: { scrollbarWidth: "none" },
                    children: TABS2.map(({ id, label, badge, badgeTone }) => {
                      const active = activeTab === id;
                      return /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => setActiveTab(id),
                          className: "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 " + (active ? "border-ndp-accent text-ndp-accent" : "border-transparent text-ndp-text-dim hover:text-ndp-text"),
                          children: [
                            label,
                            badge !== void 0 && /* @__PURE__ */ jsx(
                              "span",
                              {
                                className: "text-[10px] px-1.5 py-0.5 rounded-full font-semibold " + (badgeTone === "accent" ? "bg-sky-500/25 text-sky-300" : "bg-white/10 text-ndp-text-dim"),
                                children: badge
                              }
                            )
                          ]
                        },
                        id
                      );
                    })
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 flex-shrink-0 py-2", children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: handleSearch,
                      disabled: isSearchBusy,
                      className: "text-xs font-medium rounded-lg bg-ndp-accent text-white hover:bg-ndp-accent/90 transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap",
                      children: isSearchBusy ? /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5", children: [
                        /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" }),
                        "Searching"
                      ] }) : "Search"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: handleRefresh,
                      disabled: refreshState === "loading",
                      className: "text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-ndp-text transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap",
                      children: refreshState === "loading" ? "Refreshing\u2026" : "Refresh"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: handleToggleMonitored,
                      disabled: monitorState === "loading",
                      className: "text-xs font-medium rounded-lg transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap " + (movie.monitored ? "bg-white/10 hover:bg-white/15 text-ndp-text" : "bg-ndp-accent/20 hover:bg-ndp-accent/30 text-ndp-accent"),
                      children: monitorState === "loading" ? "\u2026" : movie.monitored ? "Unmonitor" : "Monitor"
                    }
                  ),
                  primaryFile && (!deleteConfirm ? /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => setDeleteConfirm(true),
                      className: "text-xs font-medium rounded-lg bg-ndp-error/10 hover:bg-ndp-error/20 text-ndp-error transition-colors px-3 py-1.5 whitespace-nowrap",
                      children: "Delete"
                    }
                  ) : /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => handleDeleteFile(primaryFile.id),
                        disabled: deleteState === "loading",
                        className: "text-xs font-medium rounded-lg bg-ndp-error text-white hover:bg-ndp-error/80 transition-colors disabled:opacity-50 px-3 py-1.5 whitespace-nowrap",
                        children: deleteState === "loading" ? "\u2026" : "Confirm"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => setDeleteConfirm(false),
                        className: "text-xs font-medium rounded-lg bg-white/10 text-ndp-text-dim hover:bg-white/15 transition-colors px-3 py-1.5 whitespace-nowrap",
                        children: "Cancel"
                      }
                    )
                  ] }))
                ] })
              ] }),
              message && /* @__PURE__ */ jsx(
                "div",
                {
                  className: "mx-6 mt-3 rounded-lg text-sm font-medium px-4 py-2 flex-shrink-0 " + (message.type === "success" ? "bg-ndp-success/15 text-ndp-success" : "bg-ndp-error/15 text-ndp-error"),
                  children: message.text
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-6", children: [
                activeTab === "overview" && /* @__PURE__ */ jsx(OverviewTab, { movie, file: primaryFile, mediaInfo }),
                activeTab === "releases" && /* @__PURE__ */ jsx(
                  ReleasesTab,
                  {
                    releases,
                    phase: searchPhase,
                    searchLabel: searchButtonLabel(),
                    grabbing,
                    grabbedGuids,
                    onGrab: handleGrab
                  }
                ),
                activeTab === "history" && /* @__PURE__ */ jsx(
                  HistoryTab,
                  {
                    items: history,
                    loading: historyLoading,
                    retrying,
                    onRetry: handleRetryFailed
                  }
                ),
                activeTab === "queue" && /* @__PURE__ */ jsx(
                  QueueTab,
                  {
                    items: queue,
                    loading: queueLoading,
                    removing: removingQueue,
                    onRemove: handleRemoveQueue
                  }
                ),
                activeTab === "blocklist" && /* @__PURE__ */ jsx(
                  BlocklistTab,
                  {
                    items: blocklist,
                    loading: blocklistLoading,
                    unblocking,
                    onUnblock: handleUnblock
                  }
                )
              ] })
            ] })
          ]
        }
      )
    }
  );
}
function OverviewTab({
  movie,
  file,
  mediaInfo
}) {
  if (!file) {
    return /* @__PURE__ */ jsx("div", { className: "text-center py-12 text-sm text-ndp-text-dim", children: "No file on disk for this movie yet." });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx(Section, { title: "File Information", children: /* @__PURE__ */ jsxs(Grid, { children: [
      /* @__PURE__ */ jsx(Field, { label: "Path", children: /* @__PURE__ */ jsx("span", { className: "break-all", children: file.path }) }),
      /* @__PURE__ */ jsx(Field, { label: "Size", children: formatSize(file.size) }),
      mediaInfo && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs(Field, { label: "Video", children: [
          mediaInfo.videoCodec,
          mediaInfo.videoDynamicRangeType ? ` (${mediaInfo.videoDynamicRangeType})` : ""
        ] }),
        /* @__PURE__ */ jsx(Field, { label: "Resolution", children: mediaInfo.resolution }),
        /* @__PURE__ */ jsxs(Field, { label: "Audio", children: [
          mediaInfo.audioCodec,
          " ",
          mediaInfo.audioChannels,
          "ch"
        ] }),
        /* @__PURE__ */ jsx(Field, { label: "Languages", children: mediaInfo.audioLanguages || "\u2014" }),
        mediaInfo.subtitles && /* @__PURE__ */ jsx(Field, { label: "Subtitles", span: true, children: mediaInfo.subtitles }),
        mediaInfo.runTime && /* @__PURE__ */ jsx(Field, { label: "Runtime", children: mediaInfo.runTime })
      ] }),
      /* @__PURE__ */ jsx(Field, { label: "Added", children: formatRelativeDate(file.dateAdded) })
    ] }) }),
    /* @__PURE__ */ jsx(Section, { title: "Quality", children: /* @__PURE__ */ jsx("div", { className: "card p-4", children: /* @__PURE__ */ jsxs("span", { className: "text-sm text-ndp-text", children: [
      file.quality?.quality?.name || "Unknown",
      file.quality?.quality?.resolution ? ` (${file.quality.quality.resolution}p)` : ""
    ] }) }) })
  ] });
}
function ReleasesTab({
  releases,
  phase,
  searchLabel,
  grabbing,
  grabbedGuids,
  onGrab
}) {
  const isBusy = phase === "searching" || phase === "polling" || phase === "fetching-releases";
  const approved = releases.filter((r) => r.approved);
  const rejected = releases.filter((r) => !r.approved);
  if (isBusy && releases.length === 0) {
    return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-3 py-16 text-ndp-text-dim", children: [
      /* @__PURE__ */ jsx("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }),
      /* @__PURE__ */ jsx("span", { className: "text-xs", children: searchLabel })
    ] });
  }
  if (releases.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "text-center py-12 text-sm text-ndp-text-dim", children: phase === "done" ? "No releases found. Check indexer configuration in Radarr." : "Click Search above to look for available releases." });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "text-xs text-ndp-text-dim", children: [
      approved.length,
      " approved \xB7 ",
      rejected.length,
      " rejected"
    ] }),
    approved.length > 0 && /* @__PURE__ */ jsx(
      ReleaseList,
      {
        title: `Approved (${approved.length})`,
        releases: approved,
        grabbing,
        grabbedGuids,
        onGrab
      }
    ),
    rejected.length > 0 && /* @__PURE__ */ jsx(
      ReleaseList,
      {
        title: `Rejected (${rejected.length})`,
        releases: rejected,
        grabbing,
        grabbedGuids,
        onGrab,
        showRejections: true
      }
    )
  ] });
}
function ReleaseList({
  title,
  releases,
  grabbing,
  grabbedGuids,
  onGrab,
  showRejections = false
}) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsx("h4", { className: "text-xs font-semibold uppercase tracking-wider text-ndp-text-dim", children: title }),
    /* @__PURE__ */ jsx("div", { className: "space-y-2", children: releases.map((r) => {
      const isGrabbed = grabbedGuids.has(r.guid);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "card p-3 space-y-2 " + (showRejections ? "opacity-75" : ""),
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-xs text-ndp-text break-all leading-snug", children: r.title }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-ndp-text", children: r.quality?.quality?.name || "\u2014" }),
                  /* @__PURE__ */ jsx("span", { children: "\xB7" }),
                  /* @__PURE__ */ jsx("span", { children: formatSize(r.size) }),
                  /* @__PURE__ */ jsx("span", { children: "\xB7" }),
                  /* @__PURE__ */ jsx("span", { children: r.indexer || "\u2014" }),
                  /* @__PURE__ */ jsx("span", { children: "\xB7" }),
                  /* @__PURE__ */ jsx("span", { children: formatAge(r.age, r.ageHours, r.ageMinutes) }),
                  r.protocol === "torrent" && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx("span", { children: "\xB7" }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      r.seeders ?? "\u2014",
                      "/",
                      r.leechers ?? "\u2014",
                      " S/L"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("span", { children: "\xB7" }),
                  /* @__PURE__ */ jsx("span", { className: "uppercase tracking-wider", children: r.protocol === "torrent" ? "Torrent" : "Usenet" }),
                  typeof r.customFormatScore === "number" && r.customFormatScore !== 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx("span", { children: "\xB7" }),
                    /* @__PURE__ */ jsxs("span", { className: r.customFormatScore > 0 ? "text-ndp-success" : "text-ndp-error", children: [
                      "CF ",
                      r.customFormatScore > 0 ? "+" : "",
                      r.customFormatScore
                    ] })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex-shrink-0", children: isGrabbed ? /* @__PURE__ */ jsx("span", { className: "text-[11px] text-ndp-success font-medium", children: "Grabbed" }) : /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onGrab(r),
                  disabled: grabbing === r.guid,
                  className: "rounded-lg text-xs font-medium bg-ndp-accent/20 text-ndp-accent hover:bg-ndp-accent/30 transition-colors disabled:opacity-50 px-3 py-1.5",
                  children: grabbing === r.guid ? /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 border border-ndp-accent border-t-transparent rounded-full animate-spin block" }) : "Grab"
                }
              ) })
            ] }),
            showRejections && r.rejections && r.rejections.length > 0 && /* @__PURE__ */ jsx("ul", { className: "border-t border-white/5 pt-2 space-y-1", children: r.rejections.map((reason, i) => /* @__PURE__ */ jsxs("li", { className: "text-[11px] text-ndp-error/80 flex items-start gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { className: "text-ndp-error mt-0.5", children: "\u2715" }),
              /* @__PURE__ */ jsx("span", { children: reason })
            ] }, i)) })
          ]
        },
        r.guid
      );
    }) })
  ] });
}
function HistoryTab({
  items,
  loading,
  retrying,
  onRetry
}) {
  if (loading && items === null) {
    return /* @__PURE__ */ jsx("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) });
  }
  if (!items || items.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "text-center py-12 text-sm text-ndp-text-dim", children: "No history events for this movie yet." });
  }
  return /* @__PURE__ */ jsx("div", { className: "space-y-2", children: items.map((item) => {
    const meta = eventMeta(item.eventType);
    const isFailed = item.eventType === "downloadFailed";
    return /* @__PURE__ */ jsxs("div", { className: "card p-3 flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `flex-shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`,
          children: meta.label
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs text-ndp-text break-all leading-snug", children: item.sourceTitle }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim", children: [
          /* @__PURE__ */ jsx("span", { className: "text-ndp-text", children: item.quality?.quality?.name || "\u2014" }),
          /* @__PURE__ */ jsx("span", { children: "\xB7" }),
          /* @__PURE__ */ jsx("span", { children: formatRelativeDate(item.date) }),
          item.data?.downloadClient && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("span", { children: "\xB7" }),
            /* @__PURE__ */ jsx("span", { children: item.data.downloadClient })
          ] }),
          item.data?.reason && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("span", { children: "\xB7" }),
            /* @__PURE__ */ jsx("span", { className: "text-ndp-error/80", children: item.data.reason })
          ] })
        ] })
      ] }),
      isFailed && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => onRetry(item.id),
          disabled: retrying === item.id,
          className: "flex-shrink-0 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 px-3 py-1.5",
          children: retrying === item.id ? "Retrying\u2026" : "Retry"
        }
      )
    ] }, item.id);
  }) });
}
function QueueTab({
  items,
  loading,
  removing,
  onRemove
}) {
  if (loading && items === null) {
    return /* @__PURE__ */ jsx("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) });
  }
  if (!items || items.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "text-center py-12 text-sm text-ndp-text-dim", children: "Nothing in the download queue for this movie." });
  }
  return /* @__PURE__ */ jsx("div", { className: "space-y-3", children: items.map((item) => {
    const total = item.size || 0;
    const left = item.sizeleft || 0;
    const done = Math.max(0, total - left);
    const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
    return /* @__PURE__ */ jsxs("div", { className: "card p-4 space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs text-ndp-text break-all leading-snug", children: item.title }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim", children: [
            /* @__PURE__ */ jsx("span", { className: "text-ndp-text", children: item.quality?.quality?.name || "\u2014" }),
            /* @__PURE__ */ jsx("span", { children: "\xB7" }),
            /* @__PURE__ */ jsx("span", { children: formatSize(total) }),
            /* @__PURE__ */ jsx("span", { children: "\xB7" }),
            /* @__PURE__ */ jsx("span", { children: item.downloadClient || "\u2014" }),
            /* @__PURE__ */ jsx("span", { children: "\xB7" }),
            /* @__PURE__ */ jsx("span", { className: "uppercase tracking-wider", children: item.protocol }),
            item.timeleft && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { children: "\xB7" }),
              /* @__PURE__ */ jsxs("span", { children: [
                "ETA ",
                item.timeleft
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "flex-shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300", children: item.status })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "w-full h-1.5 bg-white/5 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
        "div",
        {
          className: "h-full bg-ndp-accent transition-all duration-300",
          style: { width: `${pct}%` }
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[11px] text-ndp-text-dim", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          formatSize(done),
          " / ",
          formatSize(total)
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "font-semibold text-ndp-accent", children: [
          pct,
          "%"
        ] })
      ] }),
      item.statusMessages && item.statusMessages.length > 0 && /* @__PURE__ */ jsx("ul", { className: "border-t border-white/5 pt-2 space-y-1", children: item.statusMessages.flatMap(
        (m) => m.messages.map((msg, i) => /* @__PURE__ */ jsxs("li", { className: "text-[11px] text-amber-300/80 flex items-start gap-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-amber-400 mt-0.5", children: "\u26A0" }),
          /* @__PURE__ */ jsx("span", { children: msg })
        ] }, `${m.title}-${i}`))
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 pt-1", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onRemove(item.id, false),
            disabled: removing === item.id,
            className: "rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-ndp-text transition-colors disabled:opacity-50 px-3 py-1.5",
            children: removing === item.id ? "Removing\u2026" : "Remove"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onRemove(item.id, true),
            disabled: removing === item.id,
            className: "rounded-lg text-xs font-medium bg-ndp-error/10 hover:bg-ndp-error/20 text-ndp-error transition-colors disabled:opacity-50 px-3 py-1.5",
            children: "Remove & Blocklist"
          }
        )
      ] })
    ] }, item.id);
  }) });
}
function BlocklistTab({
  items,
  loading,
  unblocking,
  onUnblock
}) {
  if (loading && items === null) {
    return /* @__PURE__ */ jsx("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) });
  }
  if (!items || items.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "text-center py-12 text-sm text-ndp-text-dim", children: "No blocklisted releases for this movie." });
  }
  return /* @__PURE__ */ jsx("div", { className: "space-y-2", children: items.map((item) => /* @__PURE__ */ jsxs("div", { className: "card p-3 flex items-start gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs text-ndp-text break-all leading-snug", children: item.sourceTitle }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ndp-text-dim", children: [
        /* @__PURE__ */ jsx("span", { className: "text-ndp-text", children: item.quality?.quality?.name || "\u2014" }),
        /* @__PURE__ */ jsx("span", { children: "\xB7" }),
        /* @__PURE__ */ jsx("span", { children: formatRelativeDate(item.date) }),
        item.message && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { children: "\xB7" }),
          /* @__PURE__ */ jsx("span", { className: "text-ndp-error/80", children: item.message })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => onUnblock(item.id),
        disabled: unblocking === item.id,
        className: "flex-shrink-0 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-ndp-text transition-colors disabled:opacity-50 px-3 py-1.5",
        children: unblocking === item.id ? "Removing\u2026" : "Unblock"
      }
    )
  ] }, item.id)) });
}
function Section({ title, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wider text-ndp-text-dim", children: title }),
    children
  ] });
}
function Grid({ children }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "card p-4 text-sm grid gap-y-2 gap-x-6",
      style: { gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
      children
    }
  );
}
function Field({ label, children, span = false }) {
  return /* @__PURE__ */ jsxs("div", { style: span ? { gridColumn: "1 / -1" } : void 0, children: [
    /* @__PURE__ */ jsxs("span", { className: "text-ndp-text-dim", children: [
      label,
      ": "
    ] }),
    /* @__PURE__ */ jsx("span", { className: "text-ndp-text", children })
  ] });
}

// frontend/components/LibraryTab.tsx
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function formatSize2(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function getStatusInfo(movie) {
  if (!movie.monitored) return { label: "Unmonitored", className: "bg-white/10 text-ndp-text-dim" };
  if (movie.hasFile) return { label: "Downloaded", className: "bg-ndp-success/15 text-ndp-success" };
  return { label: "Missing", className: "bg-ndp-error/15 text-ndp-error" };
}
var PAGE_SIZE = 50;
function LibraryTab() {
  const [movies, setMovies] = useState2([]);
  const [profiles, setProfiles] = useState2([]);
  const [loading, setLoading] = useState2(true);
  const [loadingMore, setLoadingMore] = useState2(false);
  const [error, setError] = useState2(null);
  const [total, setTotal] = useState2(0);
  const [hasMore, setHasMore] = useState2(false);
  const [page, setPage] = useState2(1);
  const [search, setSearch] = useState2("");
  const [statusFilter, setStatusFilter] = useState2("all");
  const [profileFilter, setProfileFilter] = useState2("all");
  const [selectedMovieId, setSelectedMovieId] = useState2(null);
  const [viewMode, setViewMode] = useState2(() => {
    try {
      return localStorage.getItem("plugin-radarr-library-view") || "table";
    } catch {
      return "table";
    }
  });
  const updateViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("plugin-radarr-library-view", mode);
    } catch {
    }
  };
  const [debouncedSearch, setDebouncedSearch] = useState2("");
  useEffect2(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const buildQuery = useCallback2((p) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (profileFilter !== "all") params.set("qualityProfileId", profileFilter);
    return params.toString();
  }, [debouncedSearch, statusFilter, profileFilter]);
  const fetchPage = useCallback2(async (p, append) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/plugins/radarr/movies?${buildQuery(p)}`, { credentials: "include" });
      const data = await res.json();
      if (append) {
        setMovies((prev) => [...prev, ...data.movies || []]);
      } else {
        setMovies(data.movies || []);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(p);
    } catch (err) {
      setError(err.message || "Failed to load movies");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);
  useEffect2(() => {
    setMovies([]);
    setPage(1);
    fetchPage(1, false);
  }, [debouncedSearch, statusFilter, profileFilter]);
  useEffect2(() => {
    fetch("/api/plugins/radarr/profiles", { credentials: "include" }).then((r) => r.json()).then((data) => setProfiles(data || [])).catch(() => {
    });
  }, []);
  const sentinelRef = useRef2(null);
  useEffect2(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPage(page + 1, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchPage]);
  const profileMap = useMemo2(() => {
    const map = {};
    for (const p of profiles) map[p.id] = p.name;
    return map;
  }, [profiles]);
  if (loading && movies.length === 0) {
    return /* @__PURE__ */ jsx2("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx2("div", { style: { width: 32, height: 32, border: "2px solid", borderColor: "var(--ndp-accent, #6366f1) transparent", borderRadius: "50%", animation: "spin 1s linear infinite" } }) });
  }
  if (error && movies.length === 0) {
    return /* @__PURE__ */ jsx2("div", { className: "card p-6 text-center", children: /* @__PURE__ */ jsx2("p", { className: "text-ndp-error", children: error }) });
  }
  return /* @__PURE__ */ jsxs2(Fragment2, { children: [
    /* @__PURE__ */ jsxs2("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap gap-3", children: [
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "text",
            placeholder: "Search movies...",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: "input flex-1 min-w-[200px] text-sm"
          }
        ),
        /* @__PURE__ */ jsxs2(
          "select",
          {
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            className: "input text-sm min-w-[150px]",
            children: [
              /* @__PURE__ */ jsx2("option", { value: "all", children: "All Status" }),
              /* @__PURE__ */ jsx2("option", { value: "downloaded", children: "Downloaded" }),
              /* @__PURE__ */ jsx2("option", { value: "missing", children: "Missing" }),
              /* @__PURE__ */ jsx2("option", { value: "unmonitored", children: "Unmonitored" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs2(
          "select",
          {
            value: profileFilter,
            onChange: (e) => setProfileFilter(e.target.value),
            className: "input text-sm min-w-[150px]",
            children: [
              /* @__PURE__ */ jsx2("option", { value: "all", children: "All Profiles" }),
              profiles.map((p) => /* @__PURE__ */ jsx2("option", { value: p.id, children: p.name }, p.id))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs2("p", { className: "text-sm text-ndp-text-dim", children: [
          movies.length,
          " of ",
          total,
          " movie",
          total !== 1 ? "s" : ""
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "flex rounded-lg overflow-hidden border border-white/10", children: [
          /* @__PURE__ */ jsx2(
            "button",
            {
              onClick: () => updateViewMode("table"),
              style: { padding: "6px 12px", fontSize: 13, background: viewMode === "table" ? "rgba(255,255,255,0.1)" : "transparent", color: viewMode === "table" ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.15s" },
              children: "Table"
            }
          ),
          /* @__PURE__ */ jsx2(
            "button",
            {
              onClick: () => updateViewMode("cards"),
              style: { padding: "6px 12px", fontSize: 13, background: viewMode === "cards" ? "rgba(255,255,255,0.1)" : "transparent", color: viewMode === "cards" ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.15s" },
              children: "Cards"
            }
          )
        ] })
      ] }),
      viewMode === "cards" && /* @__PURE__ */ jsxs2("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }, children: [
        movies.map((movie) => {
          const status = getStatusInfo(movie);
          return /* @__PURE__ */ jsxs2(
            "div",
            {
              onClick: () => setSelectedMovieId(movie.id),
              className: "card cursor-pointer hover:ring-1 hover:ring-ndp-accent/50 transition-all",
              style: { overflow: "hidden", borderRadius: 8 },
              children: [
                /* @__PURE__ */ jsxs2("div", { style: { position: "relative", aspectRatio: "2/3", background: "rgba(255,255,255,0.03)" }, children: [
                  movie.poster ? /* @__PURE__ */ jsx2(
                    "img",
                    {
                      src: movie.poster,
                      alt: "",
                      style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
                      loading: "lazy"
                    }
                  ) : /* @__PURE__ */ jsx2("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }, className: "text-ndp-text-dim text-xs", children: "No Poster" }),
                  /* @__PURE__ */ jsx2(
                    "span",
                    {
                      className: status.className,
                      style: { position: "absolute", top: 6, right: 6, padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 600 },
                      children: status.label
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs2("div", { style: { padding: "8px 10px" }, children: [
                  /* @__PURE__ */ jsx2("p", { className: "text-ndp-text", style: { fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: movie.title }),
                  /* @__PURE__ */ jsxs2("div", { className: "text-ndp-text-dim", style: { fontSize: 11, marginTop: 2, display: "flex", justifyContent: "space-between" }, children: [
                    /* @__PURE__ */ jsx2("span", { children: movie.year }),
                    /* @__PURE__ */ jsx2("span", { children: movie.qualityName || profileMap[movie.qualityProfileId] || "" })
                  ] }),
                  movie.sizeOnDisk > 0 && /* @__PURE__ */ jsx2("p", { className: "text-ndp-text-dim", style: { fontSize: 10, marginTop: 2 }, children: formatSize2(movie.sizeOnDisk) })
                ] })
              ]
            },
            movie.id
          );
        }),
        movies.length === 0 && !loading && /* @__PURE__ */ jsx2("p", { className: "text-ndp-text-dim text-center", style: { gridColumn: "1 / -1", padding: "48px 0" }, children: "No movies found" })
      ] }),
      viewMode === "table" && /* @__PURE__ */ jsx2("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsx2("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs2("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx2("thead", { children: /* @__PURE__ */ jsxs2("tr", { className: "border-b border-white/5", children: [
          /* @__PURE__ */ jsx2("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", style: { width: 60 } }),
          /* @__PURE__ */ jsx2("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", children: "Title" }),
          /* @__PURE__ */ jsx2("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", style: { width: 70 }, children: "Year" }),
          /* @__PURE__ */ jsx2("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", style: { width: 120 }, children: "Status" }),
          /* @__PURE__ */ jsx2("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", style: { width: 120 }, children: "Quality" }),
          /* @__PURE__ */ jsx2("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium", style: { width: 100 }, children: "Size" })
        ] }) }),
        /* @__PURE__ */ jsxs2("tbody", { children: [
          movies.map((movie) => {
            const status = getStatusInfo(movie);
            return /* @__PURE__ */ jsxs2(
              "tr",
              {
                onClick: () => setSelectedMovieId(movie.id),
                className: "border-b border-white/5 last:border-0 hover:bg-white/[0.03] cursor-pointer transition-colors",
                children: [
                  /* @__PURE__ */ jsx2("td", { className: "px-4 py-2", children: movie.poster ? /* @__PURE__ */ jsx2(
                    "img",
                    {
                      src: movie.poster,
                      alt: "",
                      style: { width: 40, height: 60, objectFit: "cover", borderRadius: 4 },
                      loading: "lazy"
                    }
                  ) : /* @__PURE__ */ jsx2(
                    "div",
                    {
                      style: { width: 40, height: 60, borderRadius: 4 },
                      className: "bg-white/5 flex items-center justify-center text-ndp-text-dim text-xs",
                      children: "N/A"
                    }
                  ) }),
                  /* @__PURE__ */ jsx2("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx2("span", { className: "text-ndp-text font-medium", children: movie.title }) }),
                  /* @__PURE__ */ jsx2("td", { className: "px-4 py-2 text-ndp-text-dim", children: movie.year }),
                  /* @__PURE__ */ jsx2("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx2("span", { className: "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium " + status.className, children: status.label }) }),
                  /* @__PURE__ */ jsx2("td", { className: "px-4 py-2 text-ndp-text-dim", children: movie.qualityName || profileMap[movie.qualityProfileId] || "-" }),
                  /* @__PURE__ */ jsx2("td", { className: "px-4 py-2 text-right text-ndp-text-dim", children: movie.sizeOnDisk > 0 ? formatSize2(movie.sizeOnDisk) : "-" })
                ]
              },
              movie.id
            );
          }),
          movies.length === 0 && !loading && /* @__PURE__ */ jsx2("tr", { children: /* @__PURE__ */ jsx2("td", { colSpan: 6, className: "px-4 py-12 text-center text-ndp-text-dim", children: "No movies found" }) })
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx2("div", { ref: sentinelRef, style: { height: 1 } }),
      loadingMore && /* @__PURE__ */ jsx2("div", { className: "flex justify-center py-4", children: /* @__PURE__ */ jsx2("div", { style: { width: 24, height: 24, border: "2px solid", borderColor: "var(--ndp-accent, #6366f1) transparent", borderRadius: "50%", animation: "spin 1s linear infinite" } }) })
    ] }),
    selectedMovieId !== null && /* @__PURE__ */ jsx2(
      MovieModal,
      {
        movieId: selectedMovieId,
        onClose: () => setSelectedMovieId(null)
      }
    )
  ] });
}

// frontend/components/AnalyticsTab.tsx
import { useState as useState3, useEffect as useEffect3 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function formatSize3(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function formatSizeTB(bytes) {
  const tb = bytes / Math.pow(1024, 4);
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  return formatSize3(bytes);
}
function formatMonth(key) {
  const [year, month] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}
function StatCard({ label, value, accent }) {
  return /* @__PURE__ */ jsxs3("div", { className: "card p-5", children: [
    /* @__PURE__ */ jsx3("p", { className: "text-sm text-ndp-text-dim", children: label }),
    /* @__PURE__ */ jsx3("p", { className: "text-2xl font-bold mt-1 " + (accent || "text-ndp-text"), children: value })
  ] });
}
function AnalyticsTab() {
  const [data, setData] = useState3(null);
  const [loading, setLoading] = useState3(true);
  const [error, setError] = useState3(null);
  useEffect3(() => {
    let cancelled = false;
    fetch("/api/plugins/radarr/analytics", { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then((d) => {
      if (!cancelled) setData(d);
    }).catch((err) => {
      if (!cancelled) setError(err.message || "Failed to load analytics");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (loading) {
    return /* @__PURE__ */ jsx3("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx3("div", { className: "w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) });
  }
  if (error || !data) {
    return /* @__PURE__ */ jsx3("div", { className: "card p-6 text-center", children: /* @__PURE__ */ jsx3("p", { className: "text-ndp-error", children: error || "No data available" }) });
  }
  const maxTimelineCount = Math.max(...data.timeline.map((t) => t.count), 1);
  const maxQualityCount = Math.max(...data.qualityDistribution.map((q) => q.count), 1);
  return /* @__PURE__ */ jsxs3("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxs3("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4", children: [
      /* @__PURE__ */ jsx3(StatCard, { label: "Total Movies", value: data.overview.totalMovies.toLocaleString() }),
      /* @__PURE__ */ jsx3(StatCard, { label: "Total Size", value: formatSizeTB(data.overview.totalSize) }),
      /* @__PURE__ */ jsx3(StatCard, { label: "Downloaded", value: data.overview.downloaded.toLocaleString(), accent: "text-ndp-success" }),
      /* @__PURE__ */ jsx3(StatCard, { label: "Missing", value: data.overview.missing.toLocaleString(), accent: "text-ndp-error" }),
      /* @__PURE__ */ jsx3(StatCard, { label: "Unmonitored", value: data.overview.unmonitored.toLocaleString(), accent: "text-ndp-text-dim" })
    ] }),
    data.diskSpace.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-semibold text-ndp-text", children: "Disk Space" }),
      /* @__PURE__ */ jsx3("div", { className: "card p-5 space-y-4", children: data.diskSpace.map((disk) => /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between text-sm mb-1.5", children: [
          /* @__PURE__ */ jsx3("span", { className: "text-ndp-text truncate", title: disk.path, children: disk.label || disk.path }),
          /* @__PURE__ */ jsxs3("span", { className: "text-ndp-text-dim flex-shrink-0 ml-3", children: [
            formatSize3(disk.usedSpace),
            " / ",
            formatSize3(disk.totalSpace),
            " (",
            disk.usedPercent,
            "%)"
          ] })
        ] }),
        /* @__PURE__ */ jsx3("div", { className: "w-full h-3 bg-white/5 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx3(
          "div",
          {
            className: "h-full rounded-full transition-all duration-500 " + (disk.usedPercent > 90 ? "bg-ndp-error" : disk.usedPercent > 70 ? "bg-yellow-500" : "bg-ndp-accent"),
            style: { width: `${Math.min(disk.usedPercent, 100)}%` }
          }
        ) })
      ] }, disk.path)) })
    ] }),
    data.qualityDistribution.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-semibold text-ndp-text", children: "Quality Distribution" }),
      /* @__PURE__ */ jsx3("div", { className: "card p-5 space-y-3", children: data.qualityDistribution.map((q) => /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between text-sm mb-1", children: [
          /* @__PURE__ */ jsx3("span", { className: "text-ndp-text", children: q.name }),
          /* @__PURE__ */ jsx3("span", { className: "text-ndp-text-dim", children: q.count })
        ] }),
        /* @__PURE__ */ jsx3("div", { className: "w-full h-2 bg-white/5 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx3(
          "div",
          {
            className: "h-full bg-ndp-accent rounded-full transition-all duration-500",
            style: { width: `${q.count / maxQualityCount * 100}%` }
          }
        ) })
      ] }, q.name)) })
    ] }),
    data.timeline.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-semibold text-ndp-text", children: "Movies Added (Last 12 Months)" }),
      /* @__PURE__ */ jsx3("div", { className: "card p-5", children: /* @__PURE__ */ jsx3("div", { className: "flex items-end gap-1.5 h-40", children: data.timeline.map((t) => /* @__PURE__ */ jsxs3("div", { className: "flex-1 flex flex-col items-center gap-1 h-full justify-end", children: [
        /* @__PURE__ */ jsx3("span", { className: "text-[10px] text-ndp-text-dim", children: t.count > 0 ? t.count : "" }),
        /* @__PURE__ */ jsx3(
          "div",
          {
            className: "w-full bg-ndp-accent/80 rounded-t transition-all duration-500 min-h-[2px]",
            style: {
              height: t.count > 0 ? `${Math.max(t.count / maxTimelineCount * 100, 5)}%` : "2px"
            }
          }
        ),
        /* @__PURE__ */ jsx3("span", { className: "text-[9px] text-ndp-text-dim whitespace-nowrap", children: formatMonth(t.month) })
      ] }, t.month)) }) })
    ] }),
    data.rootFolders.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-semibold text-ndp-text", children: "Root Folders" }),
      /* @__PURE__ */ jsx3("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsxs3("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx3("thead", { children: /* @__PURE__ */ jsxs3("tr", { className: "border-b border-white/5", children: [
          /* @__PURE__ */ jsx3("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", children: "Path" }),
          /* @__PURE__ */ jsx3("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[100px]", children: "Movies" }),
          /* @__PURE__ */ jsx3("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[100px]", children: "Size" })
        ] }) }),
        /* @__PURE__ */ jsx3("tbody", { children: data.rootFolders.map((rf) => /* @__PURE__ */ jsxs3("tr", { className: "border-b border-white/5 last:border-0", children: [
          /* @__PURE__ */ jsx3("td", { className: "px-4 py-3 text-ndp-text break-all", children: rf.path }),
          /* @__PURE__ */ jsx3("td", { className: "px-4 py-3 text-right text-ndp-text-dim", children: rf.count }),
          /* @__PURE__ */ jsx3("td", { className: "px-4 py-3 text-right text-ndp-text-dim", children: formatSize3(rf.size) })
        ] }, rf.path)) })
      ] }) })
    ] })
  ] });
}

// frontend/components/QualityTab.tsx
import { useState as useState4, useEffect as useEffect4, useCallback as useCallback3 } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function formatSize4(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function QualityTab() {
  const [data, setData] = useState4(null);
  const [profiles, setProfiles] = useState4([]);
  const [loading, setLoading] = useState4(true);
  const [error, setError] = useState4(null);
  const [page, setPage] = useState4(1);
  const [pageSize] = useState4(20);
  const [searchingIds, setSearchingIds] = useState4(/* @__PURE__ */ new Set());
  const [searchedIds, setSearchedIds] = useState4(/* @__PURE__ */ new Set());
  const [bulkSearching, setBulkSearching] = useState4(false);
  const [message, setMessage] = useState4(null);
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3e3);
  };
  const fetchData = useCallback3(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/plugins/radarr/quality/cutoff-unmet?page=${page}&pageSize=${pageSize}`, {
        credentials: "include"
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/plugins/radarr/profiles", { credentials: "include" }).then((r) => r.json())
    ]).then(([cutoffData, profilesData]) => {
      setData(cutoffData);
      setProfiles(profilesData || []);
    }).catch((err) => setError(err.message || "Failed to load data")).finally(() => setLoading(false));
  }, [page, pageSize]);
  useEffect4(() => {
    fetchData();
  }, [fetchData]);
  const profileMap = {};
  for (const p of profiles) profileMap[p.id] = p;
  const handleSearchUpgrade = async (movieId) => {
    setSearchingIds((prev) => new Set(prev).add(movieId));
    try {
      const r = await fetch(`/api/plugins/radarr/quality/search/${movieId}`, {
        method: "POST",
        credentials: "include"
      });
      if (!r.ok) throw new Error("Search failed");
      setSearchedIds((prev) => new Set(prev).add(movieId));
      showMessage("Search upgrade command sent", "success");
    } catch {
      showMessage("Search upgrade failed", "error");
    }
    setSearchingIds((prev) => {
      const next = new Set(prev);
      next.delete(movieId);
      return next;
    });
  };
  const handleSearchAll = async () => {
    if (!data || data.records.length === 0) return;
    setBulkSearching(true);
    try {
      const movieIds = data.records.map((m) => m.id);
      const r = await fetch("/api/plugins/radarr/quality/search-bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds })
      });
      if (!r.ok) throw new Error("Bulk search failed");
      const result = await r.json();
      const successCount = result.results?.filter((r2) => r2.ok).length || 0;
      setSearchedIds((prev) => {
        const next = new Set(prev);
        movieIds.forEach((id) => next.add(id));
        return next;
      });
      showMessage(`Search sent for ${successCount} movie${successCount !== 1 ? "s" : ""}`, "success");
    } catch {
      showMessage("Bulk search failed", "error");
    }
    setBulkSearching(false);
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.totalRecords / data.pageSize)) : 1;
  if (loading) {
    return /* @__PURE__ */ jsx4("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx4("div", { className: "w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) });
  }
  if (error) {
    return /* @__PURE__ */ jsxs4("div", { className: "card p-6 text-center", children: [
      /* @__PURE__ */ jsx4("p", { className: "text-ndp-error", children: error }),
      /* @__PURE__ */ jsx4("button", { onClick: fetchData, className: "btn-primary text-sm mt-4", children: "Retry" })
    ] });
  }
  return /* @__PURE__ */ jsxs4("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs4("div", { children: [
        /* @__PURE__ */ jsx4("h2", { className: "text-lg font-semibold text-ndp-text", children: "Cutoff Unmet" }),
        /* @__PURE__ */ jsxs4("p", { className: "text-sm text-ndp-text-dim mt-0.5", children: [
          data?.totalRecords || 0,
          " movie",
          (data?.totalRecords || 0) !== 1 ? "s" : "",
          " below quality cutoff"
        ] })
      ] }),
      /* @__PURE__ */ jsx4(
        "button",
        {
          onClick: handleSearchAll,
          disabled: bulkSearching || !data || data.records.length === 0,
          className: "btn-primary text-sm disabled:opacity-50",
          children: bulkSearching ? /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx4("span", { className: "w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" }),
            "Searching All..."
          ] }) : "Search All"
        }
      )
    ] }),
    message && /* @__PURE__ */ jsx4(
      "div",
      {
        className: "px-4 py-2 rounded-lg text-sm font-medium " + (message.type === "success" ? "bg-ndp-success/15 text-ndp-success" : "bg-ndp-error/15 text-ndp-error"),
        children: message.text
      }
    ),
    /* @__PURE__ */ jsx4("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsx4("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs4("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx4("thead", { children: /* @__PURE__ */ jsxs4("tr", { className: "border-b border-white/5", children: [
        /* @__PURE__ */ jsx4("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", children: "Title" }),
        /* @__PURE__ */ jsx4("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[130px]", children: "Current Quality" }),
        /* @__PURE__ */ jsx4("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[130px]", children: "Cutoff" }),
        /* @__PURE__ */ jsx4("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[90px]", children: "Size" }),
        /* @__PURE__ */ jsx4("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[120px]" })
      ] }) }),
      /* @__PURE__ */ jsxs4("tbody", { children: [
        data?.records.map((movie) => {
          const profile = profileMap[movie.qualityProfileId];
          const currentQuality = movie.movieFile?.quality?.quality?.name || "No file";
          const cutoffQuality = profile?.cutoff?.name || "-";
          const isSearching = searchingIds.has(movie.id);
          const wasSearched = searchedIds.has(movie.id);
          return /* @__PURE__ */ jsxs4("tr", { className: "border-b border-white/5 last:border-0", children: [
            /* @__PURE__ */ jsxs4("td", { className: "px-4 py-3", children: [
              /* @__PURE__ */ jsx4("span", { className: "text-ndp-text font-medium", children: movie.title }),
              /* @__PURE__ */ jsxs4("span", { className: "text-ndp-text-dim ml-1.5", children: [
                "(",
                movie.year,
                ")"
              ] })
            ] }),
            /* @__PURE__ */ jsx4("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx4("span", { className: "inline-block px-2 py-0.5 rounded-full text-xs bg-ndp-error/15 text-ndp-error", children: currentQuality }) }),
            /* @__PURE__ */ jsx4("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx4("span", { className: "inline-block px-2 py-0.5 rounded-full text-xs bg-ndp-success/15 text-ndp-success", children: cutoffQuality }) }),
            /* @__PURE__ */ jsx4("td", { className: "px-4 py-3 text-right text-ndp-text-dim", children: movie.sizeOnDisk > 0 ? formatSize4(movie.sizeOnDisk) : "-" }),
            /* @__PURE__ */ jsx4("td", { className: "px-4 py-3 text-right", children: wasSearched ? /* @__PURE__ */ jsx4("span", { className: "text-xs text-ndp-success", children: "Sent" }) : /* @__PURE__ */ jsx4(
              "button",
              {
                onClick: () => handleSearchUpgrade(movie.id),
                disabled: isSearching,
                className: "px-3 py-1 rounded-lg text-xs font-medium bg-ndp-accent/20 text-ndp-accent hover:bg-ndp-accent/30 transition-colors disabled:opacity-50",
                children: isSearching ? /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsx4("span", { className: "w-2.5 h-2.5 border border-ndp-accent border-t-transparent rounded-full animate-spin" }),
                  "Searching"
                ] }) : "Search Upgrade"
              }
            ) })
          ] }, movie.id);
        }),
        (!data || data.records.length === 0) && /* @__PURE__ */ jsx4("tr", { children: /* @__PURE__ */ jsx4("td", { colSpan: 5, className: "px-4 py-12 text-center text-ndp-text-dim", children: "No movies below quality cutoff" }) })
      ] })
    ] }) }) }),
    totalPages > 1 && /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs4("p", { className: "text-sm text-ndp-text-dim", children: [
        "Page ",
        data?.page || 1,
        " of ",
        totalPages,
        " (",
        data?.totalRecords || 0,
        " total)"
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: () => setPage((p) => Math.max(1, p - 1)),
            disabled: page <= 1,
            className: "px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors",
            children: "Previous"
          }
        ),
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
            disabled: page >= totalPages,
            className: "px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors",
            children: "Next"
          }
        )
      ] })
    ] })
  ] });
}

// frontend/components/ReleasesTab.tsx
import { useState as useState5, useEffect as useEffect5, useCallback as useCallback4 } from "react";
import { Fragment as Fragment3, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function formatSize5(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function formatAge2(days) {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" });
}
function ReleasesTab2() {
  const [searchQuery, setSearchQuery] = useState5("");
  const [movieResults, setMovieResults] = useState5([]);
  const [selectedMovie, setSelectedMovie] = useState5(null);
  const [releases, setReleases] = useState5([]);
  const [searchingMovies, setSearchingMovies] = useState5(false);
  const [loadingReleases, setLoadingReleases] = useState5(false);
  const [grabbing, setGrabbing] = useState5(null);
  const [blocklist, setBlocklist] = useState5([]);
  const [blocklistTotal, setBlocklistTotal] = useState5(0);
  const [blocklistPage, setBlocklistPage] = useState5(1);
  const [loadingBlocklist, setLoadingBlocklist] = useState5(true);
  const [removingId, setRemovingId] = useState5(null);
  const [message, setMessage] = useState5(null);
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3e3);
  };
  const handleSearchMovies = useCallback4(async () => {
    if (!searchQuery.trim()) return;
    setSearchingMovies(true);
    setMovieResults([]);
    setSelectedMovie(null);
    setReleases([]);
    try {
      const r = await fetch(`/api/plugins/radarr/movies?search=${encodeURIComponent(searchQuery.trim())}`, {
        credentials: "include"
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setMovieResults((data.movies || []).slice(0, 20));
    } catch {
      showMessage("Failed to search movies", "error");
    }
    setSearchingMovies(false);
  }, [searchQuery]);
  const handleFetchReleases = async (movie) => {
    setSelectedMovie(movie);
    setLoadingReleases(true);
    setReleases([]);
    try {
      const r = await fetch(`/api/plugins/radarr/releases/${movie.id}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setReleases(data || []);
    } catch {
      showMessage("Failed to load releases", "error");
    }
    setLoadingReleases(false);
  };
  const handleGrab = async (release) => {
    setGrabbing(release.guid);
    try {
      const r = await fetch("/api/plugins/radarr/releases/grab", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guid: release.guid, indexerId: 0 })
      });
      if (!r.ok) throw new Error("Grab failed");
      showMessage("Release grabbed", "success");
    } catch {
      showMessage("Failed to grab release", "error");
    }
    setGrabbing(null);
  };
  const fetchBlocklist = useCallback4(async () => {
    setLoadingBlocklist(true);
    try {
      const r = await fetch(`/api/plugins/radarr/blocklist?page=${blocklistPage}&pageSize=20`, {
        credentials: "include"
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setBlocklist(data.records || []);
      setBlocklistTotal(data.totalRecords || 0);
    } catch {
      showMessage("Failed to load blocklist", "error");
    }
    setLoadingBlocklist(false);
  }, [blocklistPage]);
  useEffect5(() => {
    fetchBlocklist();
  }, [fetchBlocklist]);
  const handleRemoveBlocklistItem = async (id) => {
    setRemovingId(id);
    try {
      const r = await fetch(`/api/plugins/radarr/blocklist/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!r.ok) throw new Error("Remove failed");
      setBlocklist((prev) => prev.filter((item) => item.id !== id));
      setBlocklistTotal((prev) => prev - 1);
      showMessage("Blocklist item removed", "success");
    } catch {
      showMessage("Failed to remove blocklist item", "error");
    }
    setRemovingId(null);
  };
  const blocklistTotalPages = Math.max(1, Math.ceil(blocklistTotal / 20));
  return /* @__PURE__ */ jsxs5("div", { className: "space-y-8", children: [
    message && /* @__PURE__ */ jsx5(
      "div",
      {
        className: "px-4 py-2 rounded-lg text-sm font-medium " + (message.type === "success" ? "bg-ndp-success/15 text-ndp-success" : "bg-ndp-error/15 text-ndp-error"),
        children: message.text
      }
    ),
    /* @__PURE__ */ jsxs5("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx5("h2", { className: "text-lg font-semibold text-ndp-text", children: "Release Search" }),
      /* @__PURE__ */ jsxs5("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx5(
          "input",
          {
            type: "text",
            placeholder: "Search by movie title...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") handleSearchMovies();
            },
            className: "input flex-1 text-sm"
          }
        ),
        /* @__PURE__ */ jsx5(
          "button",
          {
            onClick: handleSearchMovies,
            disabled: searchingMovies || !searchQuery.trim(),
            className: "btn-primary text-sm disabled:opacity-50",
            children: searchingMovies ? /* @__PURE__ */ jsxs5("span", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx5("span", { className: "w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" }),
              "Searching"
            ] }) : "Search"
          }
        )
      ] }),
      movieResults.length > 0 && !selectedMovie && /* @__PURE__ */ jsxs5("div", { className: "card overflow-hidden", children: [
        /* @__PURE__ */ jsx5("div", { className: "px-4 py-2 border-b border-white/5", children: /* @__PURE__ */ jsx5("p", { className: "text-xs text-ndp-text-dim", children: "Select a movie to browse releases" }) }),
        movieResults.map((movie) => /* @__PURE__ */ jsxs5(
          "button",
          {
            onClick: () => handleFetchReleases(movie),
            className: "w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors",
            children: [
              /* @__PURE__ */ jsx5("span", { className: "text-sm text-ndp-text font-medium", children: movie.title }),
              /* @__PURE__ */ jsxs5("span", { className: "text-sm text-ndp-text-dim ml-2", children: [
                "(",
                movie.year,
                ")"
              ] })
            ]
          },
          movie.id
        ))
      ] }),
      selectedMovie && /* @__PURE__ */ jsxs5("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs5("p", { className: "text-sm text-ndp-text", children: [
            "Releases for",
            " ",
            /* @__PURE__ */ jsxs5("span", { className: "font-semibold", children: [
              selectedMovie.title,
              " (",
              selectedMovie.year,
              ")"
            ] })
          ] }),
          /* @__PURE__ */ jsx5(
            "button",
            {
              onClick: () => {
                setSelectedMovie(null);
                setReleases([]);
              },
              className: "text-xs text-ndp-text-dim hover:text-ndp-text transition-colors",
              children: "Clear"
            }
          )
        ] }),
        loadingReleases ? /* @__PURE__ */ jsx5("div", { className: "flex justify-center py-8", children: /* @__PURE__ */ jsx5("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) }) : releases.length === 0 ? /* @__PURE__ */ jsx5("div", { className: "card p-6 text-center text-ndp-text-dim text-sm", children: "No releases found" }) : /* @__PURE__ */ jsx5("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsx5("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs5("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs5("tr", { className: "border-b border-white/5", children: [
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", children: "Title" }),
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[90px]", children: "Quality" }),
            /* @__PURE__ */ jsx5("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px]", children: "Size" }),
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[100px]", children: "Indexer" }),
            /* @__PURE__ */ jsx5("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[60px]", children: "Age" }),
            /* @__PURE__ */ jsx5("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[70px]", children: "Seeders" }),
            /* @__PURE__ */ jsx5("th", { className: "text-center px-4 py-3 text-ndp-text-dim font-medium w-[80px]", children: "Status" }),
            /* @__PURE__ */ jsx5("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px]" })
          ] }) }),
          /* @__PURE__ */ jsx5("tbody", { children: releases.map((release) => /* @__PURE__ */ jsxs5("tr", { className: "border-b border-white/5 last:border-0", children: [
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx5("span", { className: "text-ndp-text text-xs break-all line-clamp-2", children: release.title }) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx5("span", { className: "text-xs text-ndp-text-dim", children: release.quality?.quality?.name || "-" }) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-right text-xs text-ndp-text-dim", children: formatSize5(release.size) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-xs text-ndp-text-dim", children: release.indexer || "-" }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-right text-xs text-ndp-text-dim", children: formatAge2(release.age) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-right text-xs text-ndp-text-dim", children: release.protocol === "torrent" ? release.seeders !== void 0 ? release.seeders : "-" : "-" }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-center", children: release.approved ? /* @__PURE__ */ jsx5("span", { className: "inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-ndp-success/15 text-ndp-success", children: "Approved" }) : /* @__PURE__ */ jsx5(
              "span",
              {
                className: "inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-ndp-error/15 text-ndp-error cursor-help",
                title: release.rejections?.join(", ") || "Rejected",
                children: "Rejected"
              }
            ) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-right", children: /* @__PURE__ */ jsx5(
              "button",
              {
                onClick: () => handleGrab(release),
                disabled: grabbing === release.guid,
                className: "px-2.5 py-1 rounded-lg text-xs font-medium bg-ndp-accent/20 text-ndp-accent hover:bg-ndp-accent/30 transition-colors disabled:opacity-50",
                children: grabbing === release.guid ? /* @__PURE__ */ jsx5("span", { className: "flex items-center gap-1", children: /* @__PURE__ */ jsx5("span", { className: "w-2.5 h-2.5 border border-ndp-accent border-t-transparent rounded-full animate-spin" }) }) : "Grab"
              }
            ) })
          ] }, release.guid)) })
        ] }) }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx5("div", { className: "border-t border-white/5" }),
    /* @__PURE__ */ jsxs5("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx5("h2", { className: "text-lg font-semibold text-ndp-text", children: "Blocklist" }),
        /* @__PURE__ */ jsxs5("span", { className: "text-sm text-ndp-text-dim", children: [
          blocklistTotal,
          " item",
          blocklistTotal !== 1 ? "s" : ""
        ] })
      ] }),
      loadingBlocklist ? /* @__PURE__ */ jsx5("div", { className: "flex justify-center py-8", children: /* @__PURE__ */ jsx5("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) }) : blocklist.length === 0 ? /* @__PURE__ */ jsx5("div", { className: "card p-6 text-center text-ndp-text-dim text-sm", children: "Blocklist is empty" }) : /* @__PURE__ */ jsxs5(Fragment3, { children: [
        /* @__PURE__ */ jsx5("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsx5("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs5("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs5("tr", { className: "border-b border-white/5", children: [
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium", children: "Source Title" }),
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[150px]", children: "Movie" }),
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[110px]", children: "Date" }),
            /* @__PURE__ */ jsx5("th", { className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[100px]", children: "Quality" }),
            /* @__PURE__ */ jsx5("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px]" })
          ] }) }),
          /* @__PURE__ */ jsx5("tbody", { children: blocklist.map((item) => /* @__PURE__ */ jsxs5("tr", { className: "border-b border-white/5 last:border-0", children: [
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx5("span", { className: "text-ndp-text text-xs break-all line-clamp-2", children: item.sourceTitle }) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-xs text-ndp-text-dim", children: item.movie ? `${item.movie.title} (${item.movie.year})` : `ID ${item.movieId}` }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-xs text-ndp-text-dim", children: formatDate(item.date) }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-xs text-ndp-text-dim", children: item.quality?.quality?.name || "-" }),
            /* @__PURE__ */ jsx5("td", { className: "px-4 py-2 text-right", children: /* @__PURE__ */ jsx5(
              "button",
              {
                onClick: () => handleRemoveBlocklistItem(item.id),
                disabled: removingId === item.id,
                className: "px-2.5 py-1 rounded-lg text-xs font-medium bg-ndp-error/10 text-ndp-error hover:bg-ndp-error/20 transition-colors disabled:opacity-50",
                children: removingId === item.id ? /* @__PURE__ */ jsx5("span", { className: "flex items-center gap-1", children: /* @__PURE__ */ jsx5("span", { className: "w-2.5 h-2.5 border border-ndp-error border-t-transparent rounded-full animate-spin" }) }) : "Remove"
              }
            ) })
          ] }, item.id)) })
        ] }) }) }),
        blocklistTotalPages > 1 && /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs5("p", { className: "text-sm text-ndp-text-dim", children: [
            "Page ",
            blocklistPage,
            " of ",
            blocklistTotalPages
          ] }),
          /* @__PURE__ */ jsxs5("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx5(
              "button",
              {
                onClick: () => setBlocklistPage((p) => Math.max(1, p - 1)),
                disabled: blocklistPage <= 1,
                className: "px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors",
                children: "Previous"
              }
            ),
            /* @__PURE__ */ jsx5(
              "button",
              {
                onClick: () => setBlocklistPage((p) => Math.min(blocklistTotalPages, p + 1)),
                disabled: blocklistPage >= blocklistTotalPages,
                className: "px-3 py-1.5 rounded-lg text-sm bg-ndp-surface text-ndp-text-dim hover:bg-ndp-surface-light disabled:opacity-40 disabled:pointer-events-none transition-colors",
                children: "Next"
              }
            )
          ] })
        ] })
      ] })
    ] })
  ] });
}

// frontend/components/FilesTab.tsx
import { useState as useState6, useEffect as useEffect6, useMemo as useMemo3 } from "react";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function formatSize6(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function FilesTab() {
  const [movies, setMovies] = useState6([]);
  const [loading, setLoading] = useState6(true);
  const [error, setError] = useState6(null);
  const [sortKey, setSortKey] = useState6("title");
  const [sortDir, setSortDir] = useState6("asc");
  const [deletingId, setDeletingId] = useState6(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState6(null);
  const [renamingId, setRenamingId] = useState6(null);
  const [message, setMessage] = useState6(null);
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3e3);
  };
  useEffect6(() => {
    let cancelled = false;
    fetch("/api/plugins/radarr/movies", { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then((data) => {
      if (!cancelled) setMovies(data.movies || []);
    }).catch((err) => {
      if (!cancelled) setError(err.message || "Failed to load movies");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [fileDetails, setFileDetails] = useState6(/* @__PURE__ */ new Map());
  const [loadingDetails, setLoadingDetails] = useState6(false);
  useEffect6(() => {
    const moviesWithFiles = movies.filter((m) => m.hasFile);
    if (moviesWithFiles.length === 0) return;
    setLoadingDetails(true);
    const fetchBatch = async () => {
      const details = /* @__PURE__ */ new Map();
      const batchSize = 10;
      for (let i = 0; i < moviesWithFiles.length; i += batchSize) {
        const batch = moviesWithFiles.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(
            (m) => fetch(`/api/plugins/radarr/movies/${m.id}`, { credentials: "include" }).then((r) => r.json()).then((data) => ({ movie: m, data }))
          )
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            const { movie, data } = result.value;
            const files = data.files || [];
            const file = files[0];
            if (file) {
              details.set(movie.id, {
                movieId: movie.id,
                fileId: file.id,
                title: movie.title,
                year: movie.year,
                path: file.path || file.relativePath || "-",
                size: file.size || movie.sizeOnDisk || 0,
                qualityName: file.quality?.quality?.name || movie.qualityName || "-",
                videoCodec: file.mediaInfo?.videoCodec || "-",
                audioCodec: file.mediaInfo?.audioCodec ? `${file.mediaInfo.audioCodec}${file.mediaInfo.audioChannels ? ` ${file.mediaInfo.audioChannels}ch` : ""}` : "-",
                resolution: file.mediaInfo?.resolution || "-"
              });
            }
          }
        }
        setFileDetails(new Map(details));
      }
      setLoadingDetails(false);
    };
    fetchBatch();
  }, [movies]);
  const rows = useMemo3(() => {
    const result = [];
    for (const movie of movies) {
      if (!movie.hasFile) continue;
      const detail = fileDetails.get(movie.id);
      if (detail) {
        result.push(detail);
      } else {
        result.push({
          movieId: movie.id,
          fileId: 0,
          title: movie.title,
          year: movie.year,
          path: "-",
          size: movie.sizeOnDisk || 0,
          qualityName: movie.qualityName || "-",
          videoCodec: "-",
          audioCodec: "-",
          resolution: "-"
        });
      }
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "size") {
        cmp = a.size - b.size;
      } else {
        const aVal = a[sortKey].toLowerCase();
        const bVal = b[sortKey].toLowerCase();
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [movies, fileDetails, sortKey, sortDir]);
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const handleDelete = async (row) => {
    if (row.fileId === 0) return;
    setDeletingId(row.fileId);
    try {
      const r = await fetch(`/api/plugins/radarr/files/${row.fileId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!r.ok) throw new Error("Delete failed");
      setMovies((prev) => prev.map((m) => m.id === row.movieId ? { ...m, hasFile: false, sizeOnDisk: 0 } : m));
      setFileDetails((prev) => {
        const next = new Map(prev);
        next.delete(row.movieId);
        return next;
      });
      setConfirmDeleteId(null);
      showMessage(`Deleted file for ${row.title}`, "success");
    } catch {
      showMessage("Failed to delete file", "error");
    }
    setDeletingId(null);
  };
  const handleRename = async (row) => {
    setRenamingId(row.movieId);
    try {
      const r = await fetch(`/api/plugins/radarr/files/${row.movieId}/rename`, {
        method: "POST",
        credentials: "include"
      });
      if (!r.ok) throw new Error("Rename failed");
      showMessage(`Rename command sent for ${row.title}`, "success");
    } catch {
      showMessage("Failed to rename file", "error");
    }
    setRenamingId(null);
  };
  const sortIndicator = (key) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };
  if (loading) {
    return /* @__PURE__ */ jsx6("div", { className: "flex justify-center py-12", children: /* @__PURE__ */ jsx6("div", { className: "w-8 h-8 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) });
  }
  if (error) {
    return /* @__PURE__ */ jsx6("div", { className: "card p-6 text-center", children: /* @__PURE__ */ jsx6("p", { className: "text-ndp-error", children: error }) });
  }
  return /* @__PURE__ */ jsxs6("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx6("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsx6("h2", { className: "text-lg font-semibold text-ndp-text", children: "File Management" }),
      /* @__PURE__ */ jsxs6("p", { className: "text-sm text-ndp-text-dim mt-0.5", children: [
        rows.length,
        " file",
        rows.length !== 1 ? "s" : "",
        loadingDetails && " (loading details...)"
      ] })
    ] }) }),
    message && /* @__PURE__ */ jsx6(
      "div",
      {
        className: "px-4 py-2 rounded-lg text-sm font-medium " + (message.type === "success" ? "bg-ndp-success/15 text-ndp-success" : "bg-ndp-error/15 text-ndp-error"),
        children: message.text
      }
    ),
    rows.length === 0 ? /* @__PURE__ */ jsx6("div", { className: "card p-6 text-center text-ndp-text-dim text-sm", children: "No movie files found" }) : /* @__PURE__ */ jsx6("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsx6("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs6("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx6("thead", { children: /* @__PURE__ */ jsxs6("tr", { className: "border-b border-white/5", children: [
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-left px-4 py-3 text-ndp-text-dim font-medium cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("title"),
            children: [
              "Title",
              sortIndicator("title")
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-left px-4 py-3 text-ndp-text-dim font-medium cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("path"),
            children: [
              "File Path",
              sortIndicator("path")
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[80px] cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("size"),
            children: [
              "Size",
              sortIndicator("size")
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[90px] cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("qualityName"),
            children: [
              "Quality",
              sortIndicator("qualityName")
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[80px] cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("videoCodec"),
            children: [
              "Video",
              sortIndicator("videoCodec")
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[90px] cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("audioCodec"),
            children: [
              "Audio",
              sortIndicator("audioCodec")
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(
          "th",
          {
            className: "text-left px-4 py-3 text-ndp-text-dim font-medium w-[80px] cursor-pointer hover:text-ndp-text select-none",
            onClick: () => handleSort("resolution"),
            children: [
              "Res",
              sortIndicator("resolution")
            ]
          }
        ),
        /* @__PURE__ */ jsx6("th", { className: "text-right px-4 py-3 text-ndp-text-dim font-medium w-[140px]", children: "Actions" })
      ] }) }),
      /* @__PURE__ */ jsx6("tbody", { children: rows.map((row) => /* @__PURE__ */ jsxs6("tr", { className: "border-b border-white/5 last:border-0", children: [
        /* @__PURE__ */ jsxs6("td", { className: "px-4 py-2", children: [
          /* @__PURE__ */ jsx6("span", { className: "text-ndp-text font-medium", children: row.title }),
          /* @__PURE__ */ jsxs6("span", { className: "text-ndp-text-dim ml-1.5 text-xs", children: [
            "(",
            row.year,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsx6("span", { className: "text-ndp-text-dim text-xs break-all line-clamp-2", children: row.path }) }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2 text-right text-ndp-text-dim", children: formatSize6(row.size) }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2 text-ndp-text-dim", children: row.qualityName }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2 text-ndp-text-dim text-xs", children: row.videoCodec }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2 text-ndp-text-dim text-xs", children: row.audioCodec }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2 text-ndp-text-dim text-xs", children: row.resolution }),
        /* @__PURE__ */ jsx6("td", { className: "px-4 py-2 text-right", children: /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-end gap-2", children: [
          /* @__PURE__ */ jsx6(
            "button",
            {
              onClick: () => handleRename(row),
              disabled: renamingId === row.movieId,
              className: "px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-ndp-text-dim hover:bg-white/10 transition-colors disabled:opacity-50",
              children: renamingId === row.movieId ? /* @__PURE__ */ jsx6("span", { className: "w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" }) : "Rename"
            }
          ),
          confirmDeleteId === row.movieId ? /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1", children: [
            /* @__PURE__ */ jsx6(
              "button",
              {
                onClick: () => handleDelete(row),
                disabled: deletingId === row.fileId,
                className: "px-2 py-1 rounded-lg text-xs font-medium bg-ndp-error text-white hover:bg-ndp-error/80 transition-colors disabled:opacity-50",
                children: deletingId === row.fileId ? "Deleting" : "Confirm"
              }
            ),
            /* @__PURE__ */ jsx6(
              "button",
              {
                onClick: () => setConfirmDeleteId(null),
                className: "px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-ndp-text-dim hover:bg-white/10 transition-colors",
                children: "Cancel"
              }
            )
          ] }) : /* @__PURE__ */ jsx6(
            "button",
            {
              onClick: () => setConfirmDeleteId(row.movieId),
              disabled: row.fileId === 0,
              className: "px-2 py-1 rounded-lg text-xs font-medium bg-ndp-error/10 text-ndp-error hover:bg-ndp-error/20 transition-colors disabled:opacity-50",
              children: "Delete"
            }
          )
        ] }) })
      ] }, row.movieId)) })
    ] }) }) })
  ] });
}

// frontend/components/DownloadsTab.tsx
import { useState as useState7, useEffect as useEffect7, useCallback as useCallback5, useRef as useRef3 } from "react";
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
function formatSize7(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function getStatusColor(status, trackedState) {
  const s = (trackedState || status || "").toLowerCase();
  if (s === "completed" || s === "importpending" || s === "imported") return "text-ndp-success";
  if (s === "failed") return "text-ndp-error";
  if (s === "warning") return "text-yellow-400";
  if (s === "downloading" || s === "delay") return "text-ndp-accent";
  return "text-ndp-text-dim";
}
function getStatusLabel(status, trackedState) {
  const s = trackedState || status || "unknown";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function DownloadsTab() {
  const [queue, setQueue] = useState7([]);
  const [totalRecords, setTotalRecords] = useState7(0);
  const [loading, setLoading] = useState7(true);
  const [error, setError] = useState7(null);
  const [removingId, setRemovingId] = useState7(null);
  const [message, setMessage] = useState7(null);
  const intervalRef = useRef3(null);
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3e3);
  };
  const fetchQueue = useCallback5(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const r = await fetch("/api/plugins/radarr/queue?page=1&pageSize=50", {
        credentials: "include"
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setQueue(data.records || []);
      setTotalRecords(data.totalRecords || 0);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect7(() => {
    fetchQueue(true);
    intervalRef.current = setInterval(() => fetchQueue(false), 5e3);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchQueue]);
  const handleRemove = async (id, blocklist = false) => {
    setRemovingId(id);
    try {
      const params = blocklist ? "?blocklist=true&removeFromClient=true" : "";
      const r = await fetch(`/api/plugins/radarr/queue/${id}${params}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!r.ok) throw new Error("Remove failed");
      setQueue((prev) => prev.filter((item) => item.id !== id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      showMessage(blocklist ? "Removed and blocklisted" : "Removed from queue", "success");
    } catch {
      showMessage("Failed to remove from queue", "error");
    }
    setRemovingId(null);
  };
  const totalSize = queue.reduce((sum, item) => sum + item.size, 0);
  return /* @__PURE__ */ jsxs7("div", { style: { display: "flex", flexDirection: "column", gap: 24 }, children: [
    message && /* @__PURE__ */ jsx7(
      "div",
      {
        className: "rounded-lg text-sm font-medium " + (message.type === "success" ? "bg-ndp-success/15 text-ndp-success" : "bg-ndp-error/15 text-ndp-error"),
        style: { padding: "8px 16px" },
        children: message.text
      }
    ),
    /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx7("h2", { className: "text-lg font-semibold text-ndp-text", children: "Active Downloads" }),
      /* @__PURE__ */ jsxs7("div", { className: "flex items-center", style: { gap: 16 }, children: [
        /* @__PURE__ */ jsxs7("span", { className: "text-sm text-ndp-text-dim", children: [
          totalRecords,
          " item",
          totalRecords !== 1 ? "s" : ""
        ] }),
        totalSize > 0 && /* @__PURE__ */ jsxs7("span", { className: "text-sm text-ndp-text-dim", children: [
          formatSize7(totalSize),
          " total"
        ] })
      ] })
    ] }),
    loading && /* @__PURE__ */ jsx7("div", { className: "flex justify-center", style: { padding: "48px 0" }, children: /* @__PURE__ */ jsx7("div", { className: "w-6 h-6 border-2 border-ndp-accent border-t-transparent rounded-full animate-spin" }) }),
    error && !loading && /* @__PURE__ */ jsxs7("div", { className: "card text-center", style: { padding: 24 }, children: [
      /* @__PURE__ */ jsx7("p", { className: "text-ndp-error text-sm", children: error }),
      /* @__PURE__ */ jsx7(
        "button",
        {
          onClick: () => fetchQueue(true),
          className: "btn-primary text-sm",
          style: { marginTop: 12, padding: "6px 16px" },
          children: "Retry"
        }
      )
    ] }),
    !loading && !error && queue.length === 0 && /* @__PURE__ */ jsx7("div", { className: "card text-center text-ndp-text-dim text-sm", style: { padding: 48 }, children: "No active downloads" }),
    !loading && !error && queue.length > 0 && /* @__PURE__ */ jsx7("div", { className: "card overflow-hidden", children: /* @__PURE__ */ jsx7("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs7("table", { className: "w-full text-sm", style: { minWidth: 800 }, children: [
      /* @__PURE__ */ jsx7("thead", { children: /* @__PURE__ */ jsxs7("tr", { className: "border-b border-white/5", children: [
        /* @__PURE__ */ jsx7(
          "th",
          {
            className: "text-left text-ndp-text-dim font-medium",
            style: { padding: "12px 16px" },
            children: "Movie"
          }
        ),
        /* @__PURE__ */ jsx7(
          "th",
          {
            className: "text-left text-ndp-text-dim font-medium",
            style: { padding: "12px 16px", width: 90 },
            children: "Quality"
          }
        ),
        /* @__PURE__ */ jsx7(
          "th",
          {
            className: "text-left text-ndp-text-dim font-medium",
            style: { padding: "12px 16px", width: 200 },
            children: "Progress"
          }
        ),
        /* @__PURE__ */ jsx7(
          "th",
          {
            className: "text-right text-ndp-text-dim font-medium",
            style: { padding: "12px 16px", width: 80 },
            children: "Time Left"
          }
        ),
        /* @__PURE__ */ jsx7(
          "th",
          {
            className: "text-center text-ndp-text-dim font-medium",
            style: { padding: "12px 16px", width: 100 },
            children: "Status"
          }
        ),
        /* @__PURE__ */ jsx7(
          "th",
          {
            className: "text-left text-ndp-text-dim font-medium",
            style: { padding: "12px 16px", width: 110 },
            children: "Client"
          }
        ),
        /* @__PURE__ */ jsx7("th", { style: { padding: "12px 16px", width: 140 } })
      ] }) }),
      /* @__PURE__ */ jsx7("tbody", { children: queue.map((item) => {
        const progress = item.size > 0 ? (item.size - item.sizeleft) / item.size * 100 : 0;
        const progressPct = Math.min(100, Math.max(0, progress));
        const statusColor = getStatusColor(
          item.status,
          item.trackedDownloadState
        );
        const statusLabel = getStatusLabel(
          item.status,
          item.trackedDownloadState
        );
        const isRemoving = removingId === item.id;
        return /* @__PURE__ */ jsxs7(
          "tr",
          {
            className: "border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors",
            children: [
              /* @__PURE__ */ jsxs7("td", { style: { padding: "10px 16px" }, children: [
                /* @__PURE__ */ jsxs7("div", { children: [
                  /* @__PURE__ */ jsx7("span", { className: "text-ndp-text text-sm font-medium", children: item.movie?.title || item.title }),
                  item.movie?.year && /* @__PURE__ */ jsxs7("span", { className: "text-ndp-text-dim", style: { marginLeft: 6 }, children: [
                    "(",
                    item.movie.year,
                    ")"
                  ] })
                ] }),
                item.statusMessages && item.statusMessages.length > 0 && /* @__PURE__ */ jsx7("div", { style: { marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }, children: item.statusMessages.map((sm, i) => /* @__PURE__ */ jsx7("div", { children: sm.messages.map((msg, j) => /* @__PURE__ */ jsx7(
                  "span",
                  {
                    className: "text-ndp-text-dim",
                    style: { fontSize: 10, lineHeight: "14px", display: "block" },
                    children: msg
                  },
                  j
                )) }, i)) })
              ] }),
              /* @__PURE__ */ jsx7("td", { className: "text-xs text-ndp-text-dim", style: { padding: "10px 16px" }, children: item.quality?.quality?.name || "-" }),
              /* @__PURE__ */ jsxs7("td", { style: { padding: "10px 16px" }, children: [
                /* @__PURE__ */ jsxs7("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                  /* @__PURE__ */ jsx7(
                    "div",
                    {
                      style: {
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        overflow: "hidden"
                      },
                      children: /* @__PURE__ */ jsx7(
                        "div",
                        {
                          style: {
                            width: `${progressPct}%`,
                            height: "100%",
                            borderRadius: 3,
                            backgroundColor: progressPct >= 100 ? "var(--color-ndp-success, #22c55e)" : "var(--color-ndp-accent, #3b82f6)",
                            transition: "width 0.3s ease"
                          }
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ jsxs7(
                    "span",
                    {
                      className: "text-xs text-ndp-text-dim",
                      style: { minWidth: 38, textAlign: "right" },
                      children: [
                        progressPct.toFixed(1),
                        "%"
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs7("div", { className: "text-xs text-ndp-text-dim", style: { marginTop: 2 }, children: [
                  formatSize7(item.size - item.sizeleft),
                  " / ",
                  formatSize7(item.size)
                ] })
              ] }),
              /* @__PURE__ */ jsx7(
                "td",
                {
                  className: "text-right text-xs text-ndp-text-dim",
                  style: { padding: "10px 16px" },
                  children: item.timeleft || "-"
                }
              ),
              /* @__PURE__ */ jsx7("td", { className: "text-center", style: { padding: "10px 16px" }, children: /* @__PURE__ */ jsx7("span", { className: `text-xs font-medium ${statusColor}`, children: statusLabel }) }),
              /* @__PURE__ */ jsx7("td", { className: "text-xs text-ndp-text-dim", style: { padding: "10px 16px" }, children: item.downloadClient || "-" }),
              /* @__PURE__ */ jsx7("td", { style: { padding: "10px 16px" }, children: /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-end", style: { gap: 6 }, children: [
                /* @__PURE__ */ jsx7(
                  "button",
                  {
                    onClick: () => handleRemove(item.id, false),
                    disabled: isRemoving,
                    className: "rounded-lg text-xs font-medium bg-white/10 text-ndp-text-dim hover:bg-white/15 hover:text-ndp-text transition-colors disabled:opacity-50",
                    style: { padding: "4px 8px", whiteSpace: "nowrap" },
                    title: "Remove from queue",
                    children: isRemoving ? /* @__PURE__ */ jsx7("span", { className: "w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" }) : "Remove"
                  }
                ),
                /* @__PURE__ */ jsx7(
                  "button",
                  {
                    onClick: () => handleRemove(item.id, true),
                    disabled: isRemoving,
                    className: "rounded-lg text-xs font-medium bg-ndp-error/10 text-ndp-error hover:bg-ndp-error/20 transition-colors disabled:opacity-50",
                    style: { padding: "4px 8px", whiteSpace: "nowrap" },
                    title: "Remove and add to blocklist",
                    children: "Blocklist"
                  }
                )
              ] }) })
            ]
          },
          item.id
        );
      }) })
    ] }) }) })
  ] });
}

// frontend/index.tsx
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
var TABS = [
  { id: "library", label: "Library" },
  { id: "downloads", label: "Downloads" },
  { id: "analytics", label: "Analytics" },
  { id: "quality", label: "Quality" },
  { id: "releases", label: "Releases" },
  { id: "files", label: "Files" }
];
function getInitialTab() {
  const hash = window.location.hash.replace("#", "");
  if (TABS.some((t) => t.id === hash)) return hash;
  return "library";
}
function RadarrManager() {
  const [activeTab, setActiveTab] = useState8(getInitialTab);
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };
  return /* @__PURE__ */ jsxs8("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxs8("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs8("svg", { className: "w-6 h-6 text-ndp-accent", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
        /* @__PURE__ */ jsx8("rect", { x: "2", y: "2", width: "20", height: "20", rx: "2.18", ry: "2.18" }),
        /* @__PURE__ */ jsx8("line", { x1: "7", y1: "2", x2: "7", y2: "22" }),
        /* @__PURE__ */ jsx8("line", { x1: "17", y1: "2", x2: "17", y2: "22" }),
        /* @__PURE__ */ jsx8("line", { x1: "2", y1: "12", x2: "22", y2: "12" }),
        /* @__PURE__ */ jsx8("line", { x1: "2", y1: "7", x2: "7", y2: "7" }),
        /* @__PURE__ */ jsx8("line", { x1: "2", y1: "17", x2: "7", y2: "17" }),
        /* @__PURE__ */ jsx8("line", { x1: "17", y1: "7", x2: "22", y2: "7" }),
        /* @__PURE__ */ jsx8("line", { x1: "17", y1: "17", x2: "22", y2: "17" })
      ] }),
      /* @__PURE__ */ jsx8("h1", { className: "text-2xl font-bold text-ndp-text", children: "Radarr Manager" })
    ] }),
    /* @__PURE__ */ jsx8("div", { className: "flex gap-2 overflow-x-auto pb-1", style: { scrollbarWidth: "none" }, children: TABS.map(({ id, label }) => /* @__PURE__ */ jsx8(
      "button",
      {
        onClick: () => handleTabChange(id),
        className: "px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap " + (activeTab === id ? "bg-ndp-accent text-white" : "bg-ndp-surface text-ndp-text-muted hover:bg-ndp-surface-light"),
        children: label
      },
      id
    )) }),
    /* @__PURE__ */ jsxs8("div", { className: "animate-fade-in", children: [
      activeTab === "library" && /* @__PURE__ */ jsx8(LibraryTab, {}),
      activeTab === "downloads" && /* @__PURE__ */ jsx8(DownloadsTab, {}),
      activeTab === "analytics" && /* @__PURE__ */ jsx8(AnalyticsTab, {}),
      activeTab === "quality" && /* @__PURE__ */ jsx8(QualityTab, {}),
      activeTab === "releases" && /* @__PURE__ */ jsx8(ReleasesTab2, {}),
      activeTab === "files" && /* @__PURE__ */ jsx8(FilesTab, {})
    ] }, activeTab)
  ] });
}
export {
  RadarrManager as default
};
//# sourceMappingURL=index.js.map
