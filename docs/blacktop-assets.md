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

## Kenney City Kit Roads GLBs, sourced and bundled as CC0
All from `Hidencod/tge-assets/packs/city-kit-roads/`, same verified repository CC0 license as vehicle and commercial kits.

| Local path under public/assets/crime/streets/ | Source file | Original blob SHA |
| --- | --- | --- |
| dumpster.glb | packs/city-kit-roads/dumpster.glb | 4346d91ead95d98d6ca3fbee9f4d37f4d841fb4f |
| construction-barrier.glb | packs/city-kit-roads/construction-barrier.glb | f11e89081e7fa88dad4716b5e3b9042497f3019b |
| construction-fence.glb | packs/city-kit-roads/construction-fence.glb | 5a2ce85eb9feeceb7d972557be6d91b47f8e2933 |
| light-curved.glb | packs/city-kit-roads/light-curved.glb | fbe00e66616a20b0edc3b8b36039bec1dbc5953a |
| traffic-light.glb | packs/city-kit-roads/traffic-light.glb | 39d39733a048bf5c83b9dda85203c926ae5bc258 |
| road-sign-stop.glb | packs/city-kit-roads/road-sign-stop.glb | c6457263d88da000e7bbdc6abae10a90c27d7b97 |
| road-sign-warning.glb | packs/city-kit-roads/road-sign-warning.glb | 596cbf05cd1cf7b5c556ea417dd14f0ac5d4dd29 |
| construction-cone.glb | packs/city-kit-roads/construction-cone.glb | 463e1930ef71ee9b09e88562b7e4fc921f9ffb09 |
| electricity-pole.glb | packs/city-kit-roads/electricity-pole.glb | 6f71ae0b5d06aaf3acfc6ed867c56edcae89cee8 |

These are used as local 3D street dressing with physical proxy collisions; select items have destructible behaviour. The road surface geometry remains custom/instanced rather than imported road tiles.


## Mobile presentation palette — 13 October 2026

Runtime source is now `src/crime/bundled/`, imported through `src/crime/assets.ts` with `?url&inline`; all original 27 runtime asset keys remain. The new palette adds 15 GLBs and two fonts. The free **KayKit City Builder Bits 1.0** repository is by Kay Lousberg, https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 (tree `63976910ca04d16f0fc531b9c614244be8128713`). Its `LICENSE.txt` explicitly grants CC0 personal/educational/commercial use. No paid EXTRA assets are included; the free source contains no park fountain, so `CITY_MODELS.parkFountain` is undefined. Bench and bush supply real park detail. Kenney mirror tree is `08f0c913f6783cc81f9f6105a7cdda8562b1c192`; fetched LICENSE independently confirms converted files and embedded textures are CC0. License copies are bundled as `city/KAYKIT-LICENSE.txt` and `city/KENNEY-LICENSE.txt`.

Every GitHub file was fetched through the repository contents API, decoded from base64, and independently checked against Git blob SHA-1 (`blob {length}\0{bytes}`). Kenney GLBs remain byte-identical. KayKit glTF JSON + .bin + shared `citybits_texture.png` were packed into GLB 2 with four-byte-aligned chunks; the texture is embedded as a bufferView, and no external URI remains. Source units/materials/node transforms are preserved.

| Runtime key | Bytes | Source width / height / depth | Primitives |
| --- | ---: | --- | ---: |
| `roads/road-bend.glb` | 31616 | 1.00000 / 0.02000 / 1.00000 | 1 |
| `roads/road-crossing.glb` | 20152 | 1.00000 / 0.02000 / 1.00000 | 1 |
| `roads/road-crossroad-path.glb` | 30156 | 1.00000 / 0.02000 / 1.00000 | 1 |
| `roads/road-intersection.glb` | 19348 | 1.00000 / 0.02000 / 1.00000 | 1 |
| `roads/road-straight.glb` | 16696 | 1.00000 / 0.02000 / 1.00000 | 1 |
| `city/house.glb` | 110408 | 1.30000 / 0.83354 / 1.02814 | 1 |
| `city/kay-bench.glb` | 24084 | 0.40000 / 0.10000 / 0.15000 | 1 |
| `city/kay-building-a.glb` | 50120 | 1.20674 / 1.55007 / 1.45000 | 1 |
| `city/kay-building-b.glb` | 60152 | 1.60674 / 1.55007 / 1.30000 | 1 |
| `city/kay-building-c.glb` | 64856 | 1.20674 / 2.25007 / 1.30000 | 1 |
| `city/kay-bush.glb` | 24312 | 0.18936 / 0.38053 / 0.19909 | 1 |
| `city/kay-streetlight.glb` | 28432 | 0.26931 / 0.95991 / 0.06902 | 1 |
| `city/kay-watertower.glb` | 29564 | 0.49889 / 0.67000 / 0.49889 | 1 |
| `city/palm.glb` | 13616 | 0.93549 / 1.51459 / 1.01276 | 2 |
| `city/tree.glb` | 31412 | 0.84712 / 1.33242 / 0.76160 | 3 |

