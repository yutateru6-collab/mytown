#!/usr/bin/env python3
"""Offline regression tests for the community directory collectors."""
from __future__ import annotations

from sync_community import (
    parse_sdgs_partners,
    parse_shakyo_volunteer,
    parse_volunteer_directory,
    reviewed_activities,
    validate_config,
)


def main() -> None:
    volunteer_source = {
        "id": "nogata-volunteer-directory",
        "name": "直方市のボランティア団体一覧",
        "description": "団体情報",
        "url": "https://www.city.nogata.fukuoka.jp/yukari/_1510.html",
        "parser": "volunteer-directory",
        "kind": "volunteer",
        "categories": [
            {"name": "子育て", "url": "https://www.city.nogata.fukuoka.jp/yukari/_1510/_1543.html"}
        ],
    }
    volunteer_html = """
      <a href="/yukari/_1510/_1543.html">子育て</a>
      <a href="/yukari/_1510/_1543/_1544.html">のびのび会</a>
      <a href="/shisei/unrelated.html">無関係なページ</a>
    """
    groups = parse_volunteer_directory(volunteer_source, lambda _url: volunteer_html)
    assert len(groups) == 1
    assert groups[0]["name"] == "のびのび会"
    assert groups[0]["category"] == "子育て"

    sdgs_source = {
        "id": "nogata-sdgs-partners",
        "name": "のおがたSDGs推進パートナー一覧",
        "description": "登録一覧",
        "url": "https://www.city.nogata.fukuoka.jp/sdgs.html",
        "parser": "sdgs-partners",
        "kind": "sdgs",
    }
    sdgs_html = """
      <table><tr><th>登録番号</th><th>企業・団体等の名称</th><th>主な業種</th><th>紹介</th></tr>
      <tr><td>016</td><td><a href="https://example.org/mixjam">NPO法人mixjam</a>（外部リンク）</td>
      <td>教育</td><td><a href="/files/016.pdf">016紹介</a></td></tr></table>
    """
    partners = parse_sdgs_partners(sdgs_source, sdgs_html)
    assert len(partners) == 1
    assert partners[0]["registrationNumber"] == "016"
    assert partners[0]["name"] == "NPO法人mixjam"
    assert partners[0]["industry"] == "教育"
    assert partners[0]["profileUrl"] == "https://www.city.nogata.fukuoka.jp/files/016.pdf"

    shakyo_source = {
        "id": "nogata-shakyo-volunteer-center",
        "name": "直方市社会福祉協議会ボランティアセンター",
        "description": "募集情報",
        "url": "https://nogatashakyo.org/pages/65/",
        "parser": "shakyo-volunteer",
        "kind": "volunteer",
    }
    shakyo_html = '<a href="/pages/65?b_id=500&amp;detail=1&amp;r_id=95">わたしの秘密基地ボランティア募集</a>'
    calls = parse_shakyo_volunteer(shakyo_source, shakyo_html)
    assert len(calls) == 1
    assert calls[0]["activityType"] == "volunteer"
    assert "detail=1" in calls[0]["sourceUrl"]

    child_source = {
        "id": "nogata-child-cafeterias",
        "name": "こども食堂情報",
        "description": "こども食堂",
        "url": "https://www.city.nogata.fukuoka.jp/children.html",
        "documentUrl": "https://nogatashakyo.org/children.pdf",
        "parser": "reviewed-activities",
        "kind": "children",
        "dataAsOf": "令和8年6月時点",
        "activities": [
            {"name": "こども食堂A", "activityType": "child-cafeteria"},
            {"name": "支援団体B", "activityType": "child-support"},
        ],
    }
    reviewed = reviewed_activities(child_source)
    assert [item["category"] for item in reviewed] == ["こども食堂", "こどもの居場所・支援"]
    assert all(item["dataAsOf"] == "令和8年6月時点" for item in reviewed)

    config = {
        "schemaVersion": 1,
        "sources": [
            volunteer_source,
            child_source,
            sdgs_source,
            shakyo_source,
        ],
    }
    validate_config(config)
    print("Community directory pipeline checks passed")


if __name__ == "__main__":
    main()
