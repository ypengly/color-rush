# 🏁 Color Rush: Ball Race

> **Pick your favorites. Start the race. Watch the chaos.**

Color Rush is an automatic ball-racing game. You never steer anything: add your racers, press **START RACE**, and watch up to 20 colorful balls tumble down a 5,000-pixel physics canyon of pegs, ramps, spinning bars and bumpers. The first ball across the checkered line wins.

Every race is different. Starting slots, launch velocities, spinner phases and random boosts are drawn fresh from a seeded random generator, and nothing about a ball's name, color or list position can influence the outcome.

## Gameplay

1. Edit the lineup in the **Participants** panel (2–20 racers, any name, any color).
2. Press **START RACE**. A 3 · 2 · 1 · GO! countdown plays and the balls are released.
3. The camera follows the pack. The gold-outlined ball with the ★ label is the current leader, and a slim progress bar on the right edge of the arena shows every ball on the whole track.
4. When two balls fight for the line the race drops into slow motion with a "CLOSE FINISH!" banner.
5. The winner is announced with confetti, the full finishing order and finish times. Press **RACE AGAIN** for a new race with fresh random conditions.

### The track ("Rush Canyon")

| Section | What it does |
|---|---|
| A. Peg field | A plinko board that scatters the pack. |
| B. Zig-zag ramps | Eight alternating ramps with bumpers; balls drop through a 160px gap at the end of each. |
| C. Spinners | Six rotating bars that fling balls around. Their start angle and direction are randomized every race. |
| D. Bumper cluster | Springy bumpers that kick balls sideways. |
| E. Funnel | Squeezes everyone into a 200px opening before the finish line. |

Every opening is at least three ball-diameters wide (balls shrink as the field grows), so a ball can never be blocked from finishing. A stuck-ball nudge and a 120-second failsafe cover the freak cases.

## Features

- Fully automatic race simulation with real-time, fixed-step physics (gravity, drag, friction, restitution, ball-ball and ball-obstacle collisions, rotating obstacles).
- 2–20 participants with editable names and colors, live ball previews, duplicate-name and duplicate-color validation, add / remove / **RESTORE DEFAULTS**.
- Controls: START RACE, PAUSE / RESUME, RESTART, SOUND ON / OFF and SPEED 1× / 2× / 4×. Conflicting controls are disabled for the current state.
- Glowing balls with spin markers, trails, spark bursts on impact, flashing bumpers, animated spinners, a finish-line flash and confetti.
- Name labels with automatic overlap avoidance, a live leader chip and live standings.
- Photo-finish slow motion and a "PHOTO FINISH!" tag in the results when the gap is under 0.15s.
- Synthesized sound effects (collisions, boosts, countdown, victory), so no audio files are needed.
- Results with winner, finishing order, per-ball finish times and basic stats. The most recent race is kept for the browser session.
- Responsive layout, keyboard-accessible controls, ARIA labels, and `prefers-reduced-motion` support (no trails, sparks, confetti, slow motion or camera easing).
- The race auto-pauses if the tab is hidden, and the canvas follows window resizes and pixel-density changes.

## Screenshots

Screenshots are not committed. To add yours:

1. Run the game (`npm run dev`) and capture the setup screen, a mid-race moment and the winner modal.
2. Save them in `docs/screenshots/` (for example `setup.png`, `race.png`, `winner.png`).
3. Reference them here:

```md
![Setup](docs/screenshots/setup.png)
![Racing](docs/screenshots/race.png)
![Winner](docs/screenshots/winner.png)
```

## Technologies

