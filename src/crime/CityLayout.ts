/** Vesper Bay's authored, flat, 360 m city. All simulation and visuals share this graph. */
export type DistrictTheme = 'downtown' | 'suburb' | 'commercial' | 'mixed' | 'industrial' | 'park' | 'waterfront' | 'nightlife' | 'historic';
export type District = { id: string; name: string; theme: DistrictTheme; x: number; z: number; color: number };
export type RoadTile = { x: number; z: number; mask: number; kind: 'straight' | 'bend' | 'tee' | 'cross' | 'end'; rotation: number };
export type StreetNode = { id: string; x: number; z: number; neighbors: string[] };
export type CityBlock = { id: string; cells: { x: number; z: number }[]; district: string; shape: string; minX: number; maxX: number; minZ: number; maxZ: number };
export const DISTRICTS: District[] = [
  { id: 'hills', name: 'The Hills', theme: 'suburb', x: -120, z: 120, color: 0x739971 },
  { id: 'financial', name: 'Financial Core', theme: 'downtown', x: 0, z: 120, color: 0x7991ab },
  { id: 'gardens', name: 'Civic Gardens', theme: 'park', x: 120, z: 120, color: 0x54876b },
  { id: 'old-quarter', name: 'Old Quarter', theme: 'historic', x: -120, z: 0, color: 0xbb9573 },
  { id: 'midtown', name: 'Midtown', theme: 'mixed', x: 0, z: 0, color: 0xa49180 },
  { id: 'neon', name: 'Neon Mile', theme: 'nightlife', x: 120, z: 0, color: 0xa376a0 },
  { id: 'dockside', name: 'Dockside', theme: 'waterfront', x: -120, z: -120, color: 0x608b9b },
  { id: 'industrial', name: 'Industrial Belt', theme: 'industrial', x: 0, z: -120, color: 0x9e8b5e },
  { id: 'market', name: 'Market Ward', theme: 'commercial', x: 120, z: -120, color: 0xb69b63 },
];
const LIMIT = 180;
const CELL = 30;
const STEP = 10;
const ROAD_HALF_WIDTH = 3.5;
const key = (x: number, z: number) => `${x}:${z}`;
export function districtAt(x: number, z: number): District {
  const col = Math.max(0, Math.min(2, Math.floor((x + LIMIT) / 120)));
  const row = Math.max(0, Math.min(2, Math.floor((z + LIMIT) / 120)));
  return DISTRICTS[(2 - row) * 3 + col];
}

// Four deliberate mergers leave four small standalone blocks per district.
// Rotating the authored partition varies street bends and T junctions without random seams.
const mergedCells = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[2, 0], [3, 0], [2, 1]],
  [[0, 3], [1, 3], [2, 3]],
  [[0, 2], [1, 2]],
];
const owners = new Map<string, string>();
for (let index = 0; index < DISTRICTS.length; index++) {
  const d = DISTRICTS[index];
  const transform = (u: number, v: number) => {
    for (let turn = 0; turn < index % 4; turn++) [u, v] = [3 - v, u];
    return { x: d.x - 45 + u * CELL, z: d.z - 45 + v * CELL };
  };
  mergedCells.forEach((group, i) => group.forEach(([u, v]) => {
    const p = transform(u, v); owners.set(key(p.x, p.z), `${d.id}:merge-${i}`);
  }));
  for (let u = 0; u < 4; u++) for (let v = 0; v < 4; v++) {
    const p = transform(u, v); const id = key(p.x, p.z);
    if (!owners.has(id)) owners.set(id, `${d.id}:${u}-${v}`);
  }
}
const merged = (ax: number, az: number, bx: number, bz: number) => {
  const owner = owners.get(key(ax, az));
  return owner !== undefined && owner === owners.get(key(bx, bz));
};
export const STREET_NODES = new Map<string, StreetNode>();
const connect = (ax: number, az: number, bx: number, bz: number) => {
  const a = key(ax, az); const b = key(bx, bz);
  if (!STREET_NODES.has(a)) STREET_NODES.set(a, { id: a, x: ax, z: az, neighbors: [] });
  if (!STREET_NODES.has(b)) STREET_NODES.set(b, { id: b, x: bx, z: bz, neighbors: [] });
  STREET_NODES.get(a)!.neighbors.push(b); STREET_NODES.get(b)!.neighbors.push(a);
};
// Keep perimeter and all district boundaries: mergers only touch cells in one district.
for (let x = -LIMIT; x <= LIMIT; x += CELL) for (let z = -LIMIT; z < LIMIT; z += CELL) {
  if (merged(x - CELL / 2, z + CELL / 2, x + CELL / 2, z + CELL / 2)) continue;
  for (let offset = 0; offset < CELL; offset += STEP) connect(x, z + offset, x, z + offset + STEP);
}
for (let z = -LIMIT; z <= LIMIT; z += CELL) for (let x = -LIMIT; x < LIMIT; x += CELL) {
  if (merged(x + CELL / 2, z - CELL / 2, x + CELL / 2, z + CELL / 2)) continue;
  for (let offset = 0; offset < CELL; offset += STEP) connect(x + offset, z, x + offset + STEP, z);
}

