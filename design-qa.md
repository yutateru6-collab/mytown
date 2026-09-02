# MYTOWN home overview design QA

## Current iteration

- User reference: `29C15145-0CE4-4685-A650-C96099837D62(4).jpeg`.
- Design intent: preserve the reference's poster-like overview while using truthful, working HTML controls and a life-first information order.
- Required implementation: compact hero, four immediately scannable capability entrances, official-information question shortcut, and the civic path from daily life to decision.

## Required comparison

- Compare the reference and implementation at the same 390px first-screen state.
- Confirm the top explains what the app can do without relying on text baked into a raster image.
- Capture 390px/DPR3, 320px/DPR2, and 1440px/DPR1 in GitHub Actions.

## Final comparison

- The reference and the final 390px capture were placed side by side before release.
- The implementation keeps the source hierarchy: watercolor identity, primary capability menu, civic-process strip, then current information.
- The source's misleading proposal, voting, public-comment, progress, and unverified budget entrances were intentionally replaced with working life-first routes: nearby, deadlines, services, decision-making, and official-information questions.
- The mobile capability grid uses two columns instead of the reference's four tiny columns, keeping text readable and tap targets at least 44px.

## Automated and interaction checks

- Source Visual QA run: `33579610065`, artifact `mytown-visual-qa-33579610065-push`.
- Deployed Visual QA run: `33579630925`, artifact `mytown-visual-qa-33579630925-workflow_run`.
- QA run: `33579610024`; Pages deployment run: `33579610025`.
- Source and deployed 390px screenshots have identical SHA-256 hashes.
- 390px/DPR3, 320px/DPR2, and 1440px/DPR1 all report zero horizontal overflow and zero app console errors.
- Hero density is 4.29x at 390px/DPR3, 5.22x at 320px/DPR2, and 2.20x at desktop width.
- Live browser checks passed for all five capability routes and the civic-flow route.
- No P0, P1, or P2 findings remain. The 320px first viewport prioritizes the four primary action names; supporting copy and the question shortcut remain available by scrolling.

## Final Result

passed
