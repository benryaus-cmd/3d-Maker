# FINAL GOAL — BLACKTOP EMPIRE
**Project:** Original 18+ portrait-first 3D top-down open-world crime, driving, police-pursuit, racing and contraband-trading game for Aippy.  
**Date:** 12 October 2026  
**Status:** Living product specification, implementation order and acceptance contract. This replaces the previous zombie/HubSide goal for THIS repository only.  
**Reference flavours:** classic top-down GTA freedom and escalation; Need for Speed vehicle handling/customisation/pursuits; Dope Wars district economics. Build an original game, not a clone of their trademarks, levels, characters, dialogue, music or art.

## 0. Non-negotiable direction
Make an ACTUAL GAME, not a beautiful menu or static showcase. From first load the player can steer, throttle, brake, crash, flee police, make money, acquire vehicles, visit a safehouse and choose between story and open-world free roam. No tutorial wall preventing play. Cinematic, tactile, brutal adult crime fiction with meaningful decisions, consequences and progression. Target premium mobile presentation, original identity, cohesive stylized-but-detailed 3D.

**Portrait is the principal layout:** vertical view, player car in lower-middle, readable forward road, thumb-reachable twin-side controls, transparent controls over action, no cut-off HUD. Landscape/desktop gracefully supported. Never force a fake rotated view on Android Aippy. Big tap targets and proper multi-touch pointer-capture release.

**Top-down means real 3D with a high orthographic camera pitched slightly off vertical**, not a 2D sprite masquerade. Lower/transparent obstructive roofs near player, car remains visible near tall buildings, strong camera follow with velocity lookahead, cinematic shake only at appropriate impacts, controlled dynamic zoom at speed/pursuit/cutscene. A true top-down camera means skyline/fog systems from HubSide/Dead City must not be carried over.

**No distant scenery needlessly drawn or loaded.** Calculate camera frustum footprint and keep a near-edge safety margin. Preload or retain immediately relevant adjacent chunks and offscreen gameplay colliders/AI state, because deleting them just outside the view causes collisions, popping and police teleportation. Detach/recycle visuals for offscreen zones, not persistent world state. No need for fake haze/fog to mask draw distance. Camera culling alone is not sufficient: CPU actors, shadows, audio and prop update budget must cull as well. Use pooled and instanced geometry where valuable. Keep road connectivity stable between sectors.

**Core fantasy:** Start broke in a grimy port-city district with a battered car and a rented room. Work street trades and deliveries, race for respect, modify vehicles, evade expanding police response, buy and upgrade properties, take territory, survive ambushes and complete a strongly directed campaign. Any time the player can ignore the story and roam.

## 1. Existing repository — protect useful assets, reject inherited gameplay
Repo: https://github.com/benryaus-cmd/3d-Maker ; branch main.
At planning inspection, this was a full Dead City/HubSide code archive, NOT an empty starter. `src/App.tsx` was a tiny re-export of `src/zombie/ZombieGame`. There are hundreds of historical `src/game`, `src/zombie`, `src/components` files, and preloaded `public/assets/characters/*.glb`, `public/assets/quarter/*.gltf`, `public/assets/preview/building.glb`, `public/assets/city/tree.gltf`, and extensive `public/audio/sfx`.
**Do not delete that archive or blindly initialise a new framework.** A clean `src/crime/` entry point is preferable, leaving the dormant systems intact until proven replacements are better.
Keep existing Aippy Vite integration/plugin chain, React 19, Three.js, package manager, aliases and build-time project viewer mechanics. No invented Aippy native networking/credits features. Game must work offline/local-first; no HubSide server connections.

Asset work starts with an inventory: inspect and preview EXISTING geometry/models/sounds, reuse real assets when suitable, document exact licenses and file paths, then import missing car/road/property/sound assets. Avoid repeatedly loading same GLB/texture.

