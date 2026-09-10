import { useEffect, useMemo, useState } from "react";
import UploadPanel from "../components/UploadPanel/UploadPanel.jsx";
import MapView from "../components/MapView/MapView.jsx";
import ReviewQueue from "../components/ReviewQueue/ReviewQueue.jsx";
import { getJob, getDetections, exportUrl } from "../api";
import { useDetectionSocket } from "../hooks/useDetectionSocket";
import { useSessionJobs } from "../state/store";

const DONE = new Set(["completed", "failed"]);

export default function UploadResultsPage() {
  const { jobs, addJobs, patchJob, replaceDetections, updateDetection, clear } =
    useSessionJobs();
  const [activeJobId, setActiveJobId] = useState(null);
  const [overrides, setOverrides] = useState({});

  // live per-tile stream for the most recent upload
  const { detections: live, tilesDone, status: liveStatus } =
    useDetectionSocket(activeJobId);

  // WS says the active job finished — fetch the settled (deduped) list right
  // away for a fast UI update. This does NOT gate polling: if the fetch
  // fails, `settled` stays false and the poller below keeps retrying, so a
  // job can never get stuck showing the raw, un-merged WebSocket stream.
  useEffect(() => {
    if (!activeJobId) return;
    if (liveStatus === "complete") {
      patchJob(activeJobId, { status: "completed" });
      getDetections(activeJobId)
        .then((dets) => replaceDetections(activeJobId, dets))
        .catch(() => {
          /* transient — the poller retries until settled */
        });
    } else if (liveStatus === "failed") {
      patchJob(activeJobId, { status: "failed", settled: true });
    }
  }, [liveStatus, activeJobId, patchJob, replaceDetections]);

  // poll every session job that hasn't SETTLED yet — deliberately keyed off
  // `settled`, not `status`: a job reporting "completed" whose detections
  // fetch hasn't landed (raced by the WS shortcut above, or a transient
  // failure right as it finished) must keep being polled, not drop out.
  const pendingKey = jobs
    .filter((j) => !j.settled)
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pendingKey) return;
    const ids = pendingKey.split(",");
    const tick = async () => {
      for (const id of ids) {
        try {
          const info = await getJob(id);
          patchJob(id, {
            status: info.status,
            progress: info.progress ?? 0,
          });
          if (info.status === "completed") {
            replaceDetections(id, await getDetections(id));
          } else if (info.status === "failed") {
            patchJob(id, { settled: true });
          }
        } catch {
          /* transient — retry next tick */
        }
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [pendingKey, patchJob, replaceDetections]);

  function handleUploaded(entries) {
    addJobs(entries);
    if (entries.length) setActiveJobId(entries[entries.length - 1].id);
  }

  function handleUpdated(updated) {
    updateDetection(updated);
    setOverrides((prev) => ({ ...prev, [updated.detection_id]: updated }));
  }

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  // merged detections: every settled job + the live stream for the active job
  const rows = useMemo(() => {
    const merged = new Map();
    for (const j of jobs) {
      for (const d of j.detections || []) merged.set(d.detection_id, d);
    }
    const activeSettled = activeJob?.settled ?? false;
    if (activeJobId && !activeSettled) {
      for (const d of live) if (!merged.has(d.detection_id)) merged.set(d.detection_id, d);
    }
    return [...merged.values()].map((d) =>
      overrides[d.detection_id] ? { ...d, ...overrides[d.detection_id] } : d
    );
  }, [jobs, live, activeJobId, activeJob, overrides]);

  const running = jobs.filter((j) => !DONE.has(j.status)).length;

  return (
    <div className="dashboard-grid">
      <aside>
        <div className="sidebar-card">
          <h3>Upload sonar log</h3>
          <UploadPanel onUploaded={handleUploaded} />
        </div>

        <div className="sidebar-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>This session</h3>
            {jobs.length > 0 && (
              <button type="button" className="link-btn" onClick={() => { clear(); setActiveJobId(null); setOverrides({}); }}>
                Clear
              </button>
            )}
          </div>

          {jobs.length === 0 ? (
            <p className="muted">No uploads yet.</p>
          ) : (
            <>
              <div className="stat-row">
                <div className="stat">
                  <div className="stat-label">Jobs</div>
                  <div className="stat-value">{jobs.length}{running ? ` · ${running} running` : ""}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Detections</div>
                  <div className="stat-value">{rows.length}</div>
                </div>
              </div>

              <ul className="job-list">
                {jobs.map((j) => (
                  <li
                    key={j.id}
                    className={j.id === activeJobId ? "active" : ""}
                    onClick={() => setActiveJobId(j.id)}
                    title={j.id}
                  >
                    <span className="job-name">{j.name}</span>
                    <span className={`badge ${j.status}`}>{j.status}</span>
                    <span className="job-count">{j.detections?.length ?? 0}</span>
                  </li>
                ))}
              </ul>

              {activeJob && !DONE.has(activeJob.status) && (
                <div className="progress-section">
                  <div className="progress-label">
                    <span>{activeJob.name}</span>
                    <span>{Math.round((activeJob.progress ?? 0) * 100)}% · {tilesDone} tiles</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(activeJob.progress ?? 0) * 100}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="results-main">
        <div className="main-panel map-panel">
          <MapView detections={rows} />
        </div>

        <div className="results-bottom">
          <div className="main-panel queue-cell">
            <ReviewQueue detections={rows} onUpdated={handleUpdated} />
          </div>

          <div className="main-panel export-cell">
            <div className="export-bar">📄 EXPORT{activeJob ? ` — ${activeJob.name}` : ""}</div>
            <div className={`export-grid ${!activeJobId ? "disabled" : ""}`}>
              <a href={activeJobId ? exportUrl(activeJobId, "json") : "#"} download>JSON (.json) ⬇</a>
              <a href={activeJobId ? exportUrl(activeJobId, "csv") : "#"} download>CSV (.csv) ⬇</a>
              <a href={activeJobId ? exportUrl(activeJobId, "geojson") : "#"} download>GeoJSON (.geojson) ⬇</a>
            </div>
            {jobs.length > 1 && (
              <p className="hint">Per job — pick one in “This session” to switch.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
