#!/usr/bin/env python3
"""Offline regression tests for the community-event collectors."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from sync_events import (
    canonical_event_key,
    canonical_source_url,
    date_tokens,
    deduplicate,
    event_location,
    event_time,
    is_expired,
    last_sunday,
    merge_reviewed_fields,
    parse_aeon,
    parse_last_sunday_cleanup,
    parse_shakyo,
    parse_tourism,
)


JST = timezone(timedelta(hours=9))
NOW = datetime(2026, 9, 3, 10, 0, tzinfo=JST)


def source(source_id: str, parser: str, url: str, source_type: str, label: str, **extra: str) -> dict:
    return {
        "id": source_id,
        "name": extra.pop("name", source_id),
        "url": url,
        "parser": parser,
        "sourceType": source_type,
        "sourceLabel": label,
        "enabled": True,
        **extra,
    }


def main() -> None:
    aeon_source = source(
        "aeon",
        "aeon",
        "https://nogata.aeonmall.jp/event",
        "commercial",
        "商業施設",
        name="イオンモール直方",
        defaultLocation="イオンモール直方",
    )
    aeon_index = """
      <a href="/event/560fd47c-9d5b-4cb8-9d48-7e8cb6b7dbe5">予告 親子ステージ 2026/09/05 (土)</a>
      <a href="/event/11111111-1111-1111-1111-111111111111">予告 お得クーポン 2026/09/06 (日)</a>
      <a href="/event/22222222-2222-2222-2222-222222222222">イオンモールの超!COOOOOOL作戦 6月1日~9月30日</a>
    """
    aeon_detail = """
      <h1>親子ステージ</h1><dl><dt>日程</dt><dd>2026/09/05 (土)</dd>
      <dt>時間</dt><dd>11:00～ 13:00～</dd><dt>場所</dt><dd>1F リリーコート</dd></dl>
    """
    aeon_events = parse_aeon(aeon_source, aeon_index, lambda _url: aeon_detail, NOW)
    assert len(aeon_events) == 1
    assert aeon_events[0]["startDate"] == "2026-09-05"
    assert "イオンモール直方" in aeon_events[0]["location"]
    assert "family" in aeon_events[0]["tags"]

    shakyo_source = source(
        "shakyo", "shakyo", "https://nogatashakyo.org/", "community", "地域団体・NPO", name="直方市社会福祉協議会"
    )
    shakyo_url = "https://nogatashakyo.org/pages/25?b_id=119&detail=1&r_id=100"
    shakyo_index = f'<a href="{shakyo_url}">認知症カフェ「こより」を開催します!</a>'
    shakyo_detail = """
      <p>2026-09-01</p><p>日時:9月19日(土) 13時30分～15時30分</p>
      <p>場所:直方市保健福祉センターゆずりあ</p><p>参加費:200円</p>
    """
    shakyo_events = parse_shakyo(shakyo_source, shakyo_index, lambda _url: shakyo_detail, NOW)
    assert len(shakyo_events) == 1
    assert shakyo_events[0]["startDate"] == "2026-09-19"
    assert shakyo_events[0]["money"] == "200円"

    tourism_source = source(
        "tourism", "tourism", "https://nogata-kankoh.com/", "tourism", "観光・地域", name="直方市観光物産振興協会"
    )
    tourism_url = "https://nogata-kankoh.com/news/8291.html"
    tourism_index = f'<a href="{tourism_url}">チューリップの球根植えボランティア大募集</a>'
    tourism_detail = """
      <p>2026.09.02 更新</p><p>遠賀川河川敷にみんなで球根を植えませんか?</p>
      <p>申込締切:10月9日</p><p>実施日:11月17日 11月18日 11月28日</p>
      <p>実施時間:10:00～15:00</p>
    """
    tourism_events = parse_tourism(tourism_source, tourism_index, lambda _url: tourism_detail, NOW)
    assert len(tourism_events) == 1
    assert tourism_events[0]["occurrences"] == ["2026-11-17", "2026-11-18", "2026-11-28"]
    assert tourism_events[0]["applicationDeadline"] == "2026-10-09"
    assert "participation" in tourism_events[0]["tags"]

    dated_tourism_index = """
      <a href="https://nogata-kankoh.com/news/8267.html">【9/11(金)~12(土)】北九州空港で直方市をPR</a>
      <a href="https://nogata-kankoh.com/news/8300.html">【9/26(土)】 8/31(月)申込締切 バスツアー</a>
    """
    dated_details = {
        "https://nogata-kankoh.com/news/8267.html": "開催日:9月11日(金) 場所:北九州空港ターミナルビル内 特設会場",
        "https://nogata-kankoh.com/news/8300.html": "日程:8月31日申込締切 9月26日開催 場所:JR直方駅",
    }
    dated_events = parse_tourism(tourism_source, dated_tourism_index, dated_details.__getitem__, NOW)
    assert [(item["startDate"], item["endDate"]) for item in dated_events] == [
        ("2026-09-11", "2026-09-12"),
        ("2026-09-26", "2026-09-26"),
    ]

    cleanup_source = source(
        "cleanup",
        "last-sunday-cleanup",
        "https://www.city.nogata.fukuoka.jp/yukari/example.html",
        "community",
        "地域団体・NPO",
        name="遠賀川水辺館の活動団体",
    )
    cleanup_html = "<p>春の小川まつりは毎月最後の日曜日、遠賀川水辺館で行います。</p>"
    cleanup = parse_last_sunday_cleanup(cleanup_source, cleanup_html, lambda _url: "", NOW)
    assert cleanup[0]["startDate"] == "2026-09-27"
    assert last_sunday(2026, 9).isoformat() == "2026-09-27"

    shorthand = date_tokens("開催日:9月11日(金)～12日(土)", 2026)
    assert [value.isoformat() for value in shorthand] == ["2026-09-11", "2026-09-12"]
    assert event_time("日時:9月6日(日) 10:00～12:00、13:15～16:00 場所:会場") == "10:00～12:00／13:15～16:00"
    long_location = (
        "場所:北九州空港ターミナルビル内 特設会場 直方のおいしい・たのしいを体験できる2日間です "
        "ぜひお立ち寄りください 一般社団法人直方市観光物産振興協会からのお知らせを掲載しています"
    )
    assert event_location(long_location) == "北九州空港ターミナルビル内 特設会場"
    assert canonical_source_url("https://example.org/event/?b=2&a=1#detail") == canonical_source_url(
        "https://example.org/event?a=1&b=2"
    )

    reviewed = {
        **aeon_events[0],
        "summary": "編集者が確認した要約です。",
        "location": "確認済み会場",
        "category": "親子・子ども",
        "tags": ["family"],
        "editoriallyReviewed": True,
    }
    reparsed = {**aeon_events[0], "summary": "自動要約", "location": "長すぎる案内文", "category": "イベント", "tags": []}
    merged = merge_reviewed_fields(reparsed, reviewed)
    assert merged["summary"] == reviewed["summary"]
    assert merged["location"] == reviewed["location"]
    assert merged["editoriallyReviewed"] is True

    next_year = {**reparsed, "startDate": "2027-09-05", "endDate": "2027-09-05"}
    fresh = merge_reviewed_fields(next_year, reviewed)
    assert fresh["summary"] == "自動要約"
    assert "editoriallyReviewed" not in fresh

    duplicate = {**aeon_events[0], "sourceUrl": "https://example.org/same", "id": "duplicate"}
    assert canonical_event_key(aeon_events[0]) == canonical_event_key(duplicate)
    assert len(deduplicate([aeon_events[0], duplicate])) == 1
    assert not is_expired(aeon_events[0], NOW.date())
    assert is_expired({**aeon_events[0], "startDate": "2026-09-01", "endDate": "2026-09-01"}, NOW.date())

    print("Community event pipeline checks passed")


if __name__ == "__main__":
    main()
