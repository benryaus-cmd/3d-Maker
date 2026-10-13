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
- Save payload v3 in the existing `blacktop-empire-save-v2` key. Migrates legacy cash/cars/mods/cargo without inventing historic purchase costs; retains legacy and last-known-good backups. Corrupt financial inventories recover from a valid backup.
- Five foundational campaign objective loops and free roam share progress. Local engine/skid/crash samples and synthesised siren; gesture unlock.

## Verification and limits

Current economy evidence: [persistent economy playtest](testing/blacktop-economy-13oct2026.md). Earlier [goal review](testing/blacktop-goal-review-13oct2026.md) and [immersion pass](testing/blacktop-immersion-13oct2026.md) distinguish actual input from fixtures.

The economy update was checked through production browser driving, buying, travelling from Midtown to Financial Core, selling for measured profit, reload, persistent stock/ledger, stash/bank and blocked remote transfers. Active crime suites, TypeScript and production build are checked separately from the dormant archive suite. Exact counts/outputs are in the current report.

Physical Android/Aippy performance, audio, thermal stability, touch latency and a 30-minute mixed stress run remain NOT TESTED. Browser viewport/touch emulation cannot replace those. The inherited archive retains nine established failing tests; they are recorded rather than changed as part of crime work.

## Remaining priorities

1. S2: one excellent firearm encounter with responsive portrait aim/fire/reload, obstruction/cover, believable enemies, civilian reactions and police consequences.
2. S3: police perception/dispatch/search, coordinated interception and telegraphed roadblocks; robust traffic congestion handling.
3. S4: faction relationships, owned businesses/blocks, crew and meaningful defence/reputation, connected to the economy/combat/pursuit loop.
4. More deliberately authored district layouts, landmarks, art/audio identity and density. Current repeated partition variation is a foundation.
5. Full mission director, branching campaign, multi-property ownership, unique car instances, richer garage previews, settings and physical-device release evidence.

Open gun battles, organised gangs, territory control, business simulation, crew, rich cinematics and the final campaign content floor are not implemented yet. Continue towards the full goal; preserve the tested foundation while adding complete playable slices.
