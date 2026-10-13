# BLACKTOP EMPIRE — integrated street-empire sweep

13 October 2026. Baseline `a70c857556a0b94a8b41d9b78a0daf8264af163b`. This is a substantial connected gameplay slice, not the completed AAA/mobile-release goal.

## Scope

Six domain workers built firearms/rival perception, police knowledge/search, factions/contracts/business/territory, mobile combat UI, shared weapon effects/audio and district identity. Parent integration connects them through real health, ammunition, cargo, cash, upgrades, save v4, map routes and incident consequences. Independent browser QA and integration review followed.

Runtime changes: `Firearms.ts`, `PoliceDirector.ts`, `Empire.ts`, `EmpirePanel.tsx`, `CombatControls.tsx`, `WeaponVisuals.ts`, `CombatEffects.ts`, `CombatAudio.ts`, `DistrictIdentity.ts` and their styles; integration in `CrimeGame.tsx`, `Systems.ts`, `Controls.ts`, `CityMap.tsx`, `World.ts` and `crime.css`. No new runtime dependency, external asset or host/importer change. Guns, sound and signs are original code-built additions to existing licensed cars/civilians/buildings.

## Playable additions

| Area | Status | Evidence/limits |
|---|---|---|
| Pistol, shotgun, SMG | PASS | Saved unlocks and finite ammo, timed reload, wall occlusion and hull hits; paid garage stock |
| Two-thumb combat | PASS | Independent actual CDP move/aim/fire, release and pause clearing; compact portrait/landscape layouts |
| Rival firefight | PASS | Real spawned guards and input-driven kills; perception/hearing/cover goals, return fire and car damage |
| Faction contracts | PASS | Owned Ember delivery, three-rival clearance and reward/cargo reconciliation |
| First business/block | PASS | Garage purchase/income, guarded takeover and timed counterattack; first-capture reward cannot repeat |
| Police director | PARTIAL | Actual incident delay/pursuit/search plus domain arrest/escape/roadblock tests; full cinematic pursuit tactics unfinished |
| District identity | PARTIAL | 27 pooled signs/landmarks with night/ownership variants; district streets still need authored differentiation |
| Save v4 | PASS | v3 migration preserves economy; ammo, health, factions/ownership/settings/police knowledge persist |
| Physical Android/Aippy | NOT TESTED | Software Chromium/viewport emulation cannot establish device FPS, touch latency, sound quality or thermal behaviour |
| Final campaign/crew | NOT IMPLEMENTED | Current scripts/contracts are foundations; no branching multi-chapter production or crew systems |

## Review findings fixed

- Weapon selection cached before asynchronous GLB hand bones existed. Rig identity now refreshes the attachment/pose; real bundled-rig regression was observed failing before correction.
- Landscape world actions overlapped RELOAD by8px. Raised contextual action row and added explicit rectangle-intersection checks.
- Police on-foot speed was inferred from only some inputs; now uses actual position delta, including lateral keys and wall blocking.
- Indoor police perception reused stale outdoor position. New regression failed before correction; valid safehouse entry now suppresses sight/arrest while continuing last-known-position search. Visible police still block entry.
- Owned-block façade expected a district key. Engine now supplies Midtown ownership mapping.
- Abandoned/delegated squads retained live attackers indefinitely. Resolved squads holster/flee, obsolete tags retire, active tagged population caps at8, total streamed population at32, dispersed actors retire after12s, and distance culling preserves defeat records for active waves.

## Verification

Local Node24:20active check commands passed; fresh targeted reruns cover modified systems. Crime TypeScript and direct production Vite build pass. Production HTML about9.234MB /2.689MB gzip. Local `pnpm build` triggered environment supply-chain dependency verification/network problems; direct project Vite build completed. GitHub Node22 with frozen pnpm10.10.0 install passed all 20 active checks, TypeScript and pnpm build.

**134 passing browser assertions across phases:** new sweep62, original controls21, immersion17, economy34. The broad sweep run recorded60/61: its sole failed condition incorrectly assumed screen-right means positive worldX. A focused2/2motion rerun verified actual D input moves120→100worldX at5units/s without arrest, then key release enables a real arrest/fine. The corrected runner and both raw reports are retained; this is not presented as an untouched61/61single run. There are59distinct check names because some lifecycle assertions repeat for successive waves.

Original driving steering waits now use actual simulation time; software WebGL wall time did not guarantee enough physics ticks. The economy traversal/braking deadline was widened without changing destination or stopped-contact assertions. Its safehouse placement fixture now clears the authoritative police state, rather than only editing the old heat facade. No production behaviour was weakened to make these checks pass.

[Consolidated sweep report](street-empire-2026-10-13/final-qa-report.json), [full raw run](street-empire-2026-10-13/playtest-sweep-report.json), [focused motion history](street-empire-2026-10-13/playtest-sweep-motion-report.json), [economy report](street-empire-2026-10-13/economy-playtest-report.json), [immersion report](street-empire-2026-10-13/immersion-playtest-report.json), [active checks](street-empire-2026-10-13/sweep-checks.json), [build](street-empire-2026-10-13/sweep-final-build.log).

Representative screenshots: [portrait combat](street-empire-2026-10-13/07-combat-390x844.png), [landscape spacing](street-empire-2026-10-13/07-combat-844x390.png), [two-thumb firing](street-empire-2026-10-13/02-actual-two-thumb-combat.png), [gun hand fit](street-empire-2026-10-13/15-pistol-fit-inspection.png), [defended block](street-empire-2026-10-13/16-takeover-defended-empire.png), [police search map](street-empire-2026-10-13/17-police-search-map.png), [armoury](street-empire-2026-10-13/18-armoury-purchases.png), [retired counterattack](street-empire-2026-10-13/21-retired-counterattack.png).

Published runtime [11a5b41](https://github.com/benryaus-cmd/3d-Maker/commit/11a5b41cb9093b70184cb1e2b1ec3b0ed4f7a100); frozen Node22 CI [38381947081](https://github.com/benryaus-cmd/3d-Maker/actions/runs/38381947081) SUCCESS. [Step evidence](street-empire-2026-10-13/node22-ci.json). One combined22-file incremental manifest and95-file full snapshot are pinned to that runtime; every source/target/count was checked against its published Git tree. Use the full snapshot to obtain the whole sweep in one import regardless of which earlier update was applied. Inputs are real keyboard/pointer/CDP touch, with direct placement/time/inspection fixtures separately labelled. No physical Android, audio listening,15-minute phone memory benchmark or subjective human handling certification is claimed.

The dormant archive suite remains500/509 with the same9previous failures: out-of-order pending basketball shots; district lamp distance; poster snapshot; unloaded/updated artwork; timed-out artwork queue; local poster immediate rendering; delayed poster upload interruption; paused modal gravity. These belong to the dormant game and are not silently counted as passed.

## Continue from here

Complete device gates, tune the connected loop, author unique route/landmark/campaign content, and extend ambient faction/contact reactions and properties/crew. Preserve tested economy/save transactions and the Aippy host. Use [how-to-achieve-final-goal.md](../../how-to-achieve-final-goal.md).
