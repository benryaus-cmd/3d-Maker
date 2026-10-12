# Blacktop Empire: browser playtest and controls fixes

Baseline: `71e9206e3a97f37e11fd1aa3ebc7b888762641cd` on main. Actual Chromium gameplay was run against both Vite development and the built production bundle, at 390×844, 844×390 and 1280×720.

## Proven failures and fixes

| Baseline result | Cause and correction |
|---|---|
| BROKEN: city invisible despite active simulation | `src/crime/World.ts`: initial `setSize(1,1)` installed inline 1px CSS dimensions. Later resizing changed only the drawing buffer. Initial sizing now leaves CSS in charge. |
| BROKEN: player car rendered only four wheels | `World.ts`: paint cloning changed a single-material GLB primitive into a material array without geometry groups. Preserve the original scalar/array material form. |
| BROKEN: game permanently stopped after background/return | `src/crime/CrimeGame.tsx`: visibility changed the manual pause flag and never restored it. Background suspension now has separate state, clears inputs and resets elapsed time. Closing the pause menu explicitly resumes driving. |
| BROKEN: focus loss left keys held; keyboard events erased held touch inputs | `src/crime/Controls.ts` combines independent keys and captured pointer IDs. Each release removes only its source; blur, visibility and menu transitions clear all sources. |
| BROKEN: brake could not start reverse; accelerator ignored while reversing | `src/crime/vehiclePhysics.ts`: near-zero braking overwrote reverse acceleration; negative velocity selected reverse even with throttle. The stop clamp excludes intentional reverse, and throttle takes precedence over reverse selection. |
| BROKEN: player could not walk after entering safehouse | `CrimeGame.tsx`: spawn was inside the collision rectangle for a floor rug. Floor dressing no longer blocks walking. Solid furniture blockers remain. |
| BROKEN: entering interior showed empty space | `World.ts`: camera interpolated from city coordinates to the interior 10 km away. Snap focus when switching scenes, then retain normal local follow. |
| BROKEN: landscape speed display covered radar; host resize distorted render | `src/crime/crime.css` places compact speed display below radar in short landscape. `World.ts` observes mount size changes and disconnects the observer on disposal. |

## Verification

Development and production browser runs each passed all 16 checks:

1. Imported player body renders in addition to four wheels.
2. Canvas fills portrait scene.
3. Returning from background resumes driving.
4. Window blur releases held keyboard input.
5. Unrelated keyboard events preserve held touch input.
6. Three real Chromium touch contacts hold throttle, steering and drift together.
7. All touch contacts release without sticking.
8. Drive and brake beside safehouse using keyboard.
9. Close upgrades and walk inside safehouse.
10. Exit safehouse to driving.
11. Brake reverses from rest.
12. Steering turns a moving vehicle.
13. Landscape speed display avoids radar.
14. Renderer follows host resize without a window resize event.
15. Canvas fills desktop scene.
16. No browser runtime errors.

TypeScript check, `scripts/check-crime.mjs` and Vite production build passed locally. The invariant script now includes pointer/key independence, same-button multiple fingers, resets, reverse from rest and forward recovery from reverse. Existing physics, collision, economy, mission and save checks still pass.

Local environment: Node 24.19.0, Chromium 138, Three.js 0.184.0, software WebGL. Network/package installation was unavailable locally, so preinstalled compatible dependencies were used rather than claiming a fresh frozen installation. The repository's Blacktop Empire Build workflow independently runs Node 22 and frozen pnpm installation on push.

Run the optional browser harness with an installed Playwright runner: `node scripts/playtest-blacktop.mjs`. After `pnpm build`, set `PLAYTEST_BUILD=1` to test the production preview. `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` and `CHROMIUM_ARGS` may select an existing runner. The harness uses React refs for diagnostic state assertions without adding debug hooks to the game.

## Screenshots

- [Portrait city and complete player car](blacktop-controls/portrait.png)
- [Landscape after layout correction](blacktop-controls/landscape.png)
- [Walkable safehouse interior](blacktop-controls/safehouse.png)
- [Desktop](blacktop-controls/desktop.png)

## Limits of this result

PASS applies to the browser behaviors above. This was not an actual Aippy Android session, an audio audition, a full five-mission campaign run, or a 15-minute device performance benchmark. Market travel, police arrest/impound, long-session memory and remaining AAA milestones were not certified by this playtest. The supplied `final-goal.md` remains the end-state specification.
