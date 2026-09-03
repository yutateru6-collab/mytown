#!/usr/bin/env python3
"""Re-check synchronized event metadata and separate fetch health from content quality.

``sync_events.py`` answers whether a publisher page could be collected. This
second pass checks whether dates, prices and application states are internally
consistent. It prefers hiding an uncertain value over presenting it as fact.
Reviewed field corrections live in ``data/event-quality-overrides.json`` with
an evidence trail instead of being hard-coded in the parser.
"""
from __future__ import annotations

import argparse
import json
import re
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from typing import Callable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sync_events import EVENTS_PATH, JST, clean_text, date_tokens, fetch_text, parse_html


ROOT = Path(__file__).resolve().parents[1]
OVERRIDES_PATH = ROOT / "data" / "event-quality-overrides.json"

MONEY_LABELS = ("参加費", "参加料", "入場料", "受講料", "費用", "お値段", "チケット", "料金")
DEADLINE_LABELS = (
    "申込締切",
    "申込み締切",
    "申し込み締切",
    "申込期限",
    "申込み期限",
    "申し込み期限",
    "応募締切",
    "応募期限",
    "受付締切",
)
OPEN_WORDING = re.compile(r"(?:申込(?:み)?|申し込み|応募|予約|参加者).{0,6}(?:受付中|募集中)|受付中|募集中", re.IGNORECASE)
CLOSED_WORDING = re.compile(r"受付終了|募集終了|申込終了|締め切りました|定員に達", re.IGNORECASE)
PURCHASE_CONTEXT = re.compile(
    r"お買い上げ|お買上げ|買い上げ|購入|商品|販売|税込|ノベルティ|プレゼント|レシート|店内|お買い物|お買物",
    re.IGNORECASE,
)
EVENT_FEE_CONTEXT = re.compile(r"参加費|参加料|入場料|受講料|保険料|資料代|飲食代|チケット|お値段|料金|費用")
NON_EVENT_GENERIC_FEE = re.compile(r"駐車|駐輪|送料|配送料|商品|購入|買い上げ|買上げ|追加")
ALLOWED_OVERRIDE_FIELDS = {
    "money",
    "applicationDeadline",
    "applicationStatus",
    "statusLabel",
    "reservationRequired",
}


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def canonical_url(value: str) -> str:
    parsed = urlparse(str(value or ""))
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", query, ""))


def date_label(value: date) -> str:
    return f"{value.month}月{value.day}日"


def year_hint_for(event: dict, text: str, today: date) -> int:
    for value in (event.get("startDate"), event.get("applicationDeadline")):
        if isinstance(value, str) and re.match(r"^20\d{2}-", value):
            return int(value[:4])
    match = re.search(r"(20\d{2})[年/.-]\d{1,2}[月/.-]\d{1,2}", clean_text(text))
    return int(match.group(1)) if match else today.year


def normalize_numeric_spacing(text: str) -> str:
    """Join grouping digits split by HTML layout, e.g. ``1 , 000円``."""
    normalized = clean_text(text)
    normalized = re.sub(r"(?<=\d)\s*,\s*(?=\d{3}(?:\D|$))", ",", normalized)
    normalized = re.sub(r"(?<=\d)\s+(?=\d{3}(?:\D|$))", "", normalized)
    return normalized


def normalized_price_token(token: str) -> tuple[str, int | None, str | None]:
    cleaned = normalize_numeric_spacing(token).replace(" ", "")
    if cleaned == "無料":
        return "無料", 0, None
    digits_match = re.search(r"([0-9][0-9,]*)円", cleaned)
    if not digits_match:
        return "", None, "料金を数値として確認できません"
    raw_digits = digits_match.group(1)
    digits = raw_digits.replace(",", "")
    if not digits.isdigit():
        return "", None, "料金を数値として確認できません"
    if len(digits) > 1 and set(digits) == {"0"}:
        return "", None, f"料金『{raw_digits}円』の数字が不自然です"
    value = int(digits)
    if value == 0:
        return "無料", 0, None
    if value > 10_000_000:
        return "", None, f"料金『{raw_digits}円』が大きすぎるため再確認が必要です"
    return f"{value:,}円", value, None


