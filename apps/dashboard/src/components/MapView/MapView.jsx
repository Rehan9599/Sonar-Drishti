import { useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import DetectionImageModal from "../DetectionImage/DetectionImageModal.jsx";

const HIDDEN_CLASSES = new Set(["crab_pot"]);

const COLOR = {
  auto_confirmed: "#146c43",
  pending_review: "#96620c",
  analyst_confirmed: "#0a7a1e",
  analyst_rejected: "#78888e",
};

function uncertaintyM(d) {
  const base = 40;
  const across = Math.abs(d.across_track_m ?? 0);
  return Math.max(base, base + across * 1.0);
}

export default function MapView({ detections }) {
  const [preview, setPreview] = useState(null);

  const located = detections.filter((d) => {
    if (HIDDEN_CLASSES.has(d.class_label)) {
      console.warn("Unexpected class_label from backend:", d.class_label, d.detection_id);
      return false;
    }
    return d.latitude != null && d.longitude != null;
  });

  const centre = located.length
    ? [located[0].latitude, located[0].longitude]
    : [22.9734, 78.6569]; // India centroid

  const zoom = located.length ? 12 : 5;

  // force remount whenever we switch between "no detections" and "has detections"
  // (or move between two different detection sets) so Leaflet actually re-centres
  const mapKey = located.length ? `loc-${located[0].detection_id}` : "india-default";

  return (
    <>
      <MapContainer
        key={mapKey}
        center={centre}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((d) => {
          const colour = COLOR[d.review_status] ?? "#0d7490";
          const pos = [d.latitude, d.longitude];
          return (
            <div key={d.detection_id}>
              <Circle center={pos} radius={uncertaintyM(d)}
                      pathOptions={{ color: colour, weight: 1, fillOpacity: 0.12 }} />
              <CircleMarker center={pos} radius={5}
                            pathOptions={{ color: colour, fillColor: colour, fillOpacity: 0.9 }}
                            eventHandlers={{ mouseover: (e) => e.target.openPopup() }}>
                <Popup>
                  <strong>{d.class_label}</strong><br />
                  {d.confidence_score?.toFixed(1)}% · {d.review_status}<br />
                  {d.side} {d.across_track_m?.toFixed(0)} m across-track<br />
                  {d.bounding_geometry?.width_m && (
                    <>~{d.bounding_geometry.width_m.toFixed(1)} × {d.bounding_geometry.height_m?.toFixed(1)} m<br /></>
                  )}
                  <small>±{uncertaintyM(d).toFixed(0)} m · {d.ping_id}</small>
                  {d.class_label === "mine_cylinder" && (
                    <p className="popup-warning">
                      ⚠ Suspected object — do not approach. Report to the maritime authority.
                    </p>
                  )}
                  <button type="button" className="popup-img-btn"
                          onClick={() => setPreview(d)}>
                    Show detected image
                  </button>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>
      <p className="map-legend">
        Circles show positional uncertainty. Hover a contact for details. Advisory only —
        not a navigational chart.
      </p>

      {preview && (
        <DetectionImageModal detection={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}