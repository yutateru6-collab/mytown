#!/usr/bin/env python3
"""Fail closed when MYTOWN civic-transparency facts stop matching official pages."""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import sync_nogata

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "politics.json"

MAYOR_URL = "https://www.city.nogata.fukuoka.jp/shisei/_1234/_12968.html"
MAYOR_HISTORY_URL = "https://www.city.nogata.fukuoka.jp/shisei/_1233/_3878/_3845.html"
VICE_MAYOR_HISTORY_URL = "https://www.city.nogata.fukuoka.jp/shisei/_1233/_3878/_3849.html"
MEMBERS_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1252/_2728.html"
COUNCIL_STRUCTURE_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1253/_2733.html"
FACTIONS_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1252/_2729.html"
COMMITTEES_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1252/_2730.html"
ELECTIONS_URL = "https://www.city.nogata.fukuoka.jp/shisei/_2367/_2370.html"
MONEY_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1255/_2759.html"
QUESTIONS_URL = "https://www.city.nogata.fukuoka.jp/sigikai/_1254/_2747/_16982.html"


def compact(url: str) -> str:
    text = sync_nogata.html_text(sync_nogata.fetch_text(url))
    return re.sub(r"\s+", "", text)


def require(text: str, markers: list[str], label: str) -> None:
    missing = [m for m in markers if re.sub(r"\s+", "", m) not in text]
    if missing:
        raise RuntimeError(f"{label}: official source no longer matches: {missing}")


def main() -> int:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    require(compact(MAYOR_URL), ["直方市長大塚進弘"], "mayor")
    require(compact(MAYOR_HISTORY_URL), ["25代大塚進弘(平成31年4月26日)", "26代大塚進弘(令和5年4月26日)"], "mayor history")
    require(compact(VICE_MAYOR_HISTORY_URL), ["3代大塚進弘(平成23年6月1日)"], "vice mayor history")

    members = payload.get("council", {}).get("members", [])
    member_text = compact(MEMBERS_URL)
    require(member_text, [m["name"] for m in members] + ["田代文也", "議長", "渡辺幸一", "副議長"], "council members")

    structure_text = compact(COUNCIL_STRUCTURE_URL)
    require(structure_text, ["19人", "れいめい", "令和会", "市民クラブ", "日本共産党", "ふたば", "正誠会", "公明党", "プラタナス"], "council structure")

    faction_text = compact(FACTIONS_URL)
    require(faction_text, ["令和5年5月16日現在", "れいめい（5名）", "プラタナス（2名）"], "faction membership")

    committee_text = compact(COMMITTEES_URL)
    require(committee_text, ["総務常任委員会", "教育民生常任委員会", "産業建設常任委員会", "議会運営委員会", "矢野富士雄", "岡松誠二", "渡辺克也"], "committees")

    election_text = compact(ELECTIONS_URL)
    require(election_text, ["直方市長選挙", "令和9年4月25日", "直方市議会議員一般選挙", "令和9年5月1日"], "elections")

    money_text = compact(MONEY_URL)
    require(money_text, ["1人あたり年額300,000円", "月額25,000円", "4月30日まで", "収支報告書"], "political activity allowance")

    question_text = compact(QUESTIONS_URL)
    require(question_text, ["篠原正之議員", "公共交通と旧西鉄バス内ヶ磯線について", "中学校給食の無償化について", "新幹線新駅の設置について"], "general questions")

    today = date.today().isoformat()
    if payload.get("verifiedOn") != today:
        payload["verifiedOn"] = today
        DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Politics data re-verified on {today}")
    else:
        print("Politics data verification passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
