# BLACKTOP EMPIRE — Final game goal

Updated 13 October 2026 (Australia/Sydney). **This is the target product contract, not a claim that these features already exist.** The execution order and current gaps are in [how-to-achieve-final-goal.md](how-to-achieve-final-goal.md). The earlier specification is preserved in [the archive](docs/archive/final-goal-before-2026-10-13-expansion.md).

## 1. The promise

Build an original, premium, portrait-first 3D crime sandbox for mobile: **start as a street trader with a battered car, survive a city that remembers your choices, and become the owner of a criminal empire.** Trade on the street, build relationships, race, fight, escape spectacular police pursuits, acquire businesses and defend territory. Campaign and free roam share one persistent city and progression.

The benchmark is the quality of a game someone actively chooses to return to and considers worth a premium subscription, not a subscription system to implement. No pay-to-win progression, mandatory ads or energy timers. Monetisation decisions remain separate from gameplay. The core game works locally/offline after its assets are available.

“AAA within mobile” means exceptional responsiveness, coherent art, readable action, convincing sound, rich interconnected systems, memorable authored moments and reliable performance. It does not mean photorealism, a huge empty map, or a list of buttons for unfinished features.

### Design references and interpretation

These are creative references, not assets or mechanics to copy verbatim. Reference pages were reviewed on 13 October 2026; their promotional claims are not independent playtest findings.

