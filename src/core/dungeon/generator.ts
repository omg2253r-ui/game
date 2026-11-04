/**
 * Procedural dungeon layout: rooms on a coarse grid connected as a spanning tree with a few
 * extra loops. Deterministic from a seed so co-op peers / reloads produce the same layout.
 */
import { Rng } from '../rng';
import { DUNGEON_MAP, DIFF_LEVEL_OFFSET, ENEMY_COST } from '../data/regions';

export type RoomType = 'start' | 'combat' | 'elite' | 'treasure' | 'event' | 'resource' | 'boss' | 'hidden';
export type EventType = 'terminal' | 'merchant' | 'trap' | 'shrine';

export interface Encounter {
  enemies: { template: string; level: number; elite?: boolean }[];
  boss?: boolean;
}

export interface Room {
  id: number;
  gx: number;
  gy: number;
  w: number; // world units
  h: number;
  type: RoomType;
  links: number[];
  secretLink?: number; // hidden passage to this room id
  encounters: Encounter[]; // roaming groups in the room
  chest?: boolean;
  event?: EventType;
  resources?: number; // count of gather nodes
  depth: number;
}

export interface DungeonLayout {
  dungeonId: string;
  difficulty: number;
  seed: number;
  rooms: Room[];
  bossRoom: number;
  enemyLevel: [number, number];
  warning?: string;
}

export const CELL = 30;