def _money_segments(text: str) -> list[str]:
    """Return only price segments explicitly labelled as event/admission fees.

    Whole-page fallback is deliberately forbidden. Event pages often contain
    merchandise prices, parking fees and related-article amounts that must not
    be presented as participation fees.
    """
    normalized = normalize_numeric_spacing(text)
    label_pattern = "|".join(re.escape(label) for label in MONEY_LABELS)
    stop_labels = (
        "実施日",
        "開催日",
        "日程",
        "日時",
        "実施時間",
        "時間",
        "場所",
        "会場",
        "主会場",
        "定員",
        "対象",
        "持ち物",
        "申込",
        "申込み",
        "申し込み",
        "応募",
        "受付",
        "お問い合わせ",
        "問合せ",
        "注意事項",
    )
    stop_pattern = "|".join(re.escape(label) for label in stop_labels)
    segments: list[str] = []
    for match in re.finditer(rf"(?:{label_pattern})\s*[|:：]?\s*", normalized):
        label = match.group(0)
        before = normalized[max(0, match.start() - 28) : match.start()]
        # Generic labels in parking, shipping or purchase copy are not event fees.
        if re.search(r"(?:料金|費用)\s*[|:：]?\s*$", label) and NON_EVENT_GENERIC_FEE.search(before):
            continue
        tail = normalized[match.end() : match.end() + 180]
        stop = re.search(rf"\s(?:{stop_pattern})\s*[|:：]?\s*", tail)
        segment = clean_text(tail[: stop.start()] if stop else tail)
        if segment:
            segments.append(segment)
    return segments


def _money_value_from_segment(segment: str) -> tuple[str, list[str]]:
    segment = normalize_numeric_spacing(segment)
    if re.match(r"^無料(?:\D|$)", segment):
        return "無料", []

    pair = re.search(
        r"前売(?:券)?\s*[|:：]?\s*([0-9][0-9,]*)円\s*[／/・, ]+\s*当日(?:券)?\s*[|:：]?\s*([0-9][0-9,]*)円",
        segment,
        re.IGNORECASE,
    )
    if pair:
        first, _, first_issue = normalized_price_token(f"{pair.group(1)}円")
        second, _, second_issue = normalized_price_token(f"{pair.group(2)}円")
        issues = unique([first_issue or "", second_issue or ""])
        return (f"前売{first}／当日{second}" if first and second else ""), issues

    match = re.search(r"(?:[0-9][0-9,]*円|無料)", segment)
    if not match:
        return "", []
    value, _, issue = normalized_price_token(match.group(0))
    return value, [issue] if issue else []


def extract_money(text: str) -> tuple[str, list[str]]:
    values: list[str] = []
    issues: list[str] = []
    for segment in _money_segments(text):
        value, segment_issues = _money_value_from_segment(segment)
        if value:
            values.append(value)
        issues.extend(segment_issues)
    values = unique(values)
    issues = unique(issues)
    if len(values) > 1:
        return "", unique([*issues, "参加費の表記が複数あり、どれを表示すべきか確認が必要です"])
    return (values[0] if values else ""), issues


def _money_contexts(text: str, money: str) -> list[str]:
    normalized = normalize_numeric_spacing(text)
    amount_match = re.search(r"([0-9][0-9,]*)円", normalize_numeric_spacing(money))
    if not amount_match:
        return []
    digits = amount_match.group(1).replace(",", "")
    flexible = r"\s*,?\s*".join(re.escape(char) for char in digits)
    contexts: list[str] = []
    for match in re.finditer(rf"{flexible}\s*円", normalized):
        contexts.append(normalized[max(0, match.start() - 64) : match.end() + 64])
    return contexts


def _existing_money_relationship(text: str, money: str) -> str:
    contexts = _money_contexts(text, money)
    if not contexts:
        return "not_found"
    event_contexts = [context for context in contexts if EVENT_FEE_CONTEXT.search(context)]
    if event_contexts:
        return "event_fee"
    if all(PURCHASE_CONTEXT.search(context) for context in contexts):
        return "purchase_only"
    return "unlabelled"


