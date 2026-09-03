#!/usr/bin/env python3
"""Offline tests for final event deadline and application-state normalization."""
from __future__ import annotations

from datetime import date

from finalize_event_state import finalize_event, finalize_payload


def main() -> None:
    tulip = {
        "id": "community-nogata-kankoh-tulip",
        "title": "チューリップの球根植えボランティア",
        "startDate": "2026-11-17",
        "endDate": "2026-12-04",
        "applicationDeadline": "2026-11-17",
        "applicationStatus": "open",
        "statusLabel": "申込締切 11月17日",
        "sourceUrl": "https://nogata-kankoh.com/news/8291.html",
        "contentIssues": [],
        "contentNotes": [],
        "contentStatus": "verified",
    }
    tulip_override = {
        "sourceUrl": "https://nogata-kankoh.com/news/8291.html",
        "set": {
            "applicationDeadline": "2026-10-09",
            "reservationRequired": True,
        },
        "verifiedOn": "2026-09-03",
        "evidenceUrls": ["https://nogata-kankoh.com/news/8291.html"],
        "note": "申込期限をレビュー済みの10月9日に戻しました。",
    }
    open_tulip = finalize_event(tulip, date(2026, 9, 3), tulip_override)
    assert open_tulip["applicationDeadline"] == "2026-10-09"
    assert open_tulip["applicationStatus"] == "open"
    assert open_tulip["statusLabel"] == "申込締切 10月9日"
    assert open_tulip["reservationRequired"] is True
    assert open_tulip["contentStatus"] == "verified"

    closed_tulip = finalize_event(tulip, date(2026, 10, 10), tulip_override)
    assert closed_tulip["applicationStatus"] == "closed"
    assert closed_tulip["statusLabel"] == "受付終了（申込期限 10月9日）"

    bus = {
        "id": "community-nogata-kankoh-bus",
        "title": "申込み受付中 バスツアー",
        "startDate": "2026-09-26",
        "applicationDeadline": "2026-08-31",
        "sourceUrl": "https://nogata-kankoh.com/news/8238.html",
        "contentIssues": [],
    }
    closed_bus = finalize_event(bus, date(2026, 9, 3))
    assert closed_bus["applicationStatus"] == "closed"
    assert closed_bus["statusLabel"] == "受付終了（申込期限 8月31日）"
    assert "受付中" not in closed_bus["title"]

    impossible = {
        "id": "community-source-impossible",
        "title": "日付確認テスト",
        "startDate": "2026-10-01",
        "applicationDeadline": "2026-10-15",
        "sourceUrl": "https://example.org/impossible",
        "contentIssues": [],
    }
    checked = finalize_event(impossible, date(2026, 9, 3))
    assert checked["contentStatus"] == "needs_review"
    assert any("開催開始日より後" in issue for issue in checked["contentIssues"])

    payload = {
        "schemaVersion": 1,
        "events": [tulip],
        "sourceHealth": [
            {
                "id": "nogata-kankoh",
                "name": "直方市観光物産振興協会",
                "status": "ok",
                "fetchStatus": "ok",
            }
        ],
    }
    output = finalize_payload(
        payload,
        today=date(2026, 9, 3),
        overrides={"schemaVersion": 1, "overrides": [tulip_override]},
    )
    assert output["events"][0]["applicationDeadline"] == "2026-10-09"
    assert output["sourceHealth"][0]["contentStatus"] == "verified"
    assert output["sourceHealth"][0]["contentIssueCount"] == 0

    print("Event state finalization checks passed")


if __name__ == "__main__":
    main()
