# Wild Trails — Visual Art Direction & Game Upgrade Brief

## Creative target
Create a high-end stylized 3D adventure game with realistic cartoon rendering. It should feel like a handcrafted animated world, not a flat children's toy, a low-poly prototype, or a photorealistic simulator. Build believable shapes, readable silhouettes, expressive faces, layered materials, natural lighting, and purposeful animation. Use original designs; do not imitate a named studio, game, movie, or character.

## Character overhaul
The roster currently contains multiple animal skins, including a snake/worm, cat, deer, crocodile, lion, panda, owl, bird/falcon, duck, fish, and small prey creatures. Preserve the current selectable roster and IDs.
- Give every species a distinct body plan and silhouette; do not make every animal a capsule with a different head.
- Use organic topology and clean transitions between head, torso, neck, limbs, joints, tail, ears, wings, fins, muzzle and belly.
- Use believable cartoon anatomy: slightly exaggerated head/eyes and readable facial expression, but natural weight, volume and articulation.
- Build separate materials and detail for fur, scales, feathers, skin, shell, beak, claws, hooves, whiskers, eyes and nose as appropriate.
- Use PBR-style base color, roughness, normal/bump and ambient-occlusion detail where practical. Keep the fine detail at texture level rather than making every scale or hair a high-poly object.
- Add idle, walk/run, turning, eating/pickup, hit/reaction, blink and species-specific motion. Snakes/worms undulate; birds flap; fish use tail/fin motion; quadrupeds have coordinated leg cycles.
- Ensure models face the same forward axis as the current movement code. Animation must not change collider size or shift the root unpredictably.
- Preserve the existing animation hooks or create an adapter so every skin can be swapped without breaking the game.

## Adventure world treatment
Each map should feel like a place with a clear visual story and depth. Add foreground, midground, distant silhouettes, landmarks, route choices, ambient movement, and map-specific light and atmosphere. Remove flat empty floors and repetitive primitive decoration.

### Garden / park
Lush layered grass, varied trees with shaped canopies, bushes, flowers, stones, a pond or stream, footpaths, bridges, benches, lanterns, fences and distant park scenery. Use rich sunlight and soft leaf shadows. Boundaries should be hedges, railings, rocks or dense foliage.

### City street
A lived-in street with varied building facades, shopfronts, windows, balconies, signs, canopies, street furniture, pavement, drains, road markings, traffic lights, parked cars and subtle urban wear. Buildings should have different heights and rooflines. Keep doors and sidewalks traversable; no solid building blocks where entry is intended.

### Train station
Make the track geometry, sleepers, ballast, rails, platforms and platform edge easy to read. Add roof canopy, pillars, lamps, signs, benches, ticket/utility structures and a properly sized train. Preserve safe platform paths and train hazard zones. The spawn must be on a clear navigable platform, not on a rail or against a boundary.

### Home
Create a believable warm interior with floor material, skirting, wall trim, windows, furniture, rugs, doors and ceiling/roof. Make the room actually feel enclosed. Use a camera/occlusion approach that lets the player remain visible without pretending the ceiling is absent.

### Kitchen
Use tiled or stone floor, cabinet runs, worktops, handles, sink, stove/oven, fridge, backsplash, utensils, shelves, hanging lights and kitchen clutter placed with intentional negative space. Keep doors, counters and collision volumes consistent. Include a ceiling and warm practical lighting.

### Night adventure / forest
A layered twilight forest with moonlight, mist, distant hills, bioluminescent plants, fireflies, crystals or glowing fungi, roots, rocks, and readable safe paths. Glow should illuminate nearby surfaces subtly rather than becoming flat neon.

## Materials and lighting
- Use a consistent art bible across all maps: controlled palette, roughness variation, edge highlights, soft contact shadows, ambient occlusion, tone mapping and map-specific fog/sky.
- Distinguish wood, stone, concrete, metal, glass, leaves, fabric, ceramic, fur and scales by actual material response, not just hue.
- Avoid excessive gloss, pure white surfaces, flat ambient light, hard black outlines, or uniform saturation.
- Add depth through lighting and material response before adding decorative clutter.

## Camera, controls and gameplay
- Keep 3D movement relative to camera yaw, with a reliable radial joystick and predictable keyboard override.
- Camera drag must not steal joystick input. Pointer capture, cancel and blur must reset safely.
- Keep a visible playable path in every map. Never put decorative meshes inside the snake route or let colliders protrude into it.
- Preserve the separate classic grid-based mode and its joystick.
- Ensure the camera does not clip through indoor walls/ceilings and that a roof can be shown or faded only when needed to keep visibility.

## Technical standards
- Use GLB/glTF assets where they offer real value; keep original editable sources and document asset origins/licenses.
- Use sensible LODs, instancing for repeated trees/flowers/lamps, atlas textures, lazy model loading and compressed textures where supported.
- Keep mobile texture memory and draw calls under control. Avoid a single huge mesh for a whole map.
- Do not add paid services, paid asset libraries, or generation-credit workflows without explicit approval. Prefer procedural assets and verified free/open-license assets.
- Keep collision proxies separate from high-detail render meshes.
- Do not remove existing UI, data, unlocks, or progression while performing a visual overhaul.

## Acceptance checklist
1. All six map themes are visually distinct at normal gameplay camera distance.
2. Each animal has a recognizable species silhouette, material treatment, expressive head and species-specific animation.
3. Indoor maps have a real ceiling/roof and remain playable with no camera lock-up.
4. Outdoor boundaries are thematic; no generic white perimeter walls.
5. Station start point and all rail/platform navigation are safe and unobstructed.
6. The 3D joystick works in all four directions relative to the camera, and classic mode still uses grid movement.
7. No new console errors, missing assets, broken imports, dead buttons, or start/restart regressions.
8. Mobile and desktop performance remain acceptable; list any unverified device/browser combinations.
9. The work is delivered on this feature branch with an MR; no production merge or deployment until reviewed.