def deadline_text_candidates(text: str) -> list[str]:
    normalized = clean_text(text)
    candidates: list[str] = []
    label_pattern = "|".join(re.escape(label) for label in DEADLINE_LABELS)

    for match in re.finditer(rf"(?:{label_pattern})\s*[|:：]?\s*(.{{0,50}})", normalized):
        candidates.append(match.group(1))

    date_pattern = r"(?:(?:20\d{2})[年/.\-])?\d{1,2}(?:月|/|\.\-)\d{1,2}日?"
    for match in re.finditer(rf"({date_pattern})(?:\([^)]*\)|（[^）]*）)?\s*(?:{label_pattern})", normalized):
        candidates.append(match.group(1))
    return unique(candidates)


def extract_application_deadline(text: str, year_hint: int, event_start: date | None = None) -> str:
    found: list[date] = []
    for candidate in deadline_text_candidates(text):
        for value in date_tokens(candidate, year_hint):
            if value not in found:
                found.append(value)
    if not found:
        return ""
    if event_start:
        plausible = [value for value in found if value <= event_start]
        if plausible:
            return max(plausible).isoformat()
    return found[0].isoformat()


def existing_money_issue(value: str) -> str:
    if not value:
        return ""
    _, _, issue = normalized_price_token(value)
    return issue or ""


def strip_stale_open_wording(title: str, application_status: str) -> str:
    if application_status != "closed":
        return clean_text(title)
    cleaned = re.sub(
        r"(?:申込(?:み)?|申し込み|応募|予約).{0,6}(?:受付中|募集中)[!！]?[｜|:：\s-]*",
        "",
        clean_text(title),
        flags=re.IGNORECASE,
    )
    return cleaned.strip(" |｜-—:：") or clean_text(title)


def _override_index(raw: dict | None) -> dict[str, dict]:
    if not raw:
        return {}
    entries = raw.get("overrides", []) if isinstance(raw, dict) else []
    index: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        source_url = canonical_url(str(entry.get("sourceUrl") or ""))
        if source_url:
            index[source_url] = entry
    return index


def load_overrides(path: Path = OVERRIDES_PATH) -> dict:
    if not path.exists():
        return {"schemaVersion": 1, "overrides": []}
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schemaVersion") != 1 or not isinstance(raw.get("overrides"), list):
        raise ValueError("event-quality-overrides.json has an unsupported schema")
    for entry in raw["overrides"]:
        if not isinstance(entry, dict) or not canonical_url(str(entry.get("sourceUrl") or "")):
            raise ValueError("every event quality override requires sourceUrl")
        unknown = set((entry.get("set") or {}).keys()) - ALLOWED_OVERRIDE_FIELDS
        if unknown:
            raise ValueError(f"unsupported override fields: {', '.join(sorted(unknown))}")
        remove_fields = set(entry.get("removeFields") or [])
        if remove_fields - ALLOWED_OVERRIDE_FIELDS:
            raise ValueError(f"unsupported removeFields: {', '.join(sorted(remove_fields - ALLOWED_OVERRIDE_FIELDS))}")
        if "money" in (entry.get("set") or {}):
            if normalized_price_token(str(entry["set"]["money"]))[2]:
                raise ValueError("money override is invalid")
    return raw


def _clear_resolved_issues(issues: list[str], fields: set[str]) -> list[str]:
    result = list(issues)
    if "money" in fields:
        result = [issue for issue in result if not re.search(r"料金|金額|参加費", issue)]
    if "applicationDeadline" in fields or "applicationStatus" in fields:
        result = [issue for issue in result if not re.search(r"申込期限|受付状況", issue)]
    return result


def apply_override(refined: dict, override: dict | None, issues: list[str], notes: list[str]) -> tuple[dict, list[str], list[str]]:
    if not override:
        return refined, issues, notes
    corrected_fields: set[str] = set()
    for field in override.get("removeFields") or []:
        if field in ALLOWED_OVERRIDE_FIELDS:
            refined.pop(field, None)
            corrected_fields.add(field)
    for field, value in (override.get("set") or {}).items():
        if field not in ALLOWED_OVERRIDE_FIELDS:
            continue
        if field == "money":
            normalized, _, issue = normalized_price_token(str(value))
            if issue:
                issues.append(issue)
                continue
            value = normalized
        refined[field] = value
        corrected_fields.add(field)
    issues = _clear_resolved_issues(issues, corrected_fields)
    note = clean_text(str(override.get("note") or ""))
    if note:
        notes.append(note)
    refined["reviewedOverride"] = {
        "verifiedOn": str(override.get("verifiedOn") or ""),
        "fields": sorted(corrected_fields),
        "evidenceUrls": unique([str(url) for url in override.get("evidenceUrls") or [] if str(url).startswith("https://")]),
    }
    return refined, issues, notes


