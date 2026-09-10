import { useEffect, useState } from "react";
import { detectionImageUrl } from "../../api";

/**
 * Shows the tile crop for one detection.
 * The API does not serve crops yet — on 404 we fall back to an explicit
 * "not available" panel rather than a broken image, so this component keeps
 * working unchanged once GET /api/detections/<id>/image/ lands.
 */
export default function DetectionImageModal({ detection, onClose }) {
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!detection) return null;

  const url = detectionImageUrl(detection.detection_id);
  const bg = detection.bounding_geometry ?? {};
  const bbox = bg.bbox;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-label={`Detected image for ${detection.class_label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div className="modal-title">
            <strong>{detection.class_label}</strong>
            <span className={`badge ${detection.review_status}`}>
              {detection.confidence_score?.toFixed(1)}%
            </span>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-image">
          <img
            src={url}
            alt={`${detection.class_label} detection crop`}
            onLoad={() => setState("ready")}
            onError={() => setState("missing")}
            style={{ display: state === "ready" ? "block" : "none" }}
          />
          {state === "loading" && <p className="modal-note">Loading crop…</p>}
          {state === "missing" && (
            <div className="modal-missing">
              <p className="modal-missing-title">Detected image not available yet</p>
              <p>
                The API does not serve tile crops yet. Once{" "}
                <code>GET /api/detections/&lt;id&gt;/image/</code> is implemented this panel
                shows the 640×640 tile with the detection box drawn on it.
              </p>
              {bbox && (
                <p className="modal-bbox">
                  box in tile: [{bbox.map((v) => Math.round(v)).join(", ")}]
                </p>
              )}
            </div>
          )}
        </div>

        <dl className="modal-meta">
          <div>
            <dt>Ping</dt>
            <dd><code>{detection.ping_id || "—"}</code></dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>
              {detection.latitude != null
                ? `${detection.latitude.toFixed(5)}, ${detection.longitude.toFixed(5)}`
                : "no coordinates"}
            </dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>
              {bg.width_m != null
                ? `~${bg.width_m.toFixed(1)} × ${bg.height_m?.toFixed(1)} m`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{detection.review_status?.replace(/_/g, " ")}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
