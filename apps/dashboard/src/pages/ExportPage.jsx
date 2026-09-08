import { useParams } from "react-router-dom";
import { exportUrl } from "../api";

export default function ExportPage() {
  const { jobId } = useParams();
  return (
    <section className="export-page">
      <h2>Export report</h2>
      <ul className="export-links">
        <li><a href={exportUrl(jobId, "json")} download>JSON — full report</a></li>
        <li><a href={exportUrl(jobId, "csv")} download>CSV — flat table for spreadsheets</a></li>
        <li><a href={exportUrl(jobId, "geojson")} download>GeoJSON — for GIS / QGIS</a></li>
      </ul>
    </section>
  );
}