const classify = (mask: number): Pick<RoadTile, 'kind' | 'rotation'> => {
  const count = [1, 2, 4, 8].filter(bit => mask & bit).length;
  const kind: RoadTile['kind'] = count === 4 ? 'cross' : count === 3 ? 'tee' : count === 1 ? 'end' : mask === 5 || mask === 10 ? 'straight' : 'bend';
  let canonical = { straight: 5, bend: 3, tee: 11, cross: 15, end: 1 }[kind];
  for (let turn = 0; turn < 4; turn++) {
    if (canonical === mask) return { kind, rotation: turn * Math.PI / 2 };
    canonical = ((canonical << 1) & 15) | ((canonical >> 3) & 1);
  }
  throw new Error(`Invalid street mask: ${mask}`);
};
export const ROAD_TILES: RoadTile[] = [...STREET_NODES.values()].map(node => {
  let mask = 0;
  for (const id of node.neighbors) {
    const neighbor = STREET_NODES.get(id)!;
    mask |= neighbor.z > node.z ? 1 : neighbor.x > node.x ? 2 : neighbor.z < node.z ? 4 : 8;
  }
  return { x: node.x, z: node.z, mask, ...classify(mask) };
});

// Flood fill across the removed streets: these are the actual buildable city blocks.
export const CITY_BLOCKS: CityBlock[] = [];
const remaining = new Set(owners.keys());
for (const start of owners.keys()) {
  if (!remaining.has(start)) continue;
  const cells: { x: number; z: number }[] = [];
  const queue = [start]; remaining.delete(start);
  while (queue.length) {
    const id = queue.pop()!; const [x, z] = id.split(':').map(Number); cells.push({ x, z });
    for (const [dx, dz] of [[CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]]) {
      const adjacent = key(x + dx, z + dz);
      if (remaining.has(adjacent) && merged(x, z, x + dx, z + dz)) { remaining.delete(adjacent); queue.push(adjacent); }
    }
  }
  const minX = Math.min(...cells.map(p => p.x)) - CELL / 2;
  const maxX = Math.max(...cells.map(p => p.x)) + CELL / 2;
  const minZ = Math.min(...cells.map(p => p.z)) - CELL / 2;
  const maxZ = Math.max(...cells.map(p => p.z)) + CELL / 2;
  const shape = cells.length === 1 ? '1x1' : cells.length === 2 ? '1x2' : cells.length === 4 ? '2x2' : maxX - minX === CELL || maxZ - minZ === CELL ? '1x3' : 'L';
  CITY_BLOCKS.push({ id: owners.get(start)!, cells, district: districtAt(cells[0].x, cells[0].z).id, shape, minX, maxX, minZ, maxZ });
}

export function nearestStreet(x: number, z: number): { x: number; z: number; nodeId: string; distance: number } {
  let best = STREET_NODES.values().next().value!; let distanceSq = Infinity;
  for (const node of STREET_NODES.values()) {
    const candidate = (x - node.x) ** 2 + (z - node.z) ** 2;
    if (candidate < distanceSq) { best = node; distanceSq = candidate; }
  }
  return { x: best.x, z: best.z, nodeId: best.id, distance: Math.sqrt(distanceSq) };
}
export function roadRoute(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number }[] {
  const source = nearestStreet(from.x, from.z).nodeId; const target = nearestStreet(to.x, to.z).nodeId;
  const previous = new Map<string, string | null>([[source, null]]); const queue = [source];
  for (let i = 0; i < queue.length && !previous.has(target); i++) {
    for (const id of STREET_NODES.get(queue[i])!.neighbors) {
      if (previous.has(id)) continue;
      previous.set(id, queue[i]); queue.push(id);
    }
  }
  if (!previous.has(target)) return [];
  const route: { x: number; z: number }[] = [];
  for (let id: string | null = target; id !== null; id = previous.get(id) ?? null) {
    const node = STREET_NODES.get(id)!; route.push({ x: node.x, z: node.z });
  }
  return route.reverse();
}
// Small spatial bins keep per-frame wheel/surface queries independent of city size.
const segments = new Map<string, { ax: number; az: number; bx: number; bz: number }[]>();
for (const node of STREET_NODES.values()) for (const id of node.neighbors) {
  if (node.id >= id) continue;
  const next = STREET_NODES.get(id)!;
  const segment = { ax: node.x, az: node.z, bx: next.x, bz: next.z };
  const bin = key(Math.floor((node.x + next.x) / 2 / CELL), Math.floor((node.z + next.z) / 2 / CELL));
  if (!segments.has(bin)) segments.set(bin, []);
  segments.get(bin)!.push(segment);
}
export function isRoad(x: number, z: number, margin = 0): boolean {
  const radius = Math.max(0, ROAD_HALF_WIDTH + margin);
  if (x < -LIMIT - radius || x > LIMIT + radius || z < -LIMIT - radius || z > LIMIT + radius) return false;
  const reach = Math.ceil(radius / CELL) + 1;
  const cx = Math.floor(x / CELL); const cz = Math.floor(z / CELL);
  for (let u = cx - reach; u <= cx + reach; u++) for (let v = cz - reach; v <= cz + reach; v++) {
    for (const s of segments.get(key(u, v)) ?? []) {
      const px = Math.max(Math.min(s.ax, s.bx), Math.min(Math.max(s.ax, s.bx), x));
      const pz = Math.max(Math.min(s.az, s.bz), Math.min(Math.max(s.az, s.bz), z));
      if ((x - px) ** 2 + (z - pz) ** 2 <= radius ** 2) return true;
    }
  }
  return false;
}
export function roadHeight(_x: number, _z: number): number { return 0; }

/** Distance to the nearest centerline, including between the 10 m tile centers. */
export function roadDistance(x: number, z: number): number {
  let best = Infinity;
  for (const bucket of segments.values()) for (const s of bucket) {
    const px = Math.max(Math.min(s.ax, s.bx), Math.min(Math.max(s.ax, s.bx), x));
    const pz = Math.max(Math.min(s.az, s.bz), Math.min(Math.max(s.az, s.bz), z));
    best = Math.min(best, (x - px) ** 2 + (z - pz) ** 2);
  }
  return Math.sqrt(best);
}
