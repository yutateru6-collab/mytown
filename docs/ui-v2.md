# MYTOWN UI v3 — Compact Watercolor / Citizen-first

## Goal

MYTOWNの同期済み公式データ・政治透明化機能を残したまま、ホームを「政治アプリ」ではなく「直方の暮らしアプリ」として再構成する。

## Home information architecture

1. Compact watercolor hero — 日付 / MYTOWN直方 / 地区設定 / まちナビ
2. Daily life — 場所 / ごみ / 募集・期限 / 自分のテーマに近い注目情報
3. Civic bridge — 次の市議会 / なぜ・誰が決めた / 公式情報への質問
4. Secondary information — 公式新着 / 市報
5. Bottom navigation — きょう / さがす / 調べる / お知らせ / メニュー

The original supplied visual remains the design source, but it is no longer used as a
single interactive screenshot. Scenery and the approved mascot remain image assets;
dates, labels, cards and controls are semantic HTML.

On viewports up to 520px, important content cards are single-column. Supporting text
does not shrink to fit a three-column grid, and primary controls keep a 44px minimum
target.

## Personalization

- Broad district text, interests and display-notification preferences are optional.
- They are stored only in `localStorage` under `mytown-preferences-v1`.
- Location permission, account registration and precise addresses are not requested.
- A location match is only used when the saved text appears in a verified public
  location field. No distance is inferred.

## Information layers

Every structured detail uses:

1. MYTOWNによる30秒要約
2. 3分で背景まで
3. 原文・一次資料

Missing reasons, costs or decision links are shown as unconfirmed rather than filled
with guesses.

## Truthfulness rules

- モック用の架空の金額・期日・距離は本番UIへ入れない。
- 「あなたの近く」は、現在地との距離を確認できない段階では距離を表示しない。
- 予算額は構造化・検算できるまでは「連携準備中」とする。
- 市議会の一般的な流れを示す図と、個別事業で公式に確認できた意思決定経路を混同しない。
- 市議会の基本ラベルは「審議・採決」とし、「市議会が常に提案主体」と誤解させない。

## Fixed mascot asset

`assets/mascot/machinavi.webp`

SHA-256:

`e9101ee36c0cc1cb1533a43ace20408151377c7a16344e09b0d414903c57f375`

CI checks this hash. UI changes must not silently replace the approved mascot.

## Architecture

Existing pipeline remains unchanged:

`official sources -> fetch -> normalize -> verify -> public JSON -> UI`

UI v2 is an additive presentation layer:

- `ui-v2.js`
- `ui-v2.css`
- `assets/**`

It loads after the existing `app.js`, `politics.js`, and election UI, so the existing synchronized data and political pages remain available.
