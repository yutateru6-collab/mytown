#!/usr/bin/env python3
"""Sync public information from Nogata City's official website.

Only public first-party sources are fetched. The script deliberately avoids
inferring facts that are not explicitly present in those sources.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta, date
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "latest.json"
JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.date()

HOME_URL = "https://www.city.nogata.fukuoka.jp/home.html"
HOME_RSS = "https://city.nogata.fukuoka.jp/rss/home.xml"
TOPIC_RSS = "https://city.nogata.fukuoka.jp/rss/topic.xml"
BUS_URL = "https://www.city.nogata.fukuoka.jp/sangyo/_1230/_13903/_17125.html"
SCHOOL_URL = "https://city.nogata.fukuoka.jp/kyoikubunka/_1214/_1974/_10365.html"
PILATES_URL = "https://www.city.nogata.fukuoka.jp/kurashi/_3987/_3982/_8968.html"
COUNCIL_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1254/_2736/_17055.html"
GARBAGE_URL = "https://www.city.nogata.fukuoka.jp/kurashi/_1200/_16566/_1310.html"
GARBAGE_BURNABLE_URL = "https://www.city.nogata.fukuoka.jp/kurashi/_1200/_16566/_1310/_1313.html"
GARBAGE_MONTHLY_URL = "https://www.city.nogata.fukuoka.jp/kurashi/_1200/_16566/_1310/_3712.html"
GARBAGE_HOLIDAY_URL = "https://www.city.nogata.fukuoka.jp/kurashi/_1200/_16566/_7328.html"
GARBAGE_MONTHLY_PDF_URL = "https://www.city.nogata.fukuoka.jp/library/R7.11.20.2.pdf"

# Normalized from Nogata City's 2026 collection calendar. The source pages are
# checked on every sync; the app stops calculating dates if their update dates
# no longer match this reviewed snapshot.
GARBAGE_SOURCE_VERSIONS = {
    "overview": "2026-03-04",
    "burnable": "2025-04-24",
    "monthly": "2025-12-01",
    "holiday": "2026-03-04",
}
GARBAGE_SOURCE_URLS = {
    "overview": GARBAGE_URL,
    "burnable": GARBAGE_BURNABLE_URL,
    "monthly": GARBAGE_MONTHLY_URL,
    "holiday": GARBAGE_HOLIDAY_URL,
}
GARBAGE_COLLECTION_AREAS = {
    "east": {
        "label": "市東部",
        "description": "遠賀川と彦山川の東側",
        "burnableWeekdays": [1, 4],
        "cansAndBottles": [
            "2026-01-07", "2026-02-04", "2026-03-04", "2026-04-01",
            "2026-05-06", "2026-06-03", "2026-07-01", "2026-08-05",
            "2026-09-02", "2026-10-07", "2026-11-04", "2026-12-02",
        ],
        "nonBurnable": [
            "2026-01-14", "2026-02-11", "2026-03-11", "2026-04-08",
            "2026-05-13", "2026-06-10", "2026-07-08", "2026-08-12",
            "2026-09-09", "2026-10-14", "2026-11-11", "2026-12-09",
        ],
    },
    "west": {
        "label": "市西部",
        "description": "遠賀川と彦山川の西側",
        "burnableWeekdays": [2, 5],
        "cansAndBottles": [
            "2026-01-21", "2026-02-18", "2026-03-18", "2026-04-15",
            "2026-05-20", "2026-06-17", "2026-07-15", "2026-08-19",
            "2026-09-16", "2026-10-21", "2026-11-18", "2026-12-16",
        ],
        "nonBurnable": [
            "2026-01-28", "2026-02-25", "2026-03-25", "2026-04-22",
            "2026-05-27", "2026-06-24", "2026-07-22", "2026-08-26",
            "2026-09-30", "2026-10-28", "2026-11-25", "2026-12-23",
        ],
    },
}

HEADERS = {
    "User-Agent": "MYTOWN-Nogata/1.0 (+https://github.com/yutateru6-collab/mytown; public-data-sync)"
}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())

    def text(self) -> str:
        return " ".join(self.parts)


def fetch_text(url: str, timeout: int = 25) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        raw = response.read()
    try:
        return raw.decode(charset)
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace")


def html_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return re.sub(r"\s+", " ", unescape(parser.text())).strip()


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_rss(xml_text: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    items: list[dict[str, str]] = []
    for node in root.iter():
        if local_name(node.tag) not in {"item", "entry"}:
            continue
        values: dict[str, str] = {}
        for child in list(node):
            key = local_name(child.tag)
            if key == "link" and child.attrib.get("href"):
                values["link"] = child.attrib["href"].strip()
            elif child.text and child.text.strip():
                values[key] = child.text.strip()
        title = values.get("title", "").strip()
        link = values.get("link", "").strip()
        raw_date = values.get("pubdate") or values.get("date") or values.get("updated") or ""
        if not title or not link:
            continue
        host = urlparse(link).hostname or ""
        if "nogata.fukuoka.jp" not in host:
            continue
        date_iso = normalize_date(raw_date)
        items.append({"date": date_iso, "title": title, "url": link})
    seen: set[tuple[str, str]] = set()
    unique: list[dict[str, str]] = []
    for item in items:
        key = (item["title"], item["url"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def normalize_date(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    try:
        dt = parsedate_to_datetime(value)
        return dt.astimezone(JST).date().isoformat()
    except (TypeError, ValueError, OverflowError):
        pass
    m = re.search(r"(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})", value)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(JST).date().isoformat()
    except ValueError:
        return value[:10]


def official_update_date(text: str, anchor: str = "") -> str | None:
    # Navigation/sidebar entries can contain other dates. Scope the search to
    # the last occurrence of the page's own title so we read the main content.
    if anchor and anchor in text:
        text = text.rsplit(anchor, 1)[-1]
    m = re.search(r"更新日\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日", text)
    if not m:
        return None
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def build_garbage_data(source_dates: dict[str, str], old_garbage: dict | None = None) -> dict:
    """Build only the dates reviewed against the city's published calendar."""
    old_garbage = old_garbage or {}
    old_versions = (old_garbage.get("schedule") or {}).get("sourceVersions") or {}
    source_versions = {
        key: source_dates.get(url) or old_versions.get(key) or GARBAGE_SOURCE_VERSIONS[key]
        for key, url in GARBAGE_SOURCE_URLS.items()
    }
    needs_review = any(
        source_versions.get(key) != expected
        for key, expected in GARBAGE_SOURCE_VERSIONS.items()
    )
    schedule = {
        "status": "needs_review" if needs_review else "verified",
        "validFrom": "2026-01-01",
        "validThrough": "2026-12-31",
        "putOutBy": "08:30",
        "burnableRunsOnHolidays": True,
        "yearEndNeedsSeparateNotice": True,
        "sourceVersions": source_versions,
        "monthlyPdfUrl": GARBAGE_MONTHLY_PDF_URL,
        "areas": GARBAGE_COLLECTION_AREAS,
    }
    summary = "市東部・市西部の収集日程を、アプリ内で確認できます。"
    if needs_review:
        summary = "公式ページの更新を検知しました。収集日程を確認し直しています。"
    return {
        "title": "ごみ・資源リサイクルの収集日",
        "summary": summary,
        "sourceUpdated": source_versions["overview"],
        "sourceUrl": GARBAGE_URL,
        "schedule": schedule,
    }