All roads are centred at X/Z zero, cover X/Z -0.5 to +0.5, and Y 0–0.02. Scale 8 makes an 8m tile. KayKit buildings have source minY 0.09993; normalize their base before placement. Tree/palm minY is -0.05. `CITY_MODEL_BOUNDS` exposes full scene-space min/max and dimensions. Road orientation should be checked visually when choosing tile rotations.

### Original source identity

| Local destination or conversion input | Original repository path | Git blob SHA |
| --- | --- | --- |
| `roads/road-straight.glb` | `Hidencod/tge-assets/packs/city-kit-roads/road-straight.glb` | `8707b6f3bf7c6f5fda3bb01f164a9ef0b09f6eb2` |
| `roads/road-crossroad-path.glb` | `Hidencod/tge-assets/packs/city-kit-roads/road-crossroad-path.glb` | `cc470c95dc635ce879638889e2c60b8493bf1bed` |
| `roads/road-crossing.glb` | `Hidencod/tge-assets/packs/city-kit-roads/road-crossing.glb` | `240ac05f10d5912cb5a8fb9fbc4dcb58ce82b82e` |
| `roads/road-bend.glb` | `Hidencod/tge-assets/packs/city-kit-roads/road-bend.glb` | `241878bb63fec4d0dbf6f338bbf0cc3eb89dbc9d` |
| `roads/road-intersection.glb` | `Hidencod/tge-assets/packs/city-kit-roads/road-intersection.glb` | `b48e5e355f93f070426468353f8fd75abeffdab3` |
| `city/house.glb` | `Hidencod/tge-assets/packs/city-kit-suburban/building-type-a.glb` | `4aa2f0d0014f1383fad54acebd53cdf73baa2837` |
| `city/tree.glb` | `Hidencod/tge-assets/packs/nature-kit/tree-detailed.glb` | `8d59ea41e280a5ea9234ec1e503fb871c55021de` |
| `city/palm.glb` | `Hidencod/tge-assets/packs/nature-kit/tree-palm.glb` | `f9bcf4d90cfde7ef2863258442545e983740b2e4` |
| `kayraw/building_A_withoutBase.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/building_A_withoutBase.gltf` | `dc14b26f831eab7be10fe18e24e0aa0caccfe3f5` |
| `kayraw/building_A_withoutBase.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/building_A_withoutBase.bin` | `6dda292475d096b2c42a3dd3da0fc9aea063c667` |
| `kayraw/building_B_withoutBase.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/building_B_withoutBase.gltf` | `c7081043ff943e9bb6c67a8f54697d402dcb9ac5` |
| `kayraw/building_B_withoutBase.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/building_B_withoutBase.bin` | `dacd24dde33924add6bd1052e3b78beee4fa879a` |
| `kayraw/building_C_withoutBase.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/building_C_withoutBase.gltf` | `b473145dd56e847ca8a9c55f5acc7effd0e083bf` |
| `kayraw/building_C_withoutBase.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/building_C_withoutBase.bin` | `7bc0a52903a0c74ed69c69171a5e595e1ff73d53` |
| `kayraw/bench.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/bench.gltf` | `33a9bcdac5c62f6c8faaa20140d91e671d313d8f` |
| `kayraw/bench.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/bench.bin` | `58206243d5cadf202aca63ba2e667ab13c8dc9aa` |
| `kayraw/bush.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/bush.gltf` | `9de86fe3219a8ac27fe0ddc3e534ed509ebfd753` |
| `kayraw/bush.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/bush.bin` | `911f09225654a17c006857bd8469c6f06e536ba8` |
| `kayraw/streetlight.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/streetlight.gltf` | `0a35577350736d1c3e30fd68caba0a21c1a4168a` |
| `kayraw/streetlight.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/streetlight.bin` | `0fa33cc8584b11fbdd8c83484d84a32830fc0e0a` |
| `kayraw/watertower.gltf` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/watertower.gltf` | `67ba59b73f0975a0ef823970da67f1b69d4cfdb9` |
| `kayraw/watertower.bin` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/watertower.bin` | `92358a1edf3dc7903e1a8658af06d1b893c8cea2` |
| `kayraw/citybits_texture.png` | `KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf/citybits_texture.png` | `ffffc8998d30b32bdfa6761f33c87bcdfd0ba07f` |

