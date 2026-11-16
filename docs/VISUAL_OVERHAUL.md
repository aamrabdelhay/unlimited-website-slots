# Wild Trails visual-overhaul review notes

This is an incremental browser Three.js pass, not a completed AAA overhaul. The game entry remains `public/snake-evolution.html`; no Godot runtime, production deployment or save migration is added. The new optional local module `public/wild-trails-art.mjs` provides biome-specific key and hemisphere lighting and speed/turn-aware animation blending. If it fails to load, the existing procedural visuals remain active.

## Art and rendering

Existing procedural coat textures and sculpted meshes remain. The penguin has an upright body, breast, articulated flippers and feet, and an eating jaw instead of the generic quadruped with duplicate add-ons. Turtle shell proportions are corrected. Actual player displacement drives gait; animation operates on the visual rig, not the collider. Body lean is applied relative to the authored torso rotation, never accumulated on the gameplay root. The trail records movement rather than repeatedly recording a stationary head position. These are targeted improvements, not a complete roster replacement.

The existing standard-material shader still provides procedural surface variation, foliage wind and Fresnel; its time uniform is now shared and Fresnel is applied before the standard output chunk. The garden water and ambient particle shaders remain separate. Shader source has not been compiled in a browser or validated on a GPU in this environment. No new external art assets were added. Existing runtime Three.js imports use jsDelivr; older optional model URLs remain in the source and require independent license and deployment review before use. Asset licensing and fully local dependency delivery are not complete.

The existing renderer chooses mobile/desktop pixel ratios and shadow resolution; the mobile shadow map is capped at 1024. This is not an adaptive benchmark and performance has not been measured. Existing world geometry and materials are not fully lifecycle-managed; renderer and memory profiling are still required.

## Validation and release

CI runs the existing static game validator and `node --test scripts/test-art.mjs`. These checks do not validate GLSL compilation, gameplay, rendered appearance, save persistence, touch or device performance. Before merging, manually test all maps, creatures, modes, spawns, controls, collisions, power-ups, save/reload and shader fallback on desktop and mobile; inspect screenshots and performance. The production GitHub file could not be accessed with the tools available in this session; no production comparison has been made. No GitHub, main branch or deployment changes are authorized by this pass.
