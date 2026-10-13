# How to achieve the BLACKTOP EMPIRE final goal

13 October 2026, Australia/Sydney. Execution handoff for the next AI. Read [final-goal.md](final-goal.md) first. This roadmap describes **work still to do**, not implemented features. Latest assessed remote main: `e4244aa4d92126acc7c5342bdcf21a7c28320ab2`; runtime commit: `7ad47a80207df8bf210f0df3996f36c8d9bfbf98`. Always inspect the current remote head before editing.

## 1. Start from evidence

Read `src/App.tsx`, `src/crime/CrimeGame.tsx`, `Systems.ts`, `CityLayout.ts`, `World.ts`, `TrafficController.ts`, `vehiclePhysics.ts`, `Controls.ts`, `StreetCombat.ts`, `PersonVisuals.ts`, `CityMap.tsx`, `VehicleLights.ts`, `SceneryPhysics.ts`, `ImpactMotion.ts`, `Daylight.ts`, `TimedSkids.ts`, `crime.css`, the asset ledger and current CI workflow. This is the crime game, not the dormant zombie entry.

Read [the fresh goal-review playtest](docs/testing/blacktop-goal-review-13oct2026.md) and earlier district/immersion reports. Reproduce current issues before changing their implementation. Preserve the host, README integration requirements, importer, package chain, current assets and user saves. Use an isolated branch/worktree and a clean comparison to remote main; a reconstructed workspace can contain unrelated local differences.

### Current foundation and gaps

| Area | Evidence-based baseline | Work required for the final goal |
|---|---|---|
| Driving/input | Analog steering, pedal smoothing, fixed-step vehicle physics, drift, reverse, multitouch checks | Physical-device tuning, archetype balance, pursuit stress and end-to-end latency |
| City | Nine districts, merged blocks, joined 15-unit Kenney tiles, graph routing | Each district still derives from a repeated rotated partition; author landmarks, unique street plans and meaningful alternate routes |
| Visual immersion | Day/night, fitted lamps, breakable props, impacts and bounded skid lifetime | Cohesive district art, richer character animation, material consistency, calibrated audio and device profiling |
| Economy | Four goods, nine markets; persistent finite stock/demand, spreads/events, cargo cost, receipts/history, safehouse bank/stash | Wider balance/playtest coverage, more goods/contact behaviour, integration with gangs and mission economy |
| Combat | Punches; civilian fight/flee and physical car impacts | Firearms, aim controls, cover, perception, hostile squads and combat saves |
| Police/traffic | Physical cars, street routing, basic pursuit/heat/arrest | Formal incident/search states, fair dispatch, coordinated tactics, signals, jam handling, larger stress sample |
| Progression | Five short objective scripts; upgrades, car-specific model builds, safehouse | Mission graph, branching story, crew, gangs, territory, multiple properties and unique vehicle instances |
| UI | Compact driving HUD, jobs, route guidance and enlarged map | Combat/empire states, transaction clarity, consistent components, accessibility/settings and usability testing |
| Persistence | Save v2; cash, cargo, owned model builds and campaign | Durable market/faction/business/mission state, validated migrations, transaction IDs and corrupt-save recovery |

**Historical economy findings from the goal review are addressed by the persistent-economy update:** session-only prices, unlimited dealer inventory, equal buy/sell quotes and UI-only proximity validation are replaced by `Economy.ts` and save payloadv3. See [the economy report](docs/testing/blacktop-economy-13oct2026.md). The S1 checklist below remains the requirement set; read current code and evidence before repeating completed work.

## 2. Work order and integration rules

Priorities: **P0** correctness, saves, controls and measurable performance; **P1** connected core play; **P2** depth/content; **P3** optional expansion. Fix any active P0 before adding features.

Build through vertical slices. Each change needs a playable entry, feedback, consequences, persistence and failure/retry where applicable. Present real controls only when they operate a complete behaviour. An attractive gang menu without gang consequences is not a delivered gang system.

Extract responsibilities from `CrimeGame.tsx` and `Systems.ts` gradually, alongside the feature requiring them. Keep compatibility façades during migration. Suggested new domains: `SimulationClock`, `Economy`, `Save`, `Combat`, `Perception`, `PoliceDirector`, `Factions`, `Territory`, `Businesses`, `MissionDirector`, `AudioDirector`. These names are proposed modules, not existing files. Avoid rewriting the engine or adopting a new physics library without a measured gap and licensed prototype proving improvement.

Use stable entity IDs, seeded randomness, plain serialisable state and explicit events such as `TradeCompleted`, `CrimeWitnessed`, `VehicleDamaged`, `ActorDefeated`, `MissionStageCompleted` and `TerritoryChanged`. One authoritative event applies consequences once; visuals/audio consume it without awarding duplicate money or reputation. Unloaded visuals must not erase mission actors or economic state.

Dependency spine: **S0 baseline → S1 persistence/economy → S2 combat → S3 pursuit → S4 faction/territory slice → S5 city/content expansion → S6 release verification**. UI, art and audio work runs within every slice. Complete S0–S4 in a compact Midtown–Dockside–Neon corridor before reproducing it across nine districts.

## 3. S0 — lock the baseline and measure the phone

Tasks:

1. Resolve remote head, confirm the crime entry, install frozen dependencies with Node 22 and run the current CI command list. Record runtime/build SHA and dependency versions.
2. Re-run existing browser controls, district and immersion scripts. Record actual input separately from fixture placement/time changes. Keep fresh screenshots and console errors.
3. Add a development-only diagnostics capture for frame intervals, simulation duration, draw calls, triangles, active actors/bodies, geometry/textures, heap where supported and audio nodes. Keep diagnostics out of normal player UI.
4. Run an actual midrange Android/Aippy device for 15 minutes, then a 30-minute mixed stress route after warm-up. Test three-finger driving, notification/background interruptions, orientation, notches, audio unlock and save/reload.
5. Measure the starter sedan's stopping distance, turning radius, drift recovery and 0–100 acceleration at 30/60 FPS. Test narrow-road and building front/side contacts with collider overlays. Set quality-tier budgets from evidence.

Exit: reproducible baseline, no input/render/save blocker, stable resource counts, named-device performance data. If device access is unavailable, record NOT TESTED and continue desktop-verifiable work without declaring the device gate passed.

## 4. S1 — an economy worth driving across town for

Start with four existing goods and three connected markets; expand content after correctness.

Tasks:

1. Introduce a versioned simulation clock, seeded market state and save migration. Keep a last-known-good backup. Validate finite numeric values, recognised IDs, nonnegative quantities and affordable transactions.
2. Add per-market/per-good stock, desired demand, replenishment rate, buy/sell spread, bounded price response and event modifiers. Store stock and event expiry with the save. Pause freezes simulation time. Decide and test capped offline accrual explicitly; default to none initially.
3. Make `requestTrade` validate the nearby contact, menu/session state, quote version, quantity, cash, capacity and availability. Apply cash, inventory, stock and ledger atomically with a unique transaction ID.
4. Model vehicle and stash inventories by stable IDs. Persist acquisition cost per lot or a clearly defined weighted-average basis. Keep recovery, confiscation and cargo transfer coherent.
5. Build the trade screen around quantity, unit price, total, stock/demand, capacity and profit estimate. Add observed price history, timestamped rumours, map routing and a concise transaction receipt.
6. Add two clear market events: incoming port supply and a temporary nightlife demand spike. Both have readable causes, expiry and finite opportunity. Tune routes so risk-adjusted profit competes with delivery/racing, rather than dominating all other work.

Exit tests: buy at A → physically travel → sell at B → repair → bank/store → reload. Cash and cargo conserve through every successful/failed transaction. Repeated taps, stale quotes, reload, pause, mode switch, full cargo, empty stock, unavailable buyer and corrupt save cannot duplicate value. Run 100 seeded market days as a balance probe and inspect runaway wealth, dead economies and dominant routes; simulation is not a substitute for human fun testing.

## 5. S2 — one excellent street firefight

Tasks:

