# Walk Cycle to the Polls — Project Context

## What this project is
**Walk Cycle to the Polls (WCTTP)** is an interdisciplinary civic art initiative at the Stamps School of Art & Design, University of Michigan. It bridges animation education, civic history, and non-partisan voter mobilization. Participants learn to create 8-frame walk cycle characters, submit them to a video game, and race their avatars to a virtual polling booth — then cast real ballots at early voting sites.

- **Project Lead:** Avery Lawrence (Stamps School of Art & Design, U-M)
- **Instagram:** @walkcycletothepolls
- **Live website:** https://www.walkcycletothepolls.com
- **GitHub repo:** https://github.com/averymlawrence/walkcycletothepolls.com (hosted via GitHub Pages)
- **Domain registrar:** GoDaddy — custom domain pointing to GitHub Pages via CNAME + 4 A records

## Key dates (Fall 2026)
- **Jun–Aug 2026:** Phase 1 — site build, game engine rebuild (EECS students under Austin Yarger)
- **Sept 14–18, 2026:** Democracy Week — public launch, workshops
- **Sept 15, 2026:** National Voter Registration Day — workshop at Ann Arbor District Library
- **Oct 28, 2026:** James Baxter master class for Stamps students
- **Oct 29, 2026:** James Baxter Penny Stamps Distinguished Speaker Lecture + live tournament at Michigan Theatre
- **Late Oct–Nov 2026:** Full game installations at UMMA and North Campus early voting sites

## Website file structure
```
/                          ← project root (also the git repo root)
├── CLAUDE.md              ← this file
├── CNAME                  ← "walkcycletothepolls.com" for GitHub Pages
├── index.html             ← Home page
├── about.html             ← About page
├── voting.html            ← Voting / Register to Vote (links to vote.org)
├── css/style.css          ← All shared styles
├── js/nav.js              ← Shared nav JS (hamburger + dropdown)
├── graphics/
│   └── logo-walk-cycle-to-the-polls.png   ← Main logo (black stamp on orange bg)
├── images/
│   └── Fuqua-Cal-WALK.2-transparent.gif   ← Walk cycle animation (homepage hero)
├── events.html            ← Events page (split out of about.html, Sept 2026)
├── walking/
│   ├── walk-cycles.html       ← How walk cycles work (8 positions, with reference photos)
│   ├── history.html           ← History of voting-rights marches (Selma, suffragettes, etc. — no longer Bonus Army/Labor Day)
│   ├── make-a-walk-cycle.html ← Wrapper page that iframes the tool
│   └── upload-walk-cycle.html ← "Contribute to the Game!" upload flow (added by a separate session)
└── tool/
    └── index.html             ← The pixel-art walk cycle animation tool, self-contained
```

## Nav structure (current)
Home | About | **Events** | Walking (dropdown: Walk Cycles / History of Walking / Make a Walk Cycle / Contribute to the Game!) | Voting

## Navigation structure
- **Home** | **About** | **Walking** (dropdown: Walk Cycles / History of Walking / Make a Walk Cycle) | **Voting**
- Instagram icon links to @walkcycletothepolls

## Design system
- **Colors (2026 refresh):** Teal `#4bcadb` (css var `--orange`, kept for back-compat), Teal-dark `#2f5669`, Coral `#ff564b` (css var `--purple`), Yellow `#ffcd00`, Charcoal `#565e62`, Cream `#f0f0f0`, Black `#111111`, White `#FFFFFF`. The var *names* `--orange`/`--purple` are historical — their *values* are teal/coral now. Matches the logo files in `graphics/WCTTP-logo-*.svg`.
- **Logo:** Use `graphics/WCTTP-logo-STANDARD.svg` for on-white/light placements (nav, hero, og:image) and `graphics/WCTTP-logo-White.svg` for on-black/dark placements (footer). Other variants available: `-Black`, `-MUTED`, `-White-2`. Older `graphics/WCTTP-logo-26-*.svg` and the `01 old versions LOGO` / `02 updated LOGO 2026` folders are superseded — do not reference them in new work.
- **Font:** Roboto (Google Fonts), weights 400/500/700/900
- **All CSS variables** defined in `:root` in `css/style.css`
- Fully responsive, mobile-first with hamburger nav at ≤768px
- Accessibility: skip links, ARIA labels, focus-visible styles, prefers-reduced-motion support

