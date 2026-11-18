# CourtCoach: youth edition

A coaching app for a 3rd–4th grade girls basketball team. It plans fair rotations, shows the girls where to stand and what to run, tracks game stats, and turns them into practice plans. It runs as a single web page published as a Claude artifact, so Claude features use the coach's own Claude account and data saves to that account.

## What it does

- **Team:** roster with avatars, and 1–4 skill ratings on 8 things you can see at this age (dribbling, passing, shooting, defense, rebounding, spacing, hustle, confidence). Each kid gets a best spot on offense and defense.
- **Game plan:** attendance, a fair-play rotation grid (everyone's shifts within 1), an auto-builder that spreads ball handlers and balances strength, Claude rotation suggestions, formations (5-Out, 4-Out 1-In, 2-1-2, 1-3-1, 2-3 zone, 1-2-2 zone, man-to-man), drag-to-adjust spots, per-kid tips, opponent scouting notes, and a printable US Letter game plan.
- **Game day:** live stat taps, subs, a period clock that beeps at the midpoint with the next "out / in" change, a timeout card built from live stats, and plays shown full screen in the huddle with results logged.
- **Plays:** 8 starter plays (Box, Stack, sideline V-cut, Diamond press break, Give and go, Pick and roll, free throws for both teams) that fill in automatically with the kids on the court. Animated steps with arrows, a play builder, Claude drawing plays from a description, and printable play cards.
- **Review:** score by shift, which groups and pairs work, player stats, which plays score, a Claude coach's report, and a positive parent recap for the group chat.
- **Grow:** skills heat map, who fits each spot, team focus drills, each kid's mission, weekly home challenges with a Home Hero badge, and Claude practice plans.

## Project layout

```
src/logic.js    coaching model: skills, roles, formations, rotation builder, game math, example team
src/plays.js    playbook engine, sub helper, timeout card, challenges, parent recap
src/app1-8.js   interface (Preact + htm): store and sync, tabs, dialogs, PDF export
src/styles.css  styles (light and dark)
assets/avatars.json  the 10 player avatars as small WebP images
build.py        joins everything into one page
dist/index.html the built page (what is published)
tests/          logic tests
```

## Build and test

```
python3 build.py          # writes dist/index.html
node tests/logic.test.js  # runs the logic tests
```

The page loads Preact, htm and jsPDF from public CDNs and fonts from Google Fonts. Saving, Claude, and file downloads use the Claude artifact runtime (`window.claude.use("db" | "user" | "sample" | "downloads")`). Opened as a plain file, the page still runs on an example team and saves to the browser only.

## Publishing

Publish `dist/index.html` as a Claude artifact and declare these capabilities: `db` (each coach's data is private under `data/users/<id>`), `user`, `sample`, and `downloads`.
