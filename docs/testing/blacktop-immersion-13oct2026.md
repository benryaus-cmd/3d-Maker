# Blacktop Empire: wider roads and physical immersion

This pass implements the user's road, collider, skid, breakable scenery, map, lighting and physical-impact requests against active CrimeGame. The nine districts, saves, economy and campaign are retained.

## Implemented

- Road tiles increase from 10 to 15 m; asphalt from 7 to 10.5 m, exactly 50% wider. Graph spacing changes to 15 m so tiles join without overlap. The city retains its 360 m centreline span, 72 blocks and 185 buildings. Physical outer edge is 187.5 m from origin. Lanes move to 2.4 m offsets; the maximum tested chassis corner remains 4.97 m inside the 5.25 m asphalt half-width.
- Model geometry supplies low solid colliders: tree trunks and lamp poles instead of full canopies/arms, plus actual fitted bench/building footprints. Foot circle checks remove inflated square corners. Stationary saves use oriented chassis overlap. Map limits constrain the actual hull instead of stopping its centre at the old 177.5 m inset.
- Skids use one 2,560-segment pool. They hold for 10 seconds, fade linearly for another 10, then expire. Empty pools stop drawing. GPU birth times and one clock uniform provide fading; soft edges and a 12 mm surface offset improve appearance. Pause/map freezes the clock. The pool supports the fixed-step maximum of 120 new segments per second throughout the 20-second lifetime.
- Local signs, traffic lights, benches, fences, dumpsters, trees, lamps and poles can break/topple. They remain instanced until impact, then only the struck instance converts to a falling cached-model clone. Gravity, momentum, friction and ground settling leave it fallen until its chunk unloads. Reload reconstructs it. Nearby active updates are bounded to 96 bodies per frame. Broken lamps lose their individual bulb, pool and point-light illumination.
- Break thresholds in m/s: cone 3, sign/hedge 5, bench 6, fence 8, dumpster 10, lamp 12, tree 14, pole 16. Object mass controls car momentum loss and damage; a 4 kg cone no longer behaves like concrete. Building/car impacts retain the existing damage model.
- Player or NPC vehicle impacts launch pedestrians with ballistic knockback/tumbling and wall, ground and perimeter collision. Existing death animation and corpse cleanup remain. This is simplified motion, not a complete jointed ragdoll solver.
- Radar tap opens an expanded city map with districts, roads, player, parked car, markets, police and target. A market tap sets navigation and closes the map. Controls and physics pause while open; portrait and landscape work.
- Head/tail lamps fit the actual car geometry. Five models reuse their textured lamp triangles; race lamps fit to its body surface. Overlays follow body roll and deformation revisions, with bounded disposal. Braking brightens rear lamps during day/night, including filtered NPC braking. Headlamps and spotlights switch off during daylight.
- Full day is 06:00–20:00. Yellow dawn fades 05:00–06:00; a golden shoulder covers 20:00–21:00; pink/red dusk fades 21:00–22:00; night covers 22:00–05:00. Smooth boundaries avoid jumps. Visible unbroken streetlamps light as night weight increases. Lighting uses two reusable player spotlights, three local street point lights and cheaper emissive/gradient pools elsewhere.

## Verification

- Crime TypeScript check, eleven targeted suites and production build: PASS. Includes fourteen vehicle handling groups, actual GLB trunk/pole/bench bounds, per-instance removal, persistent settling, late-loading broken props, glow removal, chunk reset, GPU sharing, all six car lamp fits, deformation/disposal, road joins and rotated chassis routing.
- Existing production controls/layout: 21 assertions PASS at 390×844, 844×390 and 1280×720.
- New production immersion: 17 assertions PASS. Actual radar/market taps, keyboard driving and brake pointer; engine contact topples a loaded lamp; it settles beyond the old 2.5-second timeout and resets after chunk removal/reload. Actual driving approaches the widened edge with the hull inside it. Car contact launches/displaces a pedestrian. Requested lighting and skid ages run against the production renderer. No JavaScript or GPU shader errors.
- Time, skid geometry, prop/edge approaches and pedestrian placement are explicit fixtures. These isolate cases; they do not claim every object or route was manually driven. A separate fallen-lamp view confirms a π/2 angle, settled state and quaternion `[.7071,0,0,.7071]`.
- Build approximately 9.13 MB, 2.65 MB gzip. No new dependency or external asset download. Browser HTTPS requests were blocked; runtime assets work locally. Raw observations: `blacktop-immersion-measurements.json`.

## Screenshots

[Wider roads](media/blacktop-immersion-wide-roads.png) · [Expanded map](media/blacktop-immersion-city-map.png) · [Fallen lamp](media/blacktop-immersion-fallen-lamp.png) · [Near edge](media/blacktop-immersion-edge.png) · [Pedestrian impact](media/blacktop-immersion-pedestrian.png).

Lighting: [Dawn](media/blacktop-immersion-dawn.png), [Day](media/blacktop-immersion-day.png), [Golden shoulder](media/blacktop-immersion-golden.png), [Pink dusk](media/blacktop-immersion-dusk.png), [Night](media/blacktop-immersion-night.png). [Landscape map](media/blacktop-immersion-landscape-map.png).

Reproduce using `scripts/playtest-immersion.mjs` and `scripts/playtest-fallen-visual.mjs` with the external Playwright runner. Node 22 CI includes the new checks.

## Limits

Physical Android performance/audio/notches and a 15-minute stress run remain unverified. Falling scenery has simplified ground physics; chained debris contacts and full skeletal ragdolls remain unfinished. Full campaign balance remains unverified. The nine unrelated dormant HubSide/zombie test failures previously established were not rerun or modified. `final-goal.md` remains the ambition, not an AAA completion claim.
