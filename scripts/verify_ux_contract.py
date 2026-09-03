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
    changes = read("data/changes.json")
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
    civic_ui = read("civic-actions.js")
    civic_css = read("civic-actions.css")
    civic_routes = read("data/civic-report-routes.json")
    sw = read("sw.js")

    require(index, ">地図</span>", "dedicated map navigation")
    require(index, ">さがす</span>", "search center-nav label")
    require(index, "aria-label=\"直方の情報をさがす\"", "search accessible name")
    require(index, "./ui-v2.js?v=20", "versioned citizen-first runtime")
    require(index, "./app-runtime.js?v=3", "versioned data-load recovery runtime")
    require(index, "./ui-v2.css?v=18", "versioned citizen-first styles")
    require(index, "./app.js?v=20", "daily visit state runtime")
    require(index, "./ui-home-v4.js?v=22", "event-led home runtime")
    require(index, "./ui-home-v4.css?v=19", "event-led home styles")
    require(index, "./map-nearby.js?v=3", "nearby map runtime")
    require(index, "./map-nearby.css?v=2", "nearby map styles")
    require(index, "./bulletin-reader.js?v=2", "bulletin reader runtime")
    require(index, "./bulletin-reader.css?v=1", "bulletin reader styles")
    require(index, "./civic-actions.js?v=2", "versioned civic-actions runtime")
    require(index, "./civic-actions.css?v=2", "versioned civic-actions styles")
    require(index, "./ui-home-v5.css?v=27", "versioned home polish styles")
    forbid(index, "reference-ui.css", "static mockup stylesheet")
    forbid(index, "reference-ui.js", "static mockup runtime")
    forbid(index, ">提案する</span>", "misleading proposal label")

    for token in (
        "のおがた日和",
        "知れば直方は<br>もっとおもしろい！",
        "直方の情報を探す",
        "v2-capability-grid",
        "決まるまでの流れ",
        "地図から探す",
        "今日の暮らし",
        "暮らしに関わる市の動き",
        "data-v2-action=\"meeting\"",
        "data-v2-action=\"back-route\"",
        "V2_PREFERENCES_KEY",
        "garbageArea",
        "v2ChangesSinceLastVisit",
        "hasVerifiedConditions",
        "appShell.inert = true",
        "event.key !== \"Tab\"",
    ):
        require(ui, token, "base citizen-first UI contract")
    require(ui, "このブラウザだけに保存されます", "accurate preference storage scope")
    require(ui, "今回は反映しましたが、次に開くと元に戻ります", "preference save failure state")
    require(ui, 'class="v2-wordmark-accent"', "accented Hiyori wordmark")
    require(ui, '<p class="v2-data-note">非公式｜直方市の公開情報をもとに掲載</p>', "separate trust strip")
    forbid(ui, "<legend>知りたいテーマ", "inactive interest settings")
    forbid(ui, "まだ間に合う", "unverified active deadline claim")
    forbid(ui, "昨日から変わったこと", "unselected change-summary module")

    for token in (
        "直方のイベント",
        "市・地域団体・施設の情報を、近い日から3件。",
        "すべてのイベントを見る",
        "地域団体",
        "市・地域の公開情報から掲載",
        "v4-bento-grid",
        "暮らしから探す",
        "市報を読む",
        "次の市議会",
        "イベント・体験を探す",
        "掲載について",
        "すべてのイベントを網羅しているわけではありません",
        "この活動も載せて！",
        "ボランティア",
        "準備中",
        "今日、見ておくこと",
        "前回見たあと",
        "今日の直方を1つ知る",
        "今日から、直方に関わる",
        "確認できた情報だけを表示しています。",
        "今日：${todayTypes.join(\"・\")}",
        "明日：${tomorrowTypes.join(\"・\")}",
        "収集エリアを設定",
    ):
        require(home_ui, token, "event-led bento home contract")

    for token in (
        "このイベントも載せて！",
        "参加まで、参加した後まで",
        "data-ca-save-event-id",
        "data-ca-calendar-event-id",
        "data-ca-open-report",
        "写真と位置情報はこのアプリのサーバーへ送信・保存しない",
        "市議会へ正式に要望したい場合",
        "navigator.geolocation",
        "navigator.share",
        "data/civic-report-routes.json",
    ):
        require(civic_ui, token, "event follow-through and civic reporting contract")
    for token in (".ca-lifecycle", ".ca-dialog", ".ca-report-photo"):
        require(civic_css, token, "civic actions styling")
    for token in (
        '"id": "road"',
        '"id": "park"',
        "道路緊急ダイヤル（#9910）",
        "都市計画課 公園街路係",
        "市議会への請願・陳情",
    ):
        require(civic_routes, token, "verified civic report route")

    community_data = read("data/community-events.json")
    require(community_data, "地域団体・NPO", "NPO/community event source label")
    require(community_data, "NPO法人直方川づくりの会", "reviewed NPO event source")

    community_directory = read("data/community.json")
    require(community_directory, "直方市のボランティア団体一覧", "volunteer directory source")
    require(community_directory, "こども食堂情報", "child cafeteria source")
    require(community_directory, "のおがたSDGs推進パートナー一覧", "SDGs partner source")
    require(community_directory, "直方市社会福祉協議会ボランティアセンター", "volunteer center source")

    forbid(home_ui, "350m", "unverified distance on home")
    forbid(home_ui, "まだ間に合う", "unverified home deadline claim")
    require(home_css, ".v4-event-feature", "event feature styling")
    require(home_css, ".v4-bento-grid", "bento grid styling")
    require(home_css, ".v4-daily-briefing", "daily briefing styling")
    require(home_css, "min-height: 44px", "minimum v4 interactive target")

    for token in (
        ".ui-v2 .v2-wordmark .v2-wordmark-accent",
        ".v4-event-feature",
        ".v4-bento-card",
        "min-height: 112px",
        "white-space: nowrap",
        "card-nearby.svg",
        "card-deadline.svg",
        "card-services.svg",
        "card-bulletin.svg",
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
        "位置まで確認できた情報だけ",
        "地図の下に内容が表示されます",
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
        "直方市が公開した市報PDFです。",
        "読みたいページを選ぶ",
        "PDFを別画面で開く",
    ):
        require(bulletin_ui, token, "in-app bulletin reader contract")
    require(bulletin_css, ".bulletin-reader-frame", "bulletin PDF frame styling")
    require(bulletin_css, ".bulletin-page-button", "bulletin page picker styling")
    require(bulletin_css, ".v2-bulletin-button", "bulletin home button styling")

    require(app, "30秒で読む", "30-second layer")
    require(app, "背景・費用・決まり方", "detail layer")
    require(app, "確認に使った資料", "primary-source layer")
    require(app, "現在取り込んでいる市の資料では、答えを確認できませんでした", "safe unanswered state")
    require(app, 'item.sourceUpdated || item.published || "確認できず"', "separate source date fallback")
    forbid(app, "item.sourceUpdated || item.published || state.data.verifiedOn", "mixed source and app verification dates")
    require(app, "市の資料で確認できた流れ", "decision evidence timeline")
    require(data, '"decisionTimeline"', "verified bus decision timeline data")
    require(data, '"decisionUnknowns"', "explicit decision unknowns")
    require(data, '"burnableWeekdays": [', "in-app garbage weekday data")
    require(data, '"cansAndBottles": [', "in-app cans and bottles dates")
    require(data, '"nonBurnable": [', "in-app non-burnable dates")
    require(changes, '"changes"', "change-log data file")
    require(politics, "質問に合わない基本情報", "mayor false-match guard")

    require(css, "min-height: 44px", "minimum interactive target")
    require(css, "@media (max-width: 520px)", "single-column mobile breakpoint")
    require(sw, "mytown-civic-v27-civic-actions", "service-worker cache revision")
    require(sw, "data/changes.json", "change-log precache")
    require(sw, "ui-home-v4.js", "v4 runtime precache")
    require(sw, "ui-home-v5.css", "v5 polish precache")
    require(sw, "map-nearby.js", "nearby map runtime precache")
    require(sw, "map-nearby.css", "nearby map style precache")
    require(sw, "bulletin-reader.js", "bulletin reader runtime precache")
    require(sw, "bulletin-reader.css", "bulletin reader style precache")
    require(sw, "civic-actions.js", "civic reporting runtime precache")
    require(sw, "civic-actions.css", "civic reporting styles precache")
    require(sw, "event-festival.svg", "event illustration precache")
    require(sw, "data/community-events.json", "community event data precache")
    require(sw, "data/community.json", "community directory data precache")
    require(sw, "data/civic-report-routes.json", "verified civic routes precache")
    for token in (
        "card-nearby.svg",
        "card-deadline.svg",
        "card-services.svg",
        "card-decision.svg",
        "card-bulletin.svg",
    ):
        require(sw, token, "distinct bento illustration precache")

    print("UX contract checks passed")


if __name__ == "__main__":
    main()
