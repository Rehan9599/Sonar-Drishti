import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadLog } from "../../api";

export default function UploadPanel({ onUploaded }) {
  const [files, setFiles] = useState([]);
  const [xtf, setXtf] = useState(null);
  const [nav, setNav] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // "2 / 3"
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true);
    setErr(null);

    const uploaded = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`${i + 1} / ${files.length}`);
        const { job_id } = await uploadLog(files[i], { xtf, nav });
        uploaded.push({ id: job_id, name: files[i].name });
      }
      if (onUploaded) {
        onUploaded(uploaded);
      } else if (uploaded.length) {
        navigate(`/jobs/${uploaded[uploaded.length - 1].id}`);
      }
      setFiles([]);
    } catch (e2) {
      setErr(
        (uploaded.length ? `${uploaded.length} uploaded, then failed. ` : "") +
          (e2?.response?.data?.detail ?? "Upload failed. Check the file and try again.")
      );
      if (uploaded.length && onUploaded) onUploaded(uploaded);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form className="upload-panel" onSubmit={submit}>
      <label>
        Sonar image(s) or log <span className="req">required</span>
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.tif,.tiff,.xtf"
          onChange={(e) => setFiles(Array.from(e.target.files))}
        />
      </label>
      {files.length > 1 && (
        <p className="hint">{files.length} files — uploaded as separate jobs, results merge on the map.</p>
      )}

      <label>
        XTF navigation file <span className="opt">optional — needed for coordinates</span>
        <input type="file" accept=".xtf" onChange={(e) => setXtf(e.target.files[0] ?? null)} />
      </label>
      <label>
        Navigation CSV <span className="opt">optional</span>
        <input type="file" accept=".csv" onChange={(e) => setNav(e.target.files[0] ?? null)} />
      </label>

      <button type="submit" disabled={!files.length || busy}>
        {busy ? (progress ? `Uploading ${progress}…` : "Uploading…") : `Detect${files.length > 1 ? ` (${files.length})` : ""}`}
      </button>
      {err && <p className="error">{err}</p>}
      <p className="hint">
        An XTF or navigation CSV is applied to every file in the batch. Without one,
        detections have no coordinates and will not appear on the map.
      </p>
    </form>
  );
}
