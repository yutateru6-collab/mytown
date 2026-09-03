"""Static regression checks for MYTOWN's P0 citizen-first UX contract."""

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
    home = read("ui-home-v4.js")
    map_ui = read("map-nearby.js")
    civic = read("civic-actions.js")
    civic_css = read("civic-actions.css")
    portal = read("civic-portal.js")
    sw = read("sw.js")

    for token, label in (
        ('data-v2-nav="home"', "home nav"),
        ('data-v2-nav="nearby"', "nearby nav"),
        ('data-v2-nav="search"', "search nav"),
        ('data-v2-nav="saved"', "saved nav"),
        ('data-v2-nav="menu"', "menu nav"),
        ('>近く</span>', "nearby label"),
        ('>保存</span>', "saved label"),
        ('./map-nearby.js?v=4', "nearby map runtime"),
        ('./map-nearby.css?v=3', "nearby map styles"),
        ('./app.js?v=21', "versioned app runtime"),
        ('./politics.js?v=21', "versioned politics runtime"),
        ('./ui-home-v5.css?v=28', "versioned home polish"),
        ('./civic-portal.js?v=4', "versioned civic portal"),
        ('./civic-actions.js?v=2', "civic actions runtime"),
        ('./civic-actions.css?v=2', "civic actions styles"),
    ):
        require(index, token, label)

    for token in (
        'data-v2-nav="civic"',
        'data-v2-nav="notifications"',
        'trimHomeLabels',
        'MutationObserver',
    ):
        forbid(index, token, "obsolete navigation or DOM patch")

    for token in (
        "今日、見ておくこと",
        "確認できた情報だけを表示しています。",
        "直方で、なにする？",
        "非公式｜直方市の公開情報をもとに掲載",
    ):
        forbid(ui + home, token, "removed redundant home copy")

    require(app, "data/meetings.json", "meeting schedule fetch")
    require(app, "currentCouncilSchedule", "past-safe council schedule")
    require(app, "searchableCommunityItems", "community search index")
    require(app, "searchableCivicItems", "civic search index")
    require(app, "matchesSearchQuery", "synonym-aware search")
    require(app, "関連する公開情報が見つかりました", "honest related-result fallback")
    forbid(app, "市の資料から答えを探します", "overstated assistant claim")

    require(ui, "Array.isArray(saved.interests)", "interest preference load")
    require(ui, 'formData.getAll("interests")', "interest preference save")
    require(ui, 'name="interests"', "interest controls")
    require(ui, 'state.tab === "nearby"', "nearby active navigation")

    require(home, "近い日から2件", "shorter home event list")
    require(home, "updateKicker", "truthful recent-update label")
    require(home, "currentCouncilSchedule", "current council on home")

    require(civic, "caSavedEventsPage", "saved events page")
    require(civic, 'card.querySelector(".v4-event-list-copy")', "event action content placement")
    require(civic, "aria-pressed", "saved state semantics")
    require(civic, "見つけた後の流れを見る", "collapsible lifecycle help")
    require(civic_css, "grid-column: 1 / -1", "event action grid fallback")
    require(civic_css, ".ca-saved-page", "saved page styles")

    require(map_ui, "combinedSearchItems", "cross-source map input")
    require(map_ui, "VERIFIED_LOCATION_POINTS", "verified map coordinates")
    require(portal, "currentCouncilSchedule", "current council in civic portal")
    require(portal, "otherShare", "budget remainder disclosure")

    require(sw, 'const CACHE = "mytown-p0-v28"', "P0 service-worker cache")
    require(sw, "data/meetings.json", "meeting schedule precache")
    require(sw, "map-nearby.js", "map runtime precache")

    print("P0 UX contract checks passed")

if __name__ == "__main__":
    main()
