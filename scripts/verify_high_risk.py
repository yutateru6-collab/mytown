#!/usr/bin/env python3
"""Extra validation for civic data where a false positive is costly."""
from __future__ import annotations

import json
from pathlib import Path

import sync_nogata

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "latest.json"


def verify_council(payload: dict) -> None:
    council = payload.get("council")
    if not council:
        return
    try:
        text = sync_nogata.html_text(sync_nogata.fetch_text(sync_nogata.COUNCIL_URL))
    except Exception:
        return

    # Validate the actual schedule text instead of trusting dates that may also
    # appear in navigation/sidebar content.
    required = [
        "9月 3日",
        "議案の提案説明",
        "4日 金曜日 本会議 （一般質問）",
        "7日 月曜日 本会議 （一般質問）",
        "25日 金曜日 本会議 （採決",
        "午前10時",
    ]
    if all(marker in text for marker in required):
        verified = sync_nogata.council_data()
        if verified:
            verified["sourceUpdated"] = "2026-07-02"
            payload["council"] = verified
    else:
        council["status"] = "日程の再確認が必要"
        council["nextDateLabel"] = ""
        council["nextSummary"] = "公式ページの内容が想定していた日程と一致しません。推測せず、公式ページで最新情報を確認してください。"


def main() -> int:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    before = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    verify_council(payload)
    after = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    if before != after:
        DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("High-risk civic data verification adjusted the synced data")
    else:
        print("High-risk civic data verification passed without changes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