export function generateDungeon(dungeonId: string, difficulty: number, partyLevel: number, seed: number, partySize = 3): DungeonLayout {
  const def = DUNGEON_MAP[dungeonId];
  if (!def) throw new Error(`Unknown dungeon ${dungeonId}`);
  const rng = new Rng(seed);
  const target = rng.int(def.rooms[0], def.rooms[1]);

  // random walk placement
  const key = (x: number, y: number) => `${x},${y}`;
  const cells = new Map<string, Room>();
  const rooms: Room[] = [];
  const add = (gx: number, gy: number, from?: Room) => {
    const r: Room = { id: rooms.length, gx, gy, w: rng.int(14, 22), h: rng.int(14, 22), type: 'combat', links: [], encounters: [], depth: from ? from.depth + 1 : 0 };
    rooms.push(r);
    cells.set(key(gx, gy), r);
    if (from) {
      r.links.push(from.id);
      from.links.push(r.id);
    }
    return r;
  };
  add(0, 0);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let guard = 0;
  while (rooms.length < target && guard++ < 2000) {
    // prefer extending from deeper rooms to make a long critical path
    const from = rng.chance(0.6) ? rooms[rooms.length - 1] : rng.pick(rooms);
    const [dx, dy] = rng.pick(dirs);
    const nx = from.gx + dx, ny = from.gy + dy;
    if (cells.has(key(nx, ny))) continue;
    if (from.links.length >= 3) continue;
    add(nx, ny, from);
  }
  // a couple of loops
  for (const r of rooms) {
    for (const [dx, dy] of dirs) {
      const n = cells.get(key(r.gx + dx, r.gy + dy));
      if (n && !r.links.includes(n.id) && rng.chance(0.12)) {
        r.links.push(n.id);
        n.links.push(r.id);
      }
    }
  }
  // recompute depth via BFS
  const depth = new Map<number, number>([[0, 0]]);
  const q = [0];
  while (q.length) {
    const id = q.shift()!;
    for (const l of rooms[id].links) if (!depth.has(l)) {
      depth.set(l, depth.get(id)! + 1);
      q.push(l);
    }
  }
  for (const r of rooms) r.depth = depth.get(r.id) ?? 0;
  const maxDepth = Math.max(...rooms.map((r) => r.depth));

  rooms[0].type = 'start';
  rooms[0].w = rooms[0].h = 18;
  const boss = [...rooms].sort((a, b) => b.depth - a.depth || b.id - a.id)[0];
  boss.type = 'boss';
  boss.w = boss.h = 24;

  // mini boss: deep room that is not the boss
  const others = rooms.filter((r) => r.type === 'combat').sort((a, b) => b.depth - a.depth);
  if (others.length) others[0].type = 'elite';
  const rest = rng.shuffle(rooms.filter((r) => r.type === 'combat' && r.depth > 0));
  const plan: ('treasure' | 'event' | 'resource')[] = ['treasure', 'event', 'resource', 'event', 'treasure'];
  for (let i = 0; i < Math.min(plan.length, Math.floor(rest.length * 0.5)); i++) rest[i].type = plan[i];

  // hidden room attached to a leaf by a secret passage
  for (const leaf of rng.shuffle(rooms.filter((r) => r.links.length === 1 && r.type !== 'boss' && r.type !== 'start'))) {
    const free = dirs.map(([dx, dy]) => [leaf.gx + dx, leaf.gy + dy]).filter(([x, y]) => !cells.has(key(x, y)));
    if (!free.length) continue;
    const [hx, hy] = rng.pick(free);
    const h: Room = { id: rooms.length, gx: hx, gy: hy, w: 12, h: 12, type: 'hidden', links: [], encounters: [], depth: leaf.depth + 1, chest: true, secretLink: leaf.id };
    rooms.push(h);
    cells.set(key(hx, hy), h);
    leaf.secretLink = h.id;
    break;
  }

  // levels: region band by depth + difficulty offset, nudged toward the party's level
  const off = DIFF_LEVEL_OFFSET[difficulty];
  const lvAt = (d: number) => {
    const t = maxDepth ? d / maxDepth : 0;
    let lv = Math.round(def.levels[0] + (def.levels[1] - def.levels[0]) * t);
    if (partyLevel > def.levels[1] + 4) lv += Math.min(4, Math.floor((partyLevel - def.levels[1]) / 3));
    return lv + off;
  };
  const strongest = lvAt(maxDepth);
  let budgetScale = (0.75 + 0.25 * partySize) / 1.5;
  let warning: string | undefined;
  if (partyLevel < lvAt(0) - 3) {
    budgetScale *= 0.8;
    warning = `Recommended level ${lvAt(0)}+. Enemies will be dangerous.`;
  }

  for (const r of rooms) {
    const lv = lvAt(r.depth);
    if (r.type === 'combat') {
      const groups = r.w * r.h > 300 ? 2 : 1;
      for (let g = 0; g < groups; g++) r.encounters.push(makeEncounter(rng, def.pool, lv, (2.2 + r.depth * 0.3 + difficulty * 0.5) * budgetScale));
    } else if (r.type === 'elite') {
      const enc = makeEncounter(rng, def.pool, lv, (1.2 + difficulty * 0.5) * budgetScale);
      enc.enemies.unshift({ template: def.miniBoss, level: lv + 1, elite: true });
      enc.enemies = enc.enemies.slice(0, 3);
      r.encounters.push(enc);
      r.chest = true;
    } else if (r.type === 'boss') {
      const enc: Encounter = { boss: true, enemies: [{ template: def.boss, level: strongest + 1 }] };
      if (difficulty >= 2) enc.enemies.push({ template: rng.pick(def.pool), level: strongest });
      if (difficulty >= 3) enc.enemies.push({ template: rng.pick(def.pool), level: strongest });
      r.encounters.push(enc);
    } else if (r.type === 'treasure') {
      r.chest = true;
      if (rng.chance(0.5)) r.encounters.push(makeEncounter(rng, def.pool, lv, 1.6 * budgetScale));
    } else if (r.type === 'event') {
      r.event = rng.pick(['terminal', 'merchant', 'trap', 'shrine'] as const);
    } else if (r.type === 'resource') {
      r.resources = rng.int(3, 5);
      if (rng.chance(0.6)) r.encounters.push(makeEncounter(rng, def.pool, lv, 1.8 * budgetScale));
    }
  }
  return { dungeonId, difficulty, seed, rooms, bossRoom: boss.id, enemyLevel: [lvAt(0), strongest + 1], warning };
}

function makeEncounter(rng: Rng, pool: string[], level: number, budget: number): Encounter {
  const enemies: Encounter['enemies'] = [];
  let b = budget;
  let guard = 0;
  while (enemies.length < 4 && guard++ < 20) {
    const t = rng.pick(pool);
    const c = ENEMY_COST[t] ?? 1.5;
    if (c > b && enemies.length > 0) break;
    enemies.push({ template: t, level: Math.max(1, level + rng.int(-1, 0)) });
    b -= c;
  }
  return { enemies };
}