def parse_population(text: str, old: dict) -> dict:
    result = dict(old or {})
    patterns = {
        "total": r"総人口[：:]\s*([\d,]+)人",
        "male": r"男性[：:]\s*([\d,]+)人",
        "female": r"女性[：:]\s*([\d,]+)人",
        "households": r"世帯数[：:]\s*([\d,]+)世帯",
    }
    for key, pattern in patterns.items():
        m = re.search(pattern, text)
        if m:
            result[key] = int(m.group(1).replace(",", ""))
    m = re.search(r"[（(]令和(\d+)年(\d+)月末現在[）)]", text)
    if m:
        western_year = 2018 + int(m.group(1))
        result["asOf"] = f"{western_year}年（令和{m.group(1)}年）{int(m.group(2))}月末"
    result["sourceUrl"] = HOME_URL
    return result


def pilates_status() -> str:
    start = date(2026, 9, 22)
    end = date(2026, 10, 5)
    if TODAY < start:
        return "9/22受付開始"
    if TODAY <= end:
        return "受付中（10/5まで）"
    return "受付終了"


def school_status() -> str:
    start = date(2026, 10, 20)
    end = date(2026, 10, 23)
    if TODAY < start:
        return "10/20〜23実施"
    if TODAY <= end:
        return "実施期間中"
    return "実施終了"