## 2. World and art direction
Working title **BLACKTOP EMPIRE**; renameable independently of code. Fictional city **Vesper Bay**, with cohesive districts:
- **Dockside:** containers, warehouses, cranes, freight, fences, tight chases; starting safehouse.
- **Neon Mile:** convenience shops, clubs, nighttime wet roads, street-racing meets.
- **Old Quarter:** apartments, alleys, roof access, dense traffic, backstreets.
- **Financial Core:** high-end dealers, fast highways, reinforced cops, parking towers.
- **Industrial Belt:** factories, scrapyards, garages, wreckable yards.
- **The Hills:** wealthy residential properties, winding roads, high-stakes runs.
- **Ring Road:** long connected straightaways for high-speed pursuit and rival racers.

Deliver the first district fully playable before spreading low-quality city across all districts. Interconnected streets must be navigable: **lanes, junctions, one-ways where marked, sidewalks, alley shortcuts, ramps, garages, gates, traffic lights and parking**. Use deterministic chunk IDs and seeded layouts. Buildings receive stable colliders and roofs that hide or fade only when needed. Roads and sidewalks must have distinctive materials, crossings, tyre marks, litter, decals, bollards, signs, lamps, parked vehicles, breakable furniture and construction barriers. Strong day/night mood without fog as a rendering crutch; shadow impostors, baked AO, simple roof geometry and selective dynamic lights.

Camera: orthographic following the player; speed-aware ahead target, damping, portrait safe zones, roof transparency; zoom adjustable. Enforce bounds and consistent mapping between world metres, vehicle units and image space. Tiny offscreen indicators for missions, pursuit units and safehouses; compact expanding minimap with district labels.

## 3. Driving physics — priority #1, actually fun
**Not** translation + instant rotation. Simulate rigid car chassis motion at fixed timestep (~60Hz), yaw inertia, longitudinal and lateral velocity, grip/slip curves, steer angle tied to speed, cornering, throttle/reverse, brake force, differential/drive style, handbrake oversteer, traction recovery, tire friction differences on asphalt/gravel/wet streets, engine torque curve, gearing, mass, collision impulse/restitution, rolling/drag resistance and steering assistance tuned for mobile. Never tie physics to frame rate. No car passing through walls, rotating on the spot at full speed, rubber-band corners or moving sideways with no inertia. Larger vehicles must feel heavy.

Raycast suspension / four-wheel model is an upgrade if supported and warranted; Cannon-es RaycastVehicle reference: https://github.com/icurtis1/raycast-vehicle (check its license) and https://github.com/NullCipherr/Cannon-Car-Simulator (MIT). Top-down may use a performant measured 2D tire-force rigid-body simulation with 3D visual body roll, pitch and suspension if it convincingly meets handling tests. Do not add physics dependencies unnecessarily, but do not use a fake kinematic controller and call it 'real physics'.

Tune car archetypes: battered starter sedan, muscle, tuner, exotic, utility van, SUV, police interceptor; top speed, brake grip, handling, weight, gear ratios, drivetrain, durability, pursuit health. Create test course: 0–100 acceleration, high-speed corner, handbrake U-turn, head-on collision, side-swipe, reverse, wet surface, chase at 60Hz and 30Hz. Record results not wishful claims.

**Visible, progressive physical damage:** panel dents/crumpled corners with deformable mesh or damage-state swapping, bumper dislodgement, glass cracking/shattering, bent hood, missing lights, wheel misalignment, sparks, smoke, fluid leaks, damaged engine note, impaired steering and acceleration; debris gets impulse, fades/pooled. Damage caused by collision location, angle, mass and relative speed. Police and civilian cars receive damage too. Hit obstacles and leave skid tracks, scrape paint, panels and breakable props. Cars must not be pristine while their health is zero. Repair at garage or safehouse.

