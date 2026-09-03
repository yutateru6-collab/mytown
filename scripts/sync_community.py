#!/usr/bin/env python3
"""Build the Nogata community directory from reviewed public sources.

The generated file separates recurring activities and organizations from
one-off events. It stores short discovery metadata and links back to the
publisher; it does not copy page bodies or images.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "data" / "community-sources.json"
OUTPUT_PATH = ROOT / "data" / "community.json"
JST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "MYTOWN-Nogata/1.0 (+https://github.com/yutateru6-collab/mytown; community-directory-sync)"
}
ALLOWED_PARSERS = {
    "volunteer-directory",
    "reviewed-activities",
    "sdgs-partners",
    "shakyo-volunteer",
}
REQUIRED_SOURCE_IDS = {
    "nogata-volunteer-directory",
    "nogata-child-cafeterias",
    "nogata-sdgs-partners",
    "nogata-shakyo-volunteer-center",
}


def clean_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", unescape(str(value or "")))
    return re.sub(r"\s+", " ", text).strip()


class StructuredHTMLParser(HTMLParser):
    """Collect links and table rows without third-party HTML dependencies."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self.rows: list[list[dict]] = []
        self.parts: list[str] = []
        self._ignored_depth = 0
        self._href: str | None = None
        self._link_parts: list[str] = []
        self._row: list[dict] | None = None
        self._cell: dict | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript"}:
            self._ignored_depth += 1
            return
        if self._ignored_depth:
            return
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = {"parts": [], "links": []}
        elif tag == "a":
            self._href = dict(attrs).get("href")
            self._link_parts = []
        elif tag == "br":
            self.parts.append(" ")
            if self._cell is not None:
                self._cell["parts"].append(" ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript"} and self._ignored_depth:
            self._ignored_depth -= 1
            return
        if self._ignored_depth:
            return
        if tag == "a" and self._href is not None:
            label = clean_text(" ".join(self._link_parts))
            self.links.append((self._href, label))
            if self._cell is not None:
                self._cell["links"].append((self._href, label))
            self._href = None
            self._link_parts = []
        elif tag in {"td", "th"} and self._row is not None and self._cell is not None:
            self._row.append({
                "text": clean_text(" ".join(self._cell["parts"])),
                "links": list(self._cell["links"]),
            })
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, value: str) -> None:
        if self._ignored_depth:
            return
        value = clean_text(value)
        if not value:
            return
        self.parts.append(value)
        if self._href is not None:
            self._link_parts.append(value)
        if self._cell is not None:
            self._cell["parts"].append(value)


def parse_html(html: str) -> StructuredHTMLParser:
    parser = StructuredHTMLParser()
    parser.feed(html)
    return parser


def fetch_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        raw = response.read()
    try:
        return raw.decode(charset)
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")


def stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def source_hub(source: dict) -> dict:
    result = {
        "id": source["id"],
        "name": source["name"],
        "description": source["description"],
        "url": source["url"],
        "kind": source["kind"],
    }
    if source.get("detailUrl"):
        result["detailUrl"] = source["detailUrl"]
    if source.get("dataAsOf"):
        result["dataAsOf"] = source["dataAsOf"]
    return result


def organization(source: dict, name: str, category: str, source_url: str, **extra: str) -> dict:
    return {
        "id": stable_id("organization", source["id"], name, extra.get("registrationNumber", "")),
        "name": clean_text(name),
        "directoryType": source["kind"],
        "category": clean_text(category),
        "summary": extra.pop("summary", "公開されている団体情報です。"),
        "sourceId": source["id"],
        "sourceName": source["name"],
        "sourceUrl": source_url,
        "verificationLevel": "public-directory",
        **{key: value for key, value in extra.items() if value},
    }


