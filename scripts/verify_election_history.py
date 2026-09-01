#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLITICS = json.loads((ROOT / "data" / "politics.json").read_text(encoding="utf-8"))
HISTORY = json.loads((ROOT / "data" / "election-2023.json").read_text(encoding="utf-8"))


def fail(message: str) -> None:
    raise SystemExit(f"Election history QA failed: {message}")


def main() -> int:
    candidates = HISTORY.get("candidates", [])
    if len(candidates) != 24:
        fail(f"expected 24 candidates, got {len(candidates)}")

    winners = [c for c in candidates if c.get("result") == "当"]
    if len(winners) != 19:
        fail(f"expected 19 winners, got {len(winners)}")

    official_total = sum(float(c.get("votes", 0)) for c in candidates)
    if abs(official_total - 22776.997) > 0.0001:
        fail(f"candidate vote total mismatch: {official_total}")

    election = HISTORY.get("election", {})
    if election.get("validVotes") != 22777 or election.get("invalidVotes") != 453 or election.get("ballots") != 23230:
        fail("official ballot totals do not match the verified 2023 result")

    current_members = {m["name"] for m in POLITICS.get("council", {}).get("members", [])}
    linked_current = {c["currentName"] for c in winners if c.get("currentName")}
    if current_members != linked_current:
        missing = sorted(current_members - linked_current)
        extra = sorted(linked_current - current_members)
        fail(f"current-member mapping mismatch; missing={missing}, extra={extra}")

    allowed_status = {"新", "現", "元"}
    if any(c.get("statusBefore") not in allowed_status for c in candidates):
        fail("unexpected 新現元 value")

    print("Election history QA passed: 24 candidates, 19 winners, all current members mapped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
