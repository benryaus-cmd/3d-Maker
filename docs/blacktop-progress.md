# BLACKTOP EMPIRE — Implementation and Work-mode Playtest Handoff

Last edited 13 October 2026 (Australia/Sydney). This is a **fact-based checkpoint** for the original AAA ambition in `final-goal.md`, not a declaration that the finished game exists.

## Project
- GitHub: https://github.com/benryaus-cmd/3d-Maker
- Game entry: `src/App.tsx` → `src/crime/CrimeGame.tsx` (not the inherited zombie export).
- Engine: Three.js, React 19 / Vite, existing Aippy setup and build chain. Portrait-first orthographic follow camera and a 3D simulated world.
- CI: `.github/workflows/zombie-build.yml` is now named **Blacktop Empire Build** and runs Node 22, frozen pnpm install, `tsc -p tsconfig.crime.json --noEmit`, `scripts/check-crime.mjs` and `pnpm build`.
- Latest verified automation as of this checkpoint: GitHub Actions run `38255823116` for `2113ea060735e49af5b92743fe2fbf7f31b12db0` **SUCCESS**. Builds/unit invariants pass; these are not proof of Android or gameplay quality.

## Code currently shipping
1. **Driveable physics chassis**: fixed 60 Hz stepping, yaw inertia, steering angle, power/mass, drag, lateral slip/traction, braking, reversing, handbrake, nitrous, asphalt/wet parameter; oriented rectangle SAT car/building and car/car collisions, impact impulses, HP/damage zones, lowered power after damage.
2. **Visible cars and roads**: six local Kenney CC0 vehicle GLBs, 3D world with chunked roads/buildings, five Kenney commercial-building GLBs, nine Kenney roadside-object GLBs, breakable cone/barrier/dumpster proxies, pooled paired skid marks, impact particles, body dents (geometry displacement), rear spoiler, paint-tinted body, underbody glow, emergency lights on patrol cars, severe-damage smoke.
3. **Civilian life**: traffic and police AI vehicles sharing physics/colliders; pavement civilians include animated Quaternius GLBs (Idle/Walk/Run/Death) with a procedural fallback, panic/flight, collisions and visible 18+ blood stains. Population is bounded and nearby.
4. **Police**: witness escalation from hitting pedestrians and vehicles, heat/stars, physically driven pursuing police cars, audible siren, wanted decay, safehouse entry cannot be used while police visibly at door, arrest/impound/fine/confiscation if high heat and caught stationary for several seconds.
5. **Crime economy**: four fictional commodities, four district markets with different prices, stock/cash/cargo checks, district travel required to trade, garage upgrades expand storage. Market time/price balance remains basic.
6. **Safehouse and tuning**: real separate 3D interior (walkable on foot with interior furniture blockers); purchased 3D decor/stash/garage improvements; six collectible cars with individually saved state, engine/tyre/brake/armour levels affecting physics, paint palette, spoiler/neon, repair, paid recovery if broken down.
7. **Campaign/free roam**: mode switch and five authored sequential objective/reward loops; delivery route, timed street-race with physical AI rival, rising-heat chase and escape, basic take/delivery. No cutscenes yet. Missions currently operate as proximity/checkpoint objective scripts, not polished multi-scene scripted missions.
8. **Sound**: local Kenney CC0 recorded engine, tire skid, crash samples with playback-rate/volume control, plus synthesized police siren and a quiet engine component. Browser audio gesture unlock.
9. **Persistence**: versioned save `blacktop-empire-save-v2` stores cash, inventory, heat, campaign state, property, owned cars and EACH car's upgrade/paint/damage state. Defensive load and autosave on interval/exit.
10. **UX**: responsive portrait mobile touch controls with pointer capture, accelerator, brake/reverse, steering, drift, nitrous; desktop WASD/arrows, speed, damage, cash, heat stars, local radar, mission banner, garage, trading and pause panels.

