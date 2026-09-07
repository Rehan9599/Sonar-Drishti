import { useEffect, useState } from "react";
import UploadPanel from "../components/UploadPanel/UploadPanel.jsx";
import MapView from "../components/MapView/MapView.jsx";
import { getJob, getDetections, exportUrl } from "../api";
import { useDetectionSocket } from "../hooks/useDetectionSocket";

export default function UploadResultsPage() {
  const [jobId, setJobId] = useState(null);
  const { detections: live, tilesDone, status } = useDetectionSocket(jobId);
  const [job, setJob] = useState(null);
  const [settled, setSettled] = useState([]);

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(() => getJob(jobId).then(setJob).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [jobId]);

  useEffect(() => {
    if (status === "complete" && jobId) getDetections(jobId).then(setSettled).catch(() => {});
  }, [status, jobId]);

  const rows = settled.length ? settled : live;

  return (
    <div className="dashboard-grid">
      <aside>
        <div className="sidebar-card">
          <h3>Upload sonar log</h3>
          <UploadPanel onUploaded={(id) => setJobId(id)} />
        </div>

        <div className="sidebar-card">
          <h3>Job status</h3>
          {!jobId ? (
            <p className="muted">No job running yet.</p>
          ) : (
            <>
              <div className="stat-row">
                <div className="stat">
                  <div className="stat-label">Status</div>
                  <span className={`badge ${status}`}>{status}</span>
                </div>
              </div>
              <div className="stat-row">
                <div className="stat">
                  <div className="stat-label">Detections</div>
                  <div className="stat-value">{rows.length}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Tiles processed</div>
                  <div className="stat-value">{tilesDone}</div>
                </div>
              </div>
              {job && (
                <div className="progress-section">
                  <div className="progress-label">
                    <span>Progress</span>
                    <span>{Math.round((job.progress ?? 0) * 100)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(job.progress ?? 0) * 100}%` }} />
                  </div>
                </div>
              )}
              {rows.length > 0 && (
                <div className="detection-feed">
                  <h4>Detection feed</h4>
                  {rows.slice(0, 6).map((d) => (
                    <span key={d.detection_id}>
                      {d.class_label} ({d.confidence_score?.toFixed(0)}%)
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main>
        <div className="main-panel" style={{ marginBottom: 0 }}>
          {!jobId ? (
            <div className="main-panel-empty">
              <h2 style={{ margin: 0, color: "#17212b" }}>No job yet</h2>
              <p>Upload a sonar file to start detection. Results will appear here once processing begins.</p>
            </div>
          ) : (
            <MapView detections={rows} />
          )}

          <div className="export-bar">📄 EXPORT REPORT</div>
          <div className={`export-grid ${!jobId ? "disabled" : ""}`}>
            <a href={jobId ? exportUrl(jobId, "json") : "#"} download>JSON Data (.json) ⬇</a>
            <a href={jobId ? exportUrl(jobId, "csv") : "#"} download>CSV Data (.csv) ⬇</a>
            <a href={jobId ? exportUrl(jobId, "geojson") : "#"} download>GeoJSON (.geojson) ⬇</a>
          </div>
        </div>
      </main>
    </div>
  );
}