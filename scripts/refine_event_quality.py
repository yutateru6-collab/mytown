#!/usr/bin/env python3
"""Re-check synchronized event metadata and separate fetch health from content quality.

This is intentionally a second pass after ``sync_events.py``. The source collector
answers "could the page be fetched?"; this pass answers "are dates, prices and
application states internally consistent?". It never invents missing facts.
"""
from __future__ import annotations

import argparse
import json
import re
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from typing import Callable

from sync_events import EVENTS_PATH, JST, clean_text, date_tokens, fetch_text, parse_html


ROOT = Path(__file__).resolve().parents[1]

MONEY_LABELS = ("参加費", "参加料", "料金", "費用", "お値段", "チケット", "受講料")
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


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def date_label(value: date) -> str:
    return f"{value.month}月{value.day}日"


def year_hint_for(event: dict, text: str, today: date) -> int:
    for value in (event.get("startDate"), event.get("applicationDeadline")):
        if isinstance(value, str) and re.match(r"^20\d{2}-", value):
            return int(value[:4])
    match = re.search(r"(20\d{2})[年/.-]\d{1,2}[月/.-]\d{1,2}", clean_text(text))
    return int(match.group(1)) if match else today.year


def labelled_value(text: str, labels: tuple[str, ...], limit: int = 180) -> str:
    normalized = clean_text(text)
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?:{label_pattern})\s*[|:：]?\s*", normalized)
    if not match:
        return ""
    tail = normalized[match.end() : match.end() + limit]
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
    stop_pattern = "|".join(re.escape(label) for label in stop_labels if label not in labels)
    stop = re.search(rf"\s(?:{stop_pattern})\s*[|:：]?\s*", tail)
    return clean_text(tail[: stop.start()] if stop else tail)


def normalized_price_token(token: str) -> tuple[str, int | None, str | None]:
    cleaned = clean_text(token).replace(" ", "")
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
        return "", None, f"料金「{raw_digits}円」の数字が不自然です"
    value = int(digits)
    if value == 0:
        return "無料", 0, None
    if value > 10_000_000:
        return "", None, f"料金「{raw_digits}円」が大きすぎるため再確認が必要です"
    return f"{value:,}円", value, None


def extract_money(text: str) -> tuple[str, list[str]]:
    normalized = clean_text(text)
    segment = labelled_value(normalized, MONEY_LABELS, limit=180)
    search_area = segment or normalized

    free_match = re.search(r"(?:参加費|参加料|料金|費用|お値段|受講料)\s*[|:：]?\s*無料", search_area)
    if free_match:
        return "無料", []

    pair = re.search(
        r"前売(?:券)?\s*[|:：]?\s*([0-9][0-9,]*)円\s*[／/・, ]+\s*当日(?:券)?\s*[|:：]?\s*([0-9][0-9,]*)円",
        search_area,
        re.IGNORECASE,
    )
    if pair:
        first, _, first_issue = normalized_price_token(f"{pair.group(1)}円")
        second, _, second_issue = normalized_price_token(f"{pair.group(2)}円")
        issues = unique([first_issue or "", second_issue or ""])
        return (f"前売{first}／当日{second}" if first and second else ""), issues

    labelled_money = re.search(r"(?:[0-9][0-9,]*円|無料)", search_area)
    if not labelled_money:
        return "", []
    value, _, issue = normalized_price_token(labelled_money.group(0))
    return value, [issue] if issue else []


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


def extract_application_deadline(text: str, year_hint: int) -> str:
    found: list[date] = []
    for candidate in deadline_text_candidates(text):
        for value in date_tokens(candidate, year_hint):
            if value not in found:
                found.append(value)
    return min(found).isoformat() if found else ""


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


def refine_event(event: dict, source_text: str, today: date) -> dict:
    refined = deepcopy(event)
    issues: list[str] = []
    notes: list[str] = []
    text = clean_text(source_text)
    hint = year_hint_for(refined, text, today)

    extracted_money, money_issues = extract_money(text)
    prior_money_issue = existing_money_issue(str(refined.get("money") or ""))
    if extracted_money:
        if refined.get("money") and refined.get("money") != extracted_money:
            notes.append(f"料金を掲載元から再確認し「{extracted_money}」に更新しました")
        refined["money"] = extracted_money
    elif prior_money_issue:
        refined.pop("money", None)
        issues.append(prior_money_issue)
    issues.extend(money_issues)

    deadline = extract_application_deadline(text, hint)
    if deadline:
        if refined.get("applicationDeadline") and refined.get("applicationDeadline") != deadline:
            notes.append(f"申込期限を掲載元から再確認し「{deadline}」に更新しました")
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
        refined.setdefault("applicationStatus", "not_required_or_unknown")

    refined["title"] = strip_stale_open_wording(str(refined.get("title") or ""), str(refined.get("applicationStatus") or ""))

    if not refined.get("startDate"):
        issues.append("開催日を確認できません")
    if not refined.get("sourceUrl"):
        issues.append("掲載元URLを確認できません")

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
) -> dict:
    today = today or datetime.now(JST).date()
    result = deepcopy(payload)
    refined_events: list[dict] = []
    fetch_warnings: list[dict] = []

    for event in result.get("events", []):
        source_url = str(event.get("sourceUrl") or "")
        source_text = ""
        if source_url.startswith("https://"):
            try:
                source_text = parse_html(fetcher(source_url)).text
            except Exception as error:
                fetch_warnings.append({
                    "eventId": event.get("id", ""),
                    "sourceUrl": source_url,
                    "message": clean_text(str(error))[:180],
                })
        refined_events.append(refine_event(event, source_text, today))

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
    parser.add_argument("--check", action="store_true", help="validate the script without network access")
    parser.add_argument("--input", type=Path, default=EVENTS_PATH)
    parser.add_argument("--output", type=Path, default=EVENTS_PATH)
    args = parser.parse_args()

    if args.check:
        assert normalized_price_token("5,000円")[0] == "5,000円"
        assert normalized_price_token("000円")[2]
        assert extract_application_deadline("申込期限：8月31日", 2026) == "2026-08-31"
        print("Event quality refinement checks passed")
        return

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    refined = refine_payload(payload)
    args.output.write_text(json.dumps(refined, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    needs_review = sum(1 for event in refined.get("events", []) if event.get("contentStatus") == "needs_review")
    print(f"Refined {len(refined.get('events', []))} events; {needs_review} need review")


if __name__ == "__main__":
    main()
