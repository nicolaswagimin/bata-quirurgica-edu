---
name: Bata Quirúrgica Edu
description: Quirófano menta — a calm mint-tiled operating room where every achievement is a small pixel tile set into the wall.
colors:
  bg: "#fffdf8"
  surface: "#f3efe4"
  ink: "#173a2f"
  muted: "#4c5d55"
  border: "#d9d1bf"
  band: "#a6e4c9"
  on-band-muted: "#2c4f42"
  tile: "#d3eee1"
  primary: "#0c6a4c"
  primary-strong: "#084e38"
  primary-soft: "#e2f5ec"
  seal: "#8a5a00"
  seal-soft: "#fbeed0"
  px-bronze: "#c7832a"
  xp: "#f2b705"
  xp-soft: "#ffefb8"
  streak: "#e4612a"
  success: "#1b7344"
  danger: "#b3362b"
  info: "#2a5db8"
  focus: "#173a2f"
  focus-on-primary: "#f2b705"
  gown: "#32718e"
  gown-trim: "#1d4b63"
  mask: "#b7d2ff"
  mask-shade: "#7f9fd0"
  glove: "#cbaf8b"
  glove-shade: "#a58a68"
  px-skin: "#c68a64"
  px-skin-shade: "#a46a47"
  px-hair: "#3b2a22"
  px-cheek: "#d9776a"
typography:
  pixel-headline:
    fontFamily: "Pixelify Sans, Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 600
  pixel-badge:
    fontFamily: "Pixelify Sans, Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
  headline:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.375
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.33
  figure:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.33
    fontFeature: "\"tnum\""
rounded:
  box: "4px"
  card: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.bg}"
  button-mission-cta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.primary-soft}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.bg}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  assistant-pill:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "6px 16px 6px 6px"
    height: "44px"
  assistant-pill-hover:
    backgroundColor: "{colors.primary-soft}"
  chip-xp:
    backgroundColor: "{colors.xp}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  chip-streak:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  chip-reward:
    backgroundColor: "{colors.xp-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 8px"
  chip-reward-mastered:
    textColor: "{colors.seal}"
    typography: "{typography.label}"
    padding: "6px 8px"
  code-badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    typography: "{typography.pixel-badge}"
    rounded: "{rounded.box}"
    padding: "2px 6px"
  progress-tile:
    backgroundColor: "{colors.primary-soft}"
    rounded: "{rounded.box}"
    size: "32px"
  progress-tile-done:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{rounded.box}"
    size: "32px"
  level-bar:
    backgroundColor: "{colors.primary-strong}"
    rounded: "{rounded.box}"
    height: "12px"
  mission-tile:
    backgroundColor: "{colors.primary-soft}"
    rounded: "{rounded.card}"
    size: "44px"
  mission-tile-current:
    backgroundColor: "{colors.band}"
    rounded: "{rounded.card}"
    size: "44px"
  mascot-bubble-band:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.card}"
    padding: "8px 12px"
  mascot-bubble-panel:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.card}"
    padding: "8px 12px"
  input-text:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "44px"
  nav-tab:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    height: "56px"
  nav-tab-active:
    textColor: "{colors.primary}"
  nav-pill:
    textColor: "{colors.on-band-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  nav-pill-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
  nav-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
---

# Design System: Bata Quirúrgica Edu

## Overview

**Creative North Star: "Quirófano menta"**

The app is a mint-tiled operating room: a calm clinical surface where every achievement is a small pixel tile set into the wall. The header and the home band are the mint wall, carrying deep-green ink; working panels are warm white, lifted off the band by a soft ink-tinted shadow; deep surgical green marks every button, link and current state. The student opens it on a mid-range phone for a three-minute session and should know, inside the first viewport, the one thing to do today.

Pixel art is the only ornament, and it is an accent, never the reading surface. Mission icons, the XP gem, the streak flame, the bronze medal, sparkles and the mascot are 16 px character grids drawn as crisp SVG, outlined in ink and coloured from the 3D model's gown, mask and glove. Everything a student reads is Atkinson Hyperlegible Next; Pixelify Sans only sets two-to-four-word headlines and badges. Dra. Menta, a pixel scrub nurse in cap, mask and gown with gloved hands held in the sterile posture, signs the one orchestrated moment of each screen.

