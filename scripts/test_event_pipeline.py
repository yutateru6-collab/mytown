#!/usr/bin/env python3
"""Offline regression tests for the community-event collectors."""
from __future__ import annotations

from datetime import date, datetime, timezone, timedelta

from sync_events import (
    canonical_event_key,
    canonical_source_url,
    date_tokens,
    deduplicate,
    event_location,
    event_schedule,
    event_time,
    format_when,
    is_expired,
    last_sunday,
    merge_reviewed_fields,
    parse_aeon,
    parse_last_sunday_cleanup,
    parse_html,
    parse_schedule,
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


def schedule_regressions(aeon_source: dict, shakyo_source: dict, tourism_source: dict) -> None:
    # Reduced fixtures reproduce the verified official DOM: td/td date row,
    # unrelated latest-event dates, Reiwa date, and dated flyer attachment.
    shinako_url = "https://nogata.aeonmall.jp/event/855015b5-8959-4d2e-bd4b-4faff180ace2"
    shinako_index = f'<a href="{shinako_url}">【限定ドリンク】しなこ限定スリーブ♡マジカルブルベリミルク</a>'
    shinako_detail = """
      <p>2026/09/29 (火) 更新</p>
      <table><tr><td>日程</td><td>2026/10/05 (月) - 2026/11/01 (日)</td></tr></table>
      <p>販売期間：2026年10月5日(月) ～ 2026年11月1日(日)</p>
      <h3>最新のイベント</h3>
      <ul><li>2026/10/25 (日)</li><li>2026/10/14 (水)</li>
      <li>2026/10/09 (金) - 2026/10/19 (月)</li></ul>
    """
    drink = parse_aeon(aeon_source, shinako_index, lambda _url: shinako_detail, NOW)[0]
    assert (drink["startDate"], drink["endDate"]) == ("2026-10-05", "2026-11-01")
    assert drink["when"] == "10月5日～11月1日"
    assert "occurrences" not in drink

    iaeon_url = "https://nogata.aeonmall.jp/event/b6d19054-6756-414c-a42e-19b40c22e66f"
    iaeon_index = f'<a href="{iaeon_url}">iAEON 5th Anniversary開催中</a>'
    iaeon_detail = """
      <table><tr><td>日程</td><td>2026/09/01 (火) - 2026/11/30 (月)</td></tr></table>
      <p>実施期間：2026年9月1日(火)～11月30日(月) ※キャンペーンにより期間が異なります</p>
      <h3>最新のイベント</h3><ul><li>2026/10/25</li><li>2026/10/14</li>
      <li>2026/10/09 - 2026/10/19</li></ul>
    """
    anniversary = parse_aeon(aeon_source, iaeon_index, lambda _url: iaeon_detail, NOW)[0]
    assert (anniversary["startDate"], anniversary["endDate"]) == ("2026-09-01", "2026-11-30")
    assert anniversary["when"] == "9月1日～11月30日"
    assert "occurrences" not in anniversary

    halloween_url = "https://nogata.aeonmall.jp/event/e4bfb04e-d6a8-441e-825c-f3f45b758ed9"
    halloween_detail = '<table><tr><td>日程</td><td>2026/10/05(月) - 2026/11/01(日)</td></tr></table><p>10月5日～11月1日まで企画を開催</p><h3>子企画</h3><p>予告9月28日～10月4日 開催中10月5日～10月30日 当日10月31日～11月1日</p>'
    halloween = parse_aeon(aeon_source, f'<a href="{halloween_url}">イオンモールのハロウィン</a>', lambda _url: halloween_detail, NOW)[0]
    assert halloween["startDate"] == "2026-10-05"
    assert halloween["endDate"] == "2026-11-01"
    assert halloween["when"] == "10月5日～11月1日"
    assert "occurrences" not in halloween

    # An empty structured date field must not borrow dates from the article.
    empty_detail = '<table><tr><td>日程</td><td></td></tr></table><p>別の企画は2026/10/14</p>'
    assert parse_aeon(aeon_source, shinako_index, lambda _url: empty_detail, NOW) == []

    fukushi_url = "https://nogatashakyo.org/pages/25?detail=1&b_id=118&r_id=101#block118"
    fukushi_index = f'<a href="{fukushi_url}">10月25日(日)第48回のおがた福祉まつり開催のお知らせ</a>'
    fukushi_detail = """
      <article><h3>第48回のおがた福祉まつり</h3><div>2026-09-24</div>
      <div>直方市保健福祉センターゆずりあ・直方市古町商店街の2会場で</div>
      <div>「福祉まつり」を開催します。</div>
      <div>日時 ：令和８年10月2５日(日) 10時～15時</div>
      <div>駐車場 ：河川敷駐車場</div><div>お問合せ：直方市社会福祉協議会</div>
      <ul><li><a href="/flyer.pdf">チラシはこちらから(2026-06-03・3234KB)</a></li></ul></article>
    """
    festival = parse_shakyo(shakyo_source, fukushi_index, lambda _url: fukushi_detail, NOW)[0]
    assert (festival["startDate"], festival["endDate"]) == ("2026-10-25", "2026-10-25")
    assert festival["when"] == "10月25日 10時～15時"
    assert festival["location"] == ""  # No venue heading: do not infer from 会場で…
    assert "occurrences" not in festival

    long_copy = "<p>案内文" + "説明文。" * 180 + "</p>"
    late_metadata = parse_html(long_copy + '<p>日時：10月25日 10時～15時</p><p>添付資料 2026-06-03</p>').structured_text
    assert event_schedule(late_metadata, 2026).dates == (date(2026, 10, 25),)
    assert event_time(late_metadata) == "10時～15時"
    assert event_location("2会場で 「福祉まつり」を開催します。") == ""
    assert event_time("日時：10月25日 午前10時～午後3時") == "午前10時～午後3時"
    assert event_schedule("日時：10月25日 チラシはこちらから(2026-06-03・3234KB)", 2026).dates == (date(2026, 10, 25),)

    for value in ("2026/10/05", "2026-10-05", "2026.10.05"):
        assert date_tokens(value, 2025) == [date(2026, 10, 5)]
    assert date_tokens("令和８年10月2５日", 2025) == [date(2026, 10, 25)]
    assert date_tokens("2025/12/30～2026/1/2", 2025) == [date(2025, 12, 30), date(2026, 1, 2)]
    assert date_tokens("12/30～1/2", 2026) == [date(2026, 12, 30), date(2027, 1, 2)]
    assert date_tokens("10月5日 10時～15時", 2026) == [date(2026, 10, 5)]

    for value in ("10月5日～11月1日", "10/5(月) - 11/1(日)", "10月5日から9日", "10/5～9"):
        assert parse_schedule(value, 2026).continuous is True
    for value in ("10月5日・9日", "10/5、10/9", "10月5日 10月6日"):
        assert parse_schedule(value, 2026).continuous is False
    mixed = parse_schedule("10月5日～7日、10月9日", 2026)
    assert mixed.continuous is False
    assert mixed.dates == tuple(date(2026, 10, day) for day in (5, 6, 7, 9))
    assert format_when([date(2026, 10, 5), date(2026, 10, 6)]) == "10月5日・6日"

    for dates_text, expected in (("10月5日・9日", ["2026-10-05", "2026-10-09"]),
                                 ("10月5日 10月6日", ["2026-10-05", "2026-10-06"])):
        url = "https://nogata-kankoh.com/news/9999.html"
        index = f'<a href="{url}">体験講座</a>'
        detail = f'<dl><dt>実施日</dt><dd>{dates_text}</dd><dt>場所</dt><dd>体験会場</dd></dl>'
        event = parse_tourism(tourism_source, index, lambda _url: detail, NOW)[0]
        assert event["occurrences"] == expected
        assert "～" not in event["when"]


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

    schedule_regressions(aeon_source, shakyo_source, tourism_source)

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
    assert event_location("場所:2Fイオンホール 入場無料 日程:10月23日～26日 時間:11:00～18:30") == "2Fイオンホール"
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

    schedule_reviewed = {**reviewed, "when": reviewed["when"] + "（数量限定）", "scheduleReview": {"verifiedOn": "2026-09-03"}}
    same_schedule = merge_reviewed_fields(reparsed, schedule_reviewed)
    assert same_schedule["when"] == schedule_reviewed["when"]
    assert same_schedule["scheduleReview"] == schedule_reviewed["scheduleReview"]
    changed_schedule = merge_reviewed_fields({**reparsed, "endDate": "2026-09-06"}, schedule_reviewed)
    assert "scheduleReview" not in changed_schedule
    assert changed_schedule["when"] == reparsed["when"]

    timed_reviewed = {**schedule_reviewed, "when": "9月5日（土）10:00～15:00"}
    same_time = merge_reviewed_fields({**reparsed, "when": "9月5日 10時～15時"}, timed_reviewed)
    assert same_time["when"] == timed_reviewed["when"]
    new_time = merge_reviewed_fields({**reparsed, "when": "9月5日 11時～15時"}, timed_reviewed)
    assert new_time["when"] == "9月5日 11時～15時"
    assert "scheduleReview" not in new_time

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
