# Blacktop Empire mobile overhaul — verified checkpoint

Parent: a686879f4e859e4bde972783b8a1ceb335d93410. Actual production Chromium gameplay, not code-only inspection. Reference: current zombie-game 33d8b4f78a18fb1e0b8329234734700c08476f8d, started/moved/fired in browser.

## Delivered

- Analog steering/2D walking stick, independent accelerator/brake-reverse/drift/nitro pedals, responsive compact shaded HUD, locally bundled Barlow Condensed/Rajdhani, job direction/distance and world route.
- Speed-aware close follow camera, closer animated Quaternius walking character, screen-relative walking, parked car remains visible and stationary, proximity required to reenter/use garage.
- 23 additional licensed GLBs: detailed Kenney roads, KayKit/Kenney urban buildings, trees, benches, bushes, lamps, water tower and furnished safehouse. Multi-building blocks, parks and freight yards. The city retains its seeded grid; this is not a handcrafted seven-district campaign city.
- Twenty-minute day/night cycle with sky/sun/ambient changes, window illumination, streetlight pools and three bounded local point lights.
- Progressive steering, traction-limited yaw, usable high-speed torque/drag, visible front wheel steering/spin and body roll, connected pooled tyre trails.
- Car visual dimensions fit the oriented hull; pedestrian circle vs oriented-car contact, corrected rotated/front broadphase reach, actor mass in car collisions; imported body geometry visibly deforms on impact while wheel meshes remain intact.
- Streamed InstancedMesh GPU buffers, actor-owned fallback materials/geometries and skeleton bone textures disposed; same actor rig shares skeleton updates. Shared GLB caches retained.

## Evidence

| Result | Scope and evidence |
|---|---|
| PASS | TypeScript crime check, physics/economy/mission/assets suite, mobile-controls suite, world presentation/disposal suite, person disposal/camera-space movement suite, production singlefile build. Local Node 24.19; CI retains Node 22 + frozen pnpm. |
| PASS | 21 production browser assertions at 390×844, 844×390 and 1280×720: loaded car body, parked car/walking, background/blur release, mixed keyboard/touch, three simultaneous fingers, right steering, releases, safehouse approach/walk/exit, actual animated player, reverse, host resize, no runtime errors. |
| PASS | Physical drive to Port, buy Ember, reload and preserve exact cash/cargo. Camera opens with actual speed. |
| PASS | Physical keyboard drive into obstacles: HP fell to 78.68; 612 imported-body coordinate components changed beyond .001. See damage screenshot. |
| PASS | Natural clock progressed from 17:31 to 19:16; dusk/night lighting visible. Two-minute additional drive across chunk counts 4/6/9; no page errors. |
| PASS | Synthetic render/stream resource probe: active native GPU buffers [200,200,200] across three repeated unload/reload rounds (784 created,584 deleted). This probe relocates streaming directly; the rest of the drive uses actual keys. |
| PARTIAL | Software WebGL measurements: p50 100ms, p95 216.6ms, p99 500ms; maximum 149 draw calls,108 geometries. Ending textures37 vs207 before disposal fix. This is not an Android FPS benchmark. Raw samples included. |
| PARTIAL | Archived npm suite: 500/509 pass. The same nine HubSide/zombie failures were reproduced in the pre-overhaul snapshot; these are unrelated to the active CrimeGame entry. |
| NOT TESTED | Full campaign completion, every upgrade, cross-market sale, police arrest/impound end to end, 15-minute heap benchmark, physical Android audio/multitouch/notches. |
| NOT IMPLEMENTED | Full wheel suspension/tearing, dislodged panel debris, cutscenes/heist actors/combat/gang territory, obstacle-aware route planner, professional layered audio. final-goal.md remains the ambition, not a shipping claim. |

## Files

Engine/input: src/crime/CrimeGame.tsx, Controls.ts, vehiclePhysics.ts, PersonVisuals.ts. World/assets: World.ts, CityModels.ts, assets.ts and bundled/{city,roads,interior,fonts}. UI: crime.css and CrimeGame React section. Source and licensing: docs/blacktop-assets.md.

Screenshots: [portrait](media/blacktop-overhaul-portrait.png), [landscape](media/blacktop-overhaul-landscape.png), [desktop](media/blacktop-overhaul-desktop.png), [safehouse](media/blacktop-overhaul-safehouse.png), [damage](media/blacktop-overhaul-damage.png), [night](media/blacktop-overhaul-night.png).

Reproduce browser assertions with scripts/playtest-blacktop.mjs (PLAYTEST_BUILD=1) and scripts/playtest-city.mjs after build. Optional Playwright/Chromium runner lives outside shipping dependencies. Raw city measurements: blacktop-overhaul-measurements.json. Browser HTTPS requests were blocked, proving runtime assets/fonts work locally.