The world replaces the retired "Libreta de prácticas" notebook (quadrille paper, margin rule, rubber stamp: all gone) and refuses the generic white health dashboard with a green accent. Content is separated by panels, hairline rules and type weight, not bordered cards.

Later stages, not yet built: the lesson illustrations of the "Aprende" section and the videos. They should follow the pixel-accent rules below (sprites on the tile wall, Dra. Menta as the only character) when they land.

**Key Characteristics:**
- Mint band with deep-green ink at the top of every screen; warm white panels lifted off it.
- Deep surgical green for every button, link, current tab and completed progress tile.
- Pixel sprites (16 px grid, ink outline, crisp edges) as the only ornament, always beside text.
- Gold XP and orange flame confined to chips, the level bar and sprites; bronze only for mastered.
- Atkinson for all reading; Pixelify Sans for short headlines and badges; Mono for figures.
- One orchestrated motion moment per screen, signed by Dra. Menta.

## Colors

A mint-and-deep-green clinical palette on warm white, with one bronze medal and a quarantined pair of game colours.

### Primary
- **Surgical Green** (`primary`): primary and secondary buttons, text links, the current tab (filled from md), completed progress tiles, the pixel code badge, the ring on today's mission tile, the mascot's signature. White text on it passes 4.5:1.
- **Deep Scrub** (`primary-strong`): hover/active fill of green controls and the level-bar track on the band.
- **Mint Wash** (`primary-soft`): hover fill on light controls, empty progress tiles (Faded Ink stroke), resting mission tiles, the mascot bubble on white panels, the tile-wall ground, the current ranking row, selection.

### Secondary
- **Mint Band** (`band`): the header and home band, the current mission's tile in the list. It carries ink, never white text.
- **Band Shade Ink** (`on-band-muted`): secondary text and inactive nav pills on the band only.
- **Tile Line** (`tile`): the 1 px lines of the 16 px tile wall behind pixel art.

### Tertiary
- **XP Gold** (`xp`): the XP chip, the level-bar fill, the XP gem and sparkles. Text on it is always ink.
- **Reward Cream** (`xp-soft`): the "+50 XP" reward chip on unmastered list rows.
- **Flame Orange** (`streak`): the pixel streak flame, always beside its number in text.
- **Medal Bronze** (`px-bronze`) and **Bronze Shade** (`seal`): the medal's body and shade; `seal` is also the text colour for mastered states ("+50 XP" on a mastered row, "Bata puesta" on AR results). Bronze, so mastered never reads as XP gold.
- **Bronze Wash** (`seal-soft`): defined and contrast-tested with `seal`, not yet used by a component.

### Neutral
- **Warm White** (`bg`): page, working panels, inputs, the assistant pill, the band's mascot bubble and streak chip.
- **Warm Sand** (`surface`): secondary panels (3D step text, AR/3D frames), row hover, the streak chip in the mission stats bar.
- **Scrub Ink** (`ink`): all body text and every sprite outline. Never pure black.
- **Faded Ink** (`muted`): meta lines, help text, inactive bottom tabs, input strokes.
- **Sand Rule** (`border`): hairlines between list and ranking rows, the bottom tab bar's top rule, the footer rule, the answer-feedback divider.
- **States** (`success`, `danger`, `info`): feedback. Danger also marks invalid input strokes.

### Sprite and canvas colours
`gown`, `gown-trim`, `mask`, `mask-shade`, `glove`, `glove-shade` come from the 3D model and are shared by the AR canvas, the 3D view and the sprites; `px-skin`, `px-skin-shade`, `px-hair`, `px-cheek` exist only for Dra. Menta. They are read through `var()` or `getComputedStyle`, never as UI fills. (`circulante-glove` and `circulante-cuff` are AR-canvas-only and omitted here.)

