// React hook: subscribes to a job's WebSocket channel, incrementally accumulates
// detections into state as each tile event arrives -- this is what makes
// MapView and ImageOverlay populate live instead of waiting for the full job.
import { useEffect, useRef, useState } from "react";
import { connectToJob } from "../websocket";

export function useDetectionSocket(jobId) {
  const [detections, setDetections] = useState([]);
  const [tilesDone, setTilesDone] = useState(0);
  const [status, setStatus] = useState("idle");   // idle | live | complete | failed
  const [error, setError] = useState(null);
  const sockRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;
    setDetections([]);
    setTilesDone(0);
    setStatus("live");
    setError(null);

    sockRef.current = connectToJob(jobId, {
      onPartial: (msg) => {
        setDetections((prev) => [...prev, ...(msg.detections || [])]);
        setTilesDone((n) => Math.max(n, (msg.tile_index ?? 0) + 1));
      },
      onComplete: () => setStatus("complete"),
      onFailed: (msg) => { setError(msg.error || "job failed"); setStatus("failed"); },
    });

    return () => sockRef.current?.close();
  }, [jobId]);

  return { detections, tilesDone, status, error };
}