**Controls:** left steer buttons/analog, right throttle/brake, separate handbrake and nitrous/horn. Genuine simultaneous thumb inputs on Android (pointerId-aware). Desktop arrows/WASD, space handbrake, shift nitrous, E action. Responsive throttle analogue where feasible. Gear sound/rev, brake/tyre skid, indicator and headlight controls later. Options: steering assist, camera follow, haptics and sound gains.

## 4. Cops and systemic response
Crime awareness/heat (0–5 stars), witness vision/hearing, dispatch delay, nearby reporting, escalating patrol vehicles, tactics, rolling roadblocks, tire strips, tactical vans and helicopters only when gameplay/camera supports them. Patrols drive lanes, obey a believable local pursuit model, search last-known position, split around blocks and recover from getting stuck. Police do NOT spawn inside obstacles, on top of the player, in line-of-sight out of nowhere, or forever ram the same wall. Wanted/heat drops only when genuinely unseen and not pursuing; hide at safehouse or change car/paint/plates, but never instantly erase active police at the front door. Arrest and hospital/impound consequences; car theft increases heat, pedestrians trigger reports, high-speed traffic collisions escalate.

Police and other traffic follow the same chassis/collision rules as player where practical (lower-fidelity LOD offscreen). Controlled spawn budgets and pooling. Chase music adapts to threat; radio chatter and sirens spatially anchored. Fair pursuit, with escape routes, alleys, garages and cool-down.

## 5. Population, streets, adult consequences
Living civilians: street walking, crossing at intersections, reactions to honks, gunfire, violence, speeding and police. They spot threats, flee using sidewalks, avoid cars when possible, can be physically struck, knocked aside and injured with convincing animations, ragdoll fallback or short-lived physical impulses, appropriate blood effects for 18+ setting, ambulance/fire response if budget allows. **Never reward repeated harm to civilians as the best money or progression strategy.** Impacts have strong wanted/mission/financial consequences. Harden collision resolution so NPCs do not clip through the road/cars or trap police. Characters must not be absent just because camera is far overhead: silhouette/readability matters.

Optional combat on foot later: player can enter/exit vehicles, sprint, take cover and use limited weapons; keep the DRIVING and the criminal economy as core, rather than copying the entire zombie shooter.

Adults-only original crime fiction includes rough language, substance themes, gang rivalry, danger and serious violence. 18+ entry label, settings for blood intensity and flashing effects, and sensible content controls. Fictional market names and mechanics; no real-world trafficking instructions.

## 6. Dope Wars meets GTA — functional market and risk
A simulation of fictional illicit commodities (e.g. Ember, Glitch, Velvet, Crown) with regional supply/demand, price noise, supply shocks, police pressure, rumours, gangs, cargo capacity, storage, heat, laundering and territorial influence. Player earns by buying cheaply and selling at favorable district markets, but travel, time, confiscation, betrayal and patrol inspections alter the calculation. Different districts have repeatable but changing economies; balance must not be trivial infinite cash exploit.

Map market nodes: dock stash, nightclub buyer, warehouse supplier, high-end broker, street fence. Dynamic events ('port shipment', 'neighbourhood crackdown', 'festival demand', 'rival raid') with finite duration. Offer contracts, courier runs, vehicle theft, races, protection and deliveries. Shops have hours and accessible interaction radius, prices and inventory; no buy/sell from opposite side of city. Show profit/loss including repair/fines/fuel if implemented. Fictional substance names only, abstract gameplay.

## 7. Safehouses and property ladder
Start with **Dockside Room**. Walk/drive to a marker; transition to a genuinely enterable **3D interior** or physically integrated room, not merely a static shop menu pretending to be a room. Upgrade and decorate it: lock, bed, desk, stash room, alarm, security cameras, workbench, garage, paint booth, sound system, weapon locker, extra parking/storage. Save game, repair cars, store inventory and hide from police with meaningful constraints. Later buy multiple properties in different districts, with distinct garages, passive revenue/risk, stash raids and decor style. Persist position of all purchased upgrades and garage vehicles.

No microtransactions required; all upgrade costs are in-game currency.

## 8. Cars, ownership, tuning, garages
Vehicle dealerships, street theft, purchase/sale, limited garage slots, repairs, tow/impound/recovery. **Customisation visible in 3D:** body color, wrap/decals, wheels, suspension stance, aero/spoilers, exhaust, headlights, window tint, hood, bumper, neon underglow, engine sound and plate. **Mechanical upgrades:** engine, ECU, gearbox, tires, brakes, suspension, armour, cooling, nitrous, reliability; each changes measured physics parameters with trade-offs. Presets stored by unique vehicle IDs. Menus preview real cars rotating on turntable; the world displays the same changes and damage states.

## 9. Campaign + free roam, no dead menus
Two selectable modes using one shared city/save: **CAMPAIGN** (mission tracking, dialogue, authored story) and **FREE ROAM** (all systems available immediately, no compulsory mission). On the first load let player drive straight away. Campaign starts with 5 tightly playable missions before expanding:
1. **LAST $200**: drive battered sedan to first safehouse, meet contact, learn the city.
2. **HOT DELIVERY**: timed contraband run through traffic, evade patrol, first real cash.
3. **BURN RUBBER**: race 3 opponents across the industrial route; unlock tuner shop.
4. **BLUE LIGHT SPECIAL**: bait/escape a rising police chase, lose tail, stash vehicle.
5. **THE TAKE**: multi-leg high-risk heist setup and getaway with branching payout.
Mission structure: prerequisites, launch marker, dialogue/cutscene, checkpoints, objectives, timers, fail/retry, reward, persistent unlock and clear in-world navigation. No instant reward buttons sold as missions. Free roam side loops: illegal races, towing, taxi, courier, chase challenges, garage collection, territory pushback.

**Cutscenes:** in-engine camera splines/close-ups, actors and cars physically present, skippable dialogue, subtitles with speaker labels, cinematic letterboxing only when aspect allows, normal play camera restores, AI-controlled vehicle remains stable during scene. Avoid cutscenes for every tiny action.

## 10. Sound, feel and presentation
Layered car audio with idle, load, acceleration, shifting, turbo, backfire; tire squeals by slip, skid, impacts by material and severity; police siren doppler and radio voice stingers; city traffic beds, pedestrian screams/reactions, nightclub bass, garage tools, rain/distant thunder as optional ambience. Separate sliders for master, engine, SFX, sirens, music and radio. Unlock audio on user gesture, respect pause/mute and Android audio policies. Existing `public/audio/sfx` contains gun impacts and other zombie sounds; reuse selectively, do not pretend they provide proper car audio.

Juice: camera shake, chromatic hit flash only on strong hits, skid particles, sparks, fragments, stretch lights, responsive HUD, animated cash and mission completion, speedometer with KM/H and speed streaks, gear/tachometer, minimap with north/heading markers, heat stars, vehicle damage, current job, garage inventory and GPS path. Accessibility controls: scale/UI contrast, reduced shake, blood intensity and audio independent sliders.

## 11. Asset acquisition queue — verified public sources
First preserve all preloaded assets and inventory before imports. Strong **CC0** starting options:
- **Kenney Car Kit** — current vehicle set, police, sedan, taxi, trucks, sporty sedans, detached wheels and useful debris: https://kenney.nl/assets/car-kit and https://kenney-assets.itch.io/car-kit
- **Kenney City Kit Roads** — road/intersection/sidewalk/street furniture: https://kenney.nl/assets/city-kit-roads
- **Kenney City Kit Commercial** — modern city buildings: https://opengameart.org/content/city-kit-commercial
- **Kenney City Kit Suburban** — houses/fences/driveways: https://kenney-assets.itch.io/city-kit-suburban
- **Kenney Racing Kit** — track/race props: https://kenney.nl/assets/racing-kit
- **Quaternius Cars Pack** — alternative 8 CC0 vehicles: https://quaternius.com/packs/cars.html (FBX/OBJ/Blend, convert offline to GLB).
- **Quaternius Downtown City MegaKit** — premium-looking modular city: https://quaternius.com/packs/downtowncitymegakit.html ; only free subset, check individual items and scale.
- **Kenney self-contained GLBs GitHub mirror** — https://github.com/Hidencod/tge-assets ; `packs/car-kit/{sedan,sedan-sports,police,taxi,suv,...}.glb`, plus roads/commercial/suburban. Repository LICENSE explicitly declares Kenney CC0 and conversions CC0; use locally bundled files rather than runtime CDN. Maintain provenance `docs/blacktop-assets.md`.
- **Car engine CC0 loops** https://opengameart.org/content/racing-car-engine-sound-loops ; **car engine start CC0** https://opengameart.org/content/car-engine-start-01 ; **car horn CC0** https://opengameart.org/content/car-signal. Check original specific sound license and optimise to .ogg (mono for 3D one-shots).
- **Kenney Starter Kit Racing** https://github.com/KenneyNL/Starter-Kit-Racing with car models and CC0 sound reference (Godot project; import/convert individual assets, not whole runtime).
For all external assets record original author, link, license, source SHA/version, conversion decisions, target path, scale/orientation, and measured byte/triangle costs. Reject unlicensed GTA/FiveM rips and copyrighted GTA/NFS audio. Do not depend on hotlinked remote gameplay models or audio at runtime.

## 12. Engineering layout and integration
Recommended new modules:
```
src/crime/
  CrimeGame.tsx          // single React entry / UI / inputs
  crime.css              // isolated modern portrait UI
  vehiclePhysics.ts      // deterministic fixed-step planar vehicle physics
  City.ts                // streamed urban chunks, roads, interiors, markers
  Vehicles.ts            // garages, traffic, damage, deformation
  Police.ts              // wanted, chase, dispatch, hiding
  Pedestrians.ts         // culling, movement, flee, impacts
  Economy.ts             // deterministic simulated district trade
  Missions.ts            // objective engine and campaign data
  Save.ts                // versioned persistence and migrations
  Sound.ts               // Web Audio car engine + imported SFX
  Tuning.ts              // developer debug / gameplay tuning
public/assets/crime/     // newly imported reviewed CC0 GLBs and sounds
docs/blacktop-assets.md  // provenance, paths, licenses
tests/crime/              // physics, economy, mission, spawn, save invariants
```
Use React only for menu/HUD. Keep Three.js render loop direct, no per-frame React state. Use fixed-step simulation with delta clamp and interpolation; scene graph update and drawn frame separated. Pooled objects, geometries/materials/GLBs shared and disposed on teardown. Visibility calculations include effects and AI, not just meshes. All interactive prompts and overlays pointer-accessible. Limit device pixel ratio adaptively using real timings; default target 60 FPS Android portrait (30 FPS minimum under heavy scenes), no hidden quality reductions without exposed developer option.

**No new server or multiplayer required**. Versioned autosave to localStorage/IndexedDB; defensive load validation and backup slots. Do not let currency/cars reset after reload. Distinguish real saved state from demo reset. Pause on tab hidden, stop audio, clear inputs; resume without physics explosion. Handle WebGL context loss where possible.

