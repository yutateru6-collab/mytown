#!/usr/bin/env python3
"""Detect and normalize the newest Nogata city bulletin issue.

The city publishes a monthly bulletin archive page and a detail page for each
issue.  This script reads only those first-party pages, records the newest
issue, and turns the official page labels into reviewable page candidates.
It intentionally does not invent summaries from a PDF or silently publish
machine-generated interpretations of high-risk civic information.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "bulletin.json"
JST = timezone(timedelta(hours=9))
TODAY = datetime.now(JST).date().isoformat()

ARCHIVE_URL = "https://www.city.nogata.fukuoka.jp/shisei/_1238/_2505/_16195.html"
HEADERS = {
    "User-Agent": "MYTOWN-Nogata/1.0 (+https://github.com/yutateru6-collab/mytown; public-data-sync)"
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def normalized(value: str) -> str:
    return clean(unicodedata.normalize("NFKC", value))


class BulletinParser(HTMLParser):
    """Collect headings, links, and the list text surrounding PDF links."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[dict[str, str]] = []
        self.headings: list[str] = []
        self.list_items: list[dict] = []
        self._blocks: list[dict] = []
        self._anchor: dict | None = None
        self._pending_link: dict | None = None
        self._heading: list[str] | None = None
        self._li: dict | None = None
        self._li_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag in {"li", "div", "p", "dd", "dt", "section", "article"}:
            self._blocks.append({"tag": tag, "parts": []})
        if tag == "li":
            if self._li_depth == 0:
                self._li = {"text": [], "links": []}
            self._li_depth += 1
        if tag == "a":
            self._pending_link = None
            self._anchor = {
                "href": attrs_map.get("href") or "",
                "text": [],
                "blockRefs": list(self._blocks),
            }
        if tag in {"h1", "h2", "h3", "h4"}:
            self._heading = []

    def handle_data(self, data: str) -> None:
        value = clean(data)
        if not value:
            return
        if self._anchor is not None:
            self._anchor["text"].append(value)
        if self._heading is not None:
            self._heading.append(value)
        if self._li is not None and self._li_depth:
            self._li["text"].append(value)
        for block in self._blocks:
            block["parts"].append(value)
        if self._anchor is None and self._pending_link is not None:
            self._pending_link.setdefault("afterText", []).append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._anchor is not None:
            link = {
                "href": self._anchor["href"],
                "text": clean(" ".join(self._anchor["text"])),
                "blockRefs": self._anchor["blockRefs"],
                "afterText": [],
            }
            self.links.append(link)
            if self._li is not None and self._li_depth:
                self._li["links"].append(link)
            self._pending_link = link
            self._anchor = None
        if tag in {"h1", "h2", "h3", "h4"} and self._heading is not None:
            heading = clean(" ".join(self._heading))
            if heading:
                self.headings.append(heading)
            self._heading = None
        if tag == "li" and self._li_depth:
            self._li_depth -= 1
            if self._li_depth == 0 and self._li is not None:
                self.list_items.append(
                    {
                        "text": clean(" ".join(self._li["text"])),
                        "links": list(self._li["links"]),
                    }
                )
                self._li = None
        if tag in {"li", "div", "p", "dd", "dt", "section", "article"} and self._blocks:
            self._blocks.pop()


def fetch_text(url: str, timeout: int = 25) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        raw = response.read()
    try:
        return raw.decode(charset)
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")


def parse_era_month(value: str, year_hint: int | None = None) -> tuple[int, int] | None:
    value = normalized(value)
    match = re.search(r"令和\s*(\d+)\s*年\s*(\d{1,2})\s*月\s*市報", value)
    if match:
        return int(match.group(1)), int(match.group(2))
    if year_hint is not None:
        match = re.search(r"(\d{1,2})\s*月\s*市報", value)
        if match:
            return year_hint, int(match.group(1))
    return None


def era_year_from_text(value: str) -> int | None:
    match = re.search(r"令和\s*(\d+)\s*年", normalized(value))
    return int(match.group(1)) if match else None


