# MYTOWN image-density design QA

## Source and reference capture

- User reference: `IMG_8911.jpeg`, iPhone in-app browser, approximately 355 CSS px wide at 2x density.
- Public implementation captured before the fix: `https://yutateru6-collab.github.io/mytown/`.
- Defect reproduced: the 180x101 hero and 64x85 mascot were enlarged far beyond their native raster sizes.

## Implementation capture

- GitHub Actions workflow: `.github/workflows/visual-qa.yml`.
- Required captures: `mobile-390` at DPR 3, `compact-320` at DPR 2, and `desktop-1440` at DPR 1.
- Each run stores viewport, hero-only, full-page screenshots, and `metrics.json` for 30 days.
- The workflow runs once against the pushed source and again against the deployed GitHub Pages site.

## Acceptance checks

- Hero source is at least 1560x820.
- Mascot and character art are at least 540x700.
- Every visible app image has enough decoded raster width for the tested device pixel ratio.
- No horizontal overflow or browser console errors.
- Reference and implementation are compared at the same first-screen state before release.

## Final Result

blocked
