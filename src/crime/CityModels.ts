/** Reviewed local model keys. Source units are intentionally preserved; World fits models to metres. */
export const CITY_MODELS = {
  bed: 'interior/beddouble.glb',
  sofa: 'interior/loungesofa.glb',
  table: 'interior/table.glb',
  chair: 'interior/chair.glb',
  bookcase: 'interior/bookcaseopen.glb',
  floorLamp: 'interior/lamproundfloor.glb',
  kitchenCabinet: 'interior/kitchencabinet.glb',
  pottedPlant: 'interior/pottedplant.glb',

  roadStraight: 'roads/road-straight.glb',
  roadCross: 'roads/road-crossroad-path.glb',
  roadCrossing: 'roads/road-crossing.glb',
  roadBend: 'roads/road-bend.glb',
  roadIntersection: 'roads/road-intersection.glb',
  apartment: 'city/kay-building-b.glb',
  store: 'city/kay-building-a.glb',
  house: 'city/house.glb',
  tree: 'city/tree.glb',
  palm: 'city/palm.glb',
  bench: 'city/kay-bench.glb',
  hedge: 'city/kay-bush.glb',
  streetlight: 'city/kay-streetlight.glb',
  apartmentTall: 'city/kay-building-c.glb',
  waterTower: 'city/kay-watertower.glb',
  parkFountain: undefined,
} as const;

