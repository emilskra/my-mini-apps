# my-mini-apps

A small workshop of single-purpose web apps — plain HTML, CSS and JavaScript, no build step.

**Live:** https://emilskra.github.io/my-mini-apps/

## Apps

| App | What it does |
| --- | --- |
| [Matches](matches/) | Train willpower with William James's matchbox exercise — take out 50 matches one by one, bring them back, and log what tried to stop you. |
| [Floor Planner](floor_planner/floor-planner.html) | Drop in a floor plan, calibrate the scale, and arrange furniture at real-world sizes before moving a single thing. |
| [Resume Typesetter](resume_builder/) | Fill in your details on the left, watch a LaTeX-style résumé typeset itself on a letter page on the right, then print straight to PDF. |

## Structure

```
/                  root landing page (routes to each app)
/matches/          the matches app
/floor_planner/    the floor planner app
/resume_builder/   the resume typesetter app
```

## Adding an app

1. Create a new folder at the root (e.g. `my-app/`) with its own `index.html`.
2. Add an entry to the `apps` array in the root `index.html` so it appears on the landing page.

Everything uses relative paths, so each app works both locally (open the file) and under the GitHub Pages project path.

## Deployment

GitHub Pages serves the `main` branch from the repository root. Pushing to `main` publishes the site.
