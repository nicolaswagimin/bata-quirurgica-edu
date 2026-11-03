---
version: 1
slug: "src-routes-home-tsx"
primary_target: "src/routes/home.tsx"
related_targets: ["src/components/root-layout.tsx","src/styles.css"]
---

# Surface brief: app shell + inicio (Quirófano menta)

Scope: replacement visual world for the whole web app (redesign 2026-11-03, replaces "Libreta de prácticas"). Tokens (`styles.css`), self-hosted type, app shell, inicio, misión, auth/forms, ranking, perfil, 3D and AR chrome. Visitor mode: Operate.

Audience/job: Colombian health student, daily ~3-minute session on a mid-range phone; open the app, know the one thing to do today, do it. Proof/content: real missions, progress, XP/level/streak from the API; sources from `content/**`. Constraints: assistant trigger fixed top-left, one `<nav aria-label="Principal">` with five tabs, h1 "Hola, {nombre}", `xp-pill` test id, light mode, WCAG 2.2 AA, no new runtime deps, fonts self-hosted OFL, pixel art authored in code (SVG grids), no third-party art.

User-pinned (2026-11-03): mint clinical green as the main colour, deep green for buttons and emphasised text, warm neutrals, gold XP accent; pixel art only as accent (mission icons, XP/streak badges, lesson illustrations, celebrations, AR final seal, mascot); Atkinson stays for content and buttons; Pixelify Sans only for short headlines and badges; mascot "Dra. Menta", a pixel scrub nurse in gown, cap and mask, who signs short encouragement lines. The notebook world (quadrille, margin rule, rubber stamp) is retired.

## Direction contract

THESIS: The app is the mint-tiled operating room: a calm clinical surface where every achievement is a small pixel tile set into the wall. Refuses both the notebook it replaces and the generic white health dashboard with a green accent.

OWN-WORLD: Mint band (#A6E4C9) carrying deep-green ink (#173A2F); deep surgical green (#0C6A4C) for every button, link and current state; warm white ground (#FFFDF8); working panels in the same warm white lifted off the band by a soft ink-tinted shadow (a sand panel under the mint band read muddy and lowered the progress tiles' contrast), warm sand (#F3EFE4) for secondary panels such as the 3D step text; gold XP (#F2B705) and a bronze medal (#C7832A body, #8A5A00 shade) for mastered, so mastered never reads as XP. Pixel sprites on a 16 px grid with crisp edges, outlined in ink, coloured from the 3D model's gown, mask and glove; a faint mint tile grid only behind pixel art. Atkinson Hyperlegible Next for all reading; Pixelify Sans for two-to-four-word headlines and badges. No bordered cards: panels, rules, type weight.

STORY: The student sees Dra. Menta greet them by name with their streak and XP as pixel badges, the one mission open today with its pixel icon and progress tiles, one deep-green button to continue, then the mission list where mastered missions carry a bronze pixel medal.

FIRST VIEWPORT: Mobile: mint band with the assistant pill fixed top-left and brand; h1 "Hola, {nombre}", pixel flame and XP badges, then Dra. Menta (64 px) with her signed bubble under them (beside the h1 she squeezed the greeting at 390 px), level bar on a deep-green track. Below on warm white: today's mission panel, pixel mission icon (48 px) on a tile with its code as a small pixel badge, title 20 px (no eyebrow), six progress tiles, meta line, full-width deep-green "Seguir practicando" in the thumb zone. Then "Misiones" list rows with 32 px pixel icons and the bronze medal on mastered ones. Bottom tab bar. Desktop: mission panel (7 cols) beside the list (5 cols), lifted onto the band edge.

FORM: Brief-pinned direction (the user specified palette, pixel-accent rule, font and mascot); the direction roll was run and its assignment yields to the pinned brief, as the contract rules require. Position 1 of 1. seed:e1fe0cf3f155861c. Signature move: the bronze pixel medal assembling from its ribbon down (steps() clip reveal, never from scale 0) on its mint tile when a mission is first shown as mastered, and the same medal closing the AR game; reduced motion cross-fades. Dra. Menta signs the one orchestrated moment of each screen (home band, answer feedback, AR results).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
