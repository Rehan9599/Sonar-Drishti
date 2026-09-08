import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

export async function uploadLog(file, { xtf, nav } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  if (xtf) fd.append("xtf", xtf);
  if (nav) fd.append("nav", nav);
  const { data } = await api.post("/upload/", fd);
  return data;                                  // { job_id, status }
}

export async function getJobs() {
  const { data } = await api.get("/jobs/");
  return data;
}

export async function getJob(jobId) {
  const { data } = await api.get(`/jobs/${jobId}/`);
  return data;                                  // { status, progress, detection_count, ... }
}

export async function getDetections(jobId) {
  const { data } = await api.get(`/detections/${jobId}/`);
  return data;                                  // Detection[]
}

export async function reviewDetection(detectionId, reviewStatus, actor = "analyst") {
  const { data } = await api.patch(`/detections/${detectionId}/review/`, {
    review_status: reviewStatus,                // analyst_confirmed | analyst_rejected
    actor,
  });
  return data;
}

export function exportUrl(jobId, format = "json") {
  const base = import.meta.env.VITE_API_BASE || "/api";
  return `${base}/export/${jobId}/?format=${format}`;
}