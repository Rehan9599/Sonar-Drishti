# Cross-tile duplicate detections — root cause and fix

**Area:** `apps/api` detection pipeline + `apps/dashboard` results view
**Status:** fixed, verified end-to-end. Follow-ups listed at the bottom.

---

## Symptom

Uploading any image larger than one tile (a real transect, or even a slightly
non-square tile like 691×340) produced **two or more near-identical `Detection`
rows for a single physical object**:

- multiple markers stacked on the map for one contact
- multiple rows in the review queue with near-identical position / ping id
- session detection count higher than the number of real objects

Concrete repro (`demo/frontend_test/multi_tile_wreck.jpg` and a 691×340 tile):

```
tiles produced        : 2  →  offsets (0, 0) and (51, 0)
detections before fix : shipwreck 68.5 %  bbox [193.2, 129.7, 556.6, 321.4]
                        shipwreck 66.6 %  bbox [191.9, 129.3, 560.0, 321.9]
bbox-centre distance  : 1.1 px
IoU                   : 0.983
```

---

## Root cause

`run_detection_job` (`apps/api/detections/tasks.py`) processes each tile
**independently**:

```
write_tiles(image)                       # split into overlapping 640×640 tiles
for tile in tiles:
    report = run_pipeline(tile, ...)          # M0→M3 on that tile alone
    recs   = remap_detections(report, x_off, y_off)   # bbox → full-image px
    Detection.objects.bulk_create(recs)       # persisted verbatim
```

NMS runs **only inside `ConfidenceFilter.apply_nms()`**, which compares boxes
*within a single tile's* detection set. It has no visibility across tiles.
Nothing reconciled detections between tiles, so an object sitting in the
overlap band of two tiles was detected once per tile and both rows were kept.

Compounding factor: `tile_offsets()` / `write_tiles()` defaulted to
`stride = 512` on a 640 tile — only **128 px (20 %) overlap**, inconsistent
with the documented "50 % overlap".

---

## Fix

### 1. Job-level cross-tile merge — `apps/api/detections/tasks.py`

New `_merge_overlapping_detections(job, distance_px=50.0)`:

- runs **once per job**, after every tile is scored, immediately **before**
  `job.status = "completed"`
- pulls all `Detection` rows for the job, ordered by `confidence_score` desc
- greedy pass: for each detection, if its bbox **centre** (full-image pixel
  space, i.e. post-`remap_detections`) is within `distance_px` of an
  already-kept detection **of the same class**, drop it; otherwise keep it
- hard-deletes the dropped rows, returns the count
- count is written to the completion audit entry:
  `AuditLogEntry.details["duplicates_merged"]`

**Why centre-distance and not IoU:** an object truncated at a tile edge (tile A
sees it whole, tile B sees a cropped half) can have a *low* IoU with its
full-view counterpart because the boxes differ in size. Centre-distance is
robust to that mismatch. `50 px` matches the box-merge approach cited from
DFSE-YOLO in the deck.

**Known gap:** a heavily-truncated edge detection whose *centre* also shifts
> 50 px between tiles is not caught. IoS (intersection-over-smaller-box)
matching would — see follow-up 1.

### 2. True 50 % overlap — `apps/api/detections/tiling.py`

`stride` default `512 → 320` in both `tile_offsets()` and `write_tiles()`.
`640 − 320 = 320` = exactly 50 % overlap. Cost: more tiles per job (a
2048×15627 AURORA strip → 288 tiles); duplicates are now merged so it's safe,
and 50 % overlap reduces missed edge-straddling targets.
`ml/scripts/run_aurora_survey.py` has its own `tile_offsets` — untouched.

### 3. Frontend — stale un-merged view after job completion

Even with the backend fixed, the dashboard kept showing the pre-merge count.
Separate bug, same user-visible symptom.

**Cause:** two code paths set `job.status`. The WebSocket `detection.complete`
handler set `status: "completed"` **directly, with no detections fetch**. A
`"completed"` job was then excluded from the poller's pending set, and the
poller was the *only* place that called `replaceDetections()` (the deduped
`GET /api/detections/<job>/`). So `job.detections` stayed `[]` and the UI fell
back to the raw, un-merged WebSocket stream permanently.

**Fix:** new explicit `settled` boolean in `apps/dashboard/src/state/store.js`,
set `true` **only** by a successful `replaceDetections()`. It — not `status` —
is now the sole gate for "stop polling":

- `UploadResultsPage.jsx` poller keys its pending set off `!job.settled`
- the WS `complete` shortcut now also fires the `getDetections` fetch; if it
  fails, `settled` stays false and the poller keeps retrying
- `activeSettled` in the `rows` memo switched from `detections.length > 0`
  (broke for legitimate zero-detection jobs) to the explicit flag
- self-heals: jobs persisted before this change have no `settled` field →
  reads falsy → re-enter polling → get corrected on the next tick

No API contract change. The merge runs before `status` flips, so the first
`getDetections` the frontend makes on completion already returns the clean list.

---

## Verification

| Case | Result |
|---|---|
| `multi_tile_wreck.jpg` (640×900, same wreck in both overlapping tiles) | job settles to **1** detection; audit `details = {'duplicates_merged': 1}` |
| 691×340 tile (tiles at (0,0)/(51,0)) | 2 raw shipwreck detections (68.5 % / 66.6 %), centres 1.1 px apart → merged to **1** |
| `tile_offsets(2048, 15627)` after stride change | 288 tiles, exact 50 % overlap |
| Live run | both hits stream over WS transiently (real — that's what each tile saw), then reconcile to the true count on completion |

---

## Files touched

```
apps/api/detections/tasks.py        _merge_overlapping_detections() + call site + audit field
apps/api/detections/tiling.py        stride default 512 → 320 (tile_offsets, write_tiles)
apps/dashboard/src/state/store.js     `settled` flag (addJobs default, set in replaceDetections)
apps/dashboard/src/pages/UploadResultsPage.jsx
                                     poller keyed on `settled`; WS shortcut fetches;
                                     activeSettled uses the flag
```

**Deploy note:** the task change lives in the **worker** image. Its Dockerfile
is `FROM drishti-api:latest`, so a `web`-only rebuild ships stale task code
silently. Always `docker compose build worker` (or `build` with no service)
after touching `tasks.py`.

---

## Follow-ups

1. **Add IoS matching** alongside centre-distance in
   `_merge_overlapping_detections` — `intersection / min(area_a, area_b)` with a
   ~0.5 threshold — to catch the truncated-edge case centre-distance misses.
2. **Make thresholds configurable** — `distance_px` (and a future IoS
   threshold) via `settings`, not a hard-coded default.
3. **Regression test** — `apps/api/tests/test_detections_api.py` is empty. A
   test that feeds two near-identical rows and asserts (a) one survives,
   (b) the survivor is the higher-confidence one, is cheap.
4. **Soft-delete option** — the merge hard-deletes. A `merged_into` FK (or a
   `superseded` flag) keeps the dropped detection's provenance recoverable.
5. **Complexity** — the merge is O(n²) per class per job. Fine for realistic
   counts (tens–hundreds). For thousands, switch to a grid hash on bbox centre.