- [React 18](https://react.dev) + TypeScript for the interface
- [Vite 5](https://vitejs.dev) for dev server and production builds
- HTML Canvas 2D for rendering
- A custom, dependency-free physics engine (circle / capsule collisions, rotating obstacles, seeded PRNG)
- WebAudio for synthesized sound
- [Vitest](https://vitest.dev) for tests

> **Why not Matter.js?** The course is a vertical drop built from circles and line segments. A purpose-built engine keeps the simulation small, deterministic for a given seed, and runnable without a browser, which is what makes the engine unit-testable in Node.

## Installation

Requirements: **Node.js 18 or newer** and npm.

```bash
cd color-rush
npm install
```

## Development and production

```bash
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # type-check and build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # TypeScript only
```

## Tests

```bash
npm test           # run the whole suite once
npm run test:watch # watch mode
```

The tests cover the race logic independently of the UI:

- `tests/race-engine.test.ts`: races with 2, 5, 10 and 20 balls; nothing moves before `start()`; every ball moves after the start; a winner is detected correctly and results are ordered; balls never leave the arena; the same seed gives the same race; the engine stops completely after the race ends; a restart (new engine) resets everything; a statistical fairness check across 240 races.
- `tests/participants.test.ts`: defaults, add / remove limits (2–20), duplicate and invalid names and colors, sanitizing.
- `tests/utils.test.ts`: time formatting and the seeded random helpers.

Pause / resume lives in the React hook (the loop simply stops stepping the engine), so verify it manually: press PAUSE mid-race, the balls freeze and a PAUSED overlay appears; RESUME continues from the same state.

## File structure

```text
color-rush/
├── public/favicon.svg
├── src/
│   ├── components/            # React UI
│   │   ├── Header.tsx         #   title + subtitle
│   │   ├── ParticipantEditor.tsx  # add / remove / rename / recolor + validation messages
│   │   ├── BallPreview.tsx    #   glossy CSS ball
│   │   ├── RaceArena.tsx      #   canvas, resize handling, leader chip, overlays
│   │   ├── RaceControls.tsx   #   start / pause / restart / sound / speed
│   │   ├── Countdown.tsx      #   3, 2, 1, GO!
│   │   ├── Leaderboard.tsx    #   live standings, final results, last race
│   │   └── WinnerModal.tsx    #   winner, confetti, finishing order, RACE AGAIN
│   ├── game/                  # everything below is UI-free
│   │   ├── RaceEngine.ts      #   race state machine, fixed-step loop, finish detection, results
│   │   ├── Ball.ts            #   ball creation, per-ball random traits, launch and boost
│   │   ├── Physics.ts         #   constants, integration, contact and impulse math
│   │   ├── CollisionSystem.ts #   ball vs walls / pegs / ramps / spinners, ball vs ball, events
│   │   ├── Track.ts           #   the course layout and world size
│   │   ├── RaceRenderer.ts    #   canvas drawing, camera, trails, particles, labels, minimap
│   │   ├── AudioManager.ts    #   synthesized sounds
│   │   ├── participants.ts    #   roster rules, defaults, validation
│   │   └── results.ts         #   statistics and session storage of the last race
│   ├── hooks/useRace.ts       # engine + renderer + audio + the single animation loop
│   ├── types/game.ts          # shared types
│   ├── utils/                 # random.ts (seeded PRNG), formatTime.ts
│   ├── styles/global.css
│   ├── App.tsx
│   └── main.tsx
├── tests/                     # vitest suites
├── docs/screenshots/          # put your screenshots here
├── index.html  package.json  tsconfig.json  vite.config.ts  .gitignore
```

### How it fits together

`RaceEngine` is a plain class: `start()` releases the balls, `advance(dt)` accumulates time and runs fixed 1/240s physics steps, and it returns events (collisions, boosts, finishes, winner). `useRace` owns one `requestAnimationFrame` loop that scales real time by the chosen speed and photo-finish slow motion, feeds `advance`, forwards events to the renderer and audio, and publishes state to React. The loop is created once and cancelled on unmount, so loops never stack.

## Customizing

### Ball names and colors

- In the app: edit the **Participants** panel (names up to 20 characters, any color picker value).
- Defaults: edit `DEFAULT_ROSTER` in `src/game/participants.ts`. Colors added automatically come from `COLOR_PALETTE`, and extra names from `EXTRA_NAMES` in the same file.
- Limits: `MIN_PARTICIPANTS` / `MAX_PARTICIPANTS` in `participants.ts` and `MIN_BALLS` / `MAX_BALLS` in `RaceEngine.ts`. Keep them in sync (and note the track is tuned for up to 20 balls).

### The track

Open `src/game/Track.ts`. Pegs, bumpers, ramps and spinners are added with the small helper functions `peg()`, `bumper()`, `ramp()` and `spinner()`; the five sections are labelled A to E. World constants (`WORLD_WIDTH`, `FINISH_Y`, `FLOOR_Y`, `WORLD_HEIGHT`) are at the top of the file.

Rules to keep every race finishable:

- Keep every gap at least 3 × the largest ball diameter (≈ 110px for the biggest balls) and inclined surfaces at least ~8° so balls don't stall.
- Keep `FINISH_Y` above `FLOOR_Y`, and `FLOOR_Y` below `WORLD_HEIGHT`.
- After changes, run `npm test`: the suite simulates full races and fails if a ball cannot finish.

### The physics

Open `src/game/Physics.ts`:

| Constant | Effect |
|---|---|
| `GRAVITY` | Overall speed of the race (the main knob for race length). |
| `AIR_DRAG` | Terminal-velocity softening. |
| `ROLL_FRICTION` | How much balls slow down while rolling on ramps. |
| `PAIR_RESTITUTION`, `WALL_RESTITUTION`, `BUMPER_RESTITUTION`, `BUMPER_KICK` | Bounciness of ball-ball, walls and bumpers. |
| `REST_THRESHOLD` | Below this impact speed balls stop bouncing and settle. |
| `FIXED_DT` | Physics step; smaller is more accurate and more expensive. |

Randomness lives in `src/game/Ball.ts` (`createBall`, `launchBall`, `boostBall`): per-ball restitution and drag, the initial velocity, and the boost frequency and strength. All balls draw from identical distributions. Race pacing for the end of the race is controlled by `FINISH_GRACE` and `MAX_RACE_TIME` in `RaceEngine.ts`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails or `vite` is not found | Use Node.js 18+ (`node -v`), delete `node_modules` and `package-lock.json`, run `npm install` again. |
| Port 5173 already in use | `npm run dev -- --port 3000` |
| Blank page | Open the browser console. A missing-canvas message means the browser lacks Canvas 2D support (use a current Chrome, Firefox, Safari or Edge). |
| No sound | Click **SOUND** to make sure it says ON, and start the race with a click (browsers block audio until you interact). Check the device is not muted. |
| Choppy animation | Lower the browser zoom or window size, close heavy tabs, or use 1× speed. The simulation is fixed-step, so race results do not depend on frame rate. |
| Trails, confetti or slow motion are missing | Your OS has "reduce motion" enabled. That is intentional. |
| START RACE is disabled | A participant has an empty, too-long or duplicate name, or a duplicate color. Fix the highlighted rows. After a race, press RESTART or RACE AGAIN. |
| Lineup can't be edited | Editing is locked while a race is running or showing results. Press RESTART. |
| `npm test` can't find vitest | Run `npm install` first (vitest is a dev dependency). |

## License

MIT. Do whatever you like with it.
