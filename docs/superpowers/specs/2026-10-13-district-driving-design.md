# Blacktop city and driving refinement

User intent: improve the active portrait mobile crime/economy game using their Aippy recording as runtime evidence. Replace equal blocks with a seamless authored nine-district city; authentic correctly rotated Kenney roads, curves and T junctions; smooth vehicle handling/traffic, legible nighttime headlights/signs, on-foot punching with flee/fight reactions and more consequential crash damage.

City: finite 360×360 metres, nine 120×120 districts. A connected 30m street lattice supports authored merged 1×2,1×3,2×2 and L blocks, plus corner/T connectivity. Render10m Kenney tiles from the same graph used by routes, collision placement and minimap. District themes: financial downtown, homes, commerce, mixed residences, industrial yards, parks, waterfront, nightlife, historic courtyard. Load nearby60m chunks; no whole-city GPU scene.

Physics: dependency-free front/rear tyre slip with pedal/steering smoothing and inertia. Review public GitHub controllers rather than injecting an unrelated full engine. Existing upgrades, SAT contacts and save format remain compatible. More significant high-speed deformation/damage, mild scrapes remain survivable.

Traffic: lane-following routes from graph, speed control for turns, forward car/wall avoidance, bounded offscreen spawn aligned to a lane, recovery through brake/reverse steering rather than rotation teleport. Set all visual poses before scene attachment; do not render at origin for a frame.

Walking: one punch action available on foot via thumb button/keyboardF. Range/facing/cooldown constrain hits; visible arm pose/hit feedback; some pedestrians flee, others approach and retaliate. Player health separate from car health, knockdown/recovery near safehouse, no invented armed combat.

Night: moonlight maintains roadway/car readability, emissive signs/windowlighting, bounded playerheadlights and cheap NPCbeam footprints. No hundreds of realtime lights. Route markers cyan/chevrons distinguish directions from road paint.

Verification: graph connectivity/shapes/orientations, actual source roadasset opening QA, smooth handling/damage/reverse, traffic yield/recovery, combat range/cooldown. Build/check activeCrimeGame, play production at portrait/landscape/desktop, actualdrive through bends and districts, inspectnight andcarsbeforeload. Publish exact pinned update/full manifests and evidence; Android/15min benchmark and entire final-goal not presumed complete.
