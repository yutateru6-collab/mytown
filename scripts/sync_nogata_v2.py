#!/usr/bin/env python3
"""MYTOWN v2 sync orchestrator.

This keeps the proven page parsers from sync_nogata.py while moving RSS parsing
onto feedparser and council scheduling onto data/meetings.json. The old script
remains as a rollback/reference during the migration.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser
import sync_nogata as legacy

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "latest.json"
CHANGES_PATH = ROOT / "data" / "changes.json"
MEETINGS_PATH = ROOT / "data" / "meetings.json"
NOW = legacy.NOW
TODAY = legacy.TODAY


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_change_log() -> dict:
    if not CHANGES_PATH.exists():
        return {"schemaVersion": 1, "generatedAt": None, "changes": []}
    try:
        data = json.loads(CHANGES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"schemaVersion": 1, "generatedAt": None, "changes": []}
    return {
        "schemaVersion": 1,
        "generatedAt": data.get("generatedAt"),
        "changes": data.get("changes") if isinstance(data.get("changes"), list) else [],
    }


def user_visible_changes(old: dict, new: dict, detected_at: str) -> list[dict[str, str]]:
    """Return source-linked changes without inferring what an official update means."""
    if not old:
        return []

    changes: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    old_latest = {item.get("url"): item for item in old.get("latest", []) if item.get("url")}
    for item in new.get("latest", []):
        url = item.get("url")
        if not url:
            continue
        previous = old_latest.get(url)
        if previous is None:
            changes.append({
                "id": f"latest:{url}",
                "kind": "new",
                "title": str(item.get("title") or "直方市の新着情報"),
                "sourceUrl": str(url),
                "sourcePublished": str(item.get("date") or ""),
                "detectedAt": detected_at,
            })
            seen_urls.add(str(url))
        elif any(previous.get(key) != item.get(key) for key in ("title", "date")):
            changes.append({
                "id": f"latest-update:{url}",
                "kind": "updated",
                "title": str(item.get("title") or "直方市の情報が更新されました"),
                "sourceUrl": str(url),
                "sourcePublished": str(item.get("date") or ""),
                "detectedAt": detected_at,
            })
            seen_urls.add(str(url))

    old_featured = {item.get("id"): item for item in old.get("featured", []) if item.get("id")}
    fields = ("title", "summary", "status", "when", "location", "sourceUpdated", "applicationStarts", "applicationDeadline")
    for item in new.get("featured", []):
        item_id = item.get("id")
        url = str(item.get("sourceUrl") or "")
        if not item_id or not url or url in seen_urls:
            continue
        previous = old_featured.get(item_id)
        if previous is None:
            continue
        if any(previous.get(key) != item.get(key) for key in fields):
            changes.append({
                "id": f"featured-update:{item_id}:{detected_at}",
                "kind": "updated",
                "title": str(item.get("title") or "直方市の情報が更新されました"),
                "sourceUrl": url,
                "sourcePublished": str(item.get("sourceUpdated") or item.get("published") or ""),
                "detectedAt": detected_at,
            })
            seen_urls.add(url)

    for key, title in (("council", "市議会の日程が更新されました"), ("garbage", "ごみ収集の案内が更新されました")):
        current = new.get(key) or {}
        previous = old.get(key) or {}
        url = str(current.get("sourceUrl") or "")
        if not previous or not url or url in seen_urls:
            continue
        comparable_current = {name: value for name, value in current.items() if name != "summary"}
        comparable_previous = {name: value for name, value in previous.items() if name != "summary"}
        if comparable_current != comparable_previous:
            changes.append({
                "id": f"{key}-update:{detected_at}",
                "kind": "updated",
                "title": title,
                "sourceUrl": url,
                "sourcePublished": str(current.get("sourceUpdated") or ""),
                "detectedAt": detected_at,
            })

    return changes


def update_change_log(old: dict, new: dict, detected_at: str) -> None:
    log = read_change_log()
    additions = user_visible_changes(old, new, detected_at)
    if not additions:
        return

    cutoff = NOW.astimezone(timezone.utc) - timedelta(days=45)
    recent: list[dict[str, str]] = []
    for item in additions + log["changes"]:
        try:
            detected = datetime.fromisoformat(str(item.get("detectedAt") or "").replace("Z", "+00:00"))
        except ValueError:
            continue
        if detected.tzinfo is None:
            detected = detected.replace(tzinfo=timezone.utc)
        if detected < cutoff:
            continue
        recent.append(item)

    deduplicated: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for item in recent:
        item_id = str(item.get("id") or "")
        if not item_id or item_id in seen_ids:
            continue
        seen_ids.add(item_id)
        deduplicated.append(item)
        if len(deduplicated) >= 100:
            break

    payload = {"schemaVersion": 1, "generatedAt": detected_at, "changes": deduplicated}
    CHANGES_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_rss(xml_text: str) -> list[dict[str, str]]:
    parsed = feedparser.parse(xml_text)
    if getattr(parsed, "bozo", False) and not parsed.entries:
        raise ValueError(f"feedparser could not parse feed: {getattr(parsed, 'bozo_exception', 'unknown error')}")

    items: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for entry in parsed.entries:
        title = str(entry.get("title") or "").strip()
        link = str(entry.get("link") or "").strip()
        if not title or not link:
            continue
        host = urlparse(link).hostname or ""
        if host not in {"city.nogata.fukuoka.jp", "www.city.nogata.fukuoka.jp"}:
            continue
        raw_date = str(entry.get("published") or entry.get("updated") or entry.get("created") or "")
        item = {"date": legacy.normalize_date(raw_date), "title": title, "url": link}
        key = (title, link)
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


def read_meetings() -> dict:
    try:
        return json.loads(MEETINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"meeting data unavailable: {exc}") from exc


def council_data(meeting_data: dict) -> dict | None:
    meetings = meeting_data.get("meetings") or []
    future: list[tuple[datetime, dict]] = []
    for meeting in meetings:
        raw_start = meeting.get("start")
        if not raw_start:
            continue
        try:
            start = datetime.fromisoformat(str(raw_start))
        except ValueError:
            continue
        if start.date() >= TODAY:
            future.append((start, meeting))
    if not future:
        return None
    future.sort(key=lambda item: item[0])
    start, next_meeting = future[0]
    source = meeting_data.get("source") or {}
    return {
        "title": meeting_data.get("seriesTitle") or "市議会日程",
        "status": f"{start.month}/{start.day}予定",
        "nextDateLabel": f"{start.month}/{start.day} {start:%H:%M}",
        "nextSummary": f"{next_meeting.get('title', '会議')}が予定されています。日程・開会時間は変更されることがあります。",
        "summary": meeting_data.get("summary") or "公式の市議会日程を確認できます。",
        "sourceUpdated": source.get("sourceUpdated"),
        "sourceUrl": source.get("sourceUrl"),
    }


def main() -> int:
    old = {}
    if DATA_PATH.exists():
        old = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    try:
        meeting_data = read_meetings()
    except RuntimeError as exc:
        print(f"ERROR council meetings: {exc}", file=sys.stderr)
        return 1
    council = council_data(meeting_data)
    council_url = (meeting_data.get("source") or {}).get("sourceUrl")

    health: list[dict[str, str]] = []
    population = old.get("population", {})
    latest = old.get("latest", [])

    try:
        home_text = legacy.html_text(legacy.fetch_text(legacy.HOME_URL))
        population = legacy.parse_population(home_text, population)
        health.append({"name": "人口と世帯数", "mode": "auto", "status": "ok"})
    except Exception as exc:
        print(f"WARN population: {exc}", file=sys.stderr)
        health.append({"name": "人口と世帯数", "mode": "auto", "status": "failed"})

    rss_items: list[dict[str, str]] = []
    for name, url in (("直方市新着RSS", legacy.HOME_RSS), ("直方市注目RSS", legacy.TOPIC_RSS)):
        try:
            rss_items.extend(parse_rss(legacy.fetch_text(url)))
            health.append({"name": name, "mode": "feedparser", "status": "ok"})
        except Exception as exc:
            print(f"WARN {name}: {exc}", file=sys.stderr)
            health.append({"name": name, "mode": "feedparser", "status": "failed"})

    if rss_items:
        rss_items.sort(key=lambda item: item.get("date", ""), reverse=True)
        seen: set[tuple[str, str]] = set()
        latest = []
        for item in rss_items:
            key = (item["title"], item["url"])
            if key in seen:
                continue
            seen.add(key)
            latest.append(item)
            if len(latest) >= 12:
                break

    fixed_sources: list[tuple[str, str, str]] = [
        ("コミュニティバス変更", legacy.BUS_URL, "路線と時刻表を令和8年10月1日から変更します"),
        ("就学時健康診断", legacy.SCHOOL_URL, "小学校入学予定者の就学時健康診断を実施します"),
        ("ピラティス教室", legacy.PILATES_URL, "ピラティス教室参加者募集"),
        ("ごみ収集案内", legacy.GARBAGE_URL, "ごみ・資源リサイクルの収集日"),
        ("もやせるごみ区域", legacy.GARBAGE_BURNABLE_URL, "燃やせるごみ"),
        ("カン・ビン・もやせないごみ日程", legacy.GARBAGE_MONTHLY_URL, "燃やせないごみ、カン・ビン"),
        ("祝日のごみ収集", legacy.GARBAGE_HOLIDAY_URL, "祝日のごみ収集"),
    ]
    if council_url:
        fixed_sources.append(("市議会日程", council_url, f"{meeting_data.get('seriesTitle', '')}日程"))

    source_dates: dict[str, str] = {}
    for name, url, anchor in fixed_sources:
        try:
            text = legacy.html_text(legacy.fetch_text(url))
            updated = legacy.official_update_date(text, anchor)
            if updated:
                source_dates[url] = updated
            health.append({"name": name, "mode": "page-check", "status": "ok"})
        except Exception as exc:
            print(f"WARN {name}: {exc}", file=sys.stderr)
            health.append({"name": name, "mode": "page-check", "status": "failed"})

    featured = legacy.build_featured(latest)
    for item in featured:
        source_updated = source_dates.get(item["sourceUrl"])
        if not source_updated:
            continue
        item["sourceUpdated"] = source_updated
        published = item.get("published")
        if published and source_updated > published:
            item["needsReview"] = True
            item["status"] = "公式ページ更新あり"
            item["summary"] = "この公式ページは公開後に更新されています。同期システムが変更を検知したため、最新内容は公式ページで確認してください。"
            item["why"] = "更新後の内容を自動推測せず、公式ページの確認を優先しています。"
            item["money"] = None
            item.pop("moneyNote", None)
            item["bullets"] = []

    garbage = legacy.build_garbage_data(source_dates, old.get("garbage"))

    if council and council_url:
        page_updated = source_dates.get(council_url)
        parsed_updated = council.get("sourceUpdated")
        if page_updated and parsed_updated and page_updated != parsed_updated:
            council["status"] = "公式日程更新あり"
            council["nextDateLabel"] = ""
            council["nextSummary"] = "公式ページの更新日と会議データの確認日が一致しません。変更内容を推測せず、最新の日程は公式ページで確認してください。"

    core_payload = {
        "schemaVersion": 2,
        "city": "直方市",
        "verifiedOn": TODAY.isoformat(),
        "population": population,
        "featured": featured,
        "council": council,
        "garbage": garbage,
        "latest": latest,
        "sourceHealth": health,
        "pipeline": {
            "refreshHours": 6,
            "rssParser": "feedparser",
            "meetingSource": "data/meetings.json",
            "sourceRegistry": "data/sources.json"
        }
    }

    old_core = {key: value for key, value in old.items() if key != "generatedAt"}
    if old_core == core_payload:
        print("No semantic data changes")
        return 0

    detected_at = iso_utc(NOW)
    payload = {
        **core_payload,
        "generatedAt": detected_at,
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    update_change_log(old, payload, detected_at)
    print(f"Wrote {DATA_PATH.relative_to(ROOT)} with {len(latest)} latest items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
