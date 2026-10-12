# Blacktop mobile presentation and feel

The user's authorised goal is a substantial playable visual overhaul of the existing Blacktop game, taking the close framing, compact HUD and immediate controls of their Dead City reference. Preserve final-goal.md, saves, economy, missions, local assets, Vite/Aippy pipeline and single React entry. Work toward premium presentation without describing the entire final-goal contract as finished.

## Art and city
Make Dockside a coherent near-camera district: real Kenney roads and junctions, pavement detail, groups of buildings and shopfronts, alleys, parking, freight/yard blocks and planted park pockets. Preserve the 32m street graph used by markets and NPCs. Bundle reviewed Kenney and free KayKit models locally and document provenance; do not buy or assume access to paid park extras. Imported assets use inlined URLs through assets.ts; CityModels.ts supplies semantic role-to-key mapping. Share geometry/materials and instance repeated models where practical. Use directional light, contact shadows, changing sky/ambient colour, window and streetlamp lighting for a continuous day/night cycle without distant fog or large postprocessing chains.

## Camera and vehicle feel
Orthographic 3D, pitched enough to read model depth. Portrait car below centre with forward road visible. Smooth zoom: close while walking/slow, broader at high speed. Heading-aware damping, no abrupt rotation or camera sickness. Preserve separate interior transition snap. Live front-wheel steering, wheel rotation, suspension/body lean and brief collision response; continuous connected skid ribbons replace separated rectangles. Physics remains fixed-step and independently testable; make steering/grip recovery progressive, retain reverse, solid oriented collisions and damage.

## Mobile UI/input
Left analog stick controls steering in car and two-axis movement on foot. Right thumb uses clear throttle and brake/reverse pads; drift/nitro secondary. Independent captured pointers and keyboard fallback must coexist, clear on cancel/focus loss/menus, with no sticky sources. Controls has steer, moveX, moveZ analog values while preserving existing boolean keyboard/pedal fields.

Small readable locally bundled fonts, charcoal translucent panels, restrained amber/cyan accents, compact cash/wanted/health/speed, minimap and expandable mission card. Navigation displays active job name, distance and direction; the world shows a street-following route. Nearby actions remain reachable and panels close cleanly. Proper portrait layout at 390x844 and smaller devices, graceful landscape/desktop. Player on foot uses an existing locally bundled animated Quaternius human, not cylinder placeholders.

## Integration contracts
- assets.ts + CityModels.ts + bundled assets owned by asset task. Export CITY_MODELS role mapping and document asset dimensions.
- World.ts owned by world task. Existing exports retained. Extend follow with optional onFoot:boolean sixth/seventh argument after interior, add setNavigation(target:{x:number;z:number;label?:string}|null,player:{x:number;z:number;heading:number}):void; updateEnvironment(dt:number):void; clockLabel:string. Parent passes onFoot, ticks lighting once per drawn frame and updates navigation at HUD cadence.
- Controls.ts, MobileControls.tsx, crime.css, and CrimeGame.tsx React section starting at function ControlButton owned by UI task. Parent owns engine/type section before it. HUD gains foot:boolean, heading:number, clock:string; radar gains heading:number. Keep engine useRef as the third hook for QA.
- Parent owns vehiclePhysics.ts, engine integration, animated player, behavioural tests and final browser validation.

## Acceptance
Production screenshots must show substantial city/model detail and compact usable portrait controls, not blank rectangles or dead decorative UI. Drive using real touch events, reverse, drift, collide, walk, navigate to a job, visit safehouse and reload saved progress. Test low/high speed zoom, day/night light changes, controls cancellation, assets available offline, bounded draw calls/geometry as chunks stream. Report actual desktop software-WebGL metrics separately from any Android claims.
