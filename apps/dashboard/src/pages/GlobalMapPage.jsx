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
    <section className="global-map-page">
      <h2>Global map</h2>
      <select value={jobId ?? ""} onChange={(e) => setJobId(e.target.value)}>
        <option value="" disabled>Select a job</option>
        {jobs.map((j) => (
          <option key={j.job_id ?? j.id} value={j.job_id ?? j.id}>
            {j.job_id ?? j.id} ({j.status})
          </option>
        ))}
      </select>
      {jobId && <MapView detections={detections} />}
    </section>
  );
}