def refine_event(
    event: dict,
    source_text: str,
    today: date,
    *,
    source_available: bool = True,
    override: dict | None = None,
) -> dict:
    refined = deepcopy(event)
    issues: list[str] = []
    notes: list[str] = []
    text = clean_text(source_text)
    hint = year_hint_for(refined, text, today)

    existing_money = str(refined.get("money") or "")
    extracted_money, money_issues = extract_money(text) if source_available else ("", [])
    prior_money_issue = existing_money_issue(existing_money)
    if extracted_money:
        if existing_money and existing_money != extracted_money:
            notes.append(f"料金を掲載元から再確認し『{extracted_money}』に更新しました")
        refined["money"] = extracted_money
        refined["moneyVerification"] = "publisher_label"
    elif prior_money_issue:
        refined.pop("money", None)
        refined.pop("moneyVerification", None)
        issues.append(prior_money_issue)
    elif existing_money and source_available:
        relationship = _existing_money_relationship(text, existing_money)
        if relationship == "purchase_only":
            refined.pop("money", None)
            refined.pop("moneyVerification", None)
            notes.append("商品購入額をイベント参加費として扱わないため、料金表示から外しました")
        elif relationship == "event_fee":
            refined["moneyVerification"] = "publisher_context"
        elif relationship == "unlabelled":
            refined.pop("money", None)
            refined.pop("moneyVerification", None)
            issues.append("金額は確認できましたが、イベント参加費かどうか判断できないため表示から外しました")
        else:
            refined.pop("money", None)
            refined.pop("moneyVerification", None)
            issues.append("料金を掲載元ページで再確認できないため表示から外しました")
    elif existing_money and not source_available:
        issues.append("掲載元ページを再取得できず、料金を再確認できません")
    issues.extend(money_issues)

    event_start: date | None = None
    try:
        if refined.get("startDate"):
            event_start = date.fromisoformat(str(refined["startDate"]))
    except ValueError:
        issues.append("開催日の日付形式を確認できません")

    deadline = extract_application_deadline(text, hint, event_start) if source_available else ""
    if deadline:
        if refined.get("applicationDeadline") and refined.get("applicationDeadline") != deadline:
            notes.append(f"申込期限を掲載元から再確認し『{deadline}』に更新しました")
        refined["applicationDeadline"] = deadline

    deadline_date: date | None = None
    try:
        if refined.get("applicationDeadline"):
            deadline_date = date.fromisoformat(str(refined["applicationDeadline"]))
    except ValueError:
        issues.append("申込期限の日付形式を確認できません")
        refined.pop("applicationDeadline", None)

    combined = f"{refined.get('title', '')} {text}"
    if deadline_date:
        if deadline_date < today:
            refined["applicationStatus"] = "closed"
            refined["statusLabel"] = f"受付終了（申込期限 {date_label(deadline_date)}）"
        elif deadline_date == today:
            refined["applicationStatus"] = "due_today"
            refined["statusLabel"] = "申込期限は今日"
        else:
            refined["applicationStatus"] = "open"
            refined["statusLabel"] = f"申込締切 {date_label(deadline_date)}"
    elif CLOSED_WORDING.search(combined):
        refined["applicationStatus"] = "closed"
        refined["statusLabel"] = "受付終了"
    elif OPEN_WORDING.search(combined):
        refined["applicationStatus"] = "unconfirmed"
        refined["statusLabel"] = "受付状況を掲載元で確認"
        issues.append("受付中の表記はありますが、申込期限を確認できません")
    else:
        refined["applicationStatus"] = "not_required_or_unknown"

    refined["title"] = strip_stale_open_wording(str(refined.get("title") or ""), str(refined.get("applicationStatus") or ""))

    if not refined.get("startDate"):
        issues.append("開催日を確認できません")
    if not refined.get("sourceUrl"):
        issues.append("掲載元URLを確認できません")
    elif not source_available:
        issues.append("掲載元ページを再取得できず、今回の内容確認は保留です")

    refined, issues, notes = apply_override(refined, override, unique(issues), unique(notes))
    refined["contentIssues"] = unique(issues)
    refined["contentNotes"] = unique(notes)
    refined["contentStatus"] = "needs_review" if refined["contentIssues"] else "verified"
    refined["contentCheckedAt"] = datetime.now(JST).isoformat()
    return refined


