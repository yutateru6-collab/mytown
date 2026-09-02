#!/usr/bin/env python3
"""Reject tiny raster assets before they can reach the public app."""

from pathlib import Path

from PIL import Image


MINIMUMS = {
    "assets/hero/nogata-watercolor.webp": (1560, 820),
    "assets/mascot/machinavi.webp": (540, 700),
    "assets/icons/nearby.webp": (700, 390),
    "assets/icons/services.webp": (540, 700),
    "assets/icons/deadline.webp": (540, 700),
    "assets/icons/decision.webp": (540, 700),
}


def main() -> None:
    failures: list[str] = []
    for filename, minimum in MINIMUMS.items():
        path = Path(filename)
        with Image.open(path) as image:
            actual = image.size
        if actual[0] < minimum[0] or actual[1] < minimum[1]:
            failures.append(f"{filename}: {actual[0]}x{actual[1]} < {minimum[0]}x{minimum[1]}")
        else:
            print(f"PASS {filename}: {actual[0]}x{actual[1]}")

    if failures:
        raise SystemExit("Raster density check failed:\n" + "\n".join(failures))


if __name__ == "__main__":
    main()
