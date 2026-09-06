import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

const MOCK = import.meta.env.VITE_MOCK === "1";

const MOCK_DETECTIONS = [{
  detection_id: "a138c61c-59b4-4eb2-815b-205b9d15b74f",
  job_id: "176771df-7360-4b31-a4ef-c92e3cddf393",
  ping_id: "DATA0000106.H-PU#1401",
  timestamp: "2015-08-12T09:08:28.650000+00:00",
  latitude: 50.3937068, longitude: -7.7132752,
  class_label: "shipwreck", confidence_score: 64.0,
  bounding_geometry: { bbox: [475.9, 11.4, 640.0, 153.1], mask_polygon: [],
                       width_m: 55.2, height_m: 47.63 },
  across_track_m: 80.29, side: "starboard",
  review_status: "pending_review", source_file: "DATA0000106.H-PU",
}];

export async function uploadLog(file, { xtf, nav } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  if (xtf) fd.append("xtf", xtf);
  if (nav) fd.append("nav", nav);
  const { data } = await api.post("/upload/", fd);
  return data;
}

export async function getJobs() {
  const { data } = await api.get("/jobs/");
  return data;
}

export async function getJob(jobId) {
  const { data } = await api.get(`/jobs/${jobId}/`);
  return data;
}

export async function getDetections(jobId) {
  if (MOCK) return MOCK_DETECTIONS;
  const { data } = await api.get(`/detections/${jobId}/`);
  return data;
}

export async function reviewDetection(detectionId, reviewStatus, actor = "analyst") {
  const { data } = await api.patch(`/detections/${detectionId}/review/`, {
    review_status: reviewStatus,
    actor,
  });
  return data;
}

export function exportUrl(jobId, format = "json") {
  const base = import.meta.env.VITE_API_BASE || "/api";
  return `${base}/export/${jobId}/?format=${format}`;
}