def bus_status() -> str:
    effective = date(2026, 10, 1)
    return "10/1から変更" if TODAY < effective else "10/1から新路線"


def council_data() -> dict | None:
    sessions = [
        (date(2026, 9, 3), "本会議（議案の提案説明）"),
        (date(2026, 9, 4), "本会議（一般質問）"),
        (date(2026, 9, 7), "本会議（一般質問）"),
        (date(2026, 9, 8), "本会議（一般質問）"),
        (date(2026, 9, 9), "本会議（一般質問）"),
        (date(2026, 9, 11), "本会議（決算質疑）"),
        (date(2026, 9, 15), "本会議（予算等質疑）"),
        (date(2026, 9, 16), "委員会（付託議案審査）"),
        (date(2026, 9, 17), "委員会（付託議案審査）"),
        (date(2026, 9, 18), "委員会（付託議案審査）"),
        (date(2026, 9, 24), "委員会（付託議案審査）"),
        (date(2026, 9, 25), "本会議（採決）"),
    ]
    if TODAY > sessions[-1][0]:
        return None
    next_session = next((x for x in sessions if x[0] >= TODAY), sessions[-1])
    return {
        "title": "令和8年9月定例会",
        "status": f"{next_session[0].month}/{next_session[0].day}予定",
        "nextDateLabel": f"{next_session[0].month}/{next_session[0].day} 10:00",
        "nextSummary": next_session[1] + "が予定されています。日程・開会時間は変更されることがあります。",
        "summary": "9月3日から25日までの日程が公表されています。",
        "sourceUpdated": "2026-07-02",
        "sourceUrl": COUNCIL_URL,
    }


def classify_title(title: str) -> str:
    if re.search(r"バス|交通|路線|時刻", title):
        return "交通"
    if re.search(r"学校|小学校|中学校|教育|就学|給食", title):
        return "学校・教育"
    if re.search(r"健康|スポーツ|体育|ピラティス|講習", title):
        return "健康・スポーツ"
    if re.search(r"議会|定例会|会議録|議案", title):
        return "議会"
    if re.search(r"ごみ|廃棄|リサイクル", title):
        return "ごみ"
    if re.search(r"消防|災害|防災|火災|避難", title):
        return "防災"
    if re.search(r"観光|キャンプ|イベント|まつり|シンポジウム|マンホール|フェスタ", title):
        return "観光・イベント"
    return "その他"


def rss_feature(item: dict[str, str]) -> dict:
    digest = hashlib.sha1(item["url"].encode("utf-8"), usedforsecurity=False).hexdigest()[:12]
    return {
        "id": f"rss-{digest}",
        "category": classify_title(item["title"]),
        "title": item["title"],
        "summary": "直方市公式サイトの新着情報です。内容は公式ページで確認できます。",
        "published": item.get("date", ""),
        "status": "新着",
        "sourceUrl": item["url"],
    }