## Known limitations and bugs to verify, not conceal
- Full physical wheel suspension, wheel deformation/tearing, per-panel fractures and debris from **imported** Kenney meshes are not finished. Current vertices are deformed locally on collisions; it needs close-up playtest to verify visual realism and material UV quality.
- Traffic/police navigation uses local Manhattan street goals, **not** an obstacle-aware full route planner. NPCs can get stuck at collisions and should be observed.
- Mission 3 street-race and other campaigns are foundational playable scripts, not full NFS-style rival racing cinematics; checkpoint routing, fair timing, offroad cutting and loss/retry require end-to-end validation.
- City uses a **seeded endless street grid** with district labeling; not yet a distinct fully handcrafted seven-district campaign city.
- The walkable interior currently uses simple room furniture primitives, not imported high-end interior models; room interactions should be expanded.
- There are no real scene-directed character cutscenes, heist animations, on-foot combat system, organized gang territory or interior garage rotating model preview.
- Pedestrian impacts/animations are basic and should be inspected for mismatched skeleton clips, hierarchy and depth ordering. Avoid pretending there's mature GTA pedestrian AI.
- No actual police radio voice samples, high-end car sound layering, traffic ambience, music soundtrack or multi-channel volume preferences are implemented yet.
- Roadway mark instancing and nearby streaming keep GPU cost bounded, but a real Aippy Android FPS benchmark and long-session memory review have **not** been performed.
- Browser/phone play was **not** tested in this development chat. Only GitHub Actions compilation/build and Node physics/economy/persistence assertions are confirmed. Do not claim real browser testing unless you run it.

## Work-mode full playtest priorities
1. Inspect main branch HEAD (may advance) and this handoff + `final-goal.md`. Confirm `src/App.tsx` points to `src/crime/CrimeGame.tsx`. Do NOT accidentally play old `src/zombie/ZombieGame.tsx`.
2. Run **Node 22 / pnpm install / TypeScript check / `node --experimental-strip-types scripts/check-crime.mjs` / `pnpm build`**, then launch Vite and actually operate the game. If you have web browser access, capture screenshots.
3. Desktop arrows/WASD: drive forward/reverse, fast turns, handbrake drift, oversteer/recovery, collision with *front and side* of a building, observe damage/smoke, hit barrier, follow skid marks. Run at portrait 390×844 and landscape 844×390 plus desktop 1280×720. Check car is in the frame and forward road legible.
4. 3D asset QA: verify Kenney GLBs load locally and oriented +Z, body/wheels correctly fitted (front wheels from source GLB are at +Z), paint is actually visible without tinting windows/wheels, rear spoiler and neon don't float and geometry damage doesn't shred the car. Check dynamic props don't block roads after breaking.
5. Market QA: purchase goods at Port, sell at another market, confirm correct cash and cargo, capacity checks and that saving/reloading doesn't exploit/reset stock or cars.
6. Story QA: get to safehouse, collect package at port and deliver to nightclub, timed race against physical rival, escape high police heat, finish heist mission; check failure/retry and rewards. Check free-roam toggle doesn't lose story or stolen cash.
7. Police/NPC QA: provoke police by collisions or pedestrian impact, drive chase, let officers corner stopped player, confirm fine/confiscation/impound and ability to recover. Watch NPCs get stuck, spawn through walls or obstruct emergency services.
8. Safehouse QA: enter after parking, close upgrade menu and WALK inside, interact with 3D space, buy all 3 levels, exit, reenter, reload save and confirm models still present. Police at door must block hiding. Ensure menu doesn't trap player.
9. Mobile multitouch: hold left steer + throttle + handbrake simultaneously then release all; no sticky input, accidental zoom/scroll, overlaid buttons, rotated display or clips under notches.
10. Measure actual frame timings / p95 / p99, draw calls, renderer geometries, GLB requests, long tasks and heap trends over a 15-minute drive across chunk boundaries. Prioritise removing duplicated materials/geometry and scene leaks before art polish.
11. Record findings as PASS / BROKEN / PARTIAL / NOT IMPLEMENTED with exact files/lines and screenshots. Fix only proven failures, then rerun tests and report new commit. If direct browser gameplay tools are available, **play**; code-only reading is not a playtest.

## Next engineering milestones
- Correct any actual runtime/visual issues found by Work first. Retune physics with in-game evidence.
- Upgrade road graph, intersection traffic law, police dispatch/search/roadblocks and racing AI.
- Dedicated dislodging car parts, deformable panels, per-vehicle wear and tuning previews.
- Populate genuinely distinct Dockside, Neon Mile, Old Quarter, Financial Core, Industrial Belt and Hills.
- Proper scripted campaign camera/actor cutscenes, original adult storyline, choices, mission UX and dynamic world events.
- Add original properly licensed professional car sound set and complete gain/mute controls.
- Improve pedestrian animations, safehouse interactions and responsive portrait HUD to release-level polish.
- Actual Aippy Android rendering/audio/multitouch test required before claiming ship readiness.

Full end-state is defined exclusively by `final-goal.md`. No artificial "done" checkboxes: extend depth until the real game meets it.
