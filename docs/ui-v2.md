# MYTOWN UI v2 — Watercolor / Citizen-first

## Goal

MYTOWNの同期済み公式データ・政治透明化機能を残したまま、ホームを「政治アプリ」ではなく「直方の暮らしアプリ」として再構成する。

## Home information architecture

1. Watercolor hero — MYTOWN / 直方市 / 暮らしから、まちがわかる。
2. Four entrances — 近くを見る / 使える制度 / まだ間に合う / 誰が決めた？
3. Civic flow — 暮らし → 市役所 → 市議会（審議・採決）→ 決定・実行
4. Dashboard — 場所 / 募集・期限 / 次の市議会 / お金 / 市報 / まちナビ
5. Bottom navigation — ホーム / さがす / 調べる / お知らせ / メニュー

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