def source_id_for_event(event: dict, source_ids: list[str]) -> str:
    event_id = str(event.get("id") or "")
    for source_id in sorted(source_ids, key=len, reverse=True):
        if event_id.startswith(f"community-{source_id}-"):
            return source_id
    return ""


def refine_payload(
    payload: dict,
    fetcher: Callable[[str], str] = fetch_text,
    today: date | None = None,
    overrides: dict | None = None,
) -> dict:
    today = today or datetime.now(JST).date()
    result = deepcopy(payload)
    refined_events: list[dict] = []
    fetch_warnings: list[dict] = []
    override_index = _override_index(overrides if overrides is not None else load_overrides())

    for event in result.get("events", []):
        source_url = str(event.get("sourceUrl") or "")
        source_text = ""
        source_available = False
        if source_url.startswith("https://"):
            try:
                source_text = parse_html(fetcher(source_url)).text
                source_available = bool(source_text)
                if not source_available:
                    raise ValueError("publisher page contained no readable text")
            except Exception as error:
                fetch_warnings.append({
                    "eventId": event.get("id", ""),
                    "sourceUrl": source_url,
                    "message": clean_text(str(error))[:180],
                })
        refined_events.append(
            refine_event(
                event,
                source_text,
                today,
                source_available=source_available,
                override=override_index.get(canonical_url(source_url)),
            )
        )

    result["events"] = refined_events
    result["qualityCheckedAt"] = datetime.now(JST).isoformat()
    result["qualityFetchWarnings"] = fetch_warnings

    source_health = result.get("sourceHealth", [])
    source_ids = [str(item.get("id") or "") for item in source_health if item.get("id")]
    events_by_source: dict[str, list[dict]] = {source_id: [] for source_id in source_ids}
    for event in refined_events:
        source_id = source_id_for_event(event, source_ids)
        if source_id:
            events_by_source.setdefault(source_id, []).append(event)

    next_health: list[dict] = []
    for health in source_health:
        source_id = str(health.get("id") or "")
        source_events = events_by_source.get(source_id, [])
        issues = sum(len(event.get("contentIssues") or []) for event in source_events)
        checked = sum(1 for event in source_events if event.get("contentStatus") == "verified")
        content_status = "needs_review" if issues else ("verified" if source_events else "no_current_events")
        next_health.append({
            **health,
            "fetchStatus": health.get("status", "unknown"),
            "contentStatus": content_status,
            "contentIssueCount": issues,
            "contentVerifiedEvents": checked,
            "contentEventCount": len(source_events),
        })
    result["sourceHealth"] = next_health
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate the script and reviewed overrides without network access")
    parser.add_argument("--input", type=Path, default=EVENTS_PATH)
    parser.add_argument("--output", type=Path, default=EVENTS_PATH)
    parser.add_argument("--overrides", type=Path, default=OVERRIDES_PATH)
    args = parser.parse_args()

    reviewed_overrides = load_overrides(args.overrides)
    if args.check:
        assert normalized_price_token("5,000円")[0] == "5,000円"
        assert normalized_price_token("000円")[2]
        assert extract_money("商品を1,100円お買い上げごとにプレゼント") == ("", [])
        assert extract_application_deadline("申込期限：8月31日", 2026) == "2026-08-31"
        assert reviewed_overrides.get("schemaVersion") == 1
        print("Event quality refinement checks passed")
        return

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    refined = refine_payload(payload, overrides=reviewed_overrides)
    args.output.write_text(json.dumps(refined, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    needs_review = sum(1 for event in refined.get("events", []) if event.get("contentStatus") == "needs_review")
    print(f"Refined {len(refined.get('events', []))} events; {needs_review} need review")


if __name__ == "__main__":
    main()
