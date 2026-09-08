import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadLog } from "../../api";

export default function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [xtf, setXtf] = useState(null);
  const [nav, setNav] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const { job_id } = await uploadLog(file, { xtf, nav });
      if (onUploaded) {
        onUploaded(job_id);
      } else {
        navigate(`/jobs/${job_id}`);
      }
    } catch (e2) {
      setErr(e2?.response?.data?.detail ?? "Upload failed. Check the file and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload-panel" onSubmit={submit}>
      <label>Sonar image or log <span className="req">required</span>
        <input type="file" accept=".png,.jpg,.jpeg,.tif,.tiff,.xtf"
               onChange={(e) => setFile(e.target.files[0])} />
      </label>
      <label>XTF navigation file <span className="opt">optional — needed for coordinates</span>
        <input type="file" accept=".xtf" onChange={(e) => setXtf(e.target.files[0])} />
      </label>
      <label>Navigation CSV <span className="opt">optional</span>
        <input type="file" accept=".csv" onChange={(e) => setNav(e.target.files[0])} />
      </label>
      <button type="submit" disabled={!file || busy}>
        {busy ? "Uploading…" : "Detect"}
      </button>
      {err && <p className="error">{err}</p>}
      <p className="hint">
        Without an XTF or navigation file, detections have no coordinates and will not appear on the map.
      </p>
    </form>
  );
}