# Snake Evolution — Developer & Release Guide

## Product contract

Snake Evolution is a standalone game page served at `/snake-evolution.html` and launched from the Unlimited dashboard. Keep the existing Mرافعات تنفيذ جبري tile and route unchanged.

The first implementation is a playable vertical slice, not a claim that every planned production feature is complete. It contains:
- A classic grid-based Snake mode with keyboard and tap direction input.
- A Three.js WebGL open-world mode with a landscape-first UI, a third-person follow camera, separate movement/camera touch sticks, keyboard movement, food pickups, collectible coins, temporary speed pickup, obstacle toggle, and six selectable environment themes.
- Twelve skin catalogue entries, a local coin wallet, and local unlock persistence.
- A landscape orientation prompt on portrait mobile devices.

## Runtime and rendering

- Entry point: `public/snake-evolution.html`. This is intentionally a static page so it can run independently of the Next.js React tree.
- Renderer: Three.js `0.180.0` ESM, pinned to the jsDelivr CDN URL in the HTML. Do not silently change this to a floating `latest` URL.
- The 3D world is rendered from real-time WebGL geometry and materials. It is not a pre-rendered image, video, AI-generated background, or screenshot.
- Resolution: render at the browser's native CSS viewport size. Pixel ratio is capped at 1.5 to protect mobile GPUs; this is a deliberate quality/performance trade-off. Do not force 4K or uncapped devicePixelRatio on phones.
- Keep geometry low-poly, reuse materials where practical, keep shadow maps modest, and avoid per-frame allocations in hot loops.
- Preserve `powerPreference: high-performance`, ACES tone mapping, sRGB output, fog, and antialiasing unless device testing demonstrates a regression.
- Do not add heavy post-processing, large texture packs, physics engines, or large GLTF bundles without profiling on mid-range Android devices first.
- A CDN outage or blocked third-party module currently prevents the 3D mode from starting. Before a public commercial launch, bundle Three.js locally through the project's package manager and include a graceful WebGL/CDN failure screen.

## Controls and interaction

- Phone: landscape orientation. Left transparent joystick moves; right transparent joystick rotates the camera. Use Pointer Events and pointer capture; do not add touch-only handlers that break mouse input.
- Desktop: WASD / arrow keys move; dragging the 3D canvas with the mouse rotates the camera.
- Classic mode: WASD / arrow keys or tap a direction on the playfield.
- All buttons must remain usable without a gamepad. Do not block browser back/navigation or keyboard accessibility.

## Progression and persistence

- Current persistence is browser-local only: `localStorage` keys `se-coins` and `se-owned`.
- This is not secure or synchronized. Users can clear or edit local storage; purchases do not yet represent real money and must never be wired to payments without server-side ownership validation.
- Do not promise cloud saves, cross-device sync, accounts, leaderboards, anti-cheat, or server-authoritative currency until implemented and tested.
- Current skin list and prices are in the `skins` array. Keep the catalogue order and the free Nokia-style starter skin unless product requirements change.

## Performance acceptance targets

Test on a representative mid-range Android phone and a desktop browser:
- Stable, responsive gameplay; target 50–60 FPS on supported desktop hardware and a practical 30–60 FPS on mid-range phones.
- No unbounded object creation, event-listener duplication, or memory growth when switching modes repeatedly.
- No long main-thread stalls while collecting food or opening the shop.
- Keep the renderer pixel ratio capped; reduce shadow quality or decoration density before reducing gameplay responsiveness.
- Verify landscape and safe-area layouts on narrow phones and short landscape viewports.
- Verify WebGL unavailable / context lost / CDN unavailable states before public release.

## Required QA before Production

1. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
2. Open `/` and confirm both dashboard cards render and the existing legal study page still opens.
3. Open `/snake-evolution.html` directly and from the dashboard.
4. Test all six maps, both modes, obstacle on/off, all twelve skin catalogue cards, locked purchase with insufficient coins, successful unlock, and persistence after refresh.
5. Test phone landscape controls (both joysticks simultaneously), desktop keyboard/mouse, pause/resume, and switching from Classic to Open Map and back repeatedly.
6. Profile frame time, GPU memory, and CPU on an actual Android device. Do not infer mobile performance from desktop emulation alone.
7. Confirm no console errors, failed module requests, or missing assets.
8. Only after QA passes, merge the feature branch and deploy Production with explicit approval.

## Known gaps — do not describe these as finished

The current vertical slice does not yet implement:
- True endless chunk streaming / procedural world expansion.
- Unique fully rigged character animations and distinct follower models (eggs, chicks, kittens, cubs, fish trails, etc.) for every skin.
- The full species-specific food/feeding system, all power-ups, shield/invisibility/magnet abilities, or a balanced progression economy.
- Distinct handcrafted geometry and collision layouts for every map; map themes are an initial visual pass.
- Cloud save, account inventory, server-validated coins, analytics, leaderboards, sound/music settings, or accessibility settings.
- A fully polished Nokia 3100 sprite recreation and a complete game-over/restart flow.

Implement those as separately testable milestones. Do not disguise placeholder geometry as finished character art, and do not ship payment or competitive features on client-only state.