| Reference | What Blacktop takes from the reference |
|---|---|
| [GTA 2](https://www.rockstargames.com/games/gta2) | The requested top-down street sandbox, readable danger and gang allegiance fantasy. Our reputation model is specified below. |
| [Dope Wars — The Dopest](https://store.steampowered.com/app/4503300/Dope_Wars__The_Dopest/) | Regional price differences, finite resources, market shocks and risk across trading runs. Here, the journey takes place in a driven, explorable city. |
| [Saints Row](https://www.deepsilver.com/games/saints-row) | Personal identity, expressive vehicles, a recognisable crew and the fantasy of becoming a city boss. Our ownership system must visibly change streets. |
| [FLAIR](https://theflairgame.itch.io/theflairgame) | Its advertised ambition of reactive NPCs, gangs and ownable businesses. Blacktop prioritises authored assets and persistent systemic reactions; runtime AI generation and multiplayer are separate future proposals. |
| [Need for Speed: Most Wanted](https://www.ea.com/games/need-for-speed/need-for-speed-most-wanted) | Route choice, vehicle character, shortcuts, pursuit spectacle and escape. The linked EA page describes the 2012 game; the requested 2005-style escalating pursuit/rival fantasy also informs our original design. |
| [Justinmind game UI guide](https://www.justinmind.com/ui-design/game) | Clear hierarchy, contextual information, consistent visual language and immediate feedback. Applied as measurable portrait UI requirements, not copied screens. |

## 2. Interconnected play, not isolated activities

**Moment to moment:** steer through traffic, read danger, choose an alley, land a shot, take cover, make a deal, hear an approaching siren.

**Three to ten minutes:** spot an opportunity → choose cargo and a route → meet a contact → survive a complication → sell or deliver → bank the profit → repair or reinvest.

**Thirty to sixty minutes:** cultivate one faction, undermine another, upgrade a vehicle, unlock a business, complete a story chapter and change the district's balance of power.

**Long term:** assemble a distinctive fleet and crew, establish a supply network, own and defend businesses, shape nine districts and finish a branching campaign. Free roam continues with meaningful changing opportunities.

Example target sequence: a port oversupply creates a cheap purchase; an ally offers a better buyer; crossing a rival block triggers a telegraphed ambush; a short street gunfight attracts patrols; the player abandons a damaged vehicle, uses a parked getaway car, escapes through a construction shortcut, sells the surviving cargo, repairs the original car and returns to an owned garage. All cash, damage, faction changes and cargo losses survive reload. This is the benchmark vertical slice.

## 3. Vesper Bay: nine authored districts

Retain the seamless 3×3 city foundation, roughly 120×120 world units per district. The current centreline span is 360, with physical perimeter at ±187.5 after road widening. These are game-world units: perceived journey length and route choices matter more than a claim of real city scale. Expand only after measured travel times and density justify it.

| District | Identity and landmarks | Gameplay character |
|---|---|---|
| Dockside | Working waterfront, cranes, container lanes, customs yard | Bulk supply, freight interception, tight warehouse escapes |
| Industrial Belt | Foundries, scrapyards, service tunnels, rail sidings | Heavy vehicles, chop shops, destructible chase routes |
| Market Ward | Shopfronts, stalls, loading bays, commercial plazas | Busy street trading, crowds, fences and delivery work |
| Old Quarter | Dense brick housing, courtyards, narrow alleys | Foot pursuits, gang boundaries, intimate ambushes |
| Midtown | Mixed apartments, workshops, diners, transit stops | Starting home, accessible contacts, social crossroads |
| Neon Mile | Clubs, arcades, signs, rain-slick nightlife strips | Luxury demand, racing meets, nightclub disputes |
| The Hills | Homes, gardens, switchbacks, gated estates | Expensive cars, long sightlines, high-value contracts |
| Financial Core | Towers, bank plaza, parking structures | Corporate buyers, heavier surveillance, late campaign work |
| Civic Gardens | Parks, lake edge, civic buildings, sports spaces | Foot shortcuts, open sightlines, quieter meeting points |

Each district needs at least three recognisable landmarks, two useful alternative routes, a distinctive ambient sound palette and day/night population changes. A player should identify the district from a HUD-free screenshot. Streets transition naturally across borders.

Use varied 1×1, 1×2, 1×3, 2×2 and L-shaped blocks, plus individually authored plazas, yards and parks. Break the repeated rotated-template appearance. Correctly oriented **Kenney road geometry** supplies straights, curves, tees, crossings and junctions. Preserve 15-unit tiles and 10.5-unit asphalt unless an explicitly tested redesign changes the geometry, graph, lanes and colliders together. Add long curves, one-way streets, parking and safe sidewalks; ramps/bridges require genuine multi-level collision and navigation before use.

Map edges read as coastline, retaining walls, gates or connected perimeter roads. The car can reach the visible edge without premature invisible collisions. Render nearby chunks and a safety margin; retain gameplay state where pursuit, bullets and contacts still matter beyond the camera.

## 4. Driving and spectacular pursuits

The vehicle feels like mass on tyres: progressive throttle, speed-sensitive steering, lateral grip, yaw inertia, brake weight transfer, handbrake oversteer and controllable recovery. Starter sedan, tuner, muscle car, exotic, SUV and cargo van have distinct advantages and costs. Mobile steering assistance is adjustable and never silently teleports rotation.

Left thumb steers; right thumb uses throttle and brake/reverse, with reachable drift/nitrous. Reverse engages deliberately after braking. Camera eases close on foot and at low speed, opens with speed and threat, looks ahead and keeps the route visible above the thumbs. Inputs remain correct at 30/60 FPS and after pauses, modal changes and orientation changes.

Pursuits have readable stages: **incident → witness/report → pursuit → last-known-position search → cooldown → escaped**, with separate long-term vehicle notoriety. Police use sight, hearing and dispatch information. They search intelligently rather than knowing the player through every wall. Escalation introduces coordinated interceptors, roadblocks, spike strips and specialist units. Expensive helicopter effects come only after mobile profiling.

Crazy chases come from fair interaction: traffic near-misses, damaged steering, alley squeezes, construction barriers, blocked routes, coordinated flanking and last-second escapes. Telegraph roadblocks early enough to respond. No visible spawn-in, abrupt rotation jumps, wall ramming forever, impossible acceleration or unexplained arrests. Traffic yields, queues, avoids hazards and recovers from jams. Offscreen recovery stays out of sight and preserves pursuit consequences.

Every crash responds to contact position, relative speed and mass. Model-fitted colliders exclude empty canopy/roof space. Damage progresses through dents, shattered lamps/windows, loose panels, smoke, wheel/engine impairment and eventual breakdown; player, civilian and police cars obey the same visible rules. Detached parts have bounded physics. Cars are repairable and recoverable without trapping a broke player.

## 5. Required on-foot street combat

**Open street gun battles are a core final feature, not an optional later extra.** Walking, sprinting, melee, weapon handling and getting in/out of vehicles form one continuous control experience.

Start with a polished pistol, shotgun and automatic weapon, plus melee. Differentiate range, cadence, recoil, reload, ammunition cost, sound and impact; expand only after these feel good. Left thumb moves; right thumb aims/fires with adjustable aim assistance, a clear target cue and simple reload/weapon selection. Offer an accessible assisted-fire option. Holster and interact must be easy to distinguish.

Bullets test actual world obstruction and hit regions; cars, walls and appropriate props provide cover. Visible muzzle flashes, tracers used sparingly, material impacts, hit reactions, knockback, animation blends and spatial audio communicate what happened. Enemies acquire targets through perception, use cover, reposition, retreat and react to allies falling. Civilians flee or defend themselves according to personality; gunfire creates witnesses and police response. Gang reinforcements arrive along believable routes with limits.

Keep fights legible in portrait: distinctive hostile silhouettes, readable aim direction, offscreen threat indicators and brief damage direction cues. Hits never come from invisible, untelegraphed spawns. Defeat means hospital, lost opportunity and a bounded financial/inventory penalty; recovery keeps the campaign playable. Blood, flashes, shake and haptics have settings. Adult fictional violence has consequences; farming civilians is not the best progression loop.

## 6. Real playable commodity trading

“Real” means a functioning economy with actual buying, transporting, selling and consequences. Commodity names and values are fictional game data. Retain the four existing goods and grow to eight differentiated goods: cheap bulk, volatile high-value stock, scarce luxury goods, stolen electronics and vehicle parts, each with distinct cargo size, risk, suppliers and buyers.

Every market has finite stock, buying demand, replenishment, buy/sell spread and opening/contact conditions. Prices respond to supply, demand, local events, gang influence and police pressure within tuned limits. Purchases reduce available supply; sales consume demand. Large transactions move the market. Cargo occupies a particular vehicle or stash, can be transferred nearby and can be lost or confiscated. Travelling has meaningful risk and time cost.

Show unit price, quantity, total, capacity, available stock, average acquisition cost and estimated profit after known fees. Use observed price history and timestamped rumours; remote quotes are intelligence, not guaranteed live prices. Confirm consequential trades with immediate inventory/cash feedback. A completed exchange is atomic and saved once.

A persistent simulation clock drives markets, events and cooldowns. Reloading, changing mode, opening menus or changing device time must not reroll favourable prices, duplicate stock or replay rewards. Single-player pause freezes the world; offline income is explicitly capped and summarised if introduced. Give players access to a ledger, bank, stash and understandable money sinks: repairs, ammunition, property upkeep, crew wages and upgrades. Avoid both infinite arbitrage exploits and punitive grind.

## 7. Gangs, reputation and territorial ownership

Create four original rival factions with named leaders, visual identities, preferred districts, businesses, vehicles and tactics. Initial design identities: **Breakwater Union** (freight), **Velvet Circuit** (nightlife), **Ashline Crew** (industrial theft), **Crown Syndicate** (high-value finance). Final naming must be original and distinct from reference franchises.

Track separate values: faction respect, faction hostility, player street reputation and police heat. Helping one group can anger another. Respect unlocks contacts, discounts, work and negotiated passage; hostility changes patrols, ambush risk and access. Relationships change through witnessed acts and completed contracts, not unexplained global omniscience. Key contacts remember a limited set of persistent decisions.

Districts contain ownable blocks and business nodes. Ownership progresses through intelligence, disrupting rival income, earning local influence and a deliberate takeover encounter. Holding territory requires supply, security and relationships. Counterattacks are announced with clear response windows; defence can be delegated at a cost. District changes persist visibly through signs, patrols, shop access, traffic and crew presence.

Businesses include garages, clubs, warehouses, transport fronts and resale shops. Each adds playable work and strategic benefits, with costs and risk. Income follows a bounded simulation, not an unlimited claim button. Recruit a small named crew with roles such as driver, guard, mechanic and broker; skills have trade-offs, wages and loyalty. Begin with useful assignments, then add active companions only with reliable navigation.

## 8. Story, jobs and progression

A grounded adult crime drama with dark humour, allies, rivals, betrayals and choices with visible consequences. The player creates an identifiable adult character with readable clothing, hair and silhouette; the world uses authored, locally available character assets and coherent animations.

Target three campaign acts and at least 18 authored missions, supported by eight reusable job families: trades/deliveries, races, vehicle acquisition, escort, retrieval, business defence, rival disruption and multi-stage heists. This is a final content floor, not permission to produce filler. The first five missions must be excellent before expansion. Missions combine traversal, interaction, dialogue, combat or pursuit rather than merely crossing a radius.

Each mission has an identifiable giver, launch conditions, staged objectives, optional approaches, meaningful failure, fast retry, checkpoints, one-time rewards and save/resume support. Choices affect later contacts, faction relations or payout routes. Cinematics use present world actors, intentional framing, concise dialogue, subtitles and skip controls; restore camera/control state reliably. Free roam preserves story progress and offers every system without compulsory story gating, while retaining earned ownership and economy rules.

First-session target: movement within 20 seconds after launch, a clear job within one minute, first trade or delivery within five minutes, and one memorable consequential event within ten. New players learn through short contextual prompts, not a tutorial wall.

## 9. Properties, fleet and identity

Own multiple enterable 3D safehouses with distinct interiors, garage spaces and upgrade paths. Stash, security, furnishings, workshop and weapon storage visibly appear. Parking and interaction distances match the world. Active police at the door prevent magical escape. Interiors offer meaningful interactions, not only an upgrade menu.

Target at least 12 owned-vehicle variants across six handling archetypes. Unique vehicle IDs support multiple examples of one model, each retaining condition, cargo, mods and appearance. Purchase, theft, sale, storage, impound and towing form a complete ownership loop.

Real-time garage previews show the exact world vehicle. Paint, wheels, stance, aero, wraps and lighting are visible; engine, transmission, tyres, brakes, suspension, armour and nitrous affect measured handling with costs/trade-offs. Preserve existing saves through migrations. Cosmetic ownership is not lost during mode switches or updates.

## 10. Portrait UI and navigation quality

A cohesive street-instrument aesthetic: dark shaded panels, restrained warm accent for objectives/profit, cool navigation colour and danger red used meaningfully. Use the bundled Barlow/Rajdhani where legible; body copy remains readable. Icons share one style and carry labels where meaning is ambiguous. No emoji-led production HUD.

Default 390×844 layout: top safe area contains compact status and one active objective; a tappable radar sits away from the driving sightline; lower corners hold controls; context actions appear within thumb reach. Combat swaps vehicle metrics for health/ammo. Trading, inventory, jobs, garage and empire screens each prioritise their current decision. Collapse secondary information instead of shrinking all text indefinitely.

Targets: normal body text about 14–16 CSS px; secondary labels 12–13; primary touch targets at least 48×48 CSS px with separation. These are design targets tested on real phones, not a guarantee from viewport emulation. Provide UI scaling, left-handed control layout, steering sensitivity, colour-independent icons, reduced motion, subtitles and independent audio sliders.

Expanded map supports pan/zoom, player heading, districts, businesses, ownership, contacts, heat/search areas and route selection. Filters prevent icon soup. HUD guidance provides next turn, distance and an offscreen destination arrow; arrived/blocked states are explicit. Jobs show reward, risk, prerequisite and travel distance. Menus pause single-player action and clear held controls; closing restores context.

Release usability target: at least four of five unfamiliar testers can start a job, navigate to it, trade, repair and resume play without outside instruction. Test all major flows at 390×844, 360×800, 844×390 and desktop, including notches and keyboard/host resizing.

## 11. Art, physics, light and sound direction

Cohesive stylised realism: detailed readable silhouettes, consistent scale, authored colour/value grouping, strong contact shadows, curated signs, furnishings, planted spaces, litter and wear. Asset quantity alone is not art direction. Close on-foot views expose hands, character faces, pavements and shopfronts, so these need higher care than distant roofs. Tall buildings fade only when obstructing play.

Day is 06:00–20:00; yellow dawn 05:00–06:00; golden shoulder 20:00–21:00; pink/red dusk 21:00–22:00; night 22:00–05:00. Night retains readable road surfaces and silhouettes. Fit headlights/brake lamps to actual model surfaces, brighten braking and disable headlamps in full daylight. Visible unbroken streetlamps illuminate at night. Use emissives/pooled light footprints widely and a small measured number of real shadowed lights.

Props react by material and mass: cones scatter, signs and streetlamps topple, fences break, trees fall only under sufficient force. Broken scenery stays until its chunk despawns; persistent mission/ownership objects retain meaningful state across streaming. Skid trails are smooth, held for ten seconds, fade over ten more and release their draw resources. Pedestrians have convincing impacts and bounded physical reactions; full skeletal ragdolls require a demonstrated benefit and device budget.

Audio is a gameplay system: layered engine load/gears, tyre slip, surface-specific impacts, spatial gunfire, distinct weapons, gang voices, dispatch chatter, distant sirens, traffic beds and district ambience. Adaptive original/licensed music responds to cruising, combat, pursuit and escape. Separate master/music/engine/SFX/radio controls; audio unlock, pause, interruption and resume must work in Aippy on Android. Haptics are optional and restrained.

Maintain asset provenance in `docs/blacktop-assets.md`: author, exact source, per-asset license, conversion, scale/orientation, local target and size. Build on Kenney roads/city/cars, suitable Kay Lousberg scenery and licensed Quaternius/Poly Pizza characters/props. Individually verify licenses; a hosting site is not a license. Bundle assets locally and share geometry/materials. Original story, brands, soundtrack and art identity remain essential.

## 12. Engineering, performance and release contract

Keep the existing Aippy host/build-time importer, React/Vite/Three stack, single entry and useful archive. React owns UI, not per-frame actor simulation. Fixed-step simulation and render interpolation underpin consistent movement. Domain systems communicate through explicit events and stable IDs; avoid growing one all-purpose component indefinitely. Shared world geometry powers navigation, colliders and maps.

Release targets, to validate on a named midrange Android device in the Aippy host: sustained 60 FPS preferred (p95 frame interval ≤20 ms, p99 ≤33 ms); a deliberately selected 30 FPS quality tier may use p95 ≤37 ms and p99 ≤50 ms. Report scene, device, quality, thermal state and sampling method. No recurring >100 ms traversal hitches. Touch-to-visible feedback target ≤100 ms, measured end to end. Quality reduction trims shadows, reflections, particles and decorative density before reducing control or collision correctness.

A 30-minute warmed drive/fight/chase loop must show no unbounded growth in retained scene objects, geometry, textures, audio nodes or heap. After returning to the same scene and comparable collection points, resource counts return near baseline; investigate sustained >10% growth. Establish draw-call, triangle, light and memory budgets from the first physical-device profile. Publish measured budgets rather than inventing a universal mobile number. Initial asset delivery must fit the existing importer/host and show progress; target first control within 20 seconds on a documented representative cold-load connection.

Final acceptance requires all core systems above playable together; 18 authored missions; nine distinct districts; complete trading/ownership/faction/combat/pursuit loops; robust save migration and recovery; accessible portrait controls; licensed assets; physical Android audio/multitouch/performance evidence; and fresh human playtest recordings. Automated checks supplement this evidence. A build, a screenshot or a feature counter alone never establishes completion.

Use **PASS / PARTIAL / BROKEN / NOT IMPLEMENTED / NOT TESTED** with evidence links in every handoff. The current foundation and remaining work are documented in the companion roadmap; this contract is the destination.