### Locally bundled fonts

Google Fonts repository https://github.com/google/fonts: Barlow Condensed SemiBold (600) and Rajdhani Medium (500), both SIL Open Font License 1.1. Full OFL notices are shipped beside the binaries; no renamed/modified font versions are made. Fonts also use the inlined runtime asset bridge.

| File under bundled/fonts | Bytes | Google Fonts path | Git blob SHA |
| --- | ---: | --- | --- |
| `Rajdhani-Medium.ttf` | 384348 | `ofl/rajdhani/Rajdhani-Medium.ttf` | `a6960c6d7f50f57de0bb117158626f3c31edad9a` |
| `BarlowCondensed-OFL.txt` | 4377 | `ofl/barlowcondensed/OFL.txt` | `2f22ba6ca4dbc12145ae40b14c3368f387cba0e2` |
| `Rajdhani-OFL.txt` | 4373 | `ofl/rajdhani/OFL.txt` | `6dd809659a8ccace7ccee108d024d33cd4f936da` |
| `BarlowCondensed-SemiBold.ttf` | 109428 | `ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf` | `9df66576492bee4bd0559066825472808fa98adc` |

### Verification and limits

All 15 GLB headers/chunk lengths, bufferView ranges and absence of external buffer/image dependencies were checked. Three.js GLTFLoader parsed every model and computed scene bounds in Node with texture decoding omitted; embedded images were separately checked for valid PNG signature/dimensions. This is geometry and packaging verification, not a claim of Android rendering. Final game browser rendering, tile rotation and visual placement are verified by the integrated playtest. The new GLBs total 554924 bytes; the two font binaries total 493776 bytes.


## Safehouse furniture palette — 13 October 2026

Eight additional Kenney Furniture Kit CC0 GLBs from the same verified `Hidencod/tge-assets` tree and bundled Kenney LICENSE, https://kenney.nl/assets/furniture-kit . They remain byte-identical to source, with Git blob SHA verified. Total **94,604 bytes**, below the requested 150kB budget. Locally imported under `interior/` with semantic `CITY_MODELS` roles bed, sofa, table, chair, bookcase, floorLamp, kitchenCabinet and pottedPlant. No paid assets used.

| Runtime key | Bytes | Width / height / depth | Original path | Git blob SHA |
| --- | ---: | --- | --- | --- |
| `interior/beddouble.glb` | 23368 | 0.95600 / 0.37500 / 1.12500 | `packs/furniture-kit/beddouble.glb` | `1b0efacc4dda050a6abc34974cb692010d29b81c` |
| `interior/bookcaseopen.glb` | 18020 | 0.40000 / 0.88000 / 0.25000 | `packs/furniture-kit/bookcaseopen.glb` | `9a0cce7691e94277f3409719e9e68c910c25aa2c` |
| `interior/chair.glb` | 10756 | 0.20000 / 0.47000 / 0.20000 | `packs/furniture-kit/chair.glb` | `2d57af4fef2a32910e3af9283d1e45f177068d63` |
| `interior/kitchencabinet.glb` | 10444 | 0.43000 / 0.45000 / 0.45000 | `packs/furniture-kit/kitchencabinet.glb` | `6292e587214afb9543734486db449c47a5e52730` |
| `interior/lamproundfloor.glb` | 6600 | 0.15204 / 0.86000 / 0.17556 | `packs/furniture-kit/lamproundfloor.glb` | `69f7c9df4fb9e2fb327c59f3b20e8669faf7df0d` |
| `interior/loungesofa.glb` | 9644 | 0.98000 / 0.46000 / 0.41000 | `packs/furniture-kit/loungesofa.glb` | `7761b15cc9d53b9cd5e28d5a5dc5eaea72a648a7` |
| `interior/pottedplant.glb` | 7576 | 0.21206 / 0.65402 / 0.24146 | `packs/furniture-kit/pottedplant.glb` | `774d659a2d2be3f9af3fea78e13b2f250fdbb262` |
| `interior/table.glb` | 8196 | 0.84149 / 0.32673 / 0.44737 | `packs/furniture-kit/table.glb` | `8add1baf8a97bd813524a441c947a9e1457f4b13` |

Bounds include node transforms, including the bed cover/pillows and scaled plant. All minY values are zero; most furniture uses a corner origin, so centre X/Z before placement. Full bounds are included in `CITY_MODEL_BOUNDS`. GLB chunk length, buffer bounds and embedded-image packaging were verified; integrated safehouse rendering is covered by the game playtest.
