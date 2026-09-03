#!/usr/bin/env python3
"""Finalize event deadlines and derived application states after quality review.

The source parser and quality pass may disagree when a page contains both a
signup deadline and several event dates. Reviewed deadline overrides are
applied here as the final authority, then ``applicationStatus`` and
``statusLabel`` are recalculated from the current date on every sync.
"""
from __future__ import annotations

import argparse
import json
import re
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sync_events import EVENTS_PATH, JST, clean_text


ROOT = Path(__file__).resolve().parents[1]
OVERRIDES_PATH = ROOT / "data" / "event-quality-overrides.json"
DEADLINE_FIELDS = {"applicationDeadline", "reservationRequired"}


def canonical_url(value: str) -> str:
    parsed = urlparse(str(value or ""))
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", query, ""))


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def date_label(value: date) -> str:
    return f"{value.month}月{value.day}日"


def strip_stale_open_wording(title: str, status: str) -> str:
    if status != "closed":
        return clean_text(title)
    cleaned = re.sub(
        r"(?:申込(?:み)?|申し込み|応募|予約).{0,6}(?:受付中|募集中)[!！]?[｜|:：\s-]*",
        "",
        clean_text(title),
        flags=re.IGNORECASE,
    )
    return cleaned.strip(" |｜-—:：") or clean_text(title)


def load_overrides(path: Path = OVERRIDES_PATH) -> dict:
    if not path.exists():
        return {"schemaVersion": 1, "overrides": []}
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schemaVersion") != 1 or not isinstance(raw.get("overrides"), list):
        raise ValueError("event-quality-overrides.json has an unsupported schema")
    for entry in raw["overrides"]:
        if not isinstance(entry, dict) or not canonical_url(str(entry.get("sourceUrl") or "")):
            raise ValueError("every deadline override requires sourceUrl")
        deadline_fields = set((entry.get("set") or {}).keys()) & DEADLINE_FIELDS
        if "applicationDeadline" in deadline_fields:
            date.fromisoformat(str(entry["set"]["applicationDeadline"]))
    return raw


def _override_index(raw: dict) -> dict[str, dict]:
    return {
        canonical_url(str(entry.get("sourceUrl") or "")): entry
        for entry in raw.get("overrides", [])
        if isinstance(entry, dict) and canonical_url(str(entry.get("sourceUrl") or ""))
    }


def _remove_deadline_issues(issues: list[str]) -> list[str]:
    return [issue for issue in issues if not re.search(r"申込期限|受付状況", issue)]


def _apply_reviewed_deadline(event: dict, override: dict | None) -> dict:
    if not override:
        return event
    set_fields = override.get("set") or {}
    corrected: list[str] = []
    for field in DEADLINE_FIELDS:
        if field in set_fields:
            event[field] = set_fields[field]
            corrected.append(field)
    if not corrected:
        return event

    event["contentIssues"] = _remove_deadline_issues(list(event.get("contentIssues") or []))
    existing_review = event.get("reviewedOverride") if isinstance(event.get("reviewedOverride"), dict) else {}
    existing_fields = list(existing_review.get("fields") or [])
    existing_evidence = list(existing_review.get("evidenceUrls") or [])
    event["reviewedOverride"] = {
        "verifiedOn": str(override.get("verifiedOn") or existing_review.get("verifiedOn") or ""),
        "fields": sorted(set([*existing_fields, *corrected])),
        "evidenceUrls": unique([
            *[str(url) for url in existing_evidence if str(url).startswith("https://")],
            *[str(url) for url in override.get("evidenceUrls") or [] if str(url).startswith("https://")],
        ]),
    }
    note = clean_text(str(override.get("note") or ""))
    if note:
        event["contentNotes"] = unique([*(event.get("contentNotes") or []), note])
    return event


