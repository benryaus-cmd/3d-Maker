import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
assert.ok(existsSync(new URL('../src/crime/CityLayout.ts', import.meta.url)), 'CityLayout.ts provides the authored street graph');
const { DISTRICTS, districtAt, ROAD_TILES, STREET_NODES, CITY_BLOCKS, nearestStreet, roadRoute, isRoad, roadHeight, roadDistance } = await import('../src/crime/CityLayout.ts');
assert.equal(DISTRICTS.length, 9);
assert.equal(new Set(DISTRICTS.map(d => d.theme)).size, 9);
for (const d of DISTRICTS) {
  assert.equal(districtAt(d.x, d.z).id, d.id);
  assert.equal(CITY_BLOCKS.filter(b => b.district === d.id).flatMap(b => b.cells).length, 16);
}
assert.deepEqual(new Set(CITY_BLOCKS.map(b => b.shape)), new Set(['1x1', '1x2', '1x3', '2x2', 'L']));
const reached = new Set(); const queue = [STREET_NODES.keys().next().value];
while (queue.length) {
  const id = queue.pop(); if (reached.has(id)) continue;
  reached.add(id); queue.push(...STREET_NODES.get(id).neighbors);
}
assert.equal(reached.size, STREET_NODES.size, 'every street connects to the city network');
const deltaBits = [[0, 10, 1], [10, 0, 2], [0, -10, 4], [-10, 0, 8]];
const rotate = mask => ((mask << 1) & 15) | ((mask >> 3) & 1);
const canonical = { straight: 5, bend: 3, tee: 11, cross: 15, end: 1 };
assert.ok(ROAD_TILES.some(t => t.kind === 'bend'), 'merged blocks create real street bends');
assert.ok(ROAD_TILES.some(t => t.kind === 'tee'), 'merged blocks create T intersections');
for (const tile of ROAD_TILES) {
  const node = STREET_NODES.get(`${tile.x}:${tile.z}`);
  assert.ok(node);
  let mask = 0;
  for (const [dx, dz, bit] of deltaBits) if (node.neighbors.includes(`${tile.x + dx}:${tile.z + dz}`)) mask |= bit;
  assert.equal(tile.mask, mask);
  let rotated = canonical[tile.kind];
  for (let i = 0; i < Math.round(tile.rotation / (Math.PI / 2)); i++) rotated = rotate(rotated);
  assert.equal(rotated, tile.mask, `rotation at ${node.id}`);
  assert.ok(Math.abs(tile.x) <= 180 && Math.abs(tile.z) <= 180);
  for (const neighbor of node.neighbors) assert.ok(STREET_NODES.get(neighbor).neighbors.includes(node.id), 'edges are reciprocal');
}
for (const seam of [-60, 60]) for (let p = -180; p <= 180; p += 10) {
  const v = STREET_NODES.get(`${seam}:${p}`); const h = STREET_NODES.get(`${p}:${seam}`);
  assert.ok(v && h, 'seam arterials have continuous tile centers');
  if (p < 180) {
    assert.ok(v.neighbors.includes(`${seam}:${p + 10}`));
    assert.ok(h.neighbors.includes(`${p + 10}:${seam}`));
  }
}
for (const block of CITY_BLOCKS) for (const a of block.cells) for (const b of block.cells) {
  if (b.x === a.x + 30 && a.z === b.z) {
    assert.ok(!isRoad((a.x + b.x) / 2, a.z), 'merged cells have no internal street');
  }
  if (b.z === a.z + 30 && a.x === b.x) {
    assert.ok(!isRoad(a.x, (a.z + b.z) / 2), 'merged cells have no internal street');
  }
}
for (const target of [{ x: 32, z: 0 }, { x: 64, z: 32 }, { x: -177, z: 177 }, { x: 179, z: -179 }]) {
  const route = roadRoute({ x: 0, z: 0 }, target);
  assert.ok(route.length > 1);
  assert.deepEqual(route[0], { x: 0, z: 0 });
  for (let i = 1; i < route.length; i++) {
    assert.ok(STREET_NODES.get(`${route[i - 1].x}:${route[i - 1].z}`).neighbors.includes(`${route[i].x}:${route[i].z}`), 'route only uses existing edges');
  }
  const nearest = nearestStreet(target.x, target.z);
  assert.ok(isRoad(nearest.x, nearest.z));
  assert.deepEqual(route.at(-1), { x: nearest.x, z: nearest.z });
}
assert.equal(isRoad(0, 0), true);
assert.equal(isRoad(190, 0), false);
assert.equal(isRoad(0, 184, 0), false);
assert.equal(isRoad(0, 184, 2), true);
assert.equal(roadHeight(0, 0), 0);
assert.equal(typeof roadDistance, 'function', 'roadDistance measures the actual road centerline');
assert.equal(roadDistance(0, 5), 0, 'intermediate segment points are on centerline');
assert.equal(roadDistance(4, 5), 4);
assert.equal(roadDistance(190, 0), 10);
console.log(`City layout verified: ${DISTRICTS.length} districts, ${CITY_BLOCKS.length} blocks, ${STREET_NODES.size} nodes, ${ROAD_TILES.length} tiles.`);
