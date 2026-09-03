#!/usr/bin/env python3
"""Offline regression tests for event content-quality refinement."""
from __future__ import annotations

from datetime import date

from refine_event_quality import (
    extract_application_deadline,
    extract_money,
    refine_event,
    refine_payload,
)


def main() -> None:
    assert extract_money("お値段：5,000円 定員：20名") == ("5,000円", [])
    assert extract_money("参加費 1,000円 申込期限 8月31日") == ("1,000円", [])
    assert extract_money("参加費：1, 000円 定員：15名") == ("1,000円", [])
    assert extract_money("参加費：1 ,000円 定員：15名") == ("1,000円", [])
    assert extract_money("参加費：1 , 000円 定員：15名") == ("1,000円", [])
    assert extract_money("チケット 前売1,000円／当日1,500円") == ("前売1,000円／当日1,500円", [])
    invalid_money, invalid_issues = extract_money("料金：000円")
    assert invalid_money == ""
    assert invalid_issues and "不自然" in invalid_issues[0]

    assert extract_application_deadline("申込期限：8月31日 実施日：9月26日", 2026) == "2026-08-31"
    assert extract_application_deadline("【9/26(土)】8/31(月)申込締切 バスツアー", 2026) == "2026-08-31"
    assert extract_application_deadline("申し込み締切 2026年10月20日", 2026) == "2026-10-20"

    bus = {
        "id": "community-nogata-kankoh-test",
        "title": "申込み受付中 バスツアー『のおがたを知る一日』",
        "startDate": "2026-09-26",
        "endDate": "2026-09-26",
        "money": "000円",
        "status": "scheduled",
        "statusLabel": "開催予定",
        "sourceUrl": "https://nogata-kankoh.com/news/8238.html",
    }
    bus_text = """
      開催日：2026年9月26日
      お値段：5,000円
      申込期限：8月31日
      集合場所：直方駅
    """
    refined_bus = refine_event(bus, bus_text, date(2026, 9, 3))
    assert refined_bus["money"] == "5,000円"
    assert refined_bus["applicationDeadline"] == "2026-08-31"
    assert refined_bus["applicationStatus"] == "closed"
    assert refined_bus["statusLabel"] == "受付終了（申込期限 8月31日）"
    assert "受付中" not in refined_bus["title"]
    assert refined_bus["contentStatus"] == "verified"

    malformed = {
        "id": "community-source-bad",
        "title": "まち歩き",
        "startDate": "2026-10-31",
        "endDate": "2026-10-31",
        "money": "000円",
        "sourceUrl": "https://example.org/bad",
    }
    refined_malformed = refine_event(malformed, "開催日 10月31日 料金は掲載元で確認", date(2026, 9, 3))
    assert "money" not in refined_malformed
    assert refined_malformed["contentStatus"] == "needs_review"
    assert any("不自然" in issue for issue in refined_malformed["contentIssues"])

    payload = {
        "schemaVersion": 1,
        "events": [bus],
        "sourceHealth": [{"id": "nogata-kankoh", "name": "観光協会", "status": "ok"}],
    }
    output = refine_payload(payload, fetcher=lambda _url: bus_text, today=date(2026, 9, 3))
    assert output["events"][0]["contentStatus"] == "verified"
    assert output["sourceHealth"][0]["fetchStatus"] == "ok"
    assert output["sourceHealth"][0]["contentStatus"] == "verified"
    assert output["sourceHealth"][0]["contentIssueCount"] == 0

    ambiguous = {
        "id": "community-nogata-kankoh-ambiguous",
        "title": "参加者募集中",
        "startDate": "2026-11-01",
        "endDate": "2026-11-01",
        "sourceUrl": "https://example.org/ambiguous",
    }
    refined_ambiguous = refine_event(ambiguous, "参加者募集中。詳細はお問い合わせください。", date(2026, 9, 3))
    assert refined_ambiguous["applicationStatus"] == "unconfirmed"
    assert refined_ambiguous["contentStatus"] == "needs_review"

    print("Event content-quality checks passed")


if __name__ == "__main__":
    main()