def reviewed_activities(source: dict) -> list[dict]:
    activities = []
    for item in source.get("activities", []):
        is_support = item.get("activityType") == "child-support"
        activities.append({
            "id": stable_id("activity", source["id"], item["name"]),
            "title": item["name"],
            "activityType": item.get("activityType", "child-cafeteria"),
            "category": "こどもの居場所・支援" if is_support else "こども食堂",
            "summary": "こども食堂を支える活動です。" if is_support else "地域のこども食堂・居場所です。",
            "sourceId": source["id"],
            "sourceName": source["name"],
            "sourceUrl": source.get("documentUrl") or source.get("detailUrl") or source["url"],
            "sourceLandingUrl": source["url"],
            "verificationLevel": "reviewed-document",
            "dataAsOf": source.get("dataAsOf", ""),
            "currentnessNote": "開催日時や利用方法は変わることがあります。利用前に掲載元で確認してください。",
        })
    return activities


def fallback_organizations(source: dict) -> list[dict]:
    return [
        organization(
            source,
            item["name"],
            item["category"],
            source["url"],
            summary=f"直方市が「{item['category']}」の分野で紹介しているボランティア団体です。",
        )
        for item in source.get("fallbackOrganizations", [])
    ]


def parse_volunteer_directory(source: dict, fetcher=fetch_text) -> list[dict]:
    results: list[dict] = []
    seen_urls: set[str] = set()
    for category in source.get("categories", []):
        category_url = category["url"]
        prefix = category_url.rsplit(".html", 1)[0] + "/"
        page = parse_html(fetcher(category_url))
        for href, label in page.links:
            detail_url = urljoin(category_url, href)
            path = urlparse(detail_url).path
            if not label or detail_url in seen_urls:
                continue
            if not detail_url.startswith(prefix) or not path.endswith(".html"):
                continue
            seen_urls.add(detail_url)
            results.append(organization(
                source,
                label,
                category["name"],
                detail_url,
                summary=f"直方市が「{category['name']}」の分野で紹介しているボランティア団体です。",
            ))
    return results


def strip_external_note(value: str) -> str:
    return clean_text(re.sub(r"[（(]?外部リンク[）)]?", "", value)).strip(" |")


def parse_sdgs_partners(source: dict, html: str) -> list[dict]:
    results: list[dict] = []
    for row in parse_html(html).rows:
        if len(row) < 3:
            continue
        registration = clean_text(row[0]["text"])
        if not re.fullmatch(r"\d{3}", registration):
            continue
        name = strip_external_note(row[1]["text"])
        if not name:
            continue
        website = urljoin(source["url"], row[1]["links"][0][0]) if row[1]["links"] else ""
        profile_url = ""
        if len(row) >= 4 and row[3]["links"]:
            profile_url = urljoin(source["url"], row[3]["links"][0][0])
        results.append(organization(
            source,
            name,
            "SDGs推進パートナー",
            source["url"],
            summary="直方市が登録・公開している、のおがたSDGs推進パートナーです。",
            registrationNumber=registration,
            industry=row[2]["text"],
            websiteUrl=website,
            profileUrl=profile_url,
        ))
    return results


def parse_shakyo_volunteer(source: dict, html: str) -> list[dict]:
    results: list[dict] = []
    seen: set[str] = set()
    for href, label in parse_html(html).links:
        detail_url = urljoin(source["url"], href)
        parsed = urlparse(detail_url)
        if not label or detail_url in seen:
            continue
        if parsed.path.rstrip("/") != "/pages/65" or "detail=1" not in parsed.query:
            continue
        seen.add(detail_url)
        results.append({
            "id": stable_id("activity", source["id"], detail_url),
            "title": label,
            "activityType": "volunteer",
            "category": "ボランティア募集",
            "summary": "直方市社会福祉協議会が掲載しているボランティア募集です。",
            "sourceId": source["id"],
            "sourceName": source["name"],
            "sourceUrl": detail_url,
            "verificationLevel": "publisher",
            "currentnessNote": "募集状況や参加方法は掲載元で確認してください。",
        })
    return results


