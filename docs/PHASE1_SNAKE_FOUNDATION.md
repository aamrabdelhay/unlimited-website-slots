# Wild Trails — Phase 1 Snake Foundation

## Scope
This change implements Phase 1 only. It does not add animal AI, new biomes, new hunting systems, multiplayer features, quality presets, save migrations, or a new runtime engine.

## Baseline inspected
- The playable 3D game is a Three.js module inside `public/snake-evolution.html`.
- The original snake body was a dynamic tube with 18 radial segments and a flat, single-color material. Its vertex buffer was rebuilt from the position history.
- The original snake head used a small group of ellipsoids, a static jaw and a static tongue.
- Existing camera input already supports orbit/drag, wheel zoom, a distance range, and smoothed follow.
- Existing 3D movement, obstacle handling, self-trail collision, food, abilities, score, coins, missions, local saves, and the Arabic RTL interface remain owned by the existing game.

## Phase 1 implementation
1. **Body geometry:** replace only the rendered snake trail with a 56-ring, 24-sided tapered mesh. The dynamic position buffer and cumulative-distance scratch buffer are allocated at creation and reused during animation.
2. **Deformation:** sample the existing gameplay path by traveled distance, use a stable transported cross-section frame, and add small motion-only undulation. The visual mesh never writes to player position, path history, collision radius, or score.
3. **Skin:** generate a seamless procedural scale color map and relief map in the browser. Use a physically based Three.js material with per-scale roughness and relief maps, subtle clearcoat and restrained bump; no new remote asset dependency is introduced.
4. **Head:** replace the snake's simple rendered head parts with a sculpted lofted skull, cheek forms, eye sockets, layered eyes with subtle gaze movement, nostrils, raised crown scales, an articulated lower jaw that opens downward, and a forked tongue rig.
5. **Animation:** animate head breathing, gaze/blink, slight turn response, jaw movement during feeding, and periodic tongue flicks. The animation is applied to a visual child rig, never the gameplay root.
6. **Camera:** retain the existing orbit, zoom and smoothed chase behavior; slightly lower the snake-only look target for better head/body framing.
7. **Garden:** retain the existing starting garden construction, pond shader, instanced grass, flowers, foliage, soft contact shadow and biome lighting rather than duplicating the environment system.

## Trade-offs
- The body and skin are procedural so they load locally and avoid unverified GLB dependencies; this is a strong browser foundation, not a final hand-sculpted production asset.
- Bump mapping is subtle and is not a substitute for real displacement or a high-resolution normal map.
- The body is a single dynamic mesh, so it avoids per-segment draw calls; normals still need to be refreshed after deformation.
- Browser/GPU testing is required to validate the actual appearance and shader compatibility on representative devices.

## Verification status
- The automated tests cover body-buffer reuse, finite curved-path deformation, taper, non-mutation of gameplay history, head animation bounds, feeding response and gameplay-root isolation.
- The existing game validator and multiplayer regression tests remain enabled by the current GitLab CI pipeline.
- Browser-rendered active gameplay, WebGL shader compilation on hardware, touch-device testing, persistence after reload and sustained FPS measurements must be reported separately; CI cannot establish these.
- No production GitHub source, GitLab `main`, Vercel deployment, save data or multiplayer server was changed by this Phase 1 commit.


## Lobby and boundary follow-up
- Replaced the broken live-preview attempt with a single shared low-power renderer and one cached Three.js scene per character card. The loop runs only while the character selector is visible and releases cached preview geometry when the selector closes.
- Kept the existing portrait visible as a fallback until a live frame is drawn. Map thumbnails remain separate one-shot Three.js renders; their temporary scene geometry and materials are disposed after capture.
- Biome boundary markers remain decorative only and are generated once; the previous code accidentally generated duplicate pebble batches. They do not alter map bounds, movement, spawn positions or obstacle collision.
- Static validation now rejects the old missing-scene draw call and undefined-yaw rotation path; actual browser/GPU testing is still required.
