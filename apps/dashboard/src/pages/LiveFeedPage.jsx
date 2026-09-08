import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MapView from "../components/MapView/MapView.jsx";
import ReviewQueue from "../components/ReviewQueue/ReviewQueue.jsx";
import { getDetections, getJob } from "../api";
import { useDetectionSocket } from "../hooks/useDetectionSocket";

export default function LiveFeedPage() {
  const { jobId } = useParams();
  const { detections: live, tilesDone, status, error } = useDetectionSocket(jobId);
  const [job, setJob] = useState(null);
  const [settled, setSettled] = useState([]);
  const [overrides, setOverrides] = useState({}); // detection_id -> latest reviewed fields

  // poll job status, but stop once the job is done
  useEffect(() => {
    if (!jobId) return;
    if (status === "complete" || status === "failed") return;
    const t = setInterval(() => getJob(jobId).then(setJob).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [jobId, status]);

  // once the job finishes, take the authoritative list from the DB
  useEffect(() => {
    if (status === "complete") getDetections(jobId).then(setSettled).catch(() => {});
  }, [status, jobId]);

  const base = settled.length ? settled : live;
  // apply any review updates on top of whichever source we're currently showing
  const rows = base.map((d) =>
    overrides[d.detection_id] ? { ...d, ...overrides[d.detection_id] } : d
  );

  function handleUpdated(updated) {
    setOverrides((prev) => ({ ...prev, [updated.detection_id]: updated }));
    setSettled((prev) =>
      prev.length
        ? prev.map((x) => (x.detection_id === updated.detection_id ? updated : x))
        : prev
    );
  }

  return (
    <div className="live-feed">
      <div className="status-bar">
        <span className={`badge ${status}`}>{status}</span>
        <span>{rows.length} detections</span>
        <span>{tilesDone} tiles processed</span>
        {job && <progress value={job.progress ?? 0} max="1" />}
        <Link to={`/jobs/${jobId}/export`}>Export</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <MapView detections={rows} />
      <ReviewQueue detections={rows} onUpdated={handleUpdated} />
    </div>
  );
}