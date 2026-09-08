import axios from "axios";

const MOCK = import.meta.env.VITE_MOCK === "1";

const MOCK_DETECTIONS = [
  {
    detection_id: "a138c61c-59b4-4eb2-815b-205b9d15b74f",
    job_id: "mock-job-1",
    ping_id: "DATA0000106.H-PU#1401",
    timestamp: "2015-08-12T09:08:28.650000+00:00",
    latitude: 50.3937068, longitude: -7.7132752,
    class_label: "shipwreck", confidence_score: 64.0,
    bounding_geometry: { bbox: [475.9, 11.4, 640.0, 153.1], mask_polygon: [], width_m: 55.2, height_m: 47.63 },
    across_track_m: 80.29, side: "starboard",
    review_status: "pending_review", source_file: "DATA0000106.H-PU",
  },
  {
    detection_id: "b249d72d-6a5c-5fc3-926c-316c0e26c85g",
    job_id: "mock-job-1",
    ping_id: "DATA0000106.H-PU#1402",
    timestamp: "2015-08-12T09:08:30.000000+00:00",
    latitude: null, longitude: null,
    class_label: "ghost_net", confidence_score: 95.3,
    bounding_geometry: { bbox: [100, 50, 200, 150], mask_polygon: [], width_m: 12.1, height_m: 8.4 },
    across_track_m: 30.1, side: "port",
    review_status: "auto_confirmed", source_file: "synth_ghost_net_00002",
  },
  {
    detection_id: "c358e83e-7b6d-6gd4-a37d-427d1f37d96h",
    job_id: "mock-job-1",
    ping_id: "DATA0000106.H-PU#1403",
    timestamp: "2015-08-12T09:08:32.000000+00:00",
    latitude: 50.3940, longitude: -7.7140,
    class_label: "mine_cylinder", confidence_score: 71.0,
    bounding_geometry: { bbox: [300, 60, 400, 180], mask_polygon: [], width_m: 5.2, height_m: 5.0 },
    across_track_m: 15.0, side: "starboard",
    review_status: "pending_review", source_file: "DATA0000106.H-PU",
  },
  {
    detection_id: "d469f94f-8c7e-7he5-b48e-538e2g48e07i",
    job_id: "mock-job-1",
    ping_id: "DATA0000106.H-PU#1404",
    timestamp: "2015-08-12T09:08:34.000000+00:00",
    latitude: 50.3935, longitude: -7.7128,
    class_label: "crab_pot", confidence_score: 55.0,
    bounding_geometry: { bbox: [10, 10, 50, 50], mask_polygon: [], width_m: 1.0, height_m: 1.0 },
    across_track_m: 5.0, side: "port",
    review_status: "pending_review", source_file: "DATA0000106.H-PU",
  },
];

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

export async function uploadLog(file, { xtf, nav } = {}) {
  if (MOCK) {
    return { job_id: "mock-job-1", status: "queued" };
  }
  const fd = new FormData();
  fd.append("file", file);
  if (xtf) fd.append("xtf", xtf);
  if (nav) fd.append("nav", nav);
  const { data } = await api.post("/upload/", fd);
  return data;
}

export async function getJobs() {
  if (MOCK) {
    return [{ job_id: "mock-job-1", status: "complete", progress: 1, detection_count: 3 }];
  }
  const { data } = await api.get("/jobs/");
  return data;
}

export async function getJob(jobId) {
  if (MOCK) {
    return { job_id: jobId, status: "complete", progress: 1, detection_count: 3 };
  }
  const { data } = await api.get(`/jobs/${jobId}/`);
  return data;
}

export async function getDetections(jobId) {
  if (MOCK) return MOCK_DETECTIONS;
  const { data } = await api.get(`/detections/${jobId}/`);
  return data;
}

export async function reviewDetection(detectionId, reviewStatus, actor = "analyst") {
  if (MOCK) {
    const found = MOCK_DETECTIONS.find((d) => d.detection_id === detectionId);
    if (found) found.review_status = reviewStatus;
    return found;
  }
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