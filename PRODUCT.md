# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences arrive on genuinely different paths, and future work must serve both without choosing one.

**Hiring-side evaluators** — recruiters, hiring managers, and potential collaborators, usually arriving from LinkedIn or a referral. They are sizing Emil up in a short visit: what does he build, how does he think, is this worth a conversation. Their exit is email.

**Curious builders** — other engineers and makers who landed on one of the apps (or, later, a post) rather than on the homepage. Their job is to *use the thing*; finding out who made it is a second, optional step they take only if the thing was good.

The site therefore gets read in both directions: top-down by someone evaluating a person, and bottom-up by someone who already met the work.

## Product Purpose

emiliskra.dev is Emil Agamamedov's personal site: the home and index for a growing set of small, self-contained web apps, a blog that is coming, and a direct way to reach him.

Success is that an evaluator leaves with an accurate, favorable read of how Emil builds — and that a visitor who came for one app finds the others and the person behind them.

## Positioning

The apps are the argument. Each one is a complete, live, usable artifact — not a screenshot, a case-study writeup, or a description of work done elsewhere. A visitor can open a matchbox and run a willpower exercise, calibrate a real floor plan, or typeset and print a résumé, without signing up for anything. A neighboring personal site can copy the layout; it cannot copy a roster of finished things that work on click.

## Operating Context

- Hosted at **emiliskra.dev** (`CNAME`), served by GitHub Pages from the `main` branch at repository root. **Pushing to `main` publishes the site** — there is no staging environment and no deploy pipeline.
- Everything uses relative paths, so every app works both opened as a local file and under the hosted path.
- Adding an app: create a folder at the root with its own `index.html`, then append an entry to the `apps` array in the root `index.html` so it appears on the landing page.
- Emil's real résumé data (`resume_builder/emil-resume.json`) is gitignored and stays local; the shipped app carries fictional sample data only.

## Capabilities and Constraints

**Shipped surfaces**

- Root landing page (`index.html`): hero, Projects list rendered from an inline `apps` array, Blog section, Connect section.
- `matches/` — "Vesta", William James's matchbox exercise for training the will: take 50 matches out one by one, bring them back, log what tried to stop you. Seven-day streak tracking.
- `floor_planner/floor-planner.html` — drop in a floor plan image, calibrate the scale, arrange furniture at real-world sizes. Persists multiple projects.
- `resume_builder/` — LaTeX-flavored résumé typesetter: fill fields on the left, a letter page typesets on the right, print straight to PDF. Multiple documents, JSON import/export.

**Constraints**

- **No build step.** Vanilla HTML, CSS, and JavaScript. No framework, no bundler, no npm install. Fonts load from the Google Fonts CDN; that is the only external dependency.
- **Fully static, no backend.** All app state lives in `localStorage`. There is no account, no server, no database, and nothing to sign up for.
- Each page must work both as a local file and hosted, which rules out absolute paths and origin-dependent APIs.

**Undecided**

- The blog has **no publishing mechanism yet** — how posts get authored, stored, and listed under the no-build-step constraint is an open decision, not a settled one.

## Brand Commitments

- Name: **Emil Agamamedov**. Domain: **emiliskra.dev**.
- **`assets/background.jpg`** — the painted illustrated landscape used as the hero — is a committed asset the current identity is built on. Preserve it.
- Contact channels in use: email `emilagamamedov@gmail.com`, LinkedIn `in/emilagamam`, Telegram `@emil_hacker`.
- **Not binding:** the apps' individually distinct visual worlds (the Vesta matchbox, the LaTeX typesetter chrome). Emil did not mark these as fixed — future work may unify them under one system or keep them separate on the merits.

## Evidence on Hand

**Real, usable now**

- Three working apps, listed above, each linkable and functional with no setup.
- Emil is a Software Engineer & Tech Lead with over 10 years of experience.
- Live contact channels (email, LinkedIn, Telegram).

**Absent — must never be fabricated**

- No published blog posts. The Blog section is honestly empty today.
- No testimonials, client names, employer names, case studies, press, or usage metrics.
- No screenshots or imagery beyond `assets/background.jpg`.

## Product Principles

1. **The artifact is the argument.** Ship working things and link straight to them. Never describe work that a visitor cannot open and use.
2. **Read it both ways.** Every structural decision has to survive a top-down evaluator and a bottom-up app visitor. Neither gets a lesser version of the page.
3. **Claim only what is true.** Emil is employed and content — open to interesting conversations, not running a job hunt. There are no posts, no clients, and no numbers yet. Honest placeholder beats invented proof.
4. **Nothing between the idea and the page.** No dependency to install, no build to run, no pipeline beyond a push to `main`. This constraint is load-bearing, not incidental.
5. **Built to absorb the next entry.** More apps are coming and the blog is going live. Structures should take the next item without a redesign.