def build_featured(latest: list[dict[str, str]]) -> list[dict]:
    fixed: list[dict] = []

    if TODAY <= date(2026, 10, 31):
        fixed.append({
            "id": "community-bus-20261001",
            "category": "交通",
            "title": "コミュニティバスの路線と時刻表が10月1日から変わります",
            "summary": "直方市コミュニティバスは2026年10月1日から路線・時刻表を変更します。新しいバス停の設置、路線名の変更、路線の統合・廃止などがあります。",
            "published": "2026-09-01",
            "status": bus_status(),
            "when": "2026年10月1日から",
            "why": "直方市公式ページでは、利用面の改善、交通空白への対応、他路線の廃止・統合への対応などが路線ごとに説明されています。",
            "money": None,
            "decision": "関連する直方市地域公共交通協議会の資料と、2026年10月1日の変更案内を時系列で表示しています。変更項目すべての最終決定・承認に当たる会議資料と日付は、現在確認した公開資料だけでは特定できません。",
            "decisionTimeline": [
                {
                    "date": "2026年1月19日",
                    "title": "関連路線の変更案を協議資料として掲載",
                    "detail": "2026年1月19日の協議会資料には、感田線・上頓野線の路線変更案などが掲載されています。この資料だけでは、今回の変更全体が最終決定されたとは判断できません。",
                    "status": "協議資料",
                    "url": "https://www.city.nogata.fukuoka.jp/sangyo/_1230/_14310.html",
                },
                {
                    "date": "2026年6月2日",
                    "title": "運行後の課題と今後の対応案を共有",
                    "detail": "令和8年度第1回協議会の資料で、感田線の経路・バス停・ダイヤを見直し、次回協議会で協議する方針が示されています。",
                    "status": "検討継続",
                    "url": "https://www.city.nogata.fukuoka.jp/library/koutsu/14310/R08/01/shiryou08.pdf",
                },
                {
                    "date": "2026年9月1日",
                    "title": "直方市が10月1日からの変更内容を公表",
                    "detail": "新設バス停、路線名変更、統合・廃止などの実施内容が公式ページで案内されました。",
                    "status": "実施案内",
                    "url": BUS_URL,
                },
                {
                    "date": "2026年10月1日",
                    "title": "変更後の路線・時刻表で運行開始予定",
                    "detail": "公式案内に記載された実施予定日です。",
                    "status": "予定",
                    "url": BUS_URL,
                },
            ],
            "decisionUnknowns": [
                "10月1日の変更項目すべてを最終決定・承認した会議資料と日付",
                "今回の変更に市議会の議決が必要だったか、実際に議決が行われたか",
                "路線変更にひも付く予算・契約の一次資料",
            ],
            "decisionSources": [
                {
                    "label": "直方市地域公共交通協議会の開催結果・資料",
                    "url": "https://www.city.nogata.fukuoka.jp/sangyo/_1230/_14310.html",
                },
                {
                    "label": "令和8年度第1回協議会資料：今後の取り組み",
                    "url": "https://www.city.nogata.fukuoka.jp/library/koutsu/14310/R08/01/shiryou08.pdf",
                },
                {
                    "label": "10月1日からの路線・時刻表変更案内",
                    "url": BUS_URL,
                },
            ],
            "bullets": [
                "上頓野線に『もち吉工場直売所』『アグリー福智の郷』バス停を新設",
                "鴨生田団地線は『新入線』へ名称変更",
                "武谷線は『中泉線』へ名称変更",
                "赤地新入線は新入線と中泉線へ統合して廃止",
            ],
            "sourceUrl": BUS_URL,
        })

    if TODAY <= date(2026, 10, 23):
        fixed.append({
            "id": "school-health-check-2026",
            "category": "学校・教育",
            "title": "小学校入学予定者の就学時健康診断を実施します",
            "summary": "2027年4月に直方市内の小学校へ入学予定の子どもを対象に、10月20日から23日まで就学時健康診断を実施します。会場は直方市中央公民館です。",
            "published": "2026-09-01",
            "status": school_status(),
            "when": "10月20日〜23日、各日13:30〜15:00予定",
            "location": "直方市中央公民館（直方市津田町7番20号）",
            "why": "現在の健康状態を把握し、疾病の早期発見や必要な助言を行い、健やかな学校生活へ向けた準備をするためと直方市が説明しています。",
            "money": None,
            "bullets": [
                "10月20日：直方南小・直方北小・直方東小",
                "10月21日：新入小・感田小",
                "10月22日：直方西小・上頓野小・福地小",
                "10月23日：下境小・中泉小・植木小",
            ],
            "sourceUrl": SCHOOL_URL,
        })

    if TODAY <= date(2026, 10, 5):
        fixed.append({
            "id": "pilates-2026-autumn",
            "category": "健康・スポーツ",
            "title": "ピラティス教室の参加者募集",
            "summary": "直方市体育館で全10回のピラティス教室を開催。市内在住・在勤の18歳以上が対象で、申込期間は9月22日から10月5日です。",
            "published": "2026-09-01",
            "status": pilates_status(),
            "applicationStarts": "2026-09-22",
            "applicationDeadline": "2026-10-05",
            "when": "10月9日〜12月18日の指定金曜日・全10回",
            "location": "直方市体育館（直方市大字直方674-25）",
            "why": "直方市公式ページでは、インナーマッスルや体幹を鍛え、筋力不足や姿勢の改善にもつながる教室として案内されています。",
            "money": "参加料 4,000円",
            "moneyNote": "保険料込み。市の事業費や予算額ではなく、参加者が支払う参加料です。",
            "bullets": [
                "Aコース 9:30〜10:30、Bコース 10:45〜11:45",
                "各コース定員20名",
                "申込期間：9月22日〜10月5日（定員になり次第締切）",
            ],
            "sourceUrl": PILATES_URL,
        })

    used_urls = {item["sourceUrl"] for item in fixed}
    for item in latest:
        if len(fixed) >= 4:
            break
        if item["url"] in used_urls:
            continue
        fixed.append(rss_feature(item))
        used_urls.add(item["url"])
    return fixed


