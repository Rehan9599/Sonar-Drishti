import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

const COLOR = {
  auto_confirmed: "#146c43",
  pending_review: "#96620c",
  analyst_confirmed: "#0a7a1e",
  analyst_rejected: "#78888e",
};

const CLASS_LABELS = {
  submarine_pipeline: "Pipeline / cable",
  shipwreck: "Shipwreck",
  mine_cylinder: "Cylinder — suspected ordnance",
  ghost_net: "Ghost net",
};

function uncertaintyM(d) {
  const base = 40;
  const across = Math.abs(d.across_track_m ?? 0);
  return Math.max(base, base + across * 1.0);
}

export default function MapView({ detections }) {
  const located = detections.filter((d) => {
    if (d.latitude == null || d.longitude == null) return false;
    if (d.class_label === "crab_pot") {
      console.error("Backend bug: crab_pot detection reached the UI", d);
      return false;
    }
    return true;
  });

  const centre = located.length
    ? [located[0].latitude, located[0].longitude]
    : [50.39, -7.71];

  return (
    <div>
      <MapContainer center={centre} zoom={13} style={{ height: "480px", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((d) => {
          const colour = COLOR[d.review_status] ?? "#0d7490";
          const pos = [d.latitude, d.longitude];
          const label = CLASS_LABELS[d.class_label] ?? d.class_label;
          return (
            <div key={d.detection_id}>
              <Circle center={pos} radius={uncertaintyM(d)}
                      pathOptions={{ color: colour, weight: 1, fillOpacity: 0.12 }} />
              <CircleMarker center={pos} radius={5}
                            pathOptions={{ color: colour, fillColor: colour, fillOpacity: 0.9 }}>
                <Popup>
                  <strong>{label}</strong><br />
                  {d.confidence_score?.toFixed(1)}% · {d.review_status}<br />
                  {d.side} {d.across_track_m?.toFixed(0)} m across-track<br />
                  {d.bounding_geometry?.width_m && (
                    <>~{d.bounding_geometry.width_m.toFixed(1)} × {d.bounding_geometry.height_m?.toFixed(1)} m<br /></>
                  )}
                  <small>±{uncertaintyM(d).toFixed(0)} m · {d.ping_id}</small>
                  {d.class_label === "mine_cylinder" && (
                    <p className="warning">
                      ⚠️ Suspected object — do not approach. Report to the maritime authority.
                    </p>
                  )}
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>
      <p className="map-legend">
        <em>Circles show positional uncertainty. Advisory only — not a navigational chart.</em>
      </p>
    </div>
  );
}   