# Blacktop Empire: nine districts, roads, driving and street combat

Parent: `e37a06757b5025d9ad278048bde1829d9e937366`. Reviewed the user's Aippy recording at 0, 8, 16 and 24 seconds. Changes target the active CrimeGame entry.

## Delivered

- A 360×360 m city with nine contiguous 120×120 m districts. Its 72 blocks include 1×1, 1×2, 1×3, 2×2 and L shapes. The connected road graph contains 622 tiles: 506 straights, 13 bends, 64 T-junctions and 39 crosses. District seams retain continuous arterial roads.
- District themes: Hills homes/gardens, Financial towers, Civic Gardens parks/walks, Old Quarter courtyards, mixed Midtown, Neon nightlife, Dockside waterfront, Industrial freight and Market Ward retail. There are 185 placed buildings. Nearby 60 m chunks stream with a maximum of 16 active; existing licensed models are reused rather than bespoke art for every building.
- Correct Kenney road orientation, verified from actual GLB edge geometry and UVs. Source straights/crossings run east/west and bends join north/west, so they need an additional π/2 rotation; crosses and tees need zero. Duplicate procedural road paint is removed. Forward cyan chevrons identify navigation assistance.
- Nine district markets, selectable routes in Jobs, a road-graph radar aligned to the camera, current district labels and a parked-car marker. Campaign deliveries resolve existing market IDs at their new district locations. The race retains a local Midtown circuit.
- Front/rear tyre slip forces, load transfer, yaw inertia, progressive pedals and steering, coasting, handbrake slip and countersteering. Studied the complete MIT `oseiskar/js-car` physics source; implementation is original and adds no engine dependency. Existing upgrades and SAT collisions remain compatible.
- Stronger nonlinear crash damage: 3 m/s scrape loses 1.01 HP, 10 m/s impact 20.65 HP, 18 m/s 71.90 HP and 20 m/s 89.51 HP. Three armour upgrades reduce the 20 m/s damage to 64.40 HP. Imported-body dents and smoke remain.
- Traffic follows lanes and graph routes, previews corner speed, senses vehicles/walls, yields and reverses physically when stuck. Braking cannot accidentally engage reverse. The first route edge follows the current heading. Cars spawn offscreen in clear lanes with their pose set before scene attachment. The old 144-degree stuck-car rotation is removed. Towing now uses a clear road at `(0,-12)`.
- Brighter moonlight, warm lamp pools, emissive signs/windows, head/tail lamps and gradient headlight footprints. Exactly two reused, non-shadow-casting spotlights light the player's road; traffic uses cheaper footprints.
- On-foot PUNCH button and keyboard F: 0.48 s cooldown, 2.25 m range and facing checks, visible Quaternius arm poses. Approximately 30% of pedestrians fight back; others flee. Retaliation reduces separate on-foot health. Knockouts recover at the safehouse for $100; house entry heals. No armed combat was added.

## Failures found and corrected

| Failure | Evidence and correction |
|---|---|
| Tow inside a building | Visible in user recording. Moved recovery from `(-7,-7)` to `(0,-12)`; actual browser tow verifies clearance. |
| Road models face wrong directions | Source triangle/UV inspection proves openings; model-specific rotations now match the graph masks. |
| Cars jump rotation | `steerActor` added π×0.8 when stuck. Replaced with physical braking/reversing/steering. |
| Traffic stop engages reverse | Pure simulation backed up 1.12 m in one second without recovery. Separate reverse intent; yielding now stays stationary for two seconds. |
| New route requests an immediate U-turn | A +Z car routed behind itself left the road. First edge is constrained; 30-second route test stays within 3.46 m of the centreline. |
| Punch button receives no touches | Browser canvas intercepted the button because inherited walking-pedal CSS disabled pointer events. Corrected and tested with actual taps. |
| Route chevrons point backward | Visual inspection caught mirrored arm rotations; corrected. |
| Radar/labels use the old city | Removed the hardcoded 32 m grid and Dockside caption; both consume the new layout. |

## Verification

- Crime TypeScript check, eight targeted check scripts and production build: PASS. Checks include 14 vehicle handling groups, graph connectivity/seams/shapes/masks, original road hashes/openings, lighting disposal, traffic yielding/recovery/routing, actual GLB punch posing, controls, camera and GPU resource disposal. Build is approximately 9.11 MB, 2.65 MB gzip. Node 22 and frozen pnpm CI are retained with the new checks.
- 21 existing production browser input/layout assertions: PASS at 390×844, 844×390 and 1280×720. Includes driving/reverse/steering, three simultaneous touches, releases, background/focus, parked car, safehouse walking and host resizing.
- 24 new production browser assertions: PASS. Actual keyboard drive to Midtown, buy/reload, cross-market sale, route picker, tow, pose before attachment, punch/flee/retaliation, night lights, traffic and no runtime errors. District placements, cross-market relocation, combat personalities and night time are explicit fixtures; this does not claim all districts were driven or the campaign completed.
- 35-second autonomous traffic sample: 223 observations, up to 10 NPC cars, zero abrupt heading teleports and all sampled NPC cars at 100 HP. Maximum 137 draw calls, 96 geometries and 32 textures. This is software WebGL, not an Android FPS benchmark or long-session stability proof.
- Archived repository suite: 500/509 pass. The same nine unrelated legacy basketball/lamp/poster/modal failures remain; no unrelated source changes.

## Screenshots

[Portrait](media/blacktop-city-portrait.png) · [Night/headlights](media/blacktop-city-night.png) · [Bend](media/blacktop-city-bend.png) · [T-junction](media/blacktop-city-tee.png) · [Punching](media/blacktop-city-combat.png) · [Landscape](media/blacktop-city-landscape.png) · [Desktop](media/blacktop-city-desktop.png).

Districts: [Hills](media/blacktop-city-hills.png), [Financial](media/blacktop-city-financial.png), [Gardens](media/blacktop-city-gardens.png), [Old Quarter](media/blacktop-city-old-quarter.png), [Midtown](media/blacktop-city-midtown.png), [Neon](media/blacktop-city-neon.png), [Dockside](media/blacktop-city-dockside.png), [Industrial](media/blacktop-city-industrial.png), [Market](media/blacktop-city-market.png).

Measurements: `blacktop-city-measurements.json`. Reproduce with `scripts/playtest-districts.mjs` and `scripts/playtest-city-visuals.mjs` using an external Playwright runner. HTTPS requests were blocked during browser testing; runtime models/fonts work locally.

## Remaining work

Physical Android FPS/audio/notches, a 15-minute memory/traffic stress test, complete district deliveries, race/police campaign validation and balancing remain unverified. Traffic prediction/recovery cannot guarantee no deadlocks throughout the city. Full suspension/wheel tearing, cinematic heists, armed combat, gang territory and professional audio remain unfinished. `final-goal.md` is the ambition, not a claim of AAA completion.
