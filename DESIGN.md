---
name: Bata Quirúrgica Edu
description: Libreta de prácticas clínica — ballpoint-blue ink on quadrille paper, a violet stamp for every mastered mission.
colors:
  bg: "#ffffff"
  surface: "#eef3fb"
  grid: "#dce7f5"
  margin: "#f3a6a6"
  ink: "#16225c"
  muted: "#4a5a8a"
  border: "#c3d1ea"
  primary: "#1f3fb0"
  primary-strong: "#16225c"
  primary-soft: "#e3eaf8"
  on-primary-muted: "#dce7f5"
  seal: "#6a3fb5"
  seal-soft: "#efe8fa"
  xp: "#f2b705"
  xp-soft: "#fff3c4"
  streak: "#f2711c"
  success: "#1e7a4c"
  danger: "#c0352b"
  info: "#2563eb"
  focus: "#16225c"
  focus-on-primary: "#f2b705"
typography:
  code:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.05em"
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
  button-sheet-cta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
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
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.bg}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  chip-reward:
    backgroundColor: "{colors.xp-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 8px"
  chip-reward-sealed:
    textColor: "{colors.seal}"
    typography: "{typography.label}"
    padding: "6px 8px"
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
    textColor: "{colors.on-primary-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  nav-pill-active:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.bg}"
  competency-box:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.primary}"
    rounded: "{rounded.box}"
    size: "32px"
  seal:
    textColor: "{colors.seal}"
    rounded: "{rounded.pill}"
    size: "52px"
  index-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.card}"
    size: "44px"
  index-tile-current:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
---

# Design System: Bata Quirúrgica Edu

## Overview

**Creative North Star: "La Libreta de prácticas"**

The app is a clinical practice notebook. The shell is the ballpoint-blue cover; the content is white quadrille paper; today's mission is the open page, each correct answer inks one competency box, and every mastered mission gets a violet rubber stamp in the index. Ink is navy, never pure black. The student opens it on a mid-range phone for a three-minute session and should know, inside the first viewport, the one thing to do today.

Density is calm and operational: one open page, one primary action, one index. Content is separated by rules, type weight and the lift of a sheet, not by stacks of bordered cards. Game mechanics are present but quarantined: gold and orange live inside chips and the level bar, so the notebook itself stays clinical and legible.

The world refuses the category default of identical mission cards on a green-and-white health UI. Type is Atkinson Hyperlegible Next, self-hosted, chosen for legibility first.

**Key Characteristics:**
- Ballpoint-blue band over white paper; quadrille grid and red margin rule only on the open page.
- Navy ink for all text; violet only for the mastered stamp.
- Gold XP and orange flame confined to chips and the level bar.
- Mono only for codes and figures (M-02, 140 / 200).
- Line pictograms on a 24 grid, 2 px stroke; no emoji.
- One orchestrated motion moment per screen; everything else answers touch.

## Colors

A two-ink palette (ballpoint blue and navy on white paper) with one violet stamp and a quarantined pair of game colors.

### Primary
- **Ballpoint Blue** (`primary`): the shell band, primary buttons, links, competency box strokes, mission codes and the current mission's index tile. White text on it passes 4.5:1.
- **Navy Ink** (`primary-strong`, same value as `ink` and `focus`): hover/active fill for blue controls, the streak chip and the level-bar track on the band, the active header pill.
- **Blue Wash** (`primary-soft`): hover fill on light controls (assistant pill), selection backgrounds.
- **Band Mist** (`on-primary-muted`): secondary text and inactive nav pills on the blue band only.

### Secondary
- **Stamp Violet** (`seal`): the mastered-mission stamp and its sealed reward text. Nowhere else.
- **Stamp Wash** (`seal-soft`): reserved tint for sealed states; defined, not yet used by a shipped component.

