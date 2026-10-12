# City and driving refinement implementation plan

Goal: implement the user's recording-backed second pass in active Blacktop Empire.
Spec: ../specs/2026-10-13-district-driving-design.md
Architecture: one pure road graph consumed by chunk rendering, route assistance, radar and traffic; existing fixed-step simulation and mobile React host retained.
Constraints: preserve save/economy/upgrades/campaign, localasset inlining, portraitmultitouch, Node22 CI/importer.
Review focus: sourceGLB roadorientations, seamlessdistrict boundaries, rotatedphysicscontacts, actorsvisualoriginflash, noframe-dependent movement or unboundedGPUresourcegrowth.

- [x] CityLayout.ts/check-city-layout: author nine districts, mergedblocks, connectedgraph and correctly classified roadtiles; prove graph/mask/route behavior.
- [x] vehiclePhysics.ts/check-vehicle-handling/check-crime: fail-before tests for ramp/coast/axleslip/reverse/realcrashdamage; keep publictune compatibility.
- [x] CityModels/assets/VehicleLights/check-road-assets: inspectroadgeometryopenings, correctcanonicalrotations, localnightbeam/lampbehavior anddisposal.
- [x] World/check-world: graph-based60m chunks, districtart/scenery, source-onlyroads, emissives/nightreadability, cyanroutechevrons, correctcolliderlandmark clearance.
- [x] TrafficController/CrimeGame: lanegraph paths, previewturnspeed, obstacleyield, safeoffscreenalignedspawn, brake/reversephysicalrecovery; posevisualbeforeadd.
- [x] StreetCombat/CrimeGame/crime.css: onfootpunchbutton/F, hitrange/cooldown/facing, NPCflee/retaliate, characterhealthandfeedback.
- [x] Integrate/typecheck/build/productionbrowserplay, review, fixprovenfailures, publishscreenshots/report/pinnedincremental/fullAippymanifests, verifyCI.
