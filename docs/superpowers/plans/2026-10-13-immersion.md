# Physical immersion implementation plan

Spec: ../specs/2026-10-13-immersion-design.md
Goal: deliver user's wider-road, collider, skid, scenery, map and lighting pass.
Constraints: preservecity120mdistricts,saves/economy/campaign,portraitmultitouch,localassetbundling;boundedGPU/CPU.
Review focus: sourcepalette lamptriangles versusbodyUV;actualpole/trunkbounds;15mtilesjoinedcorrectly;expiredskidpool;rotatedhullatphysicaledge;brokenlampstillglowing.

- [x] CityLayout/TrafficController:15mtilejoins,10.5masphalt,2.4mlanes,187.5medges;routefullhulltests.
- [x] VehicleLights/Daylight: deriveactualGLBlampfaces/anchors, daytimeoff/brakeboost;exactday/nightandhueboundarytests.
- [x] World/SceneryPhysics: smallerplotdressing,accuratecolliders,breakableinstances→fallingclones,persistentsettle/unloadreset,morestreetobjects,visiblelampstate,outerterrain.
- [x] TimedSkids/World:2560segmentboundedpool,birthtimeGPUfade10+10s,expiredmatrixcleanup/tests.
- [x] ImpactMotion/CrimeGame/vehiclePhysics:physicalpedestrianimpulse,softpropdamage/mass,rotatedhullperimeterbounds.
- [x] CityMap/CrimeGame/css:tapradarenlarges,cities/roads/markets/route,close/pause/selectiontests.
- [x] Freshtypecheck/targetedsuites/build,realproductionbrowserplay/visualinspection,review/fix,publishscreenshots/report/importmanifests,Node22CI.
