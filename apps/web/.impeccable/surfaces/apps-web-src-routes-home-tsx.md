---
version: 1
slug: "apps-web-src-routes-home-tsx"
primary_target: "apps/web/src/routes/home.tsx"
related_targets: ["apps/web/src/components/root-layout.tsx","apps/web/src/styles.css"]
---

# Surface brief: app shell + inicio (Libreta de prácticas)

Scope: replacement visual world for the whole web app; first build covers tokens (`styles.css`), self-hosted type, app shell (`root-layout.tsx`, assistant trigger) and `/` (`home.tsx`). Other routes inherit the tokens now and get their composition pass later. Visitor mode: Operate.

Audience/job: Colombian health student, daily ~3-minute session on a mid-range phone; open the app, know the one thing to do today, do it. Proof/content: real missions from Firestore, progress per mission, XP/level/streak from `/me`; sources cited from `content/**`. Constraints: assistant trigger stays fixed top-left (acceptance test), one `<nav aria-label="Principal">` with Inicio/Ranking/3D/AR espejo/Perfil, h1 "Hola, {nombre}", `xp-pill` test id, light mode, WCAG 2.2 AA, no new runtime deps (springs via CSS `linear()`/WAAPI), fonts self-hosted OFL.

Unresolved: no `lastActiveDate` or mission completion date in the API, so no "racha a salvo hoy" claim and no date on the seal until the API exposes them.

Approved proposal: `.impeccable/mocks/libreta/inicio.html` (user answered "si" on 2026-11-02). Deliberate deviations from it: assistant trigger stays fixed top-left (e2e acceptance test + blueprint) instead of a bottom-right FAB; five tabs including "AR espejo" (e2e clicks it in the navigation); no "~3 min" or per-mission source line (no such data fields); no "racha a salvo hoy" and no date on the seal (the client profile has no lastActiveDate or completion date); 3D practice for M-03 is an inline text link, not a second button.

## Direction contract

THESIS: Learning is filling your clinical practice notebook: today's mission is the open page, each mastered competency is inked, each finished mission is stamped. Refuses the category default of a stack of identical mission cards on a green-and-white health UI.

OWN-WORLD: Ballpoint-blue shell (#1F3FB0) over white paper; quadrille grid (#DCE7F5) and a red margin rule only on the open page; ink #16225C never pure black; violet rubber-stamp seal (#6A3FB5) for mastered missions; gold XP lives only inside chips and the level bar; the orange flame only beside its number. Atkinson Hyperlegible Next for UI, its Mono only for codes and figures (M-02, 140 / 200). Line pictograms, 2px stroke, 24 grid. No bordered cards: rules and type separate content.

STORY: The student sees their name, level progress and streak, understands which mission is open today and how far along it is (n of 6 boxes inked), taps one button to continue, and sees the rest of the notebook index with stamps on what they mastered.

FIRST VIEWPORT: Mobile: blue band with assistant pill fixed top-left, brand mark, h1 "Hola, {nombre}", streak and XP chips, level with a progress bar to the next level. Below, the open page on quadrille with margin rule: mission code at 48px mono, title 20px, six competency boxes, meta line, full-width "Seguir practicando" (primary action, thumb zone), source line. Then "Índice de misiones" rows. Bottom tab bar. Desktop: same band with the nav in it; open page (7 cols) beside the index (5 cols), both lifted onto the band edge.

FORM: Libreta de prácticas, position 3 of the re-roll grounded list. seed:bf6543f55e65f9b9. Signature move: the stamp landing on a mastered mission (underdamped spring, from scale 1.35 with 2px blur, never from 0), the single orchestrated moment per screen; everything else critically damped springs as `linear()` tokens; reduced motion cross-fades.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