## How to deploy updates
```bash
cd "/Users/averylawrence/Documents/Stamps/Intro to Animation/Walk Cycle to the Polls WEBSITE 2026 - Claude"
git add <files>
git commit -m "description of change"
git push
```
GitHub Pages auto-deploys ~1 minute after push. No build step needed — pure HTML/CSS/JS.

## Fixes applied
- **Mobile nav black bar (RESOLVED)** — The root cause was `.nav-links` (position:fixed, hidden via `translateY(-110%)`) had its bottom edge sitting inside the nav bar, overlaying the logo and hamburger with a black background. Fixed by parking the closed menu at `top: -100vh` and animating to `top: var(--nav-height)` when opened. All `env(safe-area-inset-top)` and `viewport-fit=cover` approaches were red herrings — do NOT re-add them. The nav HTML uses a `<div class="nav-inner">` wrapper inside `<nav>` for layout; nav is `position: sticky; top: 0`.
- **Google Form cookie prompt** — Replaced embedded iframe on both `index.html` and `about.html` with a plain link button pointing to the Google Form URL. Do not re-embed the form as an iframe.
- **Homepage rolling hills** — Removed wavy SVG background from hero section.
- **Walk cycle tool** — Synced from Game folder; always copy from `/Users/averylawrence/Documents/Stamps/Intro to Animation/WCTTP Website/Walk Cycle to the Polls Game 2026 - Claude/index.html` to `tool/index.html` (note: both folders now live inside the `WCTTP Website` container folder). Also copy any new reference image folders. Currently in `tool/`: `walk_cycle_BASIC_reference_Williams/` (8 JPEGs), `4-frame_walk-cycles/` (4 JPEGs), `cartoon_walk_cycle_reference/` (8 JPEGs), and `human_walk_cycle_reference/` (8 JPEGs). GIF files in those folders do NOT need to be copied — tool only loads JPEGs.
- **Drawing canvas resolution** — `CANVAS_W`/`CANVAS_H` in `tool/index.html` are 800×800 (bumped from 400×400 in Sept 2026 to match the fixed 800×800 export size — drawing was previously upscaled 2x on export, causing extra pixelation).
- **Reference style selector (8-frame mode only)** — `REF_STYLES_8FRAME` in `tool/index.html` lets the user pick between `human` (default, Sept 2026) and `cartoon` reference overlays via a dropdown next to the Ref opacity slider. The old `williams` option was retired at Avery's request. 4-frame and 1-frame modes are unaffected and still use `REF_CONFIG`.

## Things still to do / pending decisions
- **Team/Collaborators section** on About page: removed for now, Avery needs to decide on attribution format before adding back. The full collaborator list is preserved in this file below.
- **Homepage animation:** Cal Fuqua's GIF is live. More student walk cycle GIFs can be added to `images/` and wired into the homepage hero strip.
- **Walk cycle tool submission flow:** Currently the tool lets users draw and export — future work is connecting it to a sprite database for game integration (Phase 1 EECS work).

## Full collaborator list (for future About page)
- **Avery Lawrence** — Project Lead, Stamps School of Art & Design. Oversees project execution, curriculum integration, design collateral, community workshop programming, civic partner coordination.
- **Austin Yarger** — Technical Advisor, EECS. Primary software engineering mentor for the student dev team rebuilding the game engine.
- **James Baxter** — Visiting Artist, James Baxter Animation. Legendary character animator (Disney, DreamWorks, Warner Bros.). Penny Stamps Distinguished Speaker Lecture + mini-tournament at Michigan Theatre, Oct 29 2026.
- **Kendra Baxter** — Project Assistant, James Baxter Animation. Manages logistics, scheduling, workshop coordination for the 5-day residency.
- **Chrisstina Hamilton** — Collaborator, Director of Penny Stamps Distinguished Speaker Series. Oversees visiting artist programming and venue logistics for the Baxters' residency.
- **Joel Snyder, PhD** — Audio Description Consultant. Global authority in media accessibility; will audit and refine game's sensory accessibility for blind/low-vision participants.
- **Jacob Robinson** — Game Developer (2024 version), recent U-M grad.
- **SC Klein** — Game Developer (2024 version), recent U-M grad.

## Walk cycle tool (previously built in separate session)
- Original location: `/Users/averylawrence/Documents/Stamps/Intro to Animation/Walk Cycle to the Polls Game 2026 - Claude/index.html`
- Copied into website at `tool/index.html`
- It's a self-contained pixel-art animation tool (936 lines of HTML/CSS/JS, no dependencies)
- The `make-a-walk-cycle.html` page embeds it via `<iframe src="../tool/index.html">`
