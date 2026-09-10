import { useState } from "react";
import { reviewDetection } from "../../api";
import DetectionImageModal from "../DetectionImage/DetectionImageModal.jsx";

const HIDDEN_CLASSES = new Set(["crab_pot"]);

export default function ReviewQueue({ detections, onUpdated }) {
  const [busy, setBusy] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [preview, setPreview] = useState(null);

  const pending = detections.filter((d) => {
    if (HIDDEN_CLASSES.has(d.class_label)) {
      console.warn("Unexpected class_label from backend:", d.class_label, d.detection_id);
      return false;
    }
    return d.review_status === "pending_review";
  });

  async function act(d, verdict) {
    setBusy(d.detection_id);
    setErrorId(null);
    try {
      const updated = await reviewDetection(d.detection_id, verdict);
      onUpdated?.(updated);
    } catch (e) {
      console.error("Review action failed:", e);
      setErrorId(d.detection_id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="review-queue">
      <h3>
        Review queue <span className="count">{pending.length}</span>
      </h3>

      {pending.length === 0 ? (
        <p className="queue-empty">Nothing awaiting review.</p>
      ) : (
        <div className="queue-scroll">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Score</th>
                <th>Position</th>
                <th>Ping</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.detection_id}>
                  <td>{d.class_label}</td>
                  <td>{d.confidence_score?.toFixed(1)}%</td>
                  <td>
                    {d.latitude != null
                      ? `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}`
                      : "—"}
                  </td>
                  <td><code>{d.ping_id || "—"}</code></td>
                  <td className="queue-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      title="Show detected image"
                      onClick={() => setPreview(d)}
                    >
                      Image
                    </button>
                    <button
                      type="button"
                      disabled={busy === d.detection_id}
                      onClick={() => act(d, "analyst_confirmed")}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={busy === d.detection_id}
                      onClick={() => act(d, "analyst_rejected")}
                    >
                      Reject
                    </button>
                    {errorId === d.detection_id && (
                      <span className="row-error">Failed — try again</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <DetectionImageModal detection={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
