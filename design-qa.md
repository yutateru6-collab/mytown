# のおがた日和 hero design QA

## Scope

- Changed only the home hero: app name, catchphrase hierarchy, accent color, trust note, and mascot balance.
- Left every section below the hero unchanged.
- Did not implement the unselected `昨日から変わったこと` module.

## Visual target and rendered evidence

- Selected source visual: `/workspace/scratch/7378e1883a5d/generated_images/exec-b419898c-3b1f-4c29-b1a1-8a4c8defbe33.png`.
- Final rendered capture: `/workspace/scratch/nogata-hero-mobile-390-verified-1788422117255.jpg`.
- Same-state comparison: `/workspace/scratch/nogata-hero-comparison-verified.png`.
- Comparison viewport: 390 px wide, home route, default region setting, 9月3日(木).
- Compact check: 320 px wide, home route, default region setting.

## Fidelity review

| Surface | Result |
|---|---|
| Composition | App name and catchphrase keep the selected centered-right balance while the mascot anchors the left side. |
| Typography | `のおがた日和` is the primary mark; `知れば直方はもっとおもしろい！` is one level quieter and remains readable. |
| Color | Deep green remains the base; only `日和` uses the restrained rose accent from the selected visual. |
| Imagery | Existing watercolor scenery and mascot assets are preserved without stretching or replacement. |
| Spacing and responsive behavior | 390 px and 320 px captures keep all hero text visible with no collision between the title, controls, mascot, and trust note. |

## Iteration history

1. The first desktop pass let the mascot extend slightly above the hero. Its maximum width was reduced from 160 px to 140 px.
2. The first mobile pass made the app name too quiet relative to the selected visual. The 390 px wordmark was raised to 2.05 rem while the catchphrase stayed at 1.1 rem.
3. The first mobile pass placed the trust note behind the overlapping content sheet. Its stacking order was corrected so the entire note remains visible.
4. The final 390 px source and implementation crops were placed side by side and reviewed together.

## Interaction and regression checks

- `新着を見る` opens the new-information screen.
- The settings action opens the existing region and display-order settings screen.
- No application console errors were observed; browser-extension errors were excluded.
- JavaScript syntax, civic pipeline regression, source registry, election history, high-risk data, image density, UX contract, and `git diff --check` passed locally.
- Natural Japanese lint reported 0 findings for the hero copy.

final result: passed
