#!/usr/bin/env python3
"""Discover and normalize Nogata City Council meeting schedules.

The script reads only first-party Nogata City pages. It does not infer missing
meeting dates or times. If the official schedule cannot be parsed, it fails
instead of publishing guessed civic information.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import sync_nogata as legacy

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "meetings.json"
JST = timezone(timedelta(hours=9))
TODAY = datetime.now(JST).date()

INDEX_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1254/_2736.html"
FALLBACK_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1254/_2736/_17055.html"
FALLBACK_RANK = (2026, 9)
HEADERS = {
    "User-Agent": "MYTOWN-Nogata/1.0 (+https://github.com/yutateru6-collab/mytown; public-data-sync)"
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def session_rank(label: str) -> tuple[int, int] | None:
    match = re.search(r"令和\s*(\d+)\s*年\s*(\d{1,2})\s*月\s*(?:定例会|臨時会)日程", clean(label))
    if not match:
        return None
    western_year = 2018 + int(match.group(1))
    month = int(match.group(2))
    if not 1 <= month <= 12:
        return None
    return western_year, month


class CouncilParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self.rows: list[list[str]] = []
        self.headings: list[str] = []
        self.text_parts: list[str] = []
        self.main_heading: str | None = None
        self.after_main_heading_parts: list[str] = []
        self._capture_after_main_heading = False
        self._anchor_href: str | None = None
        self._anchor_parts: list[str] = []
        self._heading_parts: list[str] | None = None
        self._row: list[str] | None = None
        self._cell_parts: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "a":
            self._anchor_href = attrs_map.get("href") or ""
            self._anchor_parts = []
        elif tag == "h1":
            self._heading_parts = []
        elif tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell_parts = []

    def handle_data(self, data: str) -> None:
        value = clean(data)
        if not value:
            return
        self.text_parts.append(value)
        if self._capture_after_main_heading:
            self.after_main_heading_parts.append(value)
        if self._anchor_href is not None:
            self._anchor_parts.append(value)
        if self._heading_parts is not None:
            self._heading_parts.append(value)
        if self._cell_parts is not None:
            self._cell_parts.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._anchor_href is not None:
            self.links.append((self._anchor_href, clean(" ".join(self._anchor_parts))))
            self._anchor_href = None
            self._anchor_parts = []
        elif tag == "h1" and self._heading_parts is not None:
            heading = clean(" ".join(self._heading_parts))
            if heading:
                self.headings.append(heading)
                if self.main_heading is None and session_rank(heading) is not None:
                    self.main_heading = heading
                    self.after_main_heading_parts = []
                    self._capture_after_main_heading = True
            self._heading_parts = None
        elif tag in {"td", "th"} and self._row is not None and self._cell_parts is not None:
            self._row.append(clean(" ".join(self._cell_parts)))
            self._cell_parts = None
        elif tag == "tr" and self._row is not None:
            if any(self._row):
                self.rows.append(self._row)
            self._row = None
            self._cell_parts = None

    @property
    def text(self) -> str:
        return clean(" ".join(self.text_parts))

    @property
    def text_after_main_heading(self) -> str:
        return clean(" ".join(self.after_main_heading_parts))


def fetch_html(url: str, timeout: int = 25) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in {"city.nogata.fukuoka.jp", "www.city.nogata.fukuoka.jp"}:
        raise ValueError(f"refusing non-official URL: {url}")
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        raw = response.read()
    try:
        return raw.decode(charset)
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")


def discover_schedule_url(index_html: str) -> str:
    parser = CouncilParser()
    parser.feed(index_html)
    candidates: list[tuple[tuple[int, int], str]] = []
    for href, label in parser.links:
        rank = session_rank(label)
        if rank is None:
            continue
        full_url = urljoin(INDEX_URL, href)
        if urlparse(full_url).hostname not in {"city.nogata.fukuoka.jp", "www.city.nogata.fukuoka.jp"}:
            continue
        candidates.append((rank, full_url))
    candidates.append((FALLBACK_RANK, FALLBACK_URL))
    return max(candidates, key=lambda item: item[0])[1]


def opening_time(text: str) -> time | None:
    match = re.search(r"午前\s*(\d{1,2})時(?:\s*(\d{1,2})分)?", text)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    if not (1 <= hour <= 11 and 0 <= minute <= 59):
        return None
    return time(hour=hour, minute=minute)


def parse_schedule_html(html: str, source_url: str) -> dict:
    parser = CouncilParser()
    parser.feed(html)
    title = parser.main_heading or next((x for x in parser.headings if "会日程" in x), "")
    rank = session_rank(title)
    if not title or rank is None:
        raise RuntimeError("official council schedule title could not be identified")
    year, title_month = rank
    start_time = opening_time(parser.text_after_main_heading or parser.text)
    if start_time is None:
        raise RuntimeError("official opening time could not be identified")

    current_month: int | None = None
    all_dates: list[date] = []
    meetings: list[dict] = []
    occurrence_by_date: dict[str, int] = {}

    for row in parser.rows:
        if len(row) < 3:
            continue
        date_label = clean(row[0])
        weekday = clean(row[1])
        agenda = clean(" ".join(row[2:]))
        if date_label == "日付" or weekday == "曜日" or not agenda:
            continue

        month_match = re.search(r"(\d{1,2})\s*月", date_label)
        if month_match:
            current_month = int(month_match.group(1))
        elif current_month is None:
            current_month = title_month

        day_match = re.search(r"(\d{1,2})\s*日", date_label)
        if not day_match or current_month is None:
            continue
        day = int(day_match.group(1))
        try:
            meeting_date = date(year, current_month, day)
        except ValueError:
            continue
        all_dates.append(meeting_date)

        if agenda.startswith("休会"):
            continue
        if not ("本会議" in agenda or "委員会" in agenda):
            continue

        meeting_type = "本会議" if "本会議" in agenda else "委員会"
        start = datetime.combine(meeting_date, start_time, tzinfo=JST)
        date_key = meeting_date.isoformat()
        occurrence_by_date[date_key] = occurrence_by_date.get(date_key, 0) + 1
        suffix = occurrence_by_date[date_key]
        meetings.append(
            {
                "id": f"nogata-council-{date_key}-{suffix}",
                "body": "直方市議会",
                "title": agenda,
                "meetingType": meeting_type,
                "start": start.isoformat(),
                "status": "scheduled" if meeting_date >= TODAY else "past",
                "sourceUrl": source_url,
            }
        )

    if not all_dates or not meetings:
        raise RuntimeError("no council meeting rows could be parsed from the official schedule")

    first_date = min(all_dates)
    last_date = max(all_dates)
    # Reuse the same proven page-text/update-date parser as sync_nogata_v2.
    # This prevents the meeting file and the user-facing latest.json from
    # disagreeing about which "更新日" belongs to the current page.
    source_updated = legacy.official_update_date(legacy.html_text(html), title)
    series_title = re.sub(r"日程$", "", title)
    return {
        "schemaVersion": 1,
        "city": "直方市",
        "verifiedOn": TODAY.isoformat(),
        "seriesTitle": series_title,
        "sessionStart": first_date.isoformat(),
        "sessionEnd": last_date.isoformat(),
        "summary": f"{first_date.month}月{first_date.day}日から{last_date.month}月{last_date.day}日までの日程が公表されています。",
        "source": {
            "publisher": "直方市議会",
            "sourceUrl": source_url,
            "sourceUpdated": source_updated,
            "discoveryUrl": INDEX_URL,
            "extractionMode": "official_schedule_table"
        },
        "meetings": meetings,
    }


def read_old() -> dict:
    if not DATA_PATH.exists():
        return {}
    try:
        return json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    try:
        index_html = fetch_html(INDEX_URL)
        schedule_url = discover_schedule_url(index_html)
        schedule_html = fetch_html(schedule_url)
        payload = parse_schedule_html(schedule_html, schedule_url)
    except Exception as exc:
        print(f"ERROR council meetings sync: {exc}", file=sys.stderr)
        return 1

    old = read_old()
    if old == payload:
        print("No council meeting changes")
        return 0

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:12]
    print(f"Wrote {DATA_PATH.relative_to(ROOT)} ({len(payload['meetings'])} meetings, {digest})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
