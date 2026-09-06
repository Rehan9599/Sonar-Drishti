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

  useEffect(() => {
    const t = setInterval(() => getJob(jobId).then(setJob).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [jobId]);

  useEffect(() => {
    if (status === "complete") getDetections(jobId).then(setSettled).catch(() => {});
  }, [status, jobId]);

  const rows = settled.length ? settled : live;

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
      <ReviewQueue detections={rows} onUpdated={(d) =>
        setSettled((prev) => prev.map((x) =>
          x.detection_id === d.detection_id ? d : x))} />
    </div>
  );
}