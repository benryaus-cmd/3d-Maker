# Wider roads and physical immersion

User intent: roads50%wider, tightcolliders, timedskidfade, breakablescenery withpersistentfallenposes, usableedgeperimeter, expandablemap, alignedvehiclelights andtime-dependentimmersive lighting.

Keepcity360m/9districts120m. Roadtile10→15m, asphalt7→10.5m, graphstep10→15m on30m lattice; no overlappingstretchedtiles. Plot20→15m; fitdressingcolliders toactualsolids/trunks/poles andadaptfootprints. Laneoffset2.4m. Outerroadextends7.5m beyond180m centerline; CITY_EDGE187.5m, clampactualrotatedhull ratherthanarbitrary177.5mcenter.

Skids: one bounded2560segment instancepool (atmost120persecondfixedstep), maintain10sopaque thenlinear10sfade, expire20s, clockfreezeswhilepaused. GPUper-instancebirthtime/uniformclock; stalegeometryzeroed, no accumulation.

Props: separate modelinstancevisual fromactualcollider. Hitthreshold/mass controlsbreak/topple. Detachoneinstance onimpact, reusecacheforfallingclone, integrategravity/friction/angularfall andsettle; keepuntilchunkunload, reconstructonreload. Signs/cones/bench/fence/dumpster/lamp/tree/pole thresholdsdifferent. Softpropsdon'tdamagecarslikeconcretewalls. Peoplegetballisticimpulse/tumbling andgroundcollision, existingdeath/cleanup retained.

Lighting: actualtexturedlampface triangles fromGLBs, nofloatingboxes; brakeemissivebrightinallhours; daylightheadlights/spotsoff. daylightAt hoursnight22–05,dawn05–06yellow,day06–20,warmsunset20–21,pinkfade21–22. Visibleunbrokenstreetlampslitwhenappropriate,brokenlampsloseglow.

Map: radaropensfullcityview; districtlabels,roads,markets,currentplayer/parkedcar,target; selectingmarketsetsroute. Pauseinputswhileopen,preserveprogress.

Verifymath/actualmodelbounds,impactmass,fallpersistent/reset,skids10/15/20s,lightingexactboundaries/alignment,pedballistics,UIrealmaptap,roadwidth/collision/edge/propsinproductionbrowser;publishpinnedincremental/fullmanifests. NoAAAcompletion/Androidbenchmarkclaim.
