# Design QA: 市政タブの市長・市議会ランディング

## Evidence

- Source visual truth: `/workspace/scratch/24506b1a6a50/upload/IMG_8932.jpeg` (710 × 1536). The black photo-viewer controls are outside the app design and were excluded from fidelity findings.
- Browser-rendered implementation: `/workspace/scratch/mytown-politics-reference-crop-390.jpg` (390 × 844).
- Side-by-side comparison: `/workspace/scratch/mytown-politics-comparison-route-fix.jpg` (780 × 844).
- Local URL checked: `http://terminal.local:4173/?qa=politics-reference#politics` through a 390 × 844 responsive harness.
- Responsive viewports: 390 × 844 and 360 × 780 CSS px. Browser density was 1 CSS px per captured pixel.
- State: the bottom navigation's `市政` destination immediately shows the mayor/council overview.

## Full-view comparison evidence

- The implementation follows the source order: `市政トップへ`, compact title block, `30秒でわかる`, two-column mayor/council comparison, three-step budget flow, pink next-council card, and `知りたいことから`.
- Mint mayor surface, pale-blue council surface, dark-green typography, pink meeting surface, rounded outlines, and fixed bottom navigation match the selected direction.
- The source is a photo-viewer screenshot with dark editor/download overlays; the implementation correctly omits those non-app controls.

## Focused-region comparison evidence

- The mayor panel uses the watercolor human illustration, `市長`, `大塚進弘`, the role explanation, and `2期目` in the same hierarchy as the source.
- The council panel uses the watercolor meeting illustration, `市議会`, `19人`, the role explanation, and `議長 田代文也` in the same hierarchy as the source.
- The three-step budget strip and the next-council card remain readable above the fixed navigation at 390px.
- At 360px, document `scrollWidth` equals the available document width (345px after the test harness scrollbar), so no horizontal app overflow was found.

## Required fidelity surfaces

- Fonts and typography: passed. Japanese sans-serif fallback, dark-green hierarchy, compact labels, large role/name numerals, and centered panel copy follow the source without clipping.
- Spacing and layout rhythm: passed. Header, comparison card, process strip, meeting card, and following section maintain the source's compact vertical sequence.
- Colors and visual tokens: passed. Mint, sky blue, blush pink, deep green, and blue role colors match the selected mock direction.
- Image quality and asset fidelity: passed. Both mayor and council use supplied transparent watercolor raster assets; no placeholder, emoji, CSS drawing, or handcrafted replacement is used for the people illustrations.
- Copy and content: passed. The visible role, person, seat count, chair, process, and meeting labels match the selected screen. Dynamic meeting dates remain sourced from current data.
- Icons: passed. Existing image assets are used consistently for the header, budget flow, and meeting card.
- Accessibility: passed. Mayor, council, meeting, and navigation destinations are semantic buttons with visible labels and practical tap targets.

## Comparison history

- Earlier P1: the requested mayor/council screen existed one level behind the generic civic portal, so tapping the bottom `市政` navigation did not show the selected design.
- Fix: `市政`, `市政をもっと知る`, and direct `#politics` routing now open the `people` overview first. `市政トップへ` still opens the broader civic portal, preserving access to budgets, decisions, and works.
- Post-fix evidence: from the home screen, tapping the exact bottom-nav `市政` button produced the `市長・市議会を知る` heading; reloading `#politics` produced the same screen.

## Interaction and runtime checks

- Bottom `きょう` → bottom `市政`: passed; the selected overview opens immediately.
- Mayor panel → mayor details → `市長・市議会へ`: passed.
- `市政トップへ` → broader civic portal: passed.
- Console: no application-origin errors.
- `node --check civic-portal.js`
- `python scripts/verify_ux_contract.py`
- `node scripts/test_event_ui.js`
- `node scripts/test_community_ui.js`
- `node scripts/test_garbage_ui.js`
- `npm run build`
- `git diff --check`

## Findings

- No actionable P0/P1/P2 findings remain.

final result: passed