def finalize_event(event: dict, today: date, override: dict | None = None) -> dict:
    finalized = _apply_reviewed_deadline(deepcopy(event), override)
    issues = list(finalized.get("contentIssues") or [])

    deadline: date | None = None
    raw_deadline = str(finalized.get("applicationDeadline") or "")
    if raw_deadline:
        try:
            deadline = date.fromisoformat(raw_deadline)
        except ValueError:
            issues.append("申込期限の日付形式を確認できません")
            finalized.pop("applicationDeadline", None)

    start: date | None = None
    raw_start = str(finalized.get("startDate") or "")
    if raw_start:
        try:
            start = date.fromisoformat(raw_start)
        except ValueError:
            issues.append("開催日の日付形式を確認できません")

    if deadline and start and deadline > start:
        issues.append("申込期限が開催開始日より後になっているため再確認が必要です")

    if deadline:
        if deadline < today:
            status = "closed"
            label = f"受付終了（申込期限 {date_label(deadline)}）"
        elif deadline == today:
            status = "due_today"
            label = "申込期限は今日"
        else:
            status = "open"
            label = f"申込締切 {date_label(deadline)}"
        finalized["applicationStatus"] = status
        finalized["statusLabel"] = label
        finalized["title"] = strip_stale_open_wording(str(finalized.get("title") or ""), status)

    finalized["contentIssues"] = unique(issues)
    finalized["contentNotes"] = unique(list(finalized.get("contentNotes") or []))
    finalized["contentStatus"] = "needs_review" if finalized["contentIssues"] else "verified"
    finalized["stateCheckedAt"] = datetime.now(JST).isoformat()
    return finalized


def source_id_for_event(event: dict, source_ids: list[str]) -> str:
    event_id = str(event.get("id") or "")
    for source_id in sorted(source_ids, key=len, reverse=True):
        if event_id.startswith(f"community-{source_id}-"):
            return source_id
    return ""


def finalize_payload(payload: dict, today: date | None = None, overrides: dict | None = None) -> dict:
    today = today or datetime.now(JST).date()
    result = deepcopy(payload)
    registry = overrides if overrides is not None else load_overrides()
    override_index = _override_index(registry)
    events = [
        finalize_event(
            event,
            today,
            override_index.get(canonical_url(str(event.get("sourceUrl") or ""))),
        )
        for event in result.get("events", [])
    ]
    result["events"] = events
    result["stateCheckedAt"] = datetime.now(JST).isoformat()

    source_health = result.get("sourceHealth", [])
    source_ids = [str(item.get("id") or "") for item in source_health if item.get("id")]
    events_by_source: dict[str, list[dict]] = {source_id: [] for source_id in source_ids}
    for event in events:
        source_id = source_id_for_event(event, source_ids)
        if source_id:
            events_by_source.setdefault(source_id, []).append(event)

    next_health: list[dict] = []
    for health in source_health:
        source_id = str(health.get("id") or "")
        source_events = events_by_source.get(source_id, [])
        issue_count = sum(len(event.get("contentIssues") or []) for event in source_events)
        verified_count = sum(event.get("contentStatus") == "verified" for event in source_events)
        next_health.append({
            **health,
            "contentStatus": "needs_review" if issue_count else ("verified" if source_events else "no_current_events"),
            "contentIssueCount": issue_count,
            "contentVerifiedEvents": verified_count,
            "contentEventCount": len(source_events),
        })
    result["sourceHealth"] = next_health
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate reviewed deadline overrides")
    parser.add_argument("--input", type=Path, default=EVENTS_PATH)
    parser.add_argument("--output", type=Path, default=EVENTS_PATH)
    parser.add_argument("--overrides", type=Path, default=OVERRIDES_PATH)
    args = parser.parse_args()

    overrides = load_overrides(args.overrides)
    if args.check:
        assert overrides.get("schemaVersion") == 1
        sample = finalize_event(
            {
                "title": "申込み受付中 テスト",
                "startDate": "2026-09-26",
                "applicationDeadline": "2026-08-31",
            },
            date(2026, 9, 3),
        )
        assert sample["applicationStatus"] == "closed"
        assert "受付中" not in sample["title"]
        print("Event state finalization checks passed")
        return

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    finalized = finalize_payload(payload, overrides=overrides)
    args.output.write_text(json.dumps(finalized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    needs_review = sum(event.get("contentStatus") == "needs_review" for event in finalized.get("events", []))
    print(f"Finalized {len(finalized.get('events', []))} events; {needs_review} need review")


if __name__ == "__main__":
    main()
