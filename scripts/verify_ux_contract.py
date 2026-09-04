"""Static regression checks for MYTOWN's current citizen-first UX contract."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def require(text: str, token: str, label: str) -> None:
    if token not in text:
        raise AssertionError(f"Missing {label}: {token}")


def forbid(text: str, token: str, label: str) -> None:
    if token in text:
        raise AssertionError(f"Forbidden {label}: {token}")


def main() -> None:
    index = read("index.html")
    app = read("app.js")
    ui = read("ui-v2.js")
    home_ui = read("ui-home-v4.js")
    map_ui = read("map-nearby.js")
    map_css = read("map-nearby.css")
    civic = read("civic-actions.js")
    civic_portal = read("civic-portal.js")
    p0_js = read("p0-stability.js")
    p0_css = read("p0-stability.css")
    sw = read("sw.js")
    data = read("data/latest.json")
    community = read("data/community.json")
    community_events = read("data/community-events.json")

    # Bottom navigation: daily utility first. Civic content remains available from home/menu.
    for token, label in (
        ('data-v2-nav="home"', "home nav"),
        ('data-v2-nav="nearby"', "nearby nav"),
        ('>近く</span>', "nearby label"),
        ('data-v2-nav="search"', "search nav"),
        ('data-v2-nav="notifications"', "updates nav"),
        ('data-v2-nav="menu"', "menu nav"),
        ('aria-label="直方の情報をさがす"', "search accessible name"),
    ):
        require(index, token, label)
    forbid(index, 'data-v2-nav="civic"', "politics-first bottom navigation")

    # Real map wiring must be present, not only dead code in the repository.
    for token in (
        './map-nearby.css?v=2',
        './map-nearby.js?v=3',
        './p0-stability.css?v=1',
        './p0-stability.js?v=1',
        './civic-actions.js?v=2',
    ):
        require(index, token, "runtime wiring")
    forbid(index, "MutationObserver", "post-render label deletion observer")

    # Verified-location map contract.
    for token in (
        "MapLibre",
        "OPENFREEMAP_STYLE",
        "VERIFIED_LOCATION_POINTS",
        "mytown-nearby-map",
        "Googleマップで開く",
    ):
        require(map_ui, token, "nearby map contract")
    require(map_css, ".mytown-nearby-map", "map container styling")
    require(map_css, ".mytown-map-marker", "map marker styling")

    # P0 audit findings must remain fixed.
    for token in (
        ".v4-event-list-card > .ca-event-actions",
        "grid-column: 1 / -1",
        "min-height: 44px",
        "body.p0-returning .v2-hero",
        '.bottom-nav [data-v2-nav="nearby"]',
    ):
        require(p0_css, token, "P0 CSS regression guard")

    for token in (
        "p0NormalizeCouncilState",
        "p0RestorePreferences",
        "combinedSearchItemsAcrossMytown",
        "communityEvents",
        "communityActivities",
        "communityOrganizations",
        "state.civicPortal?.works",
        "state.politics?.council?.members",
        "よくある質問から探す",
        "資料横断の自由質問検索は準備中です",
        "ALLOWED_INTERESTS",
        "p0-interest-fieldset",
        "p0GoNearby",
        "今日の新着",
        "最新の更新",
    ):
        require(p0_js, token, "P0 JS regression guard")

    # Core daily-use features are still present.
    for token in (
        "直方のイベント",
        "すべてのイベントを見る",
        "暮らしから探す",
        "市報を読む",
        "地域活動・ボランティアを探す",
        "収集エリアを設定",
    ):
        require(home_ui, token, "home utility contract")

    # Civic reporting/event follow-through must survive the stabilization work.
    for token in (
        "このイベントも載せて！",
        "まちの気になる場所",
        "data-ca-save-event-id",
        "data-ca-calendar-event-id",
        "当日の変更を確認",
        "請願・陳情",
    ):
        require(civic, token, "civic action contract")

    # Search and answer safety remain source-bounded.
    require(app, "combinedSearchItems", "base search index")
    require(app, "確認できませんでした", "safe unanswered state")
    require(app, "推測", "no-inference wording")

    # Current data sources needed for cross-source discovery.
    require(data, '"council"', "council data")
    require(data, '"garbage"', "garbage data")
    require(community, '"organizations"', "community organizations")
    require(community, '"activities"', "community activities")
    require(community_events, '"events"', "community events")

    # Civic portal is still accessible from the app and remains people-first internally.
    require(civic_portal, 'state.politicsSection = "people"', "people-first civic destination")
    require(civic_portal, 'state.civicPortal', "civic data state")

    # Installed/offline app receives the same stabilized assets.
    for token in (
        "mytown-civic-v36-p0-stability",
        "map-nearby.css",
        "map-nearby.js",
        "p0-stability.css",
        "p0-stability.js",
        "data/community-events.json",
        "data/community.json",
    ):
        require(sw, token, "service worker stability contract")

    print("UX contract checks passed")


if __name__ == "__main__":
    main()
