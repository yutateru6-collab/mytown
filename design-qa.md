# Design QA: トップ文言とイベント操作欄

## Evidence

- Source visual truth: `/workspace/scratch/24506b1a6a50/upload/IMG_8930.png` (946 × 2048, iPhone browser screenshot). The user marked the narrow, one-character-per-line event actions as the defect and requested removal of the home hero wording `よく見る地域：直方`.
- Browser-rendered implementation screenshot: `/workspace/scratch/mytown-event-actions-fixed-crop-390.jpg` (390 × 844).
- Combined comparison: `/workspace/scratch/mytown-event-actions-comparison.png` (780 × 844). The source was downsampled to 390 × 844 and placed beside the 390 × 844 browser capture; no density-dependent judgment was made.
- Local URL checked: `http://terminal.local:4173/`
- Viewports checked: 390 × 844 and 360 × 780 CSS px inside the responsive browser harness.
- State: event listing with the first event action group visible; home hero checked separately.

## Full-view comparison evidence

- The source screenshot shows each Japanese character forced onto a separate line inside a 56px grid column.
- The revised browser capture shows the action group spanning the full card width, with `保存する`, `カレンダー`, and `当日の変更を確認` rendered horizontally.
- The responsive harness adds desktop scrollbar chrome that is not present on the user's iPhone; this was treated as a harness artifact rather than app layout drift.

## Focused region comparison evidence

- The action region was measured directly. At 390px, the group is 321px wide; its three controls are 96px, 90px, and 144px wide, use `writing-mode: horizontal-tb`, and use `white-space: nowrap`.
- At 360px, the group is 291px wide and retains the same horizontal control widths and 42px control height without character stacking.
- The home hero contains no `.v2-tagline` and no exact `よく見る地域：直方` text.

## Required fidelity surfaces

- Fonts and typography: passed. Existing Japanese font stack, weights, line heights, and button type scale are preserved; action labels no longer wrap character by character.
- Spacing and layout rhythm: passed. The action group spans both card grid columns and wraps controls by whole button, preserving 8px gaps and the dashed separator.
- Colors and visual tokens: passed. No palette or semantic-color changes were introduced.
- Image quality and asset fidelity: passed. No image or icon assets were changed.
- Copy and content: passed. Only the requested home hero line was removed; event labels and source information are unchanged.

## Comparison history

- Earlier P1: event actions were auto-placed in the card's 56px icon grid column, producing vertical one-character labels.
- Fix: `.ca-event-actions` and `.ca-card-quality-warning` now span `grid-column: 1 / -1`; controls use `flex: 0 0 auto` and `white-space: nowrap`.
- Post-fix evidence: 390px and 360px browser measurements show full-width horizontal action groups; the combined screenshot shows the visible correction.

## Interaction and runtime checks

- Primary interaction tested: first event `保存する` changes to `保存済み` and receives the saved state class.
- Console checked: no application-origin errors; only unrelated Chrome extension metadata errors were present.
- `node scripts/test_event_ui.js`
- `node scripts/test_community_ui.js`
- `node scripts/test_garbage_ui.js`
- `node --check civic-actions.js`
- `python scripts/test_event_quality.py`
- `npm run build`
- `git diff --check`

## Findings

- No actionable P0/P1/P2 findings remain.

final result: passed