### Tertiary
- **XP Gold** (`xp`): the XP chip on the band and the level-bar fill. Text on it is always navy ink.
- **Reward Cream** (`xp-soft`): the "+50 XP" reward chip in index rows.
- **Flame Orange** (`streak`): the filled streak flame, always beside its number in text.

### Neutral
- **Paper** (`bg`): page, sheets, inputs, the floating assistant pill.
- **Index Paper** (`surface`): hover fill for index rows and the resting tile behind pictograms.
- **Quadrille** (`grid`): the paper grid lines (mixed 70 % toward white) and the hairline rules between index rows and above the footer.
- **Margin Red** (`margin`): the 2 px vertical margin rule on the open page. Decoration only, never text.
- **Navy Ink** (`ink`): all body text.
- **Faded Ink** (`muted`): meta lines, help text, inactive tabs, input strokes.
- **Pale Rule** (`border`): dialog edges and scrollbar thumb.
- **States** (`success`, `danger`, `info`): feedback. Danger also marks invalid input borders.

### Named Rules
**The Quarantined Game Rule.** Gold (`xp`, `xp-soft`) and orange (`streak`) appear only inside chips and the level bar. The one sanctioned non-game use of gold is the focus ring on blue (`focus-on-primary`), which is a ring, not a fill.

**The Navy Not Black Rule.** No `#000` anywhere. Ink is navy; scrims are navy at 40 %.

**The One Stamp Rule.** Violet means "mastered." It never decorates, never marks progress-in-flight.

## Typography

**Body Font:** Atkinson Hyperlegible Next (variable 200–800, self-hosted woff2, OFL; with ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto)
**Label/Mono Font:** Atkinson Hyperlegible Mono (variable 200–800, self-hosted woff2, OFL; with ui-monospace, SF Mono, Menlo)

**Character:** A legibility face with a confident extrabold voice for headings, paired with its own mono sibling that reads like a printed form code.

### Hierarchy
- **Code** (Mono 700, 48 px, line-height 1, tight tracking): the mission code on the open page (M-02), in Ballpoint Blue.
- **Headline** (800, 20 px mobile / 24 px from md, 1.25, -0.025em, balanced): the band greeting h1 and "Nivel n".
- **Title** (800, 20 px mobile / 24 px md, 1.375, max 24ch): the open page's mission title; 16 px extrabold for section titles such as "Índice de misiones".
- **Body** (400, 16 px): buttons and inputs; **Body-sm** (14 px) for descriptions, capped at 52ch, and chips.
- **Label** (700, 12 px): tab labels, meta lines, reward chips.
- **Figure** (Mono 700, 12 px, tabular): inline codes (M-03) and figures such as "140 / 200".

The scale is fixed: 12 / 14 / 16 / 20 / 24 / 32 px plus the 48 px code size.

### Named Rules
**The Mono Means Data Rule.** Mono is for codes and figures only (mission codes, XP fractions). Prose and headings never use it. The stamp's lettering is the one typographic mark set in mono, because a rubber stamp is a printed code.

**The Extrabold Heading Rule.** Headings are 800 with -0.025em tracking; body stays at 400. No uppercase labels, no letter-spaced kickers.

## Layout

A single centered column (max 72rem, 16 px gutters on phones, 32 px from md) on a 4 px spacing base; steps in use are 4, 8, 12, 16, 24, 32, 40 px.

- **Phone (below 48rem):** the blue band runs full-bleed under the header; the open page follows full-bleed on paper, then the index as plain rows; the bottom tab bar sits fixed in the thumb zone over safe-area padding, and the footer reserves 80 px for it. The primary action is full-width.
- **From md (48rem):** the band extends 80 px further down and the content grid (12 columns, 32 px gap) is pulled up 48 px so the open page (7 columns) and the index (5 columns) are lifted onto the band's edge as two sheets. The page CTA becomes auto-width with a 288 px minimum from sm (40rem).
- **Header:** 68 px tall; on signed-in screens the left edge reserves 160 px so the brand never slides under the fixed assistant pill; from md the row aligns with the content column.
- Line lengths: descriptions 52ch, mission titles 24ch.

