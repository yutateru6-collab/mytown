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
    sw = read("sw.js")

    require(index, ">調べる</span>", "truthful center-nav label")
    require(index, "aria-label=\"調べるメニューを開く\"", "center-nav accessible name")
    require(index, "./ui-v2.js?v=14", "versioned citizen-first runtime")
    require(index, "./ui-v2.css?v=14", "versioned citizen-first styles")
    require(index, "./ui-home-v4.js?v=15", "event-led home runtime")
    require(index, "./ui-home-v4.css?v=15", "event-led home styles")
    forbid(index, "reference-ui.css", "static mockup stylesheet")
    forbid(index, "reference-ui.js", "static mockup runtime")
    forbid(index, ">提案する</span>", "misleading proposal label")

    for token in (
        "今日の直方",
        "MYTOWNでできること",
        "v2-capability-grid",
        "暮らしから決定まで",
        "近くで確認できること",
        "今日と明日の暮らし",
        "気づいたら市政も分かる",
        "data-v2-action=\"meeting\"",
        "V2_PREFERENCES_KEY",
        "hasVerifiedConditions",
        "appShell.inert = true",
        "event.key !== \"Tab\"",
    ):
        require(ui, token, "base citizen-first UI contract")

    for token in (
        "直方で、なにする？",
        "v4-bento-grid",
        "少しずつ分かる",
        "市議会・議員",
        "イベント・体験を見つける",
        "現在の掲載範囲",
        "全イベントを網羅しているとは表示しません",
        "イベントを載せる",
        "直方をちょっと手伝う",
        "準備中",
    ):
        require(home_ui, token, "event-led bento home contract")

    forbid(home_ui, "350m", "unverified distance on home")
    require(home_css, ".v4-event-feature", "event feature styling")
    require(home_css, ".v4-bento-grid", "bento grid styling")
    require(home_css, "min-height: 44px", "minimum v4 interactive target")

    require(app, "MYTOWNによる30秒要約", "30-second layer")
    require(app, "3分で背景まで", "three-minute layer")
    require(app, "原文・一次資料", "primary-source layer")
    require(app, "公開資料で確認できず", "safe unanswered state")
    require(app, "公式資料で追える経緯", "decision evidence timeline")
    require(data, '"decisionTimeline"', "verified bus decision timeline data")
    require(data, '"decisionUnknowns"', "explicit decision unknowns")
    require(politics, "市長という言葉だけを手掛かり", "mayor false-match guard")

    require(css, "min-height: 44px", "minimum interactive target")
    require(css, "@media (max-width: 520px)", "single-column mobile breakpoint")
    require(sw, "mytown-civic-v15-bento", "service-worker cache revision")
    require(sw, "ui-home-v4.js", "v4 runtime precache")
    require(sw, "event-festival.svg", "event illustration precache")

    print("UX contract checks passed")


if __name__ == "__main__":
    main()
