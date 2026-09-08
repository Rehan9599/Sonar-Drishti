import { Link, Navigate, Route, Routes } from "react-router-dom";

import ExportPage from "./pages/ExportPage.jsx";
import GlobalMapPage from "./pages/GlobalMapPage.jsx";
import LiveFeedPage from "./pages/LiveFeedPage.jsx";
import UploadResultsPage from "./pages/UploadResultsPage.jsx";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">DRISHTI</span>
        <nav>
          <Link to="/upload">Upload</Link>
          <Link to="/map">Map</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadResultsPage />} />
        <Route path="/jobs/:jobId" element={<LiveFeedPage />} />
        <Route path="/jobs/:jobId/export" element={<ExportPage />} />
        <Route path="/map" element={<GlobalMapPage />} />
      </Routes>
    </div>
  );
}
