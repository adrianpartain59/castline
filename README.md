# Castline

**AI UGC hook ads that look like a friend filmed them.** A 3-second selfie
reaction from a person who doesn't exist, a hard cut into a real screen
recording of the app, platform-native hook text and a sound bed. Every take is
a different person in a different room.

This repo is a demo of the UGC pipeline we built and run in production, dressed
up on a fictional brand: **Tempo**, a running app (the same fictional app as
[Tenfold](https://github.com/adrianpartain59/tenfold)'s demo). The cast, the
footage and the brand are all made up.

## What's in it

| Part | Where | What it does |
| --- | --- | --- |
| Casting + prompt engine | `src/engine/` | The production creative core, ported to TypeScript. Deals cast members from identity decks (heritage × bone structure × colouring × one distinguishing mark), so N takes are N different people. Writes the still and motion prompts deterministically: no language model, every take stores the exact prompts it came from. |
| Compositor | `src/compose/`, `src/tempo/`, `src/audio/` | Composes a finished ad in the browser: reaction, hard cut to an animated Tempo screen, native text styles, a synthesized or uploaded sound bed, and a 1080×1920 export. |
| Landing page | `src/pages/Landing.tsx` | One ad that rotates through takes, how it works, the five rules every prompt obeys, the cast. |
| Demo studio | `src/pages/Studio.tsx` | The production tool's five-step flow (cast & direction → stills → clips → compose → ads), on pre-rendered footage. Text, sound, the app screen and timing are live. |

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL. `npm test` runs the engine and compositor tests.

## Demo mode

Nothing in the demo calls a paid model. Stills and clips were rendered ahead of
time from the prompts the studio shows; the studio plays the real pipeline's
stages and reveals them. Until the footage library is rendered, the studio
draws a stylized placeholder in its place (`src/demo/footage.json` maps each
cast member and setting to its clip).

## Production library

The cast, stills, clips and finished ads on the site are the real ones from
the production UGC Lab, imported read-only by
`scripts/import/import-ugc-lab.cjs` into `public/library/production/` and
`src/demo/production.json` (web-sized: 720-wide H.264, JPEG stills). Takes the
lab never animated show as "Still only" in the studio. Without the import the
site falls back to the engine-dealt Tempo cast below.

## Rendering the footage library

`scripts/render/` runs the production pipeline over the cast: a portrait per
cast member, posed stills generated against that face, then a 4-second
image-to-video clip per approved still. `src/demo/plan.ts` decides which takes
exist, and the site reads the same plan, so the two never disagree.

```bash
npm run render
```

That prints the plan and the cost and spends nothing. Each paid stage needs
`--live` and a ceiling, and only works on what a person approved in the stage
before it:

| Step | Command |
| --- | --- |
| Portraits (Gemini) | `npm run render -- portraits --live --max-usd 3` |
| Look and approve | `npm run render -- review`, then `npm run render -- approve portraits all` |
| Stills (Gemini, 2 per take) | `npm run render -- stills --live --max-usd 10` |
| Pick one per take | `npm run render -- approve stills <key>=<n> …` |
| Clips (Higgsfield Kling 3.0 Pro) | `npm run render -- clips --live --max-credits 260` |
| Ship it | `npm run render -- publish` |

`--only <castId,…>` renders a subset (try one person first). Clips spend
Higgsfield plan credits through a signed-in `higgsfield` CLI; every clip is
priced live before it is created, and a run over a quarter of the credits left
needs `--owner-ok`. `bash scripts/render/smoke.sh` runs the whole thing against
fakes.

## Built by

Adrian Partain and Lucas Bennett.
