"""
Lee filter + CLAHE demo, for the PPT.

Runs the EXACT preprocessing DRISHTI ships with — this imports lee_filter(),
apply_clahe() and despeckle_clahe() straight from ml/scripts/preprocess_sonar.py
rather than reimplementing them, so the slide can never drift from what the
model was actually trained and served on:

    Lee MMSE speckle filter, 7x7   ->   CLAHE, clip 3.0, 8x8 tile grid

Produces, in demo/preprocessing_output/:
    01_raw.jpg              the untouched tile
    02_lee_only.jpg          after the Lee filter alone (denoised, contrast unchanged)
    03_lee_clahe.jpg         after Lee + CLAHE (== despeckle_clahe(), what the model sees)
    panel_3up.jpg            raw | Lee only | Lee+CLAHE, labelled, one image for the slide
    panel_2up.jpg            raw | Lee+CLAHE only, for a tighter before/after slide
    zoom_panel.jpg           a cropped region blown up, raw vs final, for close detail

Usage:
    python demo/preprocessing_demo.py
    python demo/preprocessing_demo.py --image path/to/tile.jpg --out demo/preprocessing_output
    python demo/preprocessing_demo.py --zoom 260 140 220 220     # x y w h of the region to blow up
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "ml" / "scripts"))
from preprocess_sonar import (          # noqa: E402  (real, shipped implementation)
    lee_filter,
    apply_clahe,
    despeckle_clahe,
    LEE_FILTER_SIZE,
    CLAHE_CLIP_LIMIT,
    CLAHE_TILE_GRID,
)

DEFAULT_IMAGE = _ROOT / "demo" / "frontend_test" / "02_shipwreck.jpg"
DEFAULT_OUT = _ROOT / "demo" / "preprocessing_output"

LABEL_H = 36
FONT = cv2.FONT_HERSHEY_SIMPLEX


def load_gray(path: Path) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"could not read image: {path}")
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def flat_region_std(gray: np.ndarray) -> float:
    """Std-dev of the flattest 40x40 *seafloor* patch (mean > 40, so the black
    nadir/water-column gap can't win by default) — a crude speckle-noise proxy."""
    h, w = gray.shape
    best = None
    step = 20
    for y in range(0, h - 40, step):
        for x in range(0, w - 40, step):
            patch = gray[y:y + 40, x:x + 40].astype(np.float64)
            if patch.mean() < 40:
                continue
            s = patch.std()
            if best is None or s < best:
                best = s
    return float(best or 0.0)


def labelled_panel(images_labels, height=360, pad=10) -> np.ndarray:
    """Horizontal strip of same-height grayscale panels, each with a caption bar."""
    panels = []
    for img, label in images_labels:
        h, w = img.shape[:2]
        scale = height / h
        resized = cv2.resize(img, (int(w * scale), height), interpolation=cv2.INTER_AREA)
        bgr = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
        bar = np.full((LABEL_H, bgr.shape[1], 3), (26, 35, 42), dtype=np.uint8)  # #1a232a
        (tw, th), _ = cv2.getTextSize(label, FONT, 0.6, 1)
        tx = max(8, (bar.shape[1] - tw) // 2)
        cv2.putText(bar, label, (tx, LABEL_H - 11), FONT, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
        panels.append(np.vstack([bar, bgr]))

    total_w = sum(p.shape[1] for p in panels) + pad * (len(panels) - 1)
    canvas_h = panels[0].shape[0]
    canvas = np.full((canvas_h, total_w, 3), 255, dtype=np.uint8)
    x = 0
    for p in panels:
        canvas[:, x:x + p.shape[1]] = p
        x += p.shape[1] + pad
        if x < total_w:
            cv2.rectangle(canvas, (x - pad, 0), (x, canvas_h), (255, 255, 255), -1)
    return canvas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", type=Path, default=DEFAULT_IMAGE, help="input sonar tile")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output directory")
    ap.add_argument("--zoom", nargs=4, type=int, default=None, metavar=("X", "Y", "W", "H"),
                     help="region to crop+enlarge for the zoom panel (default: auto-picked)")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    raw = load_gray(args.image)
    lee_only = lee_filter(raw, size=LEE_FILTER_SIZE)
    final = apply_clahe(lee_only, clip_limit=CLAHE_CLIP_LIMIT, tile_grid=CLAHE_TILE_GRID)
    assert np.array_equal(final, despeckle_clahe(raw)), "drifted from the shipped despeckle_clahe()"

    cv2.imwrite(str(args.out / "01_raw.jpg"), raw)
    cv2.imwrite(str(args.out / "02_lee_only.jpg"), lee_only)
    cv2.imwrite(str(args.out / "03_lee_clahe.jpg"), final)

    panel3 = labelled_panel([
        (raw, "RAW"),
        (lee_only, f"LEE FILTER  ({LEE_FILTER_SIZE}x{LEE_FILTER_SIZE})"),
        (final, f"+ CLAHE  (clip {CLAHE_CLIP_LIMIT}, {CLAHE_TILE_GRID[0]}x{CLAHE_TILE_GRID[1]})"),
    ])
    cv2.imwrite(str(args.out / "panel_3up.jpg"), panel3)

    panel2 = labelled_panel([(raw, "RAW"), (final, "LEE + CLAHE")])
    cv2.imwrite(str(args.out / "panel_2up.jpg"), panel2)

    # ---- zoom panel: a close crop, raw vs final, enlarged ----
    h, w = raw.shape
    if args.zoom:
        zx, zy, zw, zh = args.zoom
    else:
        zw, zh = min(220, w), min(220, h)
        zx, zy = max(0, w // 2 - zw // 2), max(0, h // 2 - zh // 2)
    zx, zy = min(zx, w - zw), min(zy, h - zh)
    raw_crop = raw[zy:zy + zh, zx:zx + zw]
    final_crop = final[zy:zy + zh, zx:zx + zw]
    zoom_scale = 2
    raw_big = cv2.resize(raw_crop, (zw * zoom_scale, zh * zoom_scale), interpolation=cv2.INTER_NEAREST)
    final_big = cv2.resize(final_crop, (zw * zoom_scale, zh * zoom_scale), interpolation=cv2.INTER_NEAREST)
    zoom_panel = labelled_panel([
        (raw_big, f"RAW  (crop {zw}x{zh} @ {zoom_scale}x)"),
        (final_big, "LEE + CLAHE"),
    ], height=zh * zoom_scale)
    cv2.imwrite(str(args.out / "zoom_panel.jpg"), zoom_panel)

    # mark the zoom region on a copy of the raw full tile, for reference
    marker = cv2.cvtColor(raw, cv2.COLOR_GRAY2BGR)
    cv2.rectangle(marker, (zx, zy), (zx + zw, zy + zh), (0, 210, 255), 2)
    cv2.imwrite(str(args.out / "zoom_region_marked.jpg"), marker)

    # ---- crude noise-reduction number, for a caption ----
    noise_before = flat_region_std(raw)
    noise_after = flat_region_std(lee_only)

    print(f"input          : {args.image}")
    print(f"output dir     : {args.out}")
    print(f"tile size      : {w}x{h}")
    print(f"Lee kernel     : {LEE_FILTER_SIZE}x{LEE_FILTER_SIZE}")
    print(f"CLAHE          : clip={CLAHE_CLIP_LIMIT}, grid={CLAHE_TILE_GRID}")
    print(f"flat-patch std : {noise_before:.1f} -> {noise_after:.1f}  (after Lee, before CLAHE)")
    print()
    print("files written:")
    for f in ["01_raw.jpg", "02_lee_only.jpg", "03_lee_clahe.jpg",
              "panel_3up.jpg", "panel_2up.jpg", "zoom_panel.jpg", "zoom_region_marked.jpg"]:
        print(f"  {args.out / f}")


if __name__ == "__main__":
    main()
