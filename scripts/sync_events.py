#!/usr/bin/env python3
"""Collect public event metadata from reviewed Nogata-area publishers.

The collector stores only the facts needed for discovery: title, date, time,
place, fee, organizer/publisher and the source URL. It does not copy article
body text or images. Social-media scraping is deliberately out of scope.
"""
from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import re
import unicodedata
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse


ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "data" / "event-sources.json"
EVENTS_PATH = ROOT / "data" / "community-events.json"
JST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "MYTOWN-Nogata/1.0 (+https://github.com/yutateru6-collab/mytown; event-metadata-sync)"
}

ALLOWED_PARSERS = {"shakyo", "tourism", "aeon", "last-sunday-cleanup"}
ALLOWED_SOURCE_TYPES = {"community", "tourism", "commercial", "cultural"}
NON_EVENT_PATTERN = re.compile(
    r"クーポン|値引|セール|FURNITURE\s*FAIR|LIMITED\s*STORE|POP\s*UP\s*STORE|"
    r"キャンペーン|販売$|お得デー|応募作品|受賞作品|イベントスペース|"
    r"超!?CO+L|ハック術|秋休み|SDGsアクション|眠活",
    re.IGNORECASE,
)
FAMILY_PATTERN = re.compile(r"親子|子ども|こども|幼児|小学生|家族|キッズ|キャラクター")
PARTICIPATION_PATTERN = re.compile(r"ボランティア|清掃|地域活動|球根植え|献血|意見募集")
LEARNING_PATTERN = re.compile(r"体験|学習|講座|教室|研修|展示|アート|ワークショップ|観察")
MUSIC_PATTERN = re.compile(r"音楽|ライブ|コンサート|演奏|Music", re.IGNORECASE)
SPORTS_PATTERN = re.compile(r"スポーツ|健康|運動|ピラティス|ヨガ|バレー")