/** Source-space geometry bounds, measured through Three GLTFLoader with node transforms applied. */
export const CITY_MODEL_BOUNDS: Record<string, { min: readonly number[]; max: readonly number[]; dimensions: readonly number[] }> = {
  "roads/road-bend.glb": {
    "min": [
      -0.5,
      0,
      -0.5
    ],
    "max": [
      0.5,
      0.019999999552965164,
      0.5
    ],
    "dimensions": [
      1,
      0.019999999552965164,
      1
    ]
  },
  "roads/road-crossing.glb": {
    "min": [
      -0.5,
      0,
      -0.5
    ],
    "max": [
      0.5,
      0.019999999552965164,
      0.5
    ],
    "dimensions": [
      1,
      0.019999999552965164,
      1
    ]
  },
  "roads/road-crossroad-path.glb": {
    "min": [
      -0.5,
      0,
      -0.5
    ],
    "max": [
      0.5,
      0.019999999552965164,
      0.5
    ],
    "dimensions": [
      1,
      0.019999999552965164,
      1
    ]
  },
  "roads/road-intersection.glb": {
    "min": [
      -0.5,
      0,
      -0.5
    ],
    "max": [
      0.5,
      0.019999999552965164,
      0.5000001192092896
    ],
    "dimensions": [
      1,
      0.019999999552965164,
      1.0000001192092896
    ]
  },
  "roads/road-straight.glb": {
    "min": [
      -0.5,
      0,
      -0.5
    ],
    "max": [
      0.5,
      0.019999999552965164,
      0.5
    ],
    "dimensions": [
      1,
      0.019999999552965164,
      1
    ]
  },
  "city/house.glb": {
    "min": [
      -0.6499999761581421,
      0,
      -0.5140689015388489
    ],
    "max": [
      0.6499999761581421,
      0.8335409760475159,
      0.5140689015388489
    ],
    "dimensions": [
      1.2999999523162842,
      0.8335409760475159,
      1.0281378030776978
    ]
  },
  "city/kay-bench.glb": {
    "min": [
      -0.20000001788139343,
      0,
      -0.07500002533197403
    ],
    "max": [
      0.20000001788139343,
      0.10000002384185791,
      0.07500002533197403
    ],
    "dimensions": [
      0.40000003576278687,
      0.10000002384185791,
      0.15000005066394806
    ]
  },
  "city/kay-building-a.glb": {
    "min": [
      -0.6033698320388794,
      0.09993039071559906,
      -0.6499999761581421
    ],
    "max": [
      0.6033698320388794,
      1.6499998569488525,
      0.8000000715255737
    ],
    "dimensions": [
      1.2067396640777588,
      1.5500694662332535,
      1.4500000476837158
    ]
  },
  "city/kay-building-b.glb": {
    "min": [
      -0.8033698201179504,
      0.09993039071559906,
      -0.6499999761581421
    ],
    "max": [
      0.8033698201179504,
      1.6499998569488525,
      0.6499999761581421
    ],
    "dimensions": [
      1.6067396402359009,
      1.5500694662332535,
      1.2999999523162842
    ]
  },
  "city/kay-building-c.glb": {
    "min": [
      -0.6033698320388794,
      0.09993039071559906,
      -0.6499999761581421
    ],
    "max": [
      0.6033698320388794,
      2.3499999046325684,
      0.6499999761581421
    ],
    "dimensions": [
      1.2067396640777588,
      2.2500695139169693,
      1.2999999523162842
    ]
  },
  "city/kay-bush.glb": {
    "min": [
      -0.08946483582258224,
      0,
      -0.09955329447984695
    ],
    "max": [
      0.09989581257104874,
      0.38052958250045776,
      0.09954001754522324
    ],
    "dimensions": [
      0.18936064839363098,
      0.38052958250045776,
      0.1990933120250702
    ]
  },
  "city/kay-streetlight.glb": {
    "min": [
      -0.2392103672027588,
      9.156763553619385e-06,
      -0.034511469304561615
    ],
    "max": [
      0.030096590518951416,
      0.9599239826202393,
      0.0345110222697258
    ],
    "dimensions": [
      0.2693069577217102,
      0.9599148258566856,
      0.06902249157428741
    ]
  },
  "city/kay-watertower.glb": {
    "min": [
      -0.24944308400154114,
      -9.387731552124023e-07,
      -0.24944308400154114
    ],
    "max": [
      0.24944306910037994,
      0.6700000762939453,
      0.24944306910037994
    ],
    "dimensions": [
      0.4988861531019211,
      0.6700010150671005,
      0.4988861531019211
    ]
  },
  "city/palm.glb": {
    "min": [
      -0.467744857,
      -0.05,
      -0.50638175
    ],
    "max": [
      0.467744857,
      1.46459062,
      0.50638175
    ],
    "dimensions": [
      0.935489714,
      1.51459062,
      1.0127635
    ]
  },
  "city/tree.glb": {
    "min": [
      -0.4324826,
      -0.05,
      -0.372135967
    ],
    "max": [
      0.41463244,
      1.282417,
      0.389466524
    ],
    "dimensions": [
      0.84711504,
      1.332417,
      0.761602491
    ]
  },
  "interior/beddouble.glb": {
    "min": [
      -1.1028009443136977e-09,
      0,
      -1.125
    ],
    "max": [
      0.9560000358323066,
      0.375,
      0
    ],
    "dimensions": [
      0.9560000369351076,
      0.375,
      1.125
    ]
  },
  "interior/bookcaseopen.glb": {
    "min": [
      0,
      0,
      -0.25
    ],
    "max": [
      0.4,
      0.879999936,
      0
    ],
    "dimensions": [
      0.4,
      0.879999936,
      0.25
    ]
  },
  "interior/chair.glb": {
    "min": [
      0,
      0,
      -0.2
    ],
    "max": [
      0.2,
      0.47,
      0
    ],
    "dimensions": [
      0.2,
      0.47,
      0.2
    ]
  },
  "interior/kitchencabinet.glb": {
    "min": [
      0,
      0,
      -0.45
    ],
    "max": [
      0.43,
      0.45,
      0
    ],
    "dimensions": [
      0.43,
      0.45,
      0.45
    ]
  },
  "interior/lamproundfloor.glb": {
    "min": [
      -0.01601971,
      0,
      -0.14778
    ],
    "max": [
      0.1360197,
      0.86,
      0.0277799983
    ],
    "dimensions": [
      0.15203940999999999,
      0.86,
      0.1755599983
    ]
  },
  "interior/loungesofa.glb": {
    "min": [
      0,
      0,
      -0.410000026
    ],
    "max": [
      0.979999959,
      0.46,
      0
    ],
    "dimensions": [
      0.979999959,
      0.46,
      0.410000026
    ]
  },
  "interior/pottedplant.glb": {
    "min": [
      -0.10602964,
      0,
      -0.12073097420000001
    ],
    "max": [
      0.106029634,
      0.6540168000000001,
      0.1207309738
    ],
    "dimensions": [
      0.212059274,
      0.6540168000000001,
      0.241461948
    ]
  },
  "interior/table.glb": {
    "min": [
      0,
      0,
      -0.447373331
    ],
    "max": [
      0.841487944,
      0.326733977,
      0
    ],
    "dimensions": [
      0.841487944,
      0.326733977,
      0.447373331
    ]
  }
};
