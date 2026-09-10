// Session-scoped job store. Keeps every upload made in this browser session so the
// map and review queue accumulate results instead of showing only the last job.
// Backed by sessionStorage: survives a refresh, cleared when the tab closes.
import { useCallback, useEffect, useState } from "react";

const KEY = "drishti.session.jobs";

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(jobs) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    /* private mode / quota — in-memory only */
  }
}

/**
 * useSessionJobs() -> { jobs, addJobs, patchJob, replaceDetections, updateDetection, clear }
 *   jobs: [{ id, name, status, progress, detections: [] }]
 */
export function useSessionJobs() {
  const [jobs, setJobs] = useState(load);

  useEffect(() => {
    save(jobs);
  }, [jobs]);

  const addJobs = useCallback((entries) => {
    setJobs((prev) => {
      const have = new Set(prev.map((j) => j.id));
      const fresh = entries
        .filter((e) => !have.has(e.id))
        .map((e) => ({
          id: e.id,
          name: e.name || e.id,
          status: "queued",
          progress: 0,
          detections: [],
          // becomes true only once replaceDetections() actually lands the
          // server's (deduped) list — the sole signal that lets a job drop
          // out of polling. Decoupled from `status` on purpose: a job that
          // reports "completed" but whose detections fetch hasn't landed
          // yet (or failed) must keep being polled, or it gets stuck
          // showing the raw, un-merged WebSocket stream forever.
          settled: false,
        }));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  const patchJob = useCallback((id, fields) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...fields } : j))
    );
  }, []);

  const replaceDetections = useCallback((id, detections) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, detections, settled: true } : j))
    );
  }, []);

  const updateDetection = useCallback((updated) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.detections.some((d) => d.detection_id === updated.detection_id)
          ? {
              ...j,
              detections: j.detections.map((d) =>
                d.detection_id === updated.detection_id ? { ...d, ...updated } : d
              ),
            }
          : j
      )
    );
  }, []);

  const clear = useCallback(() => {
    setJobs([]);
    save([]);
  }, []);

  return { jobs, addJobs, patchJob, replaceDetections, updateDetection, clear };
}
