import { useState } from "react";
import { reviewDetection } from "../../api";

const HIDDEN_CLASSES = new Set(["crab_pot"]);

export default function ReviewQueue({ detections, onUpdated }) {
  const [busy, setBusy] = useState(null);
  const pending = detections.filter((d) => {
    if (HIDDEN_CLASSES.has(d.class_label)) {
      console.warn("Unexpected class_label from backend:", d.class_label, d.detection_id);
      return false;
    }
    return d.review_status === "pending_review";
  });

  async function act(d, verdict) {
    setBusy(d.detection_id);
    try {
      const updated = await reviewDetection(d.detection_id, verdict);
      onUpdated?.(updated);
    } finally {
      setBusy(null);
    }
  }

  if (!pending.length) {
    return <p className="queue-empty">Nothing awaiting review.</p>;
  }

  return (
    <section className="review-queue">
      <h3>Review queue <span className="count">{pending.length}</span></h3>
      <table>
        <thead>
          <tr><th>Class</th><th>Score</th><th>Position</th><th>Ping</th><th /></tr>
        </thead>
        <tbody>
          {pending.map((d) => (
            <tr key={d.detection_id}>
              <td>{d.class_label}</td>
              <td>{d.confidence_score?.toFixed(1)}%</td>
              <td>{d.latitude != null
                    ? `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}`
                    : "—"}</td>
              <td><code>{d.ping_id || "—"}</code></td>
              <td>
                <button disabled={busy === d.detection_id}
                        onClick={() => act(d, "analyst_confirmed")}>Confirm</button>
                <button disabled={busy === d.detection_id}
                        onClick={() => act(d, "analyst_rejected")}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}