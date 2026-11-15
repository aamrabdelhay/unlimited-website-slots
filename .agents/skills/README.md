# Game development skills (project-local)

This directory contains a curated subset of [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills), selected for the Wild Trails / Snake Evolution game in this repository.

## Why this subset

The game is currently a browser game authored in `public/snake-evolution.html` with three.js loaded at runtime. The selected skills cover the actual work areas: engine routing, three.js scene setup and GLB animation, physically based materials and lighting, asset direction, UI/feel, camera/input, physics, performance, level design, procedural environments and shaders.

## Included skills

- `router`
- `threejs-scene-setup`
- `threejs-gltf-loading`
- `threejs-materials-lighting`
- `create-game-assets`
- `game-feel`
- `game-ui-ux`
- `camera-systems`
- `performance-optimization`
- `physics-tuning`
- `input-systems`
- `level-design`
- `procedural-gen`
- `shader-programming`

## Use

Start game-development work with `router/SKILL.md`. Detect the actual runtime engine and pinned three.js version before using any API. Keep the existing engine and dependency versions unless migration is explicitly requested. Load only the few skills relevant to the current task.

The source catalog describes these as Agent Skills and documents `.agents/skills/` as the project-level location for OpenAI Codex. They are retained here as project files so compatible coding agents can discover them. This does not train or permanently modify a hosted model.

## Upstream provenance

- Repository: https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- Branch: `main`
- Source commit checked: `c6ca6c41c839b68319ffc08430b99ab768debc32`
- Retrieved: 2026-11-15
- Upstream license: Apache-2.0; see `UPSTREAM-LICENSE-APACHE-2.0.txt`
- Only the listed skills were copied; this is not a mirror of all 79 skills.