def validate_config(config: dict) -> None:
    if config.get("schemaVersion") != 1:
        raise ValueError("community-sources.json: schemaVersion must be 1")
    sources = config.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("community-sources.json: sources must be a non-empty list")
    ids = [source.get("id") for source in sources]
    if len(ids) != len(set(ids)):
        raise ValueError("community-sources.json: duplicate source id")
    missing = REQUIRED_SOURCE_IDS - set(ids)
    if missing:
        raise ValueError(f"community-sources.json: missing required sources: {sorted(missing)}")
    for source in sources:
        if source.get("parser") not in ALLOWED_PARSERS:
            raise ValueError(f"community-sources.json: unsupported parser for {source.get('id')}")
        if not str(source.get("url", "")).startswith("https://"):
            raise ValueError(f"community-sources.json: HTTPS URL required for {source.get('id')}")
        if source.get("parser") == "volunteer-directory" and not source.get("categories"):
            raise ValueError("community-sources.json: volunteer categories are required")


def load_existing() -> dict:
    if not OUTPUT_PATH.exists():
        return {}
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def retained_items(existing: dict, key: str, source_id: str) -> list[dict]:
    return [item for item in existing.get(key, []) if item.get("sourceId") == source_id]


def build(config: dict, fetcher=fetch_text, now: datetime | None = None) -> dict:
    now = now or datetime.now(JST)
    checked_at = now.isoformat()
    existing = load_existing()
    organizations: list[dict] = []
    activities: list[dict] = []
    source_health: list[dict] = []

    for source in config["sources"]:
        if not source.get("enabled", True):
            continue
        parser_name = source["parser"]
        try:
            if parser_name == "volunteer-directory":
                collected = parse_volunteer_directory(source, fetcher)
                if not collected:
                    raise ValueError("no volunteer organizations found")
                organizations.extend(collected)
            elif parser_name == "sdgs-partners":
                collected = parse_sdgs_partners(source, fetcher(source["url"]))
                if not collected:
                    raise ValueError("no SDGs partners found")
                organizations.extend(collected)
            elif parser_name == "shakyo-volunteer":
                activities.extend(parse_shakyo_volunteer(source, fetcher(source["url"])))
            elif parser_name == "reviewed-activities":
                fetcher(source["url"])
                activities.extend(reviewed_activities(source))
            source_health.append({
                "sourceId": source["id"],
                "name": source["name"],
                "status": "ok",
                "checkedAt": checked_at,
            })
        except Exception as error:  # network and publisher markup failures must not erase the last good data
            retained_organizations = retained_items(existing, "organizations", source["id"])
            organizations.extend(retained_organizations or fallback_organizations(source))
            if parser_name == "reviewed-activities":
                activities.extend(reviewed_activities(source))
            else:
                activities.extend(retained_items(existing, "activities", source["id"]))
            source_health.append({
                "sourceId": source["id"],
                "name": source["name"],
                "status": "error",
                "checkedAt": checked_at,
                "message": clean_text(error)[:180],
            })

    for item in organizations:
        item["lastCheckedAt"] = checked_at
    for item in activities:
        item["lastCheckedAt"] = checked_at

    organizations = list({item["id"]: item for item in organizations}.values())
    activities = list({item["id"]: item for item in activities}.values())
    organizations.sort(key=lambda item: (
        item.get("directoryType") == "sdgs",
        int(item.get("registrationNumber", "9999")),
        item["name"],
    ))
    activities.sort(key=lambda item: (item.get("activityType") != "volunteer", item["title"]))
    return {
        "schemaVersion": 1,
        "generatedAt": checked_at,
        "organizations": organizations,
        "activities": activities,
        "sourceHubs": [source_hub(source) for source in config["sources"] if source.get("enabled", True)],
        "sourceHealth": source_health,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate configuration without using the network")
    parser.add_argument("--seed", action="store_true", help="write reviewed fallback data without using the network")
    args = parser.parse_args()
    config = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    validate_config(config)
    if args.check:
        print("Community source registry checks passed")
        return
    if args.seed:
        def offline_fetcher(_url: str) -> str:
            raise OSError("network check pending")

        output = build(config, fetcher=offline_fetcher)
        for item in output["sourceHealth"]:
            item["status"] = "pending"
            item["message"] = "自動更新の初回実行を待っています。"
    else:
        output = build(config)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ok_count = sum(item["status"] == "ok" for item in output["sourceHealth"])
    print(f"Wrote {len(output['organizations'])} organizations and {len(output['activities'])} activities ({ok_count}/4 sources healthy)")


if __name__ == "__main__":
    main()
