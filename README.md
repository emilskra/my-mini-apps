# my-mini-apps

A small workshop of single-purpose web apps — plain HTML, CSS and JavaScript, no build step.

**Live:** https://emilskra.github.io/my-mini-apps/

## Apps

| App | What it does |
| --- | --- |
| [Matches](matches/) | Train willpower with William James's matchbox exercise — take out 50 matches one by one, bring them back, and log what tried to stop you. |
| [Floor Planner](floor_planner/floor-planner.html) | Drop in a floor plan, calibrate the scale, and arrange furniture at real-world sizes before moving a single thing. |
| [Resume Typesetter](resume_builder/) | Fill in your details on the left, watch a LaTeX-style résumé typeset itself on a letter page on the right, then print straight to PDF. |
| [Forethought](forethought/) | Twelve small games that train planning habits — saying “I don't know”, asking dumb questions, going to the source, Occam's razor, pre-mortems, second-order thinking, solving backwards, Chesterton's fence and more. |

## Structure

```
/                  root landing page (routes to each app)
/matches/          the matches app
/floor_planner/    the floor planner app
/resume_builder/   the resume typesetter app
/forethought/      the forethought thinking games
```

## Adding an app

1. Create a new folder at the root (e.g. `my-app/`) with its own `index.html`.
2. Copy one `<li>` in the Projects list in the root `index.html`, point it at the new folder, and update the name and description.

The list is plain markup rather than JavaScript-generated, so it still renders with scripting disabled and is visible to crawlers.

Everything uses relative paths, so each app works both locally (open the file) and under the GitHub Pages project path.

## Hero art

The landing page ships three art-directed crops of `assets/background.jpg`, each cut from the
illustration's native height and encoded as AVIF with a JPEG fallback:

| Crop | Files | Used when |
| --- | --- | --- |
| 3:2 | `hero-wide-{768,1152,1536}` | landscape viewports |
| 4:5 | `hero-mid-{576,819}` | portrait tablets |
| 9:16 | `hero-tall-{432,576}` | phones |

`assets/background.jpg` stays as the `<img src>` fallback. To regenerate after replacing the
illustration, crop centred with `sips -c <height> <width>` and encode with
`sips -s format avif -s formatOptions 62`.

## Deployment

GitHub Pages serves the `main` branch from the repository root. Pushing to `main` publishes the site.
