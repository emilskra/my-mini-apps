# my-mini-apps

A small workshop of single-purpose web apps — plain HTML, CSS and JavaScript, no build step.

**Live:** https://emilskra.github.io/my-mini-apps/

## Apps

| App | What it does |
| --- | --- |
| [Matches](matches/) | Train willpower with William James's matchbox exercise — take out 50 matches one by one, bring them back, and log what tried to stop you. |

## Structure

```
/            root landing page (routes to each app)
/matches/    the matches app
```

## Adding an app

1. Create a new folder at the root (e.g. `my-app/`) with its own `index.html`.
2. Add an entry to the `apps` array in the root `index.html` so it appears on the landing page.

Everything uses relative paths, so each app works both locally (open the file) and under the GitHub Pages project path.

## Deployment

GitHub Pages serves the `main` branch from the repository root. Pushing to `main` publishes the site.