### Named Rules
**The Ink On Mint Rule.** The band carries ink (`ink`, `on-band-muted`, `primary-strong`), never white text.

**The Bronze Means Mastered Rule.** Bronze (`px-bronze`, `seal`) marks a mastered mission or a finished AR practice. It never decorates progress-in-flight and is never confused with XP gold.

**The Quarantined Game Rule.** Gold, cream and orange live inside chips, the level bar and sprites. The one non-game use of gold is the focus ring on green (`focus-on-primary`), a ring, not a fill.

## Typography

**Display Font:** Pixelify Sans (400–700, self-hosted woff2, OFL; falls back to Atkinson Hyperlegible Mono)
**Body Font:** Atkinson Hyperlegible Next (variable 200–800, self-hosted woff2, OFL; with ui-sans-serif, system-ui)
**Label/Mono Font:** Atkinson Hyperlegible Mono (variable 200–800, self-hosted woff2, OFL)

**Character:** A legibility face with an extrabold voice carries everything that is read; a pixel face, used in a handful of words, ties headlines and badges to the sprites.

### Hierarchy
- **Pixel headline** (Pixelify 600, 20 px mobile / 24 px md): "Nivel n" on the band, "¡Todas dominadas!", "Bata puesta" on AR results.
- **Headline** (Atkinson 800, 24 px, 1.25, -0.025em, balanced): page h1s (`pageTitle`); the home greeting is 20 px mobile / 24 px md.
- **Title** (800, 18–20 px, 1.375, max 24ch): today's mission title; 16 px extrabold for section titles such as "Misiones".
- **Body** (400, 16 px, explanations capped at 65ch): buttons, inputs, explanations; **Body-sm** (14 px, descriptions capped at 52ch) for descriptions, chips, the mascot bubble.
- **Label** (700, 12 px): tab labels, meta lines, reward chips.
- **Pixel badge** (Pixelify 600, 12–16 px, line-height 1): the mission code badge (M-02), XP badges in answer feedback and AR results, the level chip in the stats bar, the "— Dra. Menta" signature.
- **Figure** (Mono 700, tabular): inline codes in list rows, "xp / next", ranking positions (the first three in Surgical Green, never bronze, which means mastered), the AR score.

The scale is 12 / 14 / 16 / 20 / 24 / 32 px.

### Named Rules
**The Few Pixel Words Rule.** Pixelify Sans sets two-to-four-word headlines and badges only: never body text, buttons, inputs or navigation.

**The Mono Means Data Rule.** Mono is for codes and figures. Prose and headings never use it.

**The Extrabold Heading Rule.** Atkinson headings are 800 with -0.025em tracking; body stays at 400. No uppercase labels, no letter-spaced kickers.

## Layout

A single centred column (max 72rem, 16 px gutters on phones, 32 px from md) on a 4 px spacing base; steps in use are 4, 8, 12, 16, 24, 32, 40 px.

- **Phone (below 48rem):** the mint header and band run full-bleed; the greeting, streak and XP chips, then Dra. Menta (64 px) with her bubble under them, then the level bar. Today's mission panel follows full-bleed on warm white, then the mission list as plain rows. The bottom tab bar sits fixed in the thumb zone over safe-area padding; the footer reserves 80 px for it. The mission CTA is full-width.
- **From md (48rem):** the band extends 80 px further down and the 12-column content grid (32 px gap) is pulled up 48 px so today's mission panel (7 columns) and the list (5 columns) are lifted onto the band's edge. The CTA becomes auto-width with a 288 px minimum from sm (40rem).
- **Header:** 68 px tall; signed-in screens reserve 160 px on the left so the brand never slides under the fixed assistant pill; from md the row aligns with the content column.
- **Mission page:** a 48rem column; header with the 80 px tile-wall icon, h1, description, stats bar; questions on the working panel.

## Elevation & Depth

