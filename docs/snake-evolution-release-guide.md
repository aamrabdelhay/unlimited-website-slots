# Snake Evolution — Developer & Release Guide

## Current release scope

Snake Evolution is a standalone game page at `/snake-evolution.html`, launched from the Unlimited dashboard. The existing Mرافعات تنفيذ جبري tile and route are preserved.

Implemented gameplay:
- **OLD IS GOLD:** grid Snake with Nokia-inspired pixel presentation, keyboard/tap direction input, six map palettes, optional obstacle blocks, score, coins, high score, and a restart/game-over flow.
- **OPEN MAP:** real-time Three.js WebGL third-person world with streamed chunks, follow camera, keyboard movement, mouse-look, independent mobile movement/camera joysticks, food collection, obstacles, self-collision, game-over/restart, speed boost, shield, and magnet power-ups.
- Six themed maps: garden, street, train station, home, night, and kitchen.
- Twelve unlockable creatures with procedural low-poly models and lightweight movement animation. Species with followers include bird nest/eggs, chicks, ducklings, owlets, falcon flock, kittens, fawn, crocodile eggs, lion cubs, and fish bubbles.
- Species-themed food (mouse, yarn, fish, seeds, worm, aquatic food, leaves, meat, etc.).
- Local coin wallet, skin ownership, and high score. Store can be opened/closed during a game without starting a new round.

## Runtime and rendering

- Entry point: `public/snake-evolution.html`, independent of the React tree.
- Three.js `0.180.0` is lazy-loaded from pinned jsDelivr and unpkg ESM URLs. The Classic mode remains available if WebGL module loading fails.
- The 3D world uses real-time WebGL geometry and materials, not AI-generated backgrounds, screenshots, video, or pre-rendered imagery.
- Pixel ratio is capped for mobile GPU stability. Do not force uncapped `devicePixelRatio`, 4K rendering, or heavy post-processing on phones.
- Procedural chunks are bounded around the player; distant geometry/materials are disposed. Keep world memory bounded.
- Upgrade Three.js only with a pinned version and verification on Android Chrome and desktop.

## Controls

- Phone: landscape orientation. Left joystick controls movement; right joystick rotates the camera. Both use Pointer Events and pointer capture.
- Desktop: WASD / arrow keys move; drag the 3D canvas with the mouse to rotate the camera.
- Classic mode: WASD / arrow keys or tap a direction on the playfield.
- Pause, speed boost, shield, store, restart, and return-to-menu controls are available.

## Progression and persistence

- Browser-local keys: `se-coins`, `se-owned`, and `se-best` in `localStorage`.
- This is not secure or synchronized. Users can edit or clear local storage; purchases do not represent real money.
- Real payments, valuable rewards, leaderboards, or competitive rankings require server-authoritative ownership/validation.
- Cloud saves, accounts, analytics, anti-cheat, and server-backed inventory are not included.

## Progress persistence (coins, creatures, best score)

- Progress is stored in three places and mirrored on every change: `localStorage` (`wild-progress-v2`), a cookie, and IndexedDB (`wild-trails-save`).
- Every saved record carries a `rev` counter that only grows when progress changes. On load the copy with the highest `rev` wins, so an empty or older copy can never overwrite newer progress.
- The one-time 2,000-coin gift is recorded in the record's `grants` list (`coins-2000-v1`) and is never applied twice. New one-time rewards should use a new grant id.
- Saves are per browser *origin*. Opening a different deployment URL (for example a Vercel preview URL) is a different origin with its own empty save; use the production domain.

## PWA

- `public/snake-evolution-pwa/manifest.webmanifest` and icons, plus `public/snake-evolution-sw.js`.
- The service worker is registered with scope `/snake-evolution.html`, so it only controls the game page, not the dashboard.
- The game page and local modules are network-first (releases appear immediately), three.js is cache-first, GLB models are stale-while-revalidate. The 3D engine is cached after the first online visit; Classic mode works offline from the first visit.
- The worker never touches `localStorage`, IndexedDB or cookies, so updating it does not affect saved progress.

## Verification

Run:
```bash
npm run typecheck
npm run lint
npm run test
npm run build
``

Manual game QA:
1. Open `/`, confirm both dashboard entries, and verify the existing legal study page remains available.
2. Open the game from the dashboard and directly at `/snake-evolution.html`.
3. Complete a Classic round: movement, food, obstacles on/off, collisions, game over, restart, and best score.
4. Test Open Map in all six environments: movement, camera, both touch sticks simultaneously, food, companions, obstacle collision, self-collision, power-ups, pause, restart, and menu.
6. Open and close the store mid-round; verify it does not reset the game.
7. Verify purchases, insufficient-funds feedback, and local progress after refresh.
8. Switch modes and restart repeatedly; check for listener duplication, stale animation loops, or retained chunks.
9. Test on a physical mid-range Android phone in landscape. Desktop emulation does not establish real mobile GPU performance.

## Remaining milestones

This is a substantial playable release, not a finished commercial game:
- Hand-authored landmarks and map-specific objectives/collision layouts; maps currently use themed procedural scenery.
- Commissioned production-grade 3D assets and individually rigged animation cycles; current models are generated from procedural low-poly geometry.
- Economy/difficulty balancing after playtesting.
- Sound/music, accessibility settings, analytics, cloud saves, account inventory, leaderboards, anti-cheat, and server-authoritative progression.
- Pixel-perfect hardware-accurate Nokia 3100 recreation; Classic mode is Nokia-inspired, not an exact reproduction.

Do not describe the remaining milestones as complete or connect real payments to the client-side wallet.
