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

## Built by

Adrian Partain and Lucas Bennett.
