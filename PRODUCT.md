# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: estudiante / personal de salud en Colombia** (rol `student`). Uses the app daily during
  a course to master the correct use of the surgical gown and biosafety/sterility protocols. Short
  sessions, often on a mid-range phone; also uses the camera for the AR mirror. Every design
  decision is optimized for this user first.
- **Secondary: docente / administrador** (rol `admin`). Weekly: creates and validates questions,
  creates groups with a join code, reviews group progress.
- **One-off: director de tesis.** Validates the 30 seed questions and the donning step sequence
  before launch.

## Product Purpose

A gamified, Duolingo-style learning platform for surgical-gown use and biosafety. Learners
progress through short missions with quizzes (each answer explained and sourced), earn XP, levels
and streaks (Bogotá time), and compete on a real-time ranking (global and per group). They
practice the procedure in a step-by-step 3D mannequin, an in-browser AR mirror that overlays the
gown on their own body, and a "Ver en tu espacio" model-viewer. An AI assistant answers by text
and voice only from loaded regulations and cites every claim.

Success (v1): ≥ 3 missions completed per active user in the first two weeks of the pilot;
assistant p95 send→first token < 2.5 s; 100 % of the 30-question evaluation set answered with a
citation or a correct refusal; total cost < USD 20/month. It is a degree project operated by one
person.

## Positioning

Clinical rigor delivered through game mechanics: every quiz answer and every assistant reply is
traceable to a named regulation (OMS, CDC, Resolución 3100 de 2019), and the assistant refuses
rather than improvises. Practice is embodied (3D donning/doffing sequence, AR mirror on the
learner's own body) and fully private — camera frames never leave the browser.

## Operating Context

- Spanish (Colombia) only; Colombian healthcare training context.
- Five missions: fundamentos de bioseguridad y asepsia, tipos de bata y barreras, colocación de
  bata y guantes (técnica cerrada), campo estéril, retiro de la bata y lista de verificación OMS.
- Routes: login, registro (explicit Ley 1581 authorization), privacidad, créditos, inicio, misión,
  ranking, perfil (join group, delete account), bata-3d, bata-ar, bata-espacio, admin-preguntas,
  admin-grupos. Assistant pinned top-left on authenticated screens.
- AR mirror runs on the device's own camera with MediaPipe; an FPS monitor suggests switching to
  3D mode on weak devices.

## Capabilities and Constraints

- A mission is an exam, not a drill: each question is answered once (no changing it), the attempt
  is closed by the API and only counts when every question was answered, and it is approved at
  60 % correct. Mission XP (plus a perfect-mission bonus) is paid once, on approval; a failed or
  abandoned attempt pays 0 and a reply of an already-sealed mission is practice with no XP. Each
  mission keeps a 0–3 star record that a later attempt can improve. Missions unlock in order (the
  previous one must be sealed), each attempt has three lives, the day streak moves only on
  approval, and a daily XP goal resets at midnight in Bogotá.
- Web SPA only; no native app, payments, push notifications, offline mode, multilanguage, cloth
  physics, or dark mode in v1 (see blueprint Non-Goals).
- Clients never write to Firestore; all writes go through the API.
- Camera frames never leave the browser; no user uploads.
- Assistant conversations are not stored (data minimization, Ley 1581).
- The assistant is educational: it gives no clinical instructions for a specific patient and
  reminds users to follow their institutional protocol.
- EN 13795 and AORN are cited only as technical references, never ingested (copyright).
- Light mode only; respect `prefers-reduced-motion` (3D/AR animations included).

## Brand Commitments

- Name: **Bata Quirúrgica Edu**.
- Voice: **tú, cercano y motivador** — Duolingo-like warmth and brief celebrations in the UI, while
  clinical content stays rigorous, precise and sourced. UI copy in Spanish (Colombia).
- No institutional logo or university brand guidelines are binding.

## Evidence on Hand

- Own content only: 30 seed questions in `content/questions/seed.json` (status `draft`, pending
  validation by the thesis director), donning steps in `content/protocolos/bata-pasos.json`, KB
  sources in `content/kb/sources.json` (OMS, CDC, Resolución 3100 de 2019), asset credits in
  `content/credits.json`, privacy text in `content/legal/privacidad.json`.
- **Absent — never fabricate:** no pilot results, no testimonials, no partner institutions, no
  usage numbers, no claim that questions are validated.

## Product Principles

1. **Learner first.** Optimize for the daily student session on a mid-range phone; admin tooling
   is secondary.
2. **Every claim has a source.** Explanations and assistant answers cite a regulation; when there
   is no backing, say so.
3. **Motivation without frivolity.** Game mechanics (XP, streaks, ranking) drive habit, but never
   undercut the seriousness of sterile technique.
4. **Practice the body, not just the facts.** The 3D and AR modes are core learning, not extras.
5. **Private by design.** Minimal data, camera stays local, explicit consent.

## Accessibility & Inclusion

- Target: **WCAG 2.2 AA**. Contrast is enforced by `apps/web/test/unit/contrast.test.ts`.
- Visible focus ring; respect `prefers-reduced-motion`; streak/success colors never carry meaning
  alone (always paired with text). 3D hotspots are mirrored by accessible buttons.
