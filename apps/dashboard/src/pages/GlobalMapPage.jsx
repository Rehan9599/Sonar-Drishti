import { useEffect, useState } from "react";
import MapView from "../components/MapView/MapView.jsx";
import { getJobs, getDetections } from "../api";

export default function GlobalMapPage() {
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [detections, setDetections] = useState([]);

  useEffect(() => { getJobs().then(setJobs).catch(() => {}); }, []);

  useEffect(() => {
    if (!jobId) return;
    getDetections(jobId).then(setDetections).catch(() => {});
  }, [jobId]);

  return (
    <div className="dashboard-grid">
      <aside>
        <div className="sidebar-card">
          <h3>Select job</h3>
          <select
            value={jobId ?? ""}
            onChange={(e) => setJobId(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #dce4e8" }}
          >
            <option value="" disabled>Choose a job</option>
            {jobs.map((j) => (
              <option key={j.job_id ?? j.id} value={j.job_id ?? j.id}>
                {j.job_id ?? j.id} ({j.status})
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="main-panel">
        {jobId ? (
          <MapView detections={detections} />
        ) : (
          <div className="main-panel-empty">
            <h2 style={{ margin: 0, color: "#17212b" }}>Select a job</h2>
            <p>Choose a job from the list to view its detections on the map.</p>
          </div>
        )}
      </main>
    </div>
  );
}