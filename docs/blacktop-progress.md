# BLACKTOP EMPIRE — Current implementation handoff

Updated 13 October 2026 (Australia/Sydney). This is a playable foundation progressing toward [final-goal.md](../final-goal.md), not a completed premium game. Follow [how-to-achieve-final-goal.md](../how-to-achieve-final-goal.md) for the remaining work.

## Active game

`src/App.tsx` → `src/crime/CrimeGame.tsx`. React/Vite/Three, portrait-first mobile UI, fixed-step vehicle simulation. Preserve the existing Aippy host and build-time importer. The dormant zombie/HubSide archive is not the active game.

## What exists

- Six car models with analogue steering, progressive pedals, drift/nitrous/reverse, structural damage and saved upgrades/appearance. Shared physical traffic/police and street routing.
- Nine seamless districts in a 3×3 city; mixed block footprints, graph navigation and correctly joined/oriented Kenney roads. Road tiles 15 units, asphalt 10.5 units. Buildings/props use fitted collision footprints; physical perimeter ±187.5.
- Camera follows speed, walking and interior context. Animated characters, walking, punching, fight/flee, physical vehicle knockback and bounded populations.
- Breakable local scenery falls and remains until chunk despawn; bounded 10s hold/10s fade skid pool. Day/night, dawn/dusk colour, fitted vehicle lights and streetlight illumination.
- Radar opens an expanded city map. Jobs/market routing, garage upgrades and an enterable furnished safehouse.
- **Persistent economy:** four goods, nine contacts, finite dealer stock/buyer demand, replenishment during active simulation, buy/sell spread, deterministic regional prices, timed Port supply and Neon demand events, observed quotes and 40-entry receipts.
- Trading validates contact proximity, stopped movement, accessible car cargo, quote revision, transaction ID, cash, capacity, stock and demand. Money/cargo/market changes save together; failed storage rolls back the deal and reports cancellation.
- Cargo and weighted purchase cost stay with each owned model's vehicle inventory. Safehouse storage transfers require a nearby parked car. Banked cash and stash survive cargo confiscation. Multiple same-model vehicle instances remain future work.
- Save payload v4 in the existing `blacktop-empire-save-v2` key. Migrates legacy cash/cars/mods/cargo without inventing historic purchase costs; retains legacy and last-known-good backups. Corrupt financial inventories recover from a valid backup.
- Five foundational campaign objective loops and free roam share progress. Local engine/skid/crash samples and synthesised siren; gesture unlock.

## Verification and limits

Current sweep evidence: [street-empire report](testing/blacktop-street-empire-13oct2026.md),134 passing browser assertions across phases. Historical economy evidence: [persistent economy playtest](testing/blacktop-economy-13oct2026.md). Earlier [goal review](testing/blacktop-goal-review-13oct2026.md) and [immersion pass](testing/blacktop-immersion-13oct2026.md) distinguish actual input from fixtures.

The economy update was checked through production browser driving, buying, travelling from Midtown to Financial Core, selling for measured profit, reload, persistent stock/ledger, stash/bank and blocked remote transfers. Active crime suites, TypeScript and production build are checked separately from the dormant archive suite. Exact counts/outputs are in the current report.

Physical Android/Aippy performance, audio, thermal stability, touch latency and a 30-minute mixed stress run remain NOT TESTED. Browser viewport/touch emulation cannot replace those. The inherited archive retains nine established failing tests; they are recorded rather than changed as part of crime work.

## Integrated street-empire sweep — 13 October 2026

- Three equipped weapons: pistol, shotgun and SMG. Finite magazines/reserve, timed reload, saved unlocks, paid ammunition and distinct cadence/range/pellets. Actor circles, oriented car hulls and solid building cover determine the nearest hit.
- Independent mobile move/aim/fire sticks; keyboard J fire, R reload, F punch and 1/2/3 loadout selection. Holster returns to melee; pause/background/car transitions clear inputs.
- Armed rivals use sight/hearing, windup, repositioning, cover goals, retreat and finite ammunition. Incoming hits injure the player or occupied car; hospital recovery applies mission consequences.
- Police incident delay, visible pursuit, last-known search, cooldown/escape, interception goals and warned offscreen roadblock. Arrest uses actual body velocity; valid safehouse entry prevents outdoor perception seeing an indoor actor.
- Four original factions with saved respect/hostility and trade/combat consequences. Four street contracts consume real owned cargo or require real defeated rivals; first-capture rewards cannot repeat.
- Ownable Midtown Motor Works: purchase/upgrades, capped active-time income and discounted repair. First block takeover, timed counterattack, physical defence or paid delegation, loss/reclaim.
- Expanded map shows owned garage/block, rivals and police search area. Compact Empire/loadout/settings panels with saved aim assist, combat volume, camera scale/shake and opt-in haptics.
- Shared original weapon meshes fit animated hand rigs, including late GLB replacement. Fixed muzzle/tracer/impact pools, original bounded synth gun audio and camera recoil.
- Twenty-seven pooled district identity signs/landmarks, emissive night signs and ownership variants. This adds identity to the current city; nine fully authored campaign districts remain work.
- Save v4 keeps the existing key, v2/v3 migrations/economy/backups; adds ammo, health, factions, ownership, encounter defeats, police knowledge and settings.
- Resolved/abandoned/delegated squads holster and flee. Tagged hostile population caps at8 and total population at32; dispersed actors retire after12s and faraway visuals retire and active encounter defeats survive streaming/reload.

## Remaining priorities

1. Test and tune the connected loop on a real portrait Android/Aippy device; measure sustained performance, audio and input latency.
2. Broaden faction reactions beyond contracts/counterattacks: telegraphed patrols, controlled supply, contact perks and persistent encounters.
3. Author unique district routes/landmarks, named characters, story decisions, chase set pieces and stronger animation/audio.
4. Add mission director, crew, multiple business/property types, unique same-model vehicles and deeper garage presentation.
5. Stress traffic/pursuit congestion and long-session resources; deliver physical-device accessibility/performance evidence.

Crew, branching campaign, rich cinematics, open-ended gang simulation and the final content floor remain unfinished. See [the sweep report](testing/blacktop-street-empire-13oct2026.md).

Published runtime `11a5b41cb9093b70184cb1e2b1ec3b0ed4f7a100`; Node22 frozen CI run[38381947081](https://github.com/benryaus-cmd/3d-Maker/actions/runs/38381947081)passed 20 active check commands, TypeScript and build. Exact import: 22-file combined incremental or 95-file complete current snapshot.