## Elevation & Depth

Flat paper with exactly two lifts. Depth means "a page lifted off the band" or "a control floating over everything"; nothing else casts a shadow. Shadows are navy-tinted, never gray.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgb(22 34 92 / 0.08), 0 12px 32px -12px rgb(22 34 92 / 0.25)`): the open page and the index from md, and the consent sheet. On phones the open page drops the shadow and instead closes with a 2 px Ballpoint Blue rule along its bottom edge.
- **Float** (`box-shadow: 0 2px 4px rgb(22 34 92 / 0.12), 0 12px 24px -8px rgb(22 34 92 / 0.35)`): the fixed assistant pill only.

### Named Rules
**The Two Lifts Rule.** Sheets get `--shadow-sheet`, the floating control gets `--shadow-float`. No third shadow, no hard offset shadows.

## Shapes

Three radii: **box** (4 px) for the competency boxes, the only near-square mark; **card** (12 px) for sheets from md, index rows' hover area, pictogram tiles, inputs, mobile tabs and dialogs; **pill** (999 px) for every button, chip, header nav pill, the level bar and the stamp.

Borders belong to the notebook's own marks: 2 px Ballpoint Blue competency boxes, the stamp's 3 px violet ring with a 1 px inner ring at 60 %, 1 px Faded Ink input strokes, the margin rule, and hairline Quadrille rules between index rows. Content containers are not outlined.

### Pictograms
Line pictograms on a 24 × 24 grid, 2 px stroke, round caps and joins, `currentColor`, always `aria-hidden` next to a text label. The completion check inside a box uses a 3 px stroke so it reads at 20 px. The streak flame is the one filled glyph. Never emoji, never icon-font glyphs.

## Components

### Buttons
Tactile, rounded, one per view.
- **Shape:** full pill (999 px).
- **Primary:** Ballpoint Blue fill, white extrabold 16 px, 48 px min height, 24 px side padding; the open-page CTA is 52 px tall with a trailing arrow pictogram.
- **Hover / Active:** fill shifts to Navy Ink (180 ms); `:active` presses to 97 % scale (see Motion). Disabled drops to 60 % opacity.
- **Text links:** Ballpoint Blue, bold, underlined with 4 px offset; hover to Navy Ink.

### Chips
- **XP chip:** XP Gold fill, navy extrabold 14 px, tabular figures, 8 × 12 px padding.
- **Streak chip:** Navy Ink fill on the band, white bold text, flame glyph before the number and the word "días de racha".
- **Reward chip:** Reward Cream with navy 12 px extrabold "+50 XP"; once the mission is sealed it loses its fill and turns Stamp Violet.

### Shell and Navigation
- **Assistant pill:** fixed 12 px from the top-left on every signed-in screen, white with Ballpoint Blue text, a 32 px blue disc holding the "ask" pictogram, Float shadow, hover to Blue Wash.
- **One navigation landmark** (`aria-label="Principal"`; Inicio, Ranking, 3D, AR espejo, Perfil). Below md: a fixed bottom bar on 95 % white with backdrop blur and a Quadrille top rule; five equal tabs, 56 px tall, pictogram over a 12 px bold label, Faded Ink inactive, Ballpoint Blue active. From md: inline 44 px pills inside the blue header, Band Mist inactive, Navy Ink fill when active or hovered.
- **Skip link:** navy pill revealed on focus at the top-left.

### Home Band
The blue cover: greeting h1, streak and XP chips, a one-line streak prompt in Band Mist, then "Nivel n" with the figure "xp / next" in mono and an 8 px pill progress bar (Navy Ink track, XP Gold fill).

### Open Page (Mission Sheet)
The signature surface. Quadrille paper (16 px grid) with a 2 px Margin Red rule 44 px from the left edge (72 px from md); content starts right of the margin. Stack: 48 px mono code, extrabold title, muted description, a row of 32 px competency boxes (one per question, inked with a check when answered correctly), a meta line ("2 de 6 correctas · +50 XP al completar"), the CTA. If progress cannot be read it says so instead of showing a false zero.

### Mission Index
Ordered rows separated by Quadrille hairlines, each a three-column grid: a 44 px pictogram tile (Index Paper, or Ballpoint Blue for today's mission) or the stamp; bold 14 px title over a 12 px meta line led by the mono code; the reward chip. Rows hover to Index Paper. Header shows "n selladas de 5".

### Seal (Stamp)
A 52 px violet ring rotated −12° at 90 % opacity, double-ringed, lettered "DOMI / NADA" in mono. Decorative (`aria-hidden`); the row's text carries "sellada".

### Inputs / Fields
- **Style:** white, 1 px Faded Ink stroke (3:1 against paper), 12 px radius, 44 px min height, 16 px text, a real label above in 14 px medium.
- **Focus:** global navy 3 px ring, 2 px offset.
- **Error:** 2 px Danger stroke, `aria-invalid`, message below in Danger linked by `aria-describedby`.
- **Checkbox:** 24 px with Ballpoint Blue accent.

### Focus
Every focusable gets a 3 px outline, 2 px offset. Navy on paper; XP Gold inside blue regions (`.on-primary`), except the phone tab bar, which sits on paper and reverts to navy. Floating controls that cross both blue and white use the dual ring: gold outline outside, a 2 px navy ring on the control, and the Float shadow retained.

## Motion

Motion follows Emil Kowalski's design-engineering guidance and Apple's fluid-interface guidance: responsive first, physical where it means something, and quiet everywhere else.

1. **One orchestrated moment per screen.** On home it is the stamp landing on a newly mastered mission (200 ms delay, 547 ms, `--ease-stamp`) while the level bar settles (320 ms delay, 607 ms, `--ease-spring`). The stamp plays once per mission: seen IDs persist in `localStorage` under `bata.sealsSeen`; without storage it lands on each visit. Everything else only responds to touch.
2. **Organic springs without a library.** Springs are precomputed damped-oscillator step responses expressed as CSS `linear()` tokens. `--ease-spring` (damping 1.0, response 0.30 s, settles in about 405 ms, no overshoot) is the default; `--ease-stamp` (damping 0.65, response 0.35 s, about 547 ms, peaks near 1.07) is the only bounce in the system, because the stamp is a physical impact. Interruptible UI uses CSS transitions (as `pressable` does) or WAAPI, which retarget from the current value; keyframe animations are reserved for one-shot entrances. *Rule for future surfaces:* no animation on keyboard-initiated or high-frequency actions (no WAAPI use ships yet).
3. **Nothing enters from scale 0.** The stamp lands from scale 1.35 with 2 px blur, rotating −20° to −12° and fading to 90 %; the level bar grows from `scaleX(.82)`. *Rule for future surfaces:* other entrances start at scale ≥ .95 paired with opacity.
4. **Durations and curves only as tokens.** Durations: `--duration-press` 120 ms, `--duration-fast` 180 ms, `--duration-base` 240 ms, `--duration-spring` 405 ms, `--duration-gentle` 607 ms, `--duration-stamp` 547 ms. Curves: `--ease-out` cubic-bezier(0.23, 1, 0.32, 1), `--ease-in-out` cubic-bezier(0.77, 0, 0.175, 1), `--ease-sheet` cubic-bezier(0.32, 0.72, 0, 1), `--ease-spring`, `--ease-stamp`. Animations: `animate-stamp`, `animate-fill`. `--duration-base`, `--duration-spring`, `--ease-in-out` and `--ease-sheet` are defined for future surfaces (sheets, dialogs) and not yet used by a component.
5. **Immediate press feedback.** The `pressable` utility scales to .97 in 120 ms `--ease-out` on `:active`, with background and color shifting over 180 ms. It is on every button, tab, index row and the assistant pill. Hover styles use Tailwind v4's `hover:` variant, which only applies under `(hover: hover)`; *rule for future surfaces:* hover-only affordances also require `(pointer: fine)`.
6. **Reduced motion means fewer and gentler, not zero.** Under `prefers-reduced-motion: reduce` the stamp becomes a 180 ms opacity fade to 90 %, the level bar does not animate, and the press scale is removed. Every state change (color, fill, opacity) still happens and stays visible; in the shipped CSS those transitions are instant, and the stamp fade is the one animated cross-fade kept.
7. **Changes persist until seen.** *Rule for future surfaces, not yet exercised beyond the seal:* a new XP gain or rank change stays highlighted until the user acknowledges it and is never re-animated. The seal already follows this: it lands once, then rests.

### Named Rules
**The One Bounce Rule.** `--ease-stamp` is the only curve that overshoots, and only the stamp uses it.

**The Token Motion Rule.** No raw milliseconds or bezier values in components; reference the duration and ease tokens.

## Do's and Don'ts

### Do:
- **Do** keep gold and orange inside chips and the level bar; put navy ink on gold.
- **Do** render every streak flame next to its number in text.
- **Do** give each screen one primary pill action, Ballpoint Blue, at least 48 px tall, full-width on phones.
- **Do** use quadrille paper and the margin rule only on the open page (and the consent sheet that opens the notebook).
- **Do** set mission codes and figures in Atkinson Hyperlegible Mono with tabular figures.
- **Do** draw pictograms on the 24 grid with a 2 px round stroke and pair each with a text label.
- **Do** keep the assistant pill fixed top-left and exactly one `nav` landmark labelled "Principal".
- **Do** keep every text pair at WCAG 2.2 AA 4.5:1 and non-text marks at 3:1, and add new pairs to `apps/web/test/unit/contrast.test.ts` (it parses the `--color-*` tokens in `styles.css`).
- **Do** keep targets at least 24 × 24 px (the shipped controls are 44 px or more).
- **Do** say "no disponible" when data cannot be read instead of showing a false zero.

### Don't:
- **Don't** outline content containers with borders; separate with rules, type and the sheet lift.
- **Don't** use pure black, gray shadows, or a third shadow.
- **Don't** use violet for anything but a mastered mission.
- **Don't** use emoji, icon fonts or filled glyphs other than the streak flame.
- **Don't** use system display faces or web fonts other than the self-hosted Atkinson pair.
- **Don't** add kickers or eyebrows, uppercase labels, or letter-spaced overlines.
- **Don't** animate from scale 0, add a second orchestrated moment to a screen, or use a bounce outside the stamp.
- **Don't** claim "racha a salvo hoy" unless `lastActiveDate` equals today's Bogotá date, and don't print a date on the seal: no mission completion date reaches the client.
- **Don't** use hex values in components; use the token utilities (`bg-primary`, `text-ink`, ...).

### Known gaps
- Shared class strings live in `apps/web/src/components/ui-classes.ts` (`buttonPrimary`, `buttonSecondary`, `buttonDanger`, `textLink`, `pageTitle`, `sheet`, `notebookCard`). Misión renders its questions on a `sheet` with answer feedback rising in (`animate-rise`, that screen's one moment); ranking is ruled rows with the top three positions in seal violet; login and registro are `notebookCard` pages; media frames (3D, AR, model-viewer) are borderless surfaces with `shadow-sheet`; 3D hotspot markers are primary, active in seal violet. Admin screens carry the tokens and shared buttons but no further composition pass.
- `lastActiveDate` reaches the client (optional in `ProfileSchema`, set optimistically after a correct answer), so the band says "Tu racha está a salvo hoy" when it matches today in Bogotá. No mission completion date reaches the client, so the seal carries no date.
