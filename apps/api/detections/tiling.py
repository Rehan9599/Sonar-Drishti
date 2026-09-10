from dataclasses import dataclass
from pathlib import Path

import cv2


@dataclass(frozen=True)
class ImageTile:
    path: Path
    x_offset: int
    y_offset: int


def tile_offsets(width: int, height: int, tile_size: int = 640,
                 stride: int = 320) -> list[tuple[int, int]]:
    if tile_size <= 0 or stride <= 0:
        raise ValueError("tile_size and stride must be positive")

    x_offsets = list(range(0, max(width - tile_size, 0) + 1, stride)) or [0]
    y_offsets = list(range(0, max(height - tile_size, 0) + 1, stride)) or [0]

    if width > tile_size and x_offsets[-1] != width - tile_size:
        x_offsets.append(width - tile_size)
    if height > tile_size and y_offsets[-1] != height - tile_size:
        y_offsets.append(height - tile_size)

    return [(x_offset, y_offset)
            for y_offset in y_offsets
            for x_offset in x_offsets]


def write_tiles(image_path: str | Path, output_dir: str | Path,
                tile_size: int = 640, stride: int = 320) -> list[ImageTile]:
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(f"could not read image: {image_path}")

    height, width = image.shape[:2]
    tiles = []
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, (x_offset, y_offset) in enumerate(
            tile_offsets(width, height, tile_size, stride)):
        crop = image[y_offset:y_offset + tile_size, x_offset:x_offset + tile_size]
        if crop.shape[0] < 32 or crop.shape[1] < 32:
            continue

        tile_path = output_dir / f"tile_{index:05d}.jpg"
        if not cv2.imwrite(str(tile_path), crop):
            raise OSError(f"could not write tile: {tile_path}")
        tiles.append(ImageTile(tile_path, x_offset, y_offset))

    if not tiles:
        raise ValueError(f"image is too small to process: {image_path}")
    return tiles


def remap_detections(detections: list[dict], x_offset: int,
                     y_offset: int) -> list[dict]:
    remapped = []
    for detection in detections:
        detection = detection.copy()
        geometry = dict(detection.get("bounding_geometry") or {})
        bbox = geometry.get("bbox")
        if bbox and len(bbox) == 4:
            geometry["bbox"] = [
                bbox[0] + x_offset,
                bbox[1] + y_offset,
                bbox[2] + x_offset,
                bbox[3] + y_offset,
            ]
        detection["bounding_geometry"] = geometry
        remapped.append(detection)
    return remapped