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
    sw = read("sw.js")

    require(index, ">調べる</span>", "truthful center-nav label")
    require(index, "aria-label=\"調べるメニューを開く\"", "center-nav accessible name")
    forbid(index, "reference-ui.css", "static mockup stylesheet")
    forbid(index, "reference-ui.js", "static mockup runtime")
    forbid(index, ">提案する</span>", "misleading proposal label")

    for token in (
        "今日の直方",
        "近くで確認できること",
        "今日と明日の暮らし",
        "気づいたら市政も分かる",
        "data-v2-action=\"meeting\"",
        "V2_PREFERENCES_KEY",
        "appShell.inert = true",
        "event.key !== \"Tab\"",
    ):
        require(ui, token, "citizen-first UI contract")

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
    require(sw, "mytown-civic-v10-citizen-first", "service-worker cache revision")

    print("UX contract checks passed")


if __name__ == "__main__":
    main()