1. Refactor foot actor state into explicit locomotion, aim, action and health states while preserving existing punch/flee behaviour. Blend idle/walk/run/punch/hit/death and weapon poses; verify skeleton compatibility.
2. Implement pistol first: aim direction, aim assistance, fire cadence, ammo, reload interruption, hitscan/projectile query with cover obstruction, damage and hit feedback. Then add shotgun and automatic weapon with measurable differences.
3. Add contextual portrait combat controls and HUD. Keep move/aim/fire usable with two thumbs. Test switching car → foot → aiming → reloading → entering car without sticky inputs or an accidental action.
4. Implement sight/hearing and a small hostile group: patrol, investigate, acquire, attack, take cover, reposition, retreat. Threats and reinforcements have audible/visible warning. Pedestrians flee along valid space; a civilian personality may defend itself.
5. Integrate gunshots and witnessed injuries with police incidents. Add defeat/hospital recovery, ammo cost and saved inventory. Limit concurrent effects, shells and physical bodies.
6. Author a two-minute alley ambush with three opponents, cover and two exits; add mobile-readable muzzle/impact effects and distinct spatial sounds.

Exit: win, flee and lose all produce coherent outcomes; walls stop shots; targets react; reloading and weapon changes cannot duplicate ammo; no invisible attacks; controls work on the target phone. Capture a complete unedited encounter. Do not expand weapon count until this scene is enjoyable.

## 6. S3 — a three-minute chase players want to repeat

Tasks:

1. Separate police incident, dispatch, pursuit, search and cooldown states from the UI star count. Record last-seen location/time and witness ownership of knowledge. Add debug perception visualisation.
2. Use the shared road graph for patrol, pursuit and interception routes. Predict short-horizon collision/time-to-contact, yield at junctions and reserve/interact with lanes. Detect stuck actors; reverse/replan before any offscreen recovery.
3. Add one interceptor role, one telegraphed roadblock and one avoidable spike-strip encounter. Spawn outside camera visibility with reachable road positions and enough lead time. Use the same physics limits as comparable cars.
4. Build a chase course through open boulevard, market traffic, narrow alley and construction escape. Breakable route furniture changes the event without deleting crucial colliders or allowing walls to vanish.
5. Tune heat gain, escape conditions, search time, arrest, impound and financial recovery. Vehicle switching only helps when unseen and consistent with police knowledge.
6. Layer radio dispatch, changing sirens, tyre/impact audio, restrained camera response and a clear “searching/escaping/escaped” HUD state.

Exit: scripted scenarios prove pursuit acquisition, legitimate loss of sight, search, reacquisition, escape and arrest. Repeat across five seeds, day/night, starter/tuner and low/high quality. Record spawn visibility, wall strikes, rotation discontinuities, deadlocks and resource peaks. A three-minute human-driven run must offer at least two genuine escape decisions.

## 7. S4 — first gang, first business, first owned block

Tasks:

1. Add four faction definitions and persist separate respect/hostility; keep police heat independent. Implement visible reasoned changes from contract success, betrayal and witnessed violence.
2. Build one contact with relationship-gated work and alternate negotiation/reward choices. Track a small explicit event history rather than pretending every NPC has unlimited memory.
3. Add influence and control to a small cluster of blocks. Implement intel → disruption → takeover → owned → contested → defended/lost states with stable IDs and clear transition requirements.
4. Create one ownable garage business: physical location, purchase, useful interior, operating cost, repair benefit, crew mechanic assignment and capped earnings. Reflect ownership with signage and crew presence.
5. Create an announced rival counterattack. Player can defend, delegate or accept a bounded loss. Do not punish ordinary app absence with uncontrolled destruction.
6. Add empire map filters, relationship details and business ledger. Show both benefit and obligation before buying or taking territory.
7. Connect the full benchmark loop: profitable trade → rival ambush → combat → pursuit → escape → sale → business investment, with consequences applied once and saved.

Exit: take, defend, lose and retake the same block; reload at each state; stream away/back without resetting control. Demonstrate two faction choices leading to different contacts or risks. Completing the vertical slice is the first serious depth milestone, not completion of the final game.

## 8. S5 — authored city, campaign and long-term depth

Expand only proven systems:

- Replace district template repetition with authored block/road data. Keep graph, tiles, lane tangents, sidewalks, cover and colliders generated from a shared description. Add district landmarks and alternative routes before decorative clutter. Validate all spawn/mission/contact points and GPS reachability.
- Build a per-district art sheet: palette, facade families, signage, vegetation, pavement, light temperature, ambient audio and density. Match imported assets in scale, roughness, shadows and silhouette. Preview each asset at the actual gameplay camera before accepting it.
- Move mission scripts into a staged mission director with prerequisite, enter/update/complete/fail, retry checkpoint and one-time reward handling. Upgrade the first five missions before writing the remaining 13. Three acts culminate in distinct heists; branch consequences reuse systemic faction/business state.
- Add remaining commodity profiles, contacts and events; tune route profits and sinks using ledger data. Add all nine markets to persistent stock simulation.
- Migrate vehicle ownership from model names to unique instances. Add car theft/sale/impound, garage slots, cargo assignment and a shared live customization preview. Reach the final fleet target through meaningful archetypes, not cosmetic duplicates counted as new handling.
- Add multiple safehouses/business types with enterable interiors and useful crew roles. Deliver property upgrades in-world and in saves.
- Complete cinematic tools, original dialogue, subtitles, character customization, audio mixer and adaptive music. Add reduced motion, UI scale, blood and haptics options.

Exit: final-goal content floor met with a content manifest listing every mission, district landmark, car archetype, business and job family, each linked to a playable test. Conduct full campaign runs on fresh and migrated saves. Mission count alone is not an acceptance result.

## 9. S6 — release quality and sustained mobile play

Run the final-goal performance and usability gates on actual named devices. Capture 30-minute mixed sessions and compare warmed resource counts at matching locations. Profile before optimisation; pool/instance repeated objects, cap actor/physics/audio work, prewarm likely assets and avoid shader compilation during combat. Quality tiers preserve hit/collision/AI correctness.

Verify save migrations from every publicly shipped version, corrupted/interrupted writes, unavailable storage, restart mid-mission, repeated import/update and background resume. Keep settings and purchased appearance. Audio, camera and controls recover after every modal/cutscene/phone interruption.

Have at least five unfamiliar players attempt the first-session and UI tasks. Record completion, confusion, mis-taps, perceived handling and reasons for stopping. Address recurring issues and retest the affected flow. Produce an unresolved-issues ledger with severity, reproduction, evidence and owner. Physical-device blockers prevent a release-ready claim even when desktop tests pass.

## 10. Reproducible checks and each-AI handoff

Standard CI commands (use the installed project's versions):

```sh
pnpm install --frozen-lockfile
pnpm exec tsc -p tsconfig.crime.json --noEmit
node --experimental-strip-types scripts/check-crime.mjs
node --experimental-strip-types scripts/check-mobile-controls.mjs
node --experimental-strip-types scripts/check-world.mjs
node --experimental-strip-types scripts/check-person-disposal.mjs
node --experimental-strip-types scripts/check-city-layout.mjs
node --experimental-strip-types scripts/check-road-assets.mjs
node --experimental-strip-types scripts/check-traffic.mjs
node --experimental-strip-types scripts/check-street-combat.mjs
node --experimental-strip-types scripts/check-daylight.mjs
node --experimental-strip-types scripts/check-skid-lifetime.mjs
node --experimental-strip-types scripts/check-impact-immersion.mjs
pnpm build
```

Browser entry points: `scripts/playtest-blacktop.mjs`, `scripts/playtest-districts.mjs`, `scripts/playtest-immersion.mjs`. They require an external Playwright/Chromium runner; environment hooks are in the script headers. Use the production build and real keyboard/pointer/touch actions. Fixture placement and direct simulation clock manipulation must be labelled. Default `pnpm test` targets the inherited archive and does not replace crime-specific tests.

For every delivered slice, leave:

1. Commit SHA, exact changed files and the scenario now playable.
2. PASS/PARTIAL/BROKEN/NOT IMPLEMENTED/NOT TESTED table with evidence, not aspirational descriptions.
3. Reproduction steps, build/test commands, raw output, screenshots/video and any fixture notes.
4. Save compatibility, asset licenses and performance deltas with device/browser identified.
5. Remaining top three tasks, dependency on the next slice and known risks.
6. A pinned importer manifest when runtime files change, exact file count and a simple positive Aippy import prompt. Documentation-only updates need no runtime import.

### First task for the next AI

Inspect current HEAD and the persistent-economy report, reproduce the current buy/drive/sell/reload loop, then implement **S2's polished pistol encounter**: portrait movement/aim/fire/reload, obstruction/cover, hostile perception and police consequences. Preserve the saved market/cargo/receipt state and existing controls. Continue toward the connected ambush, pursuit and faction slice. Physical-device profiling from S0 remains outstanding; do not repeat the completed S1 core or claim its broader balance/release gates are finished.