def archive_candidates(html: str) -> list[dict[str, str | int]]:
    parser = BulletinParser()
    parser.feed(html)
    year_hint = next((era_year_from_text(x) for x in parser.headings), None)
    if year_hint is None:
        year_hint = era_year_from_text(html)

    candidates: list[dict[str, str | int]] = []
    seen: set[str] = set()
    for link in parser.links:
        href = urljoin(ARCHIVE_URL, link["href"])
        label = normalized(link["text"])
        parsed = parse_era_month(label, year_hint)
        if parsed is None or not href or href in seen:
            continue
        seen.add(href)
        era_year, month = parsed
        candidates.append(
            {
                "issueKey": f"R{era_year}-{month:02d}",
                "label": label,
                "url": href,
                "eraYear": era_year,
                "month": month,
            }
        )
    return sorted(candidates, key=lambda x: (int(x["eraYear"]), int(x["month"])), reverse=True)


def updated_date(html: str) -> str | None:
    text = normalized(html)
    match = re.search(r"更新日\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日", text)
    if not match:
        return None
    return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


def page_description(parser: BulletinParser, href: str, base_url: str) -> str:
    for link in parser.links:
        if urljoin(base_url, link["href"]) != href:
            continue
        after = clean(" ".join(link.get("afterText", [])))
        after = re.split(r"同封配布物|このページの作成担当|ページの先頭|お役立ちコーナー", after)[0]
        after = re.sub(r"\(?\s*[\d,.]+\s*KB\s*;\s*PDFファイル\s*\)?", "", after, flags=re.I)
        if after:
            return clean(after.strip("・:："))
        for block in reversed(link.get("blockRefs", [])):
            value = clean(" ".join(block["parts"]))
            if value and value != clean(link["text"]):
                for candidate in (link["text"],):
                    value = value.replace(clean(candidate), "", 1)
                value = re.sub(r"\(?\s*[\d,.]+\s*KB\s*;\s*PDFファイル\s*\)?", "", value, flags=re.I)
                value = clean(value.strip("・:："))
                if value:
                    return value
    for item in parser.list_items:
        if not any(urljoin(base_url, x["href"]) == href for x in item["links"]):
            continue
        value = item["text"]
        for link in item["links"]:
            value = value.replace(clean(link["text"]), "", 1)
        value = re.sub(r"\(?\s*[\d,.]+\s*KB\s*;\s*PDFファイル\s*\)?", "", value, flags=re.I)
        return clean(value).strip("・:：")
    return ""


def category_for(value: str) -> str:
    if re.search(r"子育て|こども|保育|学校|教育", value):
        return "子育て・教育"
    if re.search(r"健康|医療|福祉|高齢|障がい", value):
        return "健康・福祉"
    if re.search(r"ごみ|環境|SDGs|エコ", value, re.I):
        return "環境"
    if re.search(r"バス|交通|道路|工事", value):
        return "交通・まち"
    if re.search(r"募集|講座|相談|申込|申請|お知らせ", value):
        return "暮らし"
    if re.search(r"議会|予算|市政|市長", value):
        return "市政"
    return "市報"


def make_pages(issue: dict[str, str | int], issue_html: str, issue_url: str) -> list[dict]:
    parser = BulletinParser()
    parser.feed(issue_html)
    pages: list[dict] = []
    seen: set[str] = set()
    for link in parser.links:
        href = urljoin(issue_url, link["href"])
        if ".pdf" not in urlparse(href).path.lower() or href in seen:
            continue
        seen.add(href)
        label = normalized(link["text"])
        if "一括" in label or "市報PDF" in label or re.search(r"_all(?:\.|$)", urlparse(href).path, re.I):
            continue
        description = page_description(parser, href, issue_url)
        combined = clean(f"{label} {description}")
        digest = hashlib.sha1(href.encode("utf-8"), usedforsecurity=False).hexdigest()[:12]
        pages.append(
            {
                "id": f"bulletin-page-{digest}",
                "issueKey": issue["issueKey"],
                "pageLabel": label or "市報PDF",
                "title": f"市報 {label or 'PDF'}",
                "category": category_for(combined),
                "summary": "市報の各ページです。詳しい内容はPDFで確認できます。",
                "sourceDescription": description,
                "status": "見出しのみ掲載",
                "reviewStatus": "needs_review",
                "visibility": "review_candidate",
                "sourceUrl": issue_url,
                "pdfUrl": href,
                "extractionMode": "official_issue_page_label",
            }
        )
    return pages


