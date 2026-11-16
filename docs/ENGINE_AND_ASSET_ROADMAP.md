# Wild Trails — Engine, Art & Gameplay Roadmap

This document explains how the supplied repositories fit the current game and separates code that is already in the browser build from work that still needs a dedicated implementation.

## Current runtime

The production-style browser build in `public/snake-evolution.html` is a single HTML module using Three.js 0.180.0. It has two play styles: the original 2D grid mode and a 3D free-roam mode. The current art/level branch already contains six environments (garden, street, station, home, night forest and kitchen), procedural 3D animal rigs, food pickups, temporary abilities, and map-specific scenery.

The game remains browser-first in this branch. Godot is not mixed into the Three.js runtime. That avoids introducing two competing renderers, input systems, collision systems and asset pipelines into one page.

## Changes in the evolution branch

- Separate gold collectibles from food. Food increases score and replenishes movement energy; gold coins are independent world pickups used by the animal shop.
- Add a movement-energy meter. Running gradually consumes energy and eating restores it; low energy reduces speed but never immobilizes the player.
- Add daily missions for eating, collecting coins, exploring distance and time played. Mission progress, XP and claimed rewards persist separately.
- Add four purchasable character variants: fox, rabbit, turtle and penguin. Existing character indexes and the legacy `wild-coins`, `wild-owned` and `wild-best` storage keys are retained.
- Add ambient wildlife that moves through the active map, with lightweight animation and flee reactions when the player approaches.
- Add biome/diet-aware food meshes and increase the 3D food density.
- Add a separate collectible coin to the classic 2D mode as well as the 3D mode.
- Add obstacle knockback, a brief dizzy overlay, camera shake/roll and synthesized impact audio. The outer world boundary now repels the player instead of immediately ending the round.
- Add browser-generated pickup and coin sounds, initialized from the Start interaction to respect browser audio gesture restrictions.
- Daily mission time and distance progress also update in Classic mode; the movement-energy meter is hidden there because grid mode does not use the 3D movement-energy mechanic.

## Supplied repositories — intended use

| Resource | What it is | How it fits this project |
| --- | --- | --- |
| [3D-Machine-Learning](https://github.com/timzhang642/3D-Machine-Learning) | A curated research/resource index covering 3D reconstruction, point clouds, meshes, shape understanding and related datasets. It is not a game-engine plugin. | Use it as a research map when selecting a future asset/reconstruction workflow. Evaluate each model, dataset and license separately before adopting anything. |
| [Godot Engine](https://godotengine.org/) | A complete open-source engine with 2D/3D rendering, physics, animation, audio, input, scene tools and native exports. | A possible future engine migration, not a drop-in add-on for this Three.js page. A serious migration must port movement, maps, cameras, character rigs, collisions, HUD, save data and exports, then prove parity before replacing the browser build. |
| [3DDFA](https://github.com/cleardusk/3DDFA) | A research implementation for dense 3D face alignment/reconstruction and pose estimation on human faces. | Not suitable for the game's snake or animal bodies. Reconsider only if the game later adds human-like avatar faces and the model/runtime/license requirements are acceptable. |
| [3d-game-shaders-for-beginners](https://github.com/lettier/3d-game-shaders-for-beginners) | An educational shader collection/tutorial with lighting, surface, post-processing and screen-space concepts. | Use the concepts to author original Three.js/WebGL effects such as rim lighting, fog, dissolve, glow and impact feedback. Do not copy a Panda3D-specific shader into Three.js without porting and testing it. |
| [godot-shaders](https://github.com/gdquest-demos/godot-shaders) | Example shaders authored for Godot's shader language and rendering pipeline. | Use after a Godot migration, or translate selected ideas into original GLSL/Three.js shader code now. Godot shader files are not directly executable by Three.js. |
| [ai-game-devtools](https://github.com/Yuan-ManX/ai-game-devtools) | A discovery/catalog repository for AI-assisted game-development tools and asset workflows. | Use it to compare tools for concept art, textures, 3D assets, animation, sound and QA. It is not a runtime dependency or a single game-development framework. |

## Next production phases

### Phase A — gameplay quality
- Verify movement at keyboard, touch, joystick and different aspect ratios.
- Tune food density, spawn safety, movement energy drain/refill, coin spawn rate and store prices.
- Add hit recovery, shield feedback, camera shake, eating animations and clearer collision feedback.
- Add accessibility settings and reduced-effects mode for weaker phones.

### Phase B — world and asset quality
- Author a consistent art bible for each biome before adding more geometry.
- Replace high-value hero characters and signature props with reviewed, optimized GLB assets.
- Use procedural geometry for floors, walls, ceilings, collision and simple repeated props; reserve generated meshes for distinctive characters and hero objects.
- Review every map from the actual gameplay camera, including spawn/respawn safety, walkable routes, boundaries and collision silhouettes.
- Add animal behaviors only where they improve play: ambient wandering, flee/chase, feeding and habitat-specific movement.

### Phase C — online multiplayer
Online play is not implemented by the current standalone HTML game. It needs an authoritative session service, not just a client-side lobby. The target design is:
1. Create/join room and choose Race, Eat Others or Collect Points.
2. Ready state for each player and host-controlled Start.
3. One server-owned 3-2-1 countdown and a shared match start timestamp.
4. Server validation of positions, collisions, food/coins, score, winner and disconnects.
5. Persistent player profile, owned skins and currency through an authenticated backend.

The server protocol and backend must be selected and load-tested before advertising online multiplayer.

### Phase D — Godot evaluation and migration gate
Build a small Godot prototype with one animal, one map, mobile joystick, camera, collision, food, coin and save/load. Compare frame time, input latency, web export size, mobile compatibility and development effort against the current Three.js build. Migrate only if the prototype clearly wins and all existing game loops have a planned port.

## Persistence and compatibility

The legacy browser save keys are deliberately preserved:
- `wild-coins` — current soft currency balance.
- `wild-owned` — indexes of unlocked characters. New characters are appended after the original 13.
- `wild-best` — best score.

New profile XP and daily mission data use separate versioned keys. Any later server migration should import these values once, validate them server-side and avoid resetting player balances.

## Automated checks

A GitLab CI job runs `scripts/validate-game.mjs` on branch pushes and merge-request pipelines. It checks inline module syntax, required game modes/maps/characters, separation of food and gold rewards, progression hooks, the 3D movement-energy hook, wildlife/hit feedback, shader usage and legacy save keys.

These checks are static source validation. They do not replace browser runtime QA, mobile-device testing, visual review or performance profiling.

## Release gate

This branch is an isolated GitLab working copy. The repository README states that the live Vercel site still deploys from the original GitHub repository and that GitLab changes do not automatically deploy there. Do not claim a production release until the branch is reviewed, synchronized with the actual Vercel-connected source, tested on desktop and mobile, and explicitly deployed.

Minimum manual QA before release:
- Start and finish each mode without console errors.
- Confirm food changes score/energy but does not silently create currency.
- Confirm 3D and 2D gold pickups award currency exactly once.
- Buy a new skin, reload, and verify the balance and ownership persist.
- Complete/claim each daily mission, reload and verify claims do not repeat.
- Check all six maps for food/coin spawns outside obstacles and inside playable bounds.
- Verify NPCs, pickups, joystick and HUD on a low-end mobile device.
- Verify obstacle and world-edge knockback, dizziness, audio behavior and recovery.