class LinkCollector(HTMLParser):
    """Collect visible link text while also retaining page text."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self.parts: list[str] = []
        self._href: str | None = None
        self._link_parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"script", "style", "noscript"}:
            self._ignored_depth += 1
            return
        if self._ignored_depth or tag.lower() != "a":
            return
        self._href = dict(attrs).get("href")
        self._link_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript"} and self._ignored_depth:
            self._ignored_depth -= 1
            return
        if self._ignored_depth or tag.lower() != "a" or self._href is None:
            return
        self.links.append((self._href, clean_text(" ".join(self._link_parts))))
        self._href = None
        self._link_parts = []

    def handle_data(self, value: str) -> None:
        if self._ignored_depth:
            return
        value = clean_text(value)
        if not value:
            return
        self.parts.append(value)
        if self._href is not None:
            self._link_parts.append(value)

    @property
    def text(self) -> str:
        return clean_text(" ".join(self.parts))


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", unescape(str(value or "")))
    return re.sub(r"\s+", " ", value).strip()


def parse_html(html: str) -> LinkCollector:
    parser = LinkCollector()
    parser.feed(html)
    return parser


def fetch_text(url: str, timeout: int = 25) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        raw = response.read()
    try:
        return raw.decode(charset)
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")


def stable_id(source_id: str, url: str, start_date: str) -> str:
    digest = hashlib.sha1(f"{url}|{start_date}".encode("utf-8")).hexdigest()[:12]
    return f"community-{source_id}-{digest}"


def safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def explicit_year_hint(text: str, fallback: int) -> int:
    match = re.search(r"(20\d{2})[年/.-]\d{1,2}[月/.-]\d{1,2}", clean_text(text))
    return int(match.group(1)) if match else fallback


def date_tokens(text: str, year_hint: int) -> list[date]:
    """Return explicit dates in visual order, filling only omitted years."""
    text = clean_text(text)
    pattern = re.compile(
        r"(?P<iso_year>20\d{2})[/.\-](?P<iso_month>\d{1,2})[/.\-](?P<iso_day>\d{1,2})|"
        r"(?:(?P<jp_year>20\d{2})年)?(?P<jp_month>\d{1,2})月(?P<jp_day>\d{1,2})日"
    )
    found: list[date] = []
    current_year = year_hint
    previous_month: int | None = None
    for match in pattern.finditer(text):
        if match.group("iso_year"):
            year = int(match.group("iso_year"))
            month = int(match.group("iso_month"))
            day = int(match.group("iso_day"))
        else:
            explicit_year = match.group("jp_year")
            month = int(match.group("jp_month"))
            day = int(match.group("jp_day"))
            if explicit_year:
                current_year = int(explicit_year)
            elif previous_month is not None and previous_month >= 11 and month <= 2:
                current_year += 1
            year = current_year
        parsed = safe_date(year, month, day)
        if parsed and parsed not in found:
            found.append(parsed)
            previous_month = month

    # 「9月11日～12日」「9/11～12」のように、終了側の月が省かれた表記を補う。
    shorthand_patterns = (
        re.compile(
            r"(?:(?P<year>20\d{2})年)?(?P<month>\d{1,2})月(?P<start>\d{1,2})日"
            r"(?:\([^)]*\)|（[^）]*）)?\s*[~〜～\-]\s*(?P<end>\d{1,2})日"
        ),
        re.compile(
            r"(?:(?P<year>20\d{2})/)?(?P<month>\d{1,2})/(?P<start>\d{1,2})"
            r"(?:\([^)]*\)|（[^）]*）)?\s*[~〜～\-]\s*(?P<end>\d{1,2})(?!\d)"
        ),
    )
    for range_pattern in shorthand_patterns:
        for match in range_pattern.finditer(text):
            year = int(match.group("year") or year_hint)
            month = int(match.group("month"))
            for day in (int(match.group("start")), int(match.group("end"))):
                parsed = safe_date(year, month, day)
                if parsed and parsed not in found:
                    found.append(parsed)

    # 一覧見出しで使われる「9/5」も、時刻と混同しない範囲で拾う。
    for match in re.finditer(r"(?<!\d)(?P<month>\d{1,2})/(?P<day>\d{1,2})(?!\d)", text):
        parsed = safe_date(year_hint, int(match.group("month")), int(match.group("day")))
        if parsed and parsed not in found:
            found.append(parsed)
    return found


def labelled_segment(text: str, labels: Iterable[str], stop_labels: Iterable[str], limit: int = 520) -> str:
    normalized = clean_text(text)
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?:{label_pattern})\s*[|:：]?\s*", normalized)
    if not match:
        return ""
    tail = normalized[match.end() : match.end() + limit]
    stop_pattern = "|".join(re.escape(label) for label in stop_labels)
    stop = re.search(rf"\s(?:{stop_pattern})\s*[|:：]?\s*", tail)
    return clean_text(tail[: stop.start()] if stop else tail)


def event_dates(text: str, year_hint: int) -> list[date]:
    segment = labelled_segment(
        text,
        ("実施日", "開催日", "日程", "日時", "■日時"),
        ("実施時間", "時間", "場所", "会場", "主会場", "参加費", "定員", "申込", "お問い合わせ"),
    )
    return date_tokens(segment, year_hint) if segment else []


def event_time(text: str) -> str:
    segment = labelled_segment(
        text,
        ("実施時間", "時間", "日時", "■日時"),
        ("場所", "会場", "参加費", "定員", "申込", "お問い合わせ", "注意事項"),
        limit=220,
    )
    if not segment:
        return ""
    token = r"\d{1,2}(?::\d{2}|時\d{2}(?:分)?)"
    ranges = re.findall(rf"{token}\s*(?:[~〜～\-]|から)\s*{token}", segment)
    remainder = segment
    for value in ranges:
        remainder = remainder.replace(value, " ", 1)
    singles = re.findall(token, remainder)
    ranges = [re.sub(r"\s*(?:[~〜～\-]|から)\s*", "～", value) for value in ranges]
    unique = list(dict.fromkeys([*ranges, *singles]))
    return "／".join(unique[:4])


def event_location(text: str, default: str = "") -> str:
    segment = labelled_segment(
        text,
        ("主会場", "場所", "■場所", "会場"),
        ("参加費", "定員", "申込", "チケット", "お問い合わせ", "開催にあたって", "注意事項"),
        limit=180,
    )
    location = clean_text(segment).strip("|:： ")
    location = re.sub(r"^[>＞\s]*[・･]?時間\s*[:：]\s*", "", location)
    for marker in (" 【", " ■", " ※", " <", " お問い合わせ", " 開催にあたって", " 開催地域"):
        location = location.split(marker, 1)[0].strip()
    location = location.split("。", 1)[0].strip()
    location = re.split(r"\s+\d{1,2}(?::|時)\d{2}", location, maxsplit=1)[0].strip()
    venue = re.match(r"^(.{1,64}?(?:会場|館|センター|公園|広場|河川敷|ホール|体育館|キャンパス|駅))\b", location)
    if venue and re.search(r"です|ます|開催|体験|ぜひ|お知らせ", location[len(venue.group(1)) :]):
        location = venue.group(1).strip()
    if len(location) > 72:
        location = venue.group(1).strip() if venue else ""
    if default and location and default not in location:
        return f"{default} {location}"
    return location or default


def event_money(text: str) -> str:
    segment = labelled_segment(
        text,
        ("参加費", "チケット"),
        ("定員", "申込", "購入", "タイムテーブル", "お問い合わせ", "注意事項"),
        limit=120,
    )
    if not segment:
        return ""
    money = re.search(r"(?:前売[:：]?\s*)?[\d,]+円(?:\s*[／/]\s*当日[:：]?\s*[\d,]+円)?|無料", segment)
    return clean_text(money.group(0)) if money else ""


def event_tags(title: str, body: str = "") -> tuple[str, list[str]]:
    text = f"{title} {body}"
    tags: list[str] = []
    if FAMILY_PATTERN.search(text):
        tags.append("family")
    if PARTICIPATION_PATTERN.search(text):
        tags.append("participation")
    if re.search(r"ボランティア|清掃|球根植え", text):
        tags.append("volunteer")
    if LEARNING_PATTERN.search(text):
        tags.append("learn")
    if MUSIC_PATTERN.search(text):
        tags.append("music")
    if SPORTS_PATTERN.search(text):
        tags.append("sports")
    if re.search(r"無料", text):
        tags.append("free")

    if "participation" in tags:
        category = "地域参加"
    elif "family" in tags:
        category = "親子・子ども"
    elif "music" in tags:
        category = "音楽・文化"
    elif "sports" in tags:
        category = "スポーツ・健康"
    elif "learn" in tags:
        category = "体験・学び"
    else:
        category = "イベント"
    return category, list(dict.fromkeys(tags))


def format_when(dates: list[date], time_text: str = "") -> str:
    if not dates:
        return ""
    if len(dates) == 1:
        base = f"{dates[0].month}月{dates[0].day}日"
    elif len(dates) == 2 and dates[0] != dates[1]:
        if dates[1] - dates[0] == timedelta(days=1):
            base = f"{dates[0].month}月{dates[0].day}日～{dates[1].month}月{dates[1].day}日"
        elif dates[0].month == dates[1].month:
            base = f"{dates[0].month}月{dates[0].day}日・{dates[1].day}日"
        else:
            base = f"{dates[0].month}月{dates[0].day}日・{dates[1].month}月{dates[1].day}日"
    else:
        base = f"{dates[0].month}月{dates[0].day}日ほか全{len(dates)}日"
    return f"{base} {time_text}".strip()


def base_event(
    source: dict,
    *,
    url: str,
    title: str,
    dates: list[date],
    text: str,
    checked_at: str,
    default_location: str = "",
) -> dict:
    dates = sorted(set(dates))
    category, tags = event_tags(title)
    time_text = event_time(text)
    location = event_location(text, default_location)
    money = event_money(text)
    if money == "無料" and "free" not in tags:
        tags.append("free")
    start_date = min(dates).isoformat()
    end_date = max(dates).isoformat()
    event = {
        "id": stable_id(source["id"], url, start_date),
        "title": clean_text(title),
        "summary": f"{source['name']}が公開しているイベント情報です。",
        "startDate": start_date,
        "endDate": end_date,
        "when": format_when(dates, time_text),
        "location": location,
        "organizerName": "",
        "publisherName": source["name"],
        "sourceUrl": url,
        "sourceType": source["sourceType"],
        "sourceLabel": source["sourceLabel"],
        "verificationLevel": "publisher",
        "status": "scheduled",
        "statusLabel": "開催予定",
        "category": category,
        "tags": tags,
        "lastCheckedAt": checked_at,
    }
    if len(dates) > 2:
        event["occurrences"] = [value.isoformat() for value in dates]
    if money:
        event["money"] = money
    return event


def unique_links(document: LinkCollector, base_url: str, predicate: Callable[[str], bool]) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    seen: set[str] = set()
    for href, title in document.links:
        url = urljoin(base_url, href)
        if not title or url in seen or not predicate(url):
            continue
        seen.add(url)
        found.append((url, title))
    return found


def strip_listing_noise(title: str) -> str:
    title = re.sub(r"^(?:開催中|予告|NEW|オススメ)+", "", clean_text(title), flags=re.IGNORECASE)
    title = re.sub(r"20\d{2}/\d{1,2}/\d{1,2}.*$", "", title).strip()
    return title


def parse_aeon(source: dict, index_html: str, fetcher: Callable[[str], str], now: datetime) -> list[dict]:
    document = parse_html(index_html)
    links = unique_links(
        document,
        source["url"],
        lambda url: bool(re.search(r"nogata\.aeonmall\.jp/event/[0-9a-f-]{20,}$", urlparse(url).geturl())),
    )
    events: list[dict] = []
    for url, listing_title in links[:35]:
        if NON_EVENT_PATTERN.search(listing_title):
            continue
        try:
            detail = parse_html(fetcher(url)).text
        except Exception:
            detail = listing_title
        year_hint = explicit_year_hint(detail, now.year)
        dates = event_dates(detail, year_hint) or date_tokens(listing_title, year_hint)
        if not dates:
            continue
        title = strip_listing_noise(listing_title)
        if not title or NON_EVENT_PATTERN.search(title):
            continue
        events.append(
            base_event(
                source,
                url=url,
                title=title,
                dates=dates,
                text=detail,
                checked_at=now.isoformat(),
                default_location=source.get("defaultLocation", ""),
            )
        )
    return events


def parse_shakyo(source: dict, index_html: str, fetcher: Callable[[str], str], now: datetime) -> list[dict]:
    document = parse_html(index_html)
    links = unique_links(
        document,
        source["url"],
        lambda url: urlparse(url).netloc == "nogatashakyo.org" and "detail=1" in url and "r_id=" in url,
    )
    events: list[dict] = []
    for url, title in links[:25]:
        if title in {"もっと見る", "一覧へ戻る"} or NON_EVENT_PATTERN.search(title):
            continue
        try:
            detail = parse_html(fetcher(url)).text
        except Exception:
            continue
        year_hint = explicit_year_hint(detail, now.year)
        dates = event_dates(detail, year_hint)
        if not dates:
            continue
        events.append(
            base_event(
                source,
                url=url,
                title=strip_listing_noise(title),
                dates=dates,
                text=detail,
                checked_at=now.isoformat(),
            )
        )
    return events


def parse_tourism(source: dict, index_html: str, fetcher: Callable[[str], str], now: datetime) -> list[dict]:
    document = parse_html(index_html)
    links = unique_links(
        document,
        source["url"],
        lambda url: bool(re.search(r"nogata-kankoh\.com/news/\d+\.html$", urlparse(url).geturl())),
    )
    events: list[dict] = []
    for url, title in links[:20]:
        if NON_EVENT_PATTERN.search(title):
            continue
        try:
            detail = parse_html(fetcher(url)).text
        except Exception:
            continue
        year_hint = explicit_year_hint(detail, now.year)
        bracket = re.search(r"【([^】]+)】", title)
        title_dates = date_tokens(bracket.group(1), year_hint) if bracket else []
        dates = title_dates or event_dates(detail, year_hint) or date_tokens(title, year_hint)
        if not dates:
            continue
        event = base_event(
            source,
            url=url,
            title=strip_listing_noise(title),
            dates=dates,
            text=detail,
            checked_at=now.isoformat(),
            default_location="遠賀川河川敷" if "球根植え" in title and "遠賀川河川敷" in detail else "",
        )
        deadline_segment = labelled_segment(detail, ("申込締切",), ("実施日", "日時", "場所"), limit=80)
        deadlines = date_tokens(deadline_segment, year_hint)
        if deadlines:
            event["applicationDeadline"] = deadlines[0].isoformat()
            event["statusLabel"] = f"申込締切 {deadlines[0].month}月{deadlines[0].day}日"
        events.append(event)
    return events


def last_sunday(year: int, month: int) -> date:
    final_day = calendar.monthrange(year, month)[1]
    value = date(year, month, final_day)
    return value - timedelta(days=(value.weekday() - 6) % 7)


def parse_last_sunday_cleanup(source: dict, index_html: str, _fetcher: Callable[[str], str], now: datetime) -> list[dict]:
    text = parse_html(index_html).text
    required = ("春の小川まつり", "毎月最後の日曜日", "遠賀川水辺館")
    if not all(token in text for token in required):
        raise ValueError("reviewed recurring-cleanup wording was not found")
    occurrence = last_sunday(now.year, now.month)
    if occurrence < now.date():
        year = now.year + (1 if now.month == 12 else 0)
        month = 1 if now.month == 12 else now.month + 1
        occurrence = last_sunday(year, month)
    start_date = occurrence.isoformat()
    return [
        {
            "id": stable_id(source["id"], source["url"], start_date),
            "title": "春の小川まつり（遠賀川清掃活動）",
            "summary": "遠賀川河川敷をみんなで清掃する活動です。道具は用意され、1時間程度を予定しています。",
            "startDate": start_date,
            "endDate": start_date,
            "when": f"{occurrence.month}月{occurrence.day}日（日）10:00から（1時間程度）",
            "location": "遠賀川水辺館",
            "organizerName": "春の小川まつり",
            "publisherName": source["name"],
            "sourceUrl": source["url"],
            "sourceType": source["sourceType"],
            "sourceLabel": source["sourceLabel"],
            "verificationLevel": "public_directory",
            "status": "scheduled",
            "statusLabel": "開催前に確認",
            "category": "地域参加",
            "tags": ["participation", "volunteer", "outdoor"],
            "recurrence": "毎月最後の日曜日",
            "lastCheckedAt": now.isoformat(),
        }
    ]


PARSERS = {
    "aeon": parse_aeon,
    "shakyo": parse_shakyo,
    "tourism": parse_tourism,
    "last-sunday-cleanup": parse_last_sunday_cleanup,
}


def validate_source(source: dict) -> None:
    required = {"id", "name", "url", "parser", "sourceType", "sourceLabel", "enabled"}
    missing = sorted(required - source.keys())
    if missing:
        raise ValueError(f"{source.get('id', 'unknown')}: missing {', '.join(missing)}")
    if source["parser"] not in ALLOWED_PARSERS:
        raise ValueError(f"{source['id']}: unsupported parser {source['parser']}")
    if source["sourceType"] not in ALLOWED_SOURCE_TYPES:
        raise ValueError(f"{source['id']}: unsupported source type {source['sourceType']}")
    parsed = urlparse(source["url"])
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"{source['id']}: source URL must be https")


def is_expired(event: dict, today: date) -> bool:
    occurrences = event.get("occurrences") or []
    candidate = max(occurrences) if occurrences else event.get("endDate") or event.get("startDate")
    try:
        return bool(candidate and date.fromisoformat(candidate) < today)
    except (TypeError, ValueError):
        return True


def canonical_event_key(event: dict) -> str:
    title = clean_text(event.get("title", "")).lower()
    title = re.sub(r"[\W_]+", "", title)
    title = re.sub(r"20\d{2}|\d{1,2}月\d{1,2}日", "", title)
    occurrence = (event.get("occurrences") or [event.get("startDate", "")])[0]
    return f"{title}|{occurrence}"


def deduplicate(events: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for event in events:
        key = canonical_event_key(event)
        if key not in merged:
            merged[key] = event
            continue
        current = merged[key]
        urls = list(dict.fromkeys([*(current.get("sourceUrls") or [current.get("sourceUrl")]), event.get("sourceUrl")]))
        current["sourceUrls"] = [url for url in urls if url]
    return list(merged.values())


def load_existing() -> dict:
    if not EVENTS_PATH.exists():
        return {"schemaVersion": 1, "events": [], "sourceHealth": []}
    return json.loads(EVENTS_PATH.read_text(encoding="utf-8"))


def canonical_source_url(value: str) -> str:
    parsed = urlparse(value or "")
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", query, ""))


def merge_reviewed_fields(event: dict, prior: dict | None) -> dict:
    if not prior:
        return event
    merged = dict(event)
    for key in ("organizerName", "location", "money", "when"):
        if not event.get(key) and prior.get(key):
            merged[key] = prior[key]
    same_occurrence = event.get("startDate") == prior.get("startDate")
    if prior.get("editoriallyReviewed") and (same_occurrence or prior.get("recurrence")):
        reviewed_fields = (
            "title",
            "summary",
            "location",
            "organizerName",
            "publisherName",
            "money",
            "reservationRequired",
            "applicationDeadline",
            "sourceLabel",
            "category",
            "tags",
            "statusLabel",
        )
        for key in reviewed_fields:
            if key in prior:
                merged[key] = prior[key]
        merged["editoriallyReviewed"] = True
    return merged


def sync_events(fetcher: Callable[[str], str] = fetch_text, now: datetime | None = None) -> dict:
    now = now or datetime.now(JST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=JST)
    registry = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    existing = load_existing()
    existing_events = existing.get("events", [])
    prior_by_url = {canonical_source_url(item.get("sourceUrl")): item for item in existing_events if item.get("sourceUrl")}
    prior_by_source: dict[str, list[dict]] = {}
    for item in existing_events:
        source_id = next(
            (source["id"] for source in registry.get("sources", []) if item.get("sourceUrl", "").startswith(source["url"].rsplit("/", 1)[0])),
            "",
        )
        if source_id:
            prior_by_source.setdefault(source_id, []).append(item)

    events: list[dict] = []
    health: list[dict] = []
    for source in registry.get("sources", []):
        validate_source(source)
        if not source["enabled"]:
            continue
        try:
            index_html = fetcher(source["url"])
            parsed = PARSERS[source["parser"]](source, index_html, fetcher, now)
            parsed = [merge_reviewed_fields(item, prior_by_url.get(canonical_source_url(item.get("sourceUrl")))) for item in parsed]
            events.extend(parsed)
            health.append({"id": source["id"], "name": source["name"], "status": "ok", "checkedAt": now.isoformat()})
        except Exception as error:
            retained = [item for item in prior_by_source.get(source["id"], []) if not is_expired(item, now.date())]
            events.extend(retained)
            health.append(
                {
                    "id": source["id"],
                    "name": source["name"],
                    "status": "stale" if retained else "error",
                    "checkedAt": now.isoformat(),
                    "message": clean_text(str(error))[:180],
                }
            )

    events = [item for item in deduplicate(events) if not is_expired(item, now.date())]
    events.sort(key=lambda item: (item.get("startDate", "9999-12-31"), item.get("title", "")))
    return {
        "schemaVersion": 1,
        "generatedAt": now.isoformat(),
        "events": events,
        "sourceHealth": health,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate the source registry without using the network")
    args = parser.parse_args()
    registry = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    for source in registry.get("sources", []):
        validate_source(source)
    if args.check:
        print(f"Validated {len(registry.get('sources', []))} event sources")
        return
    payload = sync_events()
    EVENTS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['events'])} community events")


if __name__ == "__main__":
    main()