Flat surfaces with exactly two lifts, both ink-tinted, never gray. Depth means "a panel lifted off the mint band" or "a control floating over everything".

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgb(23 58 47 / 0.08), 0 12px 32px -12px rgb(23 58 47 / 0.28)`): working panels and the mission list from md, form panels, 3D/media frames, the mascot's bubble on the band. On phones the working panel drops the shadow and sits full-bleed.
- **Float** (`box-shadow: 0 2px 4px rgb(23 58 47 / 0.12), 0 12px 24px -8px rgb(23 58 47 / 0.35)`): the fixed assistant pill and its dialog, the AR results card and AR overlay controls.

### Named Rules
**The Two Lifts Rule.** Panels get `--shadow-sheet`, floating controls get `--shadow-float`. No third shadow, no hard offset shadows.

**The No Card In Card Rule.** Inside a white panel, nested surfaces use a flat mint wash (`primary-soft`), never another lifted white box (hence the mascot bubble's `panel` variant).

## Shapes

Three radii: **box** (4 px) for progress tiles, the level bar and the code badge, the near-square marks; **card** (12 px) for panels from md, tile-wall icon frames, list-row hover areas, inputs, mobile tabs, dialogs and the mascot bubble; **pill** (999 px) for every button, chip and header nav pill.

Pixel art keeps hard edges at every size (`pixelated`: `image-rendering: pixelated`, `shape-rendering: crispEdges`). Sprites are authored on a 16-cell grid (sparkle 7) with a 1-cell ink outline and sized in whole multiples where possible (16, 32, 48, 64 px).

The **tile wall** (`tile-grid`) is a 16 px grid of 1 px `tile` lines on `primary-soft`. It appears only behind pixel art: mission icon frames and the medal frame.

Borders belong to marks, not containers: 2 px progress-tile strokes (Faded Ink when empty, so the mark clears 3:1), the 2 px green ring on today's list tile, 1 px Faded Ink input strokes, Sand Rule hairlines between rows.

### Pictograms
UI chrome icons (tabs, arrows, checks, the ask icon) stay line pictograms on a 24 × 24 grid, 2 px stroke, round caps and joins, `currentColor`, `aria-hidden` beside a text label; the check inside a progress tile uses a 3 px stroke. Pixel sprites are the only filled imagery. Never emoji, never icon fonts.

## Components

### Buttons
Tactile, rounded, one primary per view.
- **Shape:** full pill (999 px).
- **Primary:** Surgical Green fill, white extrabold 16 px, 48 px min height, 24 px side padding; the mission CTA is 52 px tall with a trailing arrow pictogram.
- **Hover / Active:** fill shifts to Deep Scrub (180 ms); `:active` presses to 97 % scale (`pressable`, 120 ms `--ease-out`). Disabled drops to 60 % opacity.
- **Secondary:** warm white with a 2 px inset Surgical Green ring and green bold text, 44 px; hover to Mint Wash.
- **Danger:** Danger fill, white bold text, 44 px; hover to 90 % opacity.
- **Text links:** Surgical Green, bold, underlined with 4 px offset; hover to Deep Scrub.

### Chips and badges
- **XP chip:** XP Gold fill, ink Pixelify Sans 600 at 16 px (14 px in ranking rows), tabular figures, pixel XP gem before the number. Every XP badge on every screen is set this way.
- **Streak chip:** Warm White pill on the band (Warm Sand in the mission stats bar), ink bold, pixel flame before the number and "días de racha".
- **Reward chip:** Reward Cream with ink Pixelify Sans 600 12 px "+50 XP"; on a mastered row it loses its fill and turns Bronze Shade.
- **Code badge:** M-02 in Pixelify on a Surgical Green 4 px-radius badge, overlapping the bottom-right corner of the mission's tile-wall frame. Decorative (`aria-hidden`); the code is also given in text.

### Shell and Navigation
- **Assistant pill:** fixed 12 px from the top-left on every signed-in screen, warm white with Surgical Green extrabold text, Float shadow, hover to Mint Wash; focus uses the dual ring (gold outline, 2 px ink ring on the control).
- **Brand:** pixel gown sprite (28 px) beside "Bata Quirúrgica Edu" in extrabold.
- **One navigation landmark** (`aria-label="Principal"`; Inicio, Ranking, 3D, AR espejo, Perfil). Below md: a fixed bottom bar on 95 % warm white with backdrop blur and a Sand Rule top line; five equal 56 px tabs, pictogram over a 12 px bold label, Faded Ink inactive, Surgical Green active. From md: inline 44 px pills on the mint header, Band Shade Ink inactive, hover to Mint Wash with ink text, Surgical Green fill with white text when current (gold focus ring).
- **Skip link:** ink pill revealed on focus at the top-left.

### Home Band
The mint wall: greeting h1, streak and XP chips, Dra. Menta with her signed streak hint, then the pixel headline "Nivel n" with "xp / next" in mono and a 12 px level bar (Deep Scrub track, 2 px inset, XP Gold fill). Under the level bar sits the daily goal meter: "Meta de hoy x / 50 XP" in mono over a 8 px Deep Scrub track with a warm-white fill, plus "¡Meta de hoy cumplida!" once it fills.

### Mission Panel
Today's mission on warm white: the pixel mission icon (48 px, 64 px from md) on an 80 px (96 px md) tile-wall frame with its code badge, the extrabold title (no eyebrow), the muted description, a row of 32 px progress tiles (one per question; Mint Wash with a Faded Ink stroke when empty, 6.2:1, Surgical Green with a white check when answered correctly), a meta line that names the pass bar ("Necesitas 4 de 6 correctas para aprobar · +50 XP") or, once mastered, the stars and the record ("Misión dominada · récord 6 de 6"), the CTA. If progress cannot be read it says so instead of showing a false zero.

### Mission List
Rows separated by Sand Rule hairlines, each a three-column grid: a 44 px tile holding the 32 px pixel icon (Mint Wash; Mint Band with a 2 px green ring for today's mission) or, once mastered, the bronze medal on the tile wall; bold 14 px title over a 12 px meta line led by the mono code and, once mastered, its three stars; the reward chip. Rows hover to Warm Sand. Header: "Misiones" and "n dominadas de 5".

### Dra. Menta (signature)
The pixel scrub nurse (16 × 22 cells) in mint cap, mask, gown and gloves held in the sterile posture; she never shows a wrong technique. `MascotNote` places her (64 px) beside a 12 px-radius bubble of 14 px ink text with a rotated-square tail and a "— Dra. Menta" signature in Pixelify, Surgical Green. Two bubble variants: **band** (warm white with the Sheet shadow, on mint) and **panel** (flat Mint Wash, on white). `cheer` adds two gold sparkles. She appears once per screen, at that screen's orchestrated moment: the home band, answer feedback on a mission, the AR results, the all-mastered and profile-completion panels.

### Bronze Medal (signature)
A 16-cell sprite: green ribbon over a bronze disc with an ink outline. Shown at 36 px on the tile wall in mastered list rows, 80 px on AR results.

### Lives (signature)
Three 8-cell hearts in Danger red with an ink outline on the exam header, earned ones solid and lost ones at 25 % opacity. The label is always text ("2 de 3 vidas"): the third mistake closes the attempt.

### Achievements
Profile badges in a two-column grid of warm-white rows on sand: the 1 px primary ring marks an earned badge and the sprite loses all colour when pending. Six of them, always with title and description in text.

### Mission Stars (signature)
A 9-cell gold star with an ink outline, three per mission. Earned stars are full gold, the missing ones sit at 20 % opacity, and the score is always repeated as text ("2 de 3 estrellas") so colour never carries it alone. Used at 20 px in the mission rows and 28 px in the exam results.

### AR Mirror (camera)
Over the mirrored video: a status chip, the FPS chip and a camera-quality chip ("Cámara buena / regular / baja") top-left; the touch-free buttons top-right; the step stamps and the instruction low, over the legs. When the camera itself is the problem, one hint pill sits above the instruction (light, backlight, blur, framing). Never two hints at once, and never repeating the pose or the slow-device message, which have their own lines.

### Inputs / Fields
- **Style:** warm white, 1 px Faded Ink stroke, 12 px radius, 44 px min height, 16 px text, a real label above in 14 px medium.
- **Focus:** global ink 3 px ring, 2 px offset.
- **Error:** 2 px Danger stroke, `aria-invalid`, message below in Danger linked by `aria-describedby`.

### Focus
Every focusable gets a 3 px outline with a 2 px offset: ink on white and mint, XP Gold on green fills (`.on-primary`, the current nav pill). Floating controls that cross mint and white use the dual ring.

### Motion
1. **One orchestrated moment per screen.** Home: a newly mastered mission's medal assembles while the level bar settles (`animate-fill`, 320 ms delay, 607 ms `--ease-spring`, growing from `scaleX(.82)`). Mission page: answer feedback rises in (`animate-rise`, 8 px and opacity, 405 ms `--ease-spring`). AR: the medal assembles on the results card.
2. **The medal assembles, never scales.** `animate-medal` reveals the medal from its ribbon down with `clip-path` in `steps(8)` over 480 ms after 200 ms. It plays once per mission (seen IDs persist in `localStorage` under `bata.sealsSeen`).
3. **Durations and curves only as tokens.** Durations `--duration-press` 120 ms, `--duration-fast` 180 ms, `--duration-base` 240 ms, `--duration-spring` 405 ms, `--duration-gentle` 607 ms, `--duration-medal` 480 ms; curves `--ease-out`, `--ease-in-out`, `--ease-sheet`, `--ease-spring` (precomputed critically damped spring, no overshoot). `--ease-in-out` and `--ease-sheet` are reserved for future sheets and dialogs.
4. **Immediate press feedback.** `pressable` on every button, tab, list row and the assistant pill.
5. **Reduced motion.** Movement and transitions become instant; the medal keeps a 180 ms opacity fade; the press scale is removed.

### Named Rules
**The Steps Not Bounce Rule.** No curve overshoots. The only stepped animation is the medal, whose `steps()` reveal echoes the pixel grid.

**The Token Motion Rule.** No raw milliseconds or bezier values in components.

## Do's and Don'ts

### Do:
- **Do** put ink on the mint band and white text only on Surgical Green, Deep Scrub or Danger.
- **Do** give each screen one primary pill action, Surgical Green, at least 48 px tall, full-width on phones.
- **Do** keep pixel art an accent: sprites beside text, on the tile wall or the band, drawn with `PixelSprite` from character grids in `src/art/sprites.ts` mapped to colour tokens.
- **Do** outline every sprite in ink and keep crisp edges; reuse the 3D model's gown, mask and glove tokens for clothing.
- **Do** keep gold and orange inside chips, the level bar and sprites; put ink on gold.
- **Do** render every streak flame next to its number in text.
- **Do** let Dra. Menta sign only the screen's one orchestrated moment, with the `panel` bubble on white and the `band` bubble on mint.
- **Do** keep the assistant pill fixed top-left and exactly one `nav` landmark labelled "Principal".
- **Do** keep text pairs at WCAG 2.2 AA 4.5:1 and non-text marks at 3:1, and add new pairs to `apps/web/test/unit/contrast.test.ts` (it parses the `--color-*` tokens in `styles.css`).
- **Do** say "no disponible" when data cannot be read instead of showing a false zero.

### Don't:
- **Don't** set body text, buttons, inputs or navigation in Pixelify Sans.
- **Don't** put white text on the mint band.
- **Don't** use bronze for anything but mastered, or gold for mastered.
- **Don't** outline content containers with borders; separate with panels, rules and type, and never nest a lifted white box in a white panel.
- **Don't** use pure black, gray shadows, or a third shadow.
- **Don't** use emoji, icon fonts, third-party art or raster sprites.
- **Don't** bring back the notebook marks (quadrille paper, margin rule, rubber stamp).
- **Don't** add kickers or eyebrows, uppercase labels, or letter-spaced overlines.
- **Don't** animate from scale 0, add a second orchestrated moment to a screen, or use an overshooting curve.
- **Don't** use hex values in components; use the token utilities (`bg-primary`, `text-ink`, `bg-band`, ...).