def read_old() -> dict:
    if not DATA_PATH.exists():
        return {}
    try:
        return json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def build_data(old: dict) -> dict:
    archive_html = fetch_text(ARCHIVE_URL)
    candidates = archive_candidates(archive_html)
    if not candidates:
        raise RuntimeError("no monthly bulletin link found on the official archive page")
    latest = candidates[0]
    issue_url = str(latest["url"])
    issue_html = fetch_text(issue_url)
    pages = make_pages(latest, issue_html, issue_url)
    issue_updated = updated_date(issue_html)
    old_issue = (old.get("currentIssue") or {}).get("issueKey")
    is_new = old_issue != latest["issueKey"]
    month = int(latest["month"])
    era_year = int(latest["eraYear"])
    western_year = 2018 + era_year
    issue_date = f"{western_year:04d}-{month:02d}-01"
    whole_pdf = next(
        (
            urljoin(issue_url, link["href"])
            for link in BulletinParserLinks(issue_html)
            if ("一括" in normalized(link["text"])
                or "市報PDF" in normalized(link["text"])
                or re.search(r"_all(?:\.|$)", urlparse(urljoin(issue_url, link["href"])).path, re.I))
            and ".pdf" in urlparse(urljoin(issue_url, link["href"])).path.lower()
        ),
        None,
    )
    issue = {
        "id": f"bulletin-{latest['issueKey']}",
        "issueKey": latest["issueKey"],
        "title": str(latest["label"]),
        "category": "市報",
        "summary": "直方市公式の最新の市報が公開されています。ページごとの見出しと公式PDFを確認できます。",
        "published": issue_date,
        "status": "新号を検知" if is_new else "最新号",
        "isNewIssue": is_new,
        "updated": issue_updated,
        "sourceUrl": issue_url,
        "wholePdfUrl": whole_pdf,
        "pageCount": len(pages),
        "bullets": [page["pageLabel"] for page in pages[:8]],
        "why": "市報は、直方市が市民向けに公開している公式の広報資料です。内容の要約や制度の判断は、原文を確認してから追加します。",
        "decision": "このデータは市報の公開状況とページ見出しを自動検知したものです。市政上の決定過程を示す資料ではありません。",
    }
    return {
        "schemaVersion": 1,
        "city": "直方市",
        "checkedOn": TODAY,
        "archiveUrl": ARCHIVE_URL,
        "currentIssue": issue,
        "pages": pages,
        "drafts": pages,
        "availableIssues": candidates[:12],
        "sync": {
            "status": "ok",
            "mode": "official_archive_and_issue_page",
            "message": "市報の新号と公式ページ上のPDF見出しを検知しました。記事内容は確認待ちです。",
        },
    }


class BulletinParserLinks:
    """Small iterable adapter to avoid exposing parser state to PDF lookup."""

    def __init__(self, html: str) -> None:
        parser = BulletinParser()
        parser.feed(html)
        self.links = parser.links

    def __iter__(self):
        return iter(self.links)


def main() -> int:
    old = read_old()
    try:
        result = build_data(old)
    except Exception as exc:
        if old:
            old["checkedOn"] = TODAY
            old["sync"] = {
                "status": "failed",
                "mode": "official_archive_and_issue_page",
                "message": "市報の確認に失敗しました。前回取得済みの情報を保持しています。",
                "error": str(exc),
            }
            DATA_PATH.write_text(json.dumps(old, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"WARN bulletin sync failed; kept previous data: {exc}", file=sys.stderr)
            return 0
        print(f"ERROR bulletin sync failed: {exc}", file=sys.stderr)
        return 1
    DATA_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Detected {result['currentIssue']['title']} with {result['currentIssue']['pageCount']} PDF page groups"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
