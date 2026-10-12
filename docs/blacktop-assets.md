# Blacktop Empire Asset Provenance and Runtime Inventory
Updated 12 October 2026.

## New verified bundled CC0 models
Original artist: **Kenney**, https://kenney.nl/assets/car-kit and https://kenney.nl/assets/city-kit-commercial. Converted glTF Binary files distributed by **Hidencod/tge-assets**, https://github.com/Hidencod/tge-assets ; its LICENSE states all Kenney models and the derived converted files are Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/ . Code committed directly into this repository under `public/assets/crime/`, no hotlinked GLBs at runtime. Source repository paths and SHA-1s:

| Our path (under public/assets/crime/) | Original source in tge-assets | Git blob SHA |
| --- | --- | --- |
| vehicles/sedan.glb | packs/car-kit/sedan.glb | bcae84827ec41907f7f8ac8a314fa670cd372da1 |
| vehicles/sedan-sports.glb | packs/car-kit/sedan-sports.glb | 8561324019d09daf824577187b8bfdb72c6e78f5 |
| vehicles/police.glb | packs/car-kit/police.glb | 30ac9f6fdaace3c432782ef68c18f2da9b29b071 |
| vehicles/taxi.glb | packs/car-kit/taxi.glb | 86c40f0a72018bbf4d66f108928fb9a6a7093e0d |
| vehicles/suv.glb | packs/car-kit/suv.glb | 24610bb1088be7ee01f69125a9c7bc6216157239 |
| vehicles/race.glb | packs/car-kit/race.glb | 46f48acee35b0192a7be6a6be9d1ff6e1d9e11de |
| vehicles/debris-bumper.glb | packs/car-kit/debris-bumper.glb | f618a159b2b311fa1124fb3b26727da21526b63e |
| vehicles/debris-door.glb | packs/car-kit/debris-door.glb | e9b79749a9346e38785696d887abe8116bef704b |
| vehicles/cone.glb | packs/car-kit/cone.glb | 9c8c782c0f2fdd15ec6a47beee27b036a938bf6f |
| buildings/building-a.glb | packs/city-kit-commercial/building-a.glb | 351d7193acdde07877fc92ce6a7e60de092355c0 |
| buildings/building-b.glb | packs/city-kit-commercial/building-b.glb | a71ea2a4ccdca22181b6506a194094cac60f35e2 |
| buildings/building-c.glb | packs/city-kit-commercial/building-c.glb | 25296a35058fb056e0c777fe132d3f05c877ebc3 |
| buildings/building-d.glb | packs/city-kit-commercial/building-d.glb | a2cc6e10c0b0037b08bb2bf95d849007d07df265 |
| buildings/building-skyscraper-a.glb | packs/city-kit-commercial/building-skyscraper-a.glb | fc0b37efa6588889e74bd2199633a536526b9bd6 |

These bytes were transferred via the GitHub object API and verified as blobs by GitHub. No attribution legally required under CC0, but voluntary credit should remain.

## Existing library: inspect before reuse
`public/assets/characters/`: preloaded GLB people, currently available but **not yet animated or integrated with civilian traffic**.
`public/assets/quarter/`: 5 larger building glTFs with source material. Should be reviewed for overhead before importing into the new topdown chunk engine.
`public/assets/preview/`: preview building/character GLBs, unused by the new entry.
`public/assets/zombie-kit/`: Quaternius characters, zombie/weapon assets. Dormant in Blacktop Empire but not deleted.
`public/audio/sfx/`: zombie/war/pistol/rifle audio. The new game ships genuine CC0 recorded car engine, skid and collision samples. Police radio remains TODO; siren currently uses Web Audio synthesis.

## Next authentic assets to import
- Kenney Roads CC0 https://kenney.nl/assets/city-kit-roads ; GLB mirror under `packs/city-kit-roads/` (inspect filenames before selecting).
- Kenney Suburban CC0 https://kenney-assets.itch.io/city-kit-suburban ; use for safehouse exteriors.
- Quaternius Cars CC0 https://quaternius.com/packs/cars.html ; convert selected originals to GLB and standardize axes.
- Car engine loops CC0 https://opengameart.org/content/racing-car-engine-sound-loops ; optimize to Ogg and master against crashes/sirens.
- Optional Kenney racing sounds/source https://github.com/KenneyNL/Starter-Kit-Racing
- CC0 property props/interiors from Kenney Furniture Kit https://kenney.nl/assets/furniture-kit

## Correct runtime expectations
- `src/App.tsx` exports `src/crime/CrimeGame.tsx`.
- `src/crime/World.ts` uses local assets/crime/ GLBs and Three.js procedural fallback if fetch/load fails.
- Actual deformation of Kenney geometry is implemented but not yet visually verified in Aippy or Android. On close inspections verify mesh axis/pivot normalization and front/rear dent direction.
- Responsive scene/city built separately from zombie environment. Still needs external screen/playtesting to confirm frame rate, camera, collisions, AI and bundle correctness. No claim is made that Android was tested.

## Recorded vehicle sounds — downloaded and bundled (CC0)
Source: Kenney Starter Kit Racing https://github.com/KenneyNL/Starter-Kit-Racing . The README explicitly states that all game assets, including sounds, are CC0, and credits the skid sound to Landeplage (also CC0). Source code has a separate MIT licence.

| Our bundled file | Original source path | Git blob SHA | Playback |
| --- | --- | --- | --- |
| `public/assets/crime/audio/engine.ogg` | `audio/engine.ogg` | `5073c9d34bd5b9c55a40ac0237604dc17acc520b` | Loop pitch/volume responds to throttle and speed |
| `public/assets/crime/audio/skid.ogg` | `audio/skid.ogg` | `78b423b20df331af40bcf4088d2af305cb9bf54b` | Handbrake/corner slip |
| `public/assets/crime/audio/impact.ogg` | `audio/impact.ogg` | `38e9feedf2469628e03e1b8fed6664b1e2ca529c` | Collision sample |