def main() -> int:
    old = {}
    if DATA_PATH.exists():
        old = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    health: list[dict[str, str]] = []
    population = old.get("population", {})
    latest = old.get("latest", [])

    try:
        home_text = html_text(fetch_text(HOME_URL))
        population = parse_population(home_text, population)
        health.append({"name": "人口と世帯数", "mode": "auto", "status": "ok"})
    except Exception as exc:
        print(f"WARN population: {exc}", file=sys.stderr)
        health.append({"name": "人口と世帯数", "mode": "auto", "status": "failed"})

    rss_items: list[dict[str, str]] = []
    for name, url in (("直方市新着RSS", HOME_RSS), ("直方市注目RSS", TOPIC_RSS)):
        try:
            rss_items.extend(parse_rss(fetch_text(url)))
            health.append({"name": name, "mode": "auto", "status": "ok"})
        except Exception as exc:
            print(f"WARN {name}: {exc}", file=sys.stderr)
            health.append({"name": name, "mode": "auto", "status": "failed"})

    if rss_items:
        rss_items.sort(key=lambda x: x.get("date", ""), reverse=True)
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

    fixed_sources = [
        ("コミュニティバス変更", BUS_URL, "路線と時刻表を令和8年10月1日から変更します"),
        ("就学時健康診断", SCHOOL_URL, "小学校入学予定者の就学時健康診断を実施します"),
        ("ピラティス教室", PILATES_URL, "ピラティス教室参加者募集"),
        ("市議会日程", COUNCIL_URL, "令和8年9月定例会日程"),
        ("ごみ収集案内", GARBAGE_URL, "ごみ・資源リサイクルの収集日"),
        ("もやせるごみ区域", GARBAGE_BURNABLE_URL, "燃やせるごみ"),
        ("カン・ビン・もやせないごみ日程", GARBAGE_MONTHLY_URL, "燃やせないごみ、カン・ビン"),
        ("祝日のごみ収集", GARBAGE_HOLIDAY_URL, "祝日のごみ収集"),
    ]
    source_dates: dict[str, str] = {}
    for name, url, anchor in fixed_sources:
        try:
            text = html_text(fetch_text(url))
            updated = official_update_date(text, anchor)
            if updated:
                source_dates[url] = updated
            health.append({"name": name, "mode": "page-check", "status": "ok"})
        except Exception as exc:
            print(f"WARN {name}: {exc}", file=sys.stderr)
            health.append({"name": name, "mode": "page-check", "status": "failed"})

    featured = build_featured(latest)
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

    garbage = build_garbage_data(source_dates, old.get("garbage"))

    council = council_data()
    if council and COUNCIL_URL in source_dates:
        council["sourceUpdated"] = source_dates[COUNCIL_URL]
        if council["sourceUpdated"] > "2026-07-02":
            council["status"] = "公式日程更新あり"
            council["nextDateLabel"] = ""
            council["nextSummary"] = "公式ページの日程が更新されています。変更内容を推測せず、最新の日程は公式ページで確認してください。"

    core_payload = {
        "schemaVersion": 1,
        "city": "直方市",
        "verifiedOn": TODAY.isoformat(),
        "population": population,
        "featured": featured,
        "council": council,
        "garbage": garbage,
        "latest": latest,
        "sourceHealth": health,
    }

    old_core = {k: v for k, v in old.items() if k != "generatedAt"}
    if old_core == core_payload:
        print("No semantic data changes")
        return 0

    payload = {
        **core_payload,
        "generatedAt": NOW.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {DATA_PATH.relative_to(ROOT)} with {len(latest)} latest items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
