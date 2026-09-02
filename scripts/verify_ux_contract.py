"""Static regression checks for MYTOWN's citizen-first UX contract."""

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
    data = read("data/latest.json")
    politics = read("politics.js")
    ui = read("ui-v2.js")
    css = read("ui-v2.css")
    home_ui = read("ui-home-v4.js")
    home_css = read("ui-home-v4.css")
    home_polish_css = read("ui-home-v5.css")
    map_ui = read("map-nearby.js")
    map_css = read("map-nearby.css")
    bulletin_ui = read("bulletin-reader.js")
    bulletin_css = read("bulletin-reader.css")
    sw = read("sw.js")

    require(index, ">調べる</span>", "truthful center-nav label")
    require(index, "aria-label=\"調べるメニューを開く\"", "center-nav accessible name")
    require(index, "./ui-v2.js?v=15", "versioned citizen-first runtime")
    require(index, "./ui-v2.css?v=14", "versioned citizen-first styles")
    require(index, "./ui-home-v4.js?v=16", "event-led home runtime")
    require(index, "./ui-home-v4.css?v=15", "event-led home styles")
    require(index, "./map-nearby.js?v=2", "nearby map runtime")
    require(index, "./map-nearby.css?v=2", "nearby map styles")
    require(index, "./bulletin-reader.js?v=1", "bulletin reader runtime")
    require(index, "./bulletin-reader.css?v=1", "bulletin reader styles")
    # Cache-bust query values change frequently during UI polish; verify the asset is
    # versioned without coupling the UX contract to one specific revision number.
    require(index, "./ui-home-v5.css?v=", "versioned home polish styles")
    forbid(index, "reference-ui.css", "static mockup stylesheet")
    forbid(index, "reference-ui.js", "static mockup runtime")
    forbid(index, ">提案する</span>", "misleading proposal label")

    for token in (
        "今日の直方",
        "今日の直方をひと目で",
        "v2-capability-grid",
        "決まるまでの流れ",
        "近くで何がある？",
        "今日の暮らし",
        "暮らしに関わる市の動き",
        "data-v2-action=\"meeting\"",
        "V2_PREFERENCES_KEY",
        "hasVerifiedConditions",
        "appShell.inert = true",
        "event.key !== \"Tab\"",
    ):
        require(ui, token, "base citizen-first UI contract")

    for token in (
        "直方のイベント",
        "v4-bento-grid",
        "決まり方を見る",
        "市長・市議会",
        "イベント・体験を探す",
        "掲載について",
        "すべてのイベントを掲載しているわけではありません",
        "イベント掲載",
        "ボランティア",
        "準備中",
    ):
        require(home_ui, token, "event-led bento home contract")

    forbid(home_ui, "350m", "unverified distance on home")
    require(home_css, ".v4-event-feature", "event feature styling")
    require(home_css, ".v4-bento-grid", "bento grid styling")
    require(home_css, "min-height: 44px", "minimum v4 interactive target")

    for token in (
        ".ui-v2 .v2-wordmark span",
        ".v4-event-feature",
        ".v4-bento-card",
        "min-height: 112px",
        "white-space: nowrap",
        "card-nearby.svg",
        "card-deadline.svg",
        "card-services.svg",
        "card-decision.svg",
    ):
        require(home_polish_css, token, "home v5 polish contract")

    for token in (
        "maplibre-gl@${MAPLIBRE_VERSION}",
        "https://tiles.openfreemap.org/styles/liberty",
        "VERIFIED_LOCATION_POINTS",
        "130.7301452",
        "130.7253475",
        "mytown-nearby-map",
        "mytown-map-detail",
        "Googleマップで開く",
        "住所と位置を確認できた情報だけ",
        "この地図の下に内容が表示されます",
    ):
        require(map_ui, token, "verified nearby map contract")
    forbid(map_ui, "new maplibregl.Popup", "clipping-prone map popup")
    require(map_css, ".mytown-nearby-map", "nearby map container styling")
    require(map_css, ".mytown-map-marker", "nearby map marker styling")
    require(map_css, ".mytown-map-detail", "below-map detail styling")
    require(map_css, ".mytown-map-detail-actions", "map detail actions styling")

    for token in (
        "data-v2-action=\"bulletin\"",
        "bulletin-reader-frame",
        "bulletin-page-button",
        "wholePdfUrl",
        "#bulletin",
        "市の公式PDFを、MYTOWNの中でそのまま読めます。",
        "ページを選ぶ",
    ):
        require(bulletin_ui, token, "in-app bulletin reader contract")
    require(bulletin_css, ".bulletin-reader-frame", "bulletin PDF frame styling")
    require(bulletin_css, ".bulletin-page-button", "bulletin page picker styling")
    require(bulletin_css, ".v2-bulletin-button", "bulletin home button styling")

    require(app, "30秒まとめ", "30-second layer")
    require(app, "もう少しくわしく", "three-minute layer")
    require(app, "市の元資料", "primary-source layer")
    require(app, "市の資料では分かりませんでした", "safe unanswered state")
    require(app, "市の資料で確認できた流れ", "decision evidence timeline")
    require(data, '"decisionTimeline"', "verified bus decision timeline data")
    require(data, '"decisionUnknowns"', "explicit decision unknowns")
    require(politics, "質問に合わない基本情報", "mayor false-match guard")

    require(css, "min-height: 44px", "minimum interactive target")
    require(css, "@media (max-width: 520px)", "single-column mobile breakpoint")
    require(sw, "mytown-civic-v19-map-bulletin", "service-worker cache revision")
    require(sw, "ui-home-v4.js", "v4 runtime precache")
    require(sw, "ui-home-v5.css", "v5 polish precache")
    require(sw, "map-nearby.js", "nearby map runtime precache")
    require(sw, "map-nearby.css", "nearby map style precache")
    require(sw, "bulletin-reader.js", "bulletin reader runtime precache")
    require(sw, "bulletin-reader.css", "bulletin reader style precache")
    require(sw, "event-festival.svg", "event illustration precache")
    for token in (
        "card-nearby.svg",
        "card-deadline.svg",
        "card-services.svg",
        "card-decision.svg",
    ):
        require(sw, token, "distinct bento illustration precache")

    print("UX contract checks passed")


if __name__ == "__main__":
    main()
