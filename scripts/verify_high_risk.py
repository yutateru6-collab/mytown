#!/usr/bin/env python3
"""Independent validation for civic data where a false positive is costly."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import sync_meetings
import sync_nogata
import sync_nogata_v2

ROOT = Path(__file__).resolve().parents[1]
LATEST_PATH = ROOT / "data" / "latest.json"
MEETINGS_PATH = ROOT / "data" / "meetings.json"
ALLOWED_HOSTS = {"city.nogata.fukuoka.jp", "www.city.nogata.fukuoka.jp"}


def normalized_title(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def meeting_signature(meeting: dict) -> tuple[str, str]:
    raw_start = str(meeting.get("start") or "")
    try:
        start = datetime.fromisoformat(raw_start)
        start_key = start.isoformat(timespec="minutes")
    except ValueError:
        start_key = raw_start
    return start_key, normalized_title(str(meeting.get("title") or ""))


def schedule_updated_date(text: str, series_title: str) -> str | None:
    marker = f"{series_title}の会議予定は次のとおりです"
    marker_pos = text.find(marker)
    if marker_pos < 0:
        return None
    matches = list(
        re.finditer(
            r"更新日\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日",
            text[:marker_pos],
        )
    )
    if not matches:
        return None
    match = matches[-1]
    return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


def print_update_diagnostics(html: str) -> None:
    matches = list(re.finditer("更新日", html))
    print(f"Council HTML update-date candidates: {len(matches)}")
    for index, match in enumerate(matches[:20]):
        start = max(0, match.start() - 220)
        end = min(len(html), match.end() + 420)
        snippet = re.sub(r"\s+", " ", html[start:end]).strip()
        print(f"COUNCIL_UPDATE_HTML_{index}: {snippet}")


def mark_council_unverified(payload: dict, message: str) -> None:
    council = payload.get("council")
    if not council:
        return
    council["status"] = "日程の再確認が必要"
    council["nextDateLabel"] = ""
    council["nextSummary"] = message


def verify_council(payload: dict, meetings_data: dict) -> tuple[bool, bool]:
    source = meetings_data.get("source") or {}
    source_url = str(source.get("sourceUrl") or "")
    parsed_url = urlparse(source_url)
    if parsed_url.scheme != "https" or parsed_url.hostname not in ALLOWED_HOSTS:
        mark_council_unverified(payload, "会議データの公式URLを確認できません。推測せず、公式ページで最新情報を確認してください。")
        return True, False

    try:
        html = sync_meetings.fetch_html(source_url)
        print_update_diagnostics(html)
        official = sync_meetings.parse_schedule_html(html, source_url)
        plain_text = sync_nogata.html_text(html)
    except Exception:
        mark_council_unverified(payload, "公式ページの再確認に失敗しました。推測せず、公式ページで最新情報を確認してください。")
        return True, False

    expected = [meeting_signature(x) for x in meetings_data.get("meetings") or []]
    observed = [meeting_signature(x) for x in official.get("meetings") or []]
    if (
        meetings_data.get("seriesTitle") != official.get("seriesTitle")
        or meetings_data.get("sessionStart") != official.get("sessionStart")
        or meetings_data.get("sessionEnd") != official.get("sessionEnd")
        or expected != observed
    ):
        mark_council_unverified(payload, "公式ページの会議予定と同期データが一致しません。推測せず、公式ページで最新情報を確認してください。")
        return True, False

    meetings_changed = False
    verified_update = schedule_updated_date(plain_text, str(meetings_data.get("seriesTitle") or ""))
    print(f"Council text-derived update date: {verified_update or 'unresolved'}")
    if verified_update and source.get("sourceUpdated") != verified_update:
        source["sourceUpdated"] = verified_update
        meetings_data["source"] = source
        meetings_changed = True

    verified_council = sync_nogata_v2.council_data(meetings_data)
    latest_changed = payload.get("council") != verified_council
    payload["council"] = verified_council
    return latest_changed, meetings_changed


def main() -> int:
    payload = json.loads(LATEST_PATH.read_text(encoding="utf-8"))
    meetings_data = json.loads(MEETINGS_PATH.read_text(encoding="utf-8"))

    before_latest = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    before_meetings = json.dumps(meetings_data, ensure_ascii=False, sort_keys=True)
    verify_council(payload, meetings_data)
    after_latest = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    after_meetings = json.dumps(meetings_data, ensure_ascii=False, sort_keys=True)

    changed: list[str] = []
    if before_latest != after_latest:
        LATEST_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        changed.append("latest")
    if before_meetings != after_meetings:
        MEETINGS_PATH.write_text(json.dumps(meetings_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        changed.append("meetings")

    if changed:
        print(f"High-risk civic verification adjusted: {', '.join(changed)}")
    else:
        print("High-risk civic data verification passed without changes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
