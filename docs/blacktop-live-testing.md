# BLACKTOP EMPIRE — live test settings

14 October 2026. Tap the visible TEST SETTINGS button. Opening resumes the streets and clears held input. The panel edits the actual running game; minimise it to the FPS pill while driving. It also shows draw calls, triangles, geometry and texture counts.

There are 226 tunable values. Search by label, group or JSON key. The two-column numeric editors allow decimal/negative values where meaningful. The ↺ beside a field restores that field's committed default; RESET ALL restores every committed test default. Changed only filters your overrides. Test values persist separately in `blacktop-live-test-v1`; the existing game save and economy remain in their original key.

## What you can tune

Camera height/distance, pitch/heading overrides, zoom/follow/turn response; all six vehicle profiles; throttle/brake/steering response; touch-stick radius/deadzones and aiming assistance; car/wall/prop collision sizes; three weapons' implemented damage/range/ammunition/reload/cadence/economics; incoming damage and invulnerability; destructible mass/impact thresholds; lighting/exposure/shadows/render resolution; clock speed/manual time; engine/skid/siren/crash/gunfire volume; population caps; police perception/search/arrest; commodity base prices/stock/demand, economy/empire clocks, contract terms and business finances.

Camera pitch and heading `-1` use the normal follow behaviour; manual clock `-1` resumes time. Heights/distances and explicit pitch are alternatives: disable the pitch override to tune height directly. Booleans use 0/1. Settings such as starting ammo and contract duration apply when a new arsenal/job is created; they do not invent inventory or rewrite an already accepted deadline. Population increases use normal spawning; decreases remove excess civilians/traffic immediately. Frame-step and city road/layout topology stay part of the code, not editable save values.

DAY/NIGHT, REPAIR, HEAL and LOSE HEAT are labelled test actions. Invulnerability is optional and defaults off.

## Send defaults back

COPY JSON exports version, game and a `settings` object of stable names/current values. If clipboard permission is unavailable, the panel presents selectable JSON. DOWNLOAD saves `blacktop-test-settings.json`. IMPORT accepts either this export wrapper or a flat object of known finite setting values. Send the JSON back to the developer to promote selected test values into committed defaults. Reset buttons always mean committed defaults, not the last values you tested.

## Verification

23 production browser checks passed at 390×844,360×800 and 844×390: live camera/angle/exposure/night effects, per-field reset isolation, decimal preference edits, export/import, reload persistence, minimized driving, full reset, mute/zero-population behaviour and indoor clock freezes. Clipboard writer was a fixture; JSON content and all UI/game edits were real. No runtime errors. Crime TypeScript and production Vite build pass. Separate Node22 frozen CI evidence is in the live-settings report. Physical Android audio/performance testing remains with the player.