## 13. Build in vertical slices, ALWAYS playable
**S0 — Foundation:** fresh dedicated game entry; gorgeous topdown road grid and sidewalk street blocks; thumb multi-touch; physics-based sedan and collision; working camera; pause/save. Build verified.
**S1 — Road spectacle:** real locally loaded car GLBs; driving surface feedback; skid/engine/sirens; destructible props; continuous positional dents, visual debris, repair; own vehicle damage; traffic. Stress test.
**S2 — Police & population:** civilians, impact/flee responses, witnesses; accurate heat and live pursuit with road routing, roadblocks, escaping/cooldowns. Make chase exhilarating and FAIR.
**S3 — Crime economy:** district markets, cargo capacity, price events, buys/sells, police risk, profitable loop, player finance ledger.
**S4 — Properties:** actual enterable safehouse, 3D upgrade choices, garage, persistent vehicles, tuning with real handling impacts.
**S5 — Story:** 5 real missions, driving delivery, races, pursuits, cutscenes/dialogue, branching reward, skip/retry and free roam.
**S6 — polish:** complete Kenney/Quaternius world dressing, material harmonisation, audio mastering, day/night/weather, damage/multicar physics, smooth 30/60 FPS and UX review.

Each slice: inspect only relevant files, implement, run tests/build, **play in browser** using mouse/touch where possible; record observed outcome, not unverified claims. Workers must read THIS `final-goal.md` before touching code and should use current files, not older README/MEMORY/spec/zombie plans. Don't delegate whole tasks in circles; parallelise independent assets, physics, city or UX work only when integration contract is precise.

## 14. Definition of done / acceptance
A first public playable is NOT done unless all:
- Launches in Aippy portrait and desktop, renders a 3D street and player within a few seconds after assets ready; offline works after bundle loaded.
- Drives at 30 and 60 FPS with nearly same acceleration, turning, braking; handbrake U-turn and high-speed drifting visibly behave differently; collisions solid.
- At least 5 visibly different cars, with real damage visibly altering model and behavior.
- Street props break, scatter, are culled/recycled, and do not break collision after unloading nearby visuals.
- Civilian pedestrians walk, panic/flee, get struck/react and witness crimes; police respond, pursue, collide, can be escaped; spawn and recovery do not cheat visibly.
- A complete delivery → payment → vehicle modification/repair → safehouse loop exists; fictional contraband prices differ by district, balance checked.
- Enterable 3D safehouse and saved property upgrade/garage. Menu alone does not count.
- 5 interactive campaign missions and unrestricted free roam share progression; cinematics skippable, mission resume/retry coherent.
- Engine/skid/siren/crash/witness audio controls, working music/ambient settings, no autoplay violations.
- Saved cash, heat consequences, cars, upgrades and progress survive reload.
- Android controls do not stick with multiple fingers; camera does not occlude car; no offscreen heavy render/update; no runaway objects, textures, timers or audio.
- Benchmark and manual test evidence, real screenshots/video where available; record features honestly as DONE / PARTIAL / TODO. NEVER claim physical device or Aippy test without running them.

### Required Work-mode playtest when handed off
1. Inspect Git HEAD, `src/App.tsx`, `src/crime`, `public/assets/crime`, `docs/blacktop-assets.md` and package scripts; note what is truly implemented.
2. Install existing deps with Node 22, run `pnpm run build`, TypeScript check and relevant tests; fix only reproducible faults.
3. Open served browser build and ACTUALLY drive: portrait ~390x844 and landscape/desktop; exercise acceleration, brake, skid, handbrake, collision, car damage, police chase, pedestrians, market, delivery, safehouse and reload.
4. Verify linked GLBs load from local paths, camera shows streets with no dense haze/fog, spatial culling works and all user-facing controls respond.
5. Record FPS/long frames/draw calls when available; inspect scene for unwanted spikes and memory leaks. Avoid falsely claiming Android native testing.
6. Return an evidence table of DONE/PARTIAL/NOT IMPLEMENTED/BROKEN, screenshots, exact reproduction steps and targeted fixes; prioritise gameplay feel over adding dead feature UI.
7. Keep pushing toward this final goal, not merely ticking off a shallow demo.

## 15. Current delivery honesty
This document is the intended FINAL GAME CONTRACT. It does **not** assert every feature above exists today. The first implementation should expressly identify what actually shipped. Preserve existing source/assets; never report plans as already completed.
