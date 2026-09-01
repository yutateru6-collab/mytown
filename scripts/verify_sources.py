#!/usr/bin/env python3
"""Validate the MYTOWN official-source registry without making network calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "data" / "sources.json"
REQUIRED_FIELDS = {"id", "name", "type", "url", "refreshHours", "riskLevel", "publishPolicy"}
ALLOWED_TYPES = {"rss", "html", "pdf", "meeting-index", "bulletin-index"}
ALLOWED_RISK = {"low", "medium", "high"}


def validate_registry(data: dict) -> list[str]:
    errors: list[str] = []
    allowed_hosts = set(data.get("allowedHosts") or [])
    sources = data.get("sources")
    if not isinstance(sources, list) or not sources:
        return ["sources must be a non-empty list"]

    seen_ids: set[str] = set()
    for index, source in enumerate(sources):
        prefix = f"sources[{index}]"
        if not isinstance(source, dict):
            errors.append(f"{prefix} must be an object")
            continue
        missing = REQUIRED_FIELDS - set(source)
        if missing:
            errors.append(f"{prefix} missing fields: {', '.join(sorted(missing))}")
            continue

        source_id = str(source["id"])
        if source_id in seen_ids:
            errors.append(f"duplicate source id: {source_id}")
        seen_ids.add(source_id)

        if source["type"] not in ALLOWED_TYPES:
            errors.append(f"{source_id}: unsupported type {source['type']}")
        if source["riskLevel"] not in ALLOWED_RISK:
            errors.append(f"{source_id}: unsupported risk level {source['riskLevel']}")
        if not isinstance(source["refreshHours"], int) or source["refreshHours"] < 1:
            errors.append(f"{source_id}: refreshHours must be a positive integer")

        for field in ("url", "fallbackUrl"):
            value = source.get(field)
            if not value:
                continue
            parsed = urlparse(str(value))
            if parsed.scheme != "https":
                errors.append(f"{source_id}: {field} must use https")
            if parsed.hostname not in allowed_hosts:
                errors.append(f"{source_id}: {field} host is not allow-listed: {parsed.hostname}")

    return errors


def main() -> int:
    try:
        data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR source registry: {exc}", file=sys.stderr)
        return 1

    errors = validate_registry(data)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        return 1

    print(f"Source registry OK: {len(data['sources'])} official sources")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
