# Frontend live-test bundle

Stack must be up:  `docker compose up -d`  +  `pnpm --filter @drishti/dashboard dev`
Open http://localhost:5173 -> Upload page.

## Quick demo (fast, reliable) — one tile at a time

For each tile below: pick it as the **main file**, pick `navigation.csv` as the
**Navigation CSV** field, leave XTF empty, hit Detect. Watch the job page: the
review queue fills, the detection lands on the map.

| file | what you get |
|------|--------------|
| `01_pipeline.jpg`      | submarine_pipeline ~92%  -> **auto-confirmed** (green), on map |
| `02_shipwreck.jpg`     | shipwreck ~75%           -> **pending review**, on map |
| `03_mine_cylinder.jpg` | mine_cylinder ~71% (x2)  -> pending review, on map |
| `04_ghost_net.jpg`     | ghost_net ~69%           -> pending review, on map |
| `05_empty_seabed.jpg`  | nothing — shows the **"no detections"** empty state |

All five geotag to the same survey area off SW Ireland (~50.38 N, 7.71 W), so
after uploading a few they cluster on the map.

To show the review flow: open a `pending_review` detection, hit
Confirm / Reject — status updates, audit trail is written.

## Optional: full transect (slow — ~2-5 min, ~50-100 tiles)

`transect_DATA0000106.tif` is a real side-scan strip. Upload it as the main file
with `navigation.csv` as the nav CSV. The backend tiles it into 640x640, runs
every tile, and streams detections onto the map as they complete. Only do this
if you want the "whole survey" effect and have a few minutes.

(The matching XTF for true ping-header geotagging is 408 MB — too big to upload
through the browser. The nav CSV path is used instead and is close enough for a demo.)

## Without a nav file

Any tile alone (no CSV) still runs — you get the class + confidence + review
status, but latitude/longitude are null so it won't appear on the map. Useful
for showing the detector output on the Upload Results page.
