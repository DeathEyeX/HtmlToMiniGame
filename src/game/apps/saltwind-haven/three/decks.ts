import type { Group } from 'three-platformize';
import { zoneIds, zones, type Point3 } from '../content';
import { blue, child, iron, rng, rope, timber, wood, type Model, type Tools } from './model';
import type { Waterline } from './ocean';

export function planks(tool: Tools, width: number, depth: number, y: number, seed: number, x = 0, z = 0) {
  const random = rng(seed);
  const rows = Math.ceil(depth / .43);
  const row = depth / rows;
  for (let i = 0; i < rows; i++) {
    const line = z - depth / 2 + row * (i + .5);
    const pieces = width > 5 ? 3 : width > 3.1 ? 2 : 1;
    let start = x - width / 2 + (random() - .5) * .13;
    for (let k = 1; k <= pieces; k++) {
      const end = x - width / 2 + width * k / pieces + (random() - .5) * (k === pieces ? .17 : .86);
      const tone = wood[Math.floor(random() * wood.length)];
      tool.box(tone, [(start + end) / 2, y - .081 + random() * .022, line], [end - start - .024, .14, row - .025]);
      if ((i + k * 2) % 5 === 0) {
        for (const bolt of [start + .11, end - .12]) tool.round(0x524334, [bolt, y + .014, line + .08], [.067, .024, .067]);
      }
      start = end;
    }
  }
}

export function line(tool: Tools, color: number, a: Point3, b: Point3, sag = .16, thickness = .045) {
  const steps = 5;
  let previous = a;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const next: Point3 = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]) - 4 * sag * t * (1 - t), a[2] + t * (b[2] - a[2])];
    tool.beam(color, previous, next, thickness, 'fabric', true);
    previous = next;
  }
}

export function railing(tool: Tools, a: Point3, b: Point3, style: 'rope' | 'wood' = 'rope', sections = 3, height = .78) {
  let last: Point3 | undefined;
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const p: Point3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const top: Point3 = [p[0], p[1] + height, p[2]];
    tool.box(timber, [p[0], p[1] + height * .46, p[2]], [.15, height + .14, .16]);
    tool.round(iron, [p[0], top[1] + .05, p[2]], [.09, .034, .09]);
    if (last) {
      if (style === 'rope') {
        line(tool, rope, last, top, .12, .052);
        line(tool, rope, [last[0], last[1] - .30, last[2]], [top[0], top[1] - .30, top[2]], .09, .038);
      } else {
        tool.beam(wood[2], last, top, .13);
        tool.beam(wood[0], [last[0], last[1] - .34, last[2]], [top[0], top[1] - .34, top[2]], .075);
      }
    }
    last = top;
  }
}

export function stairs(tool: Tools, start: Point3, end: Point3, width: number, steps: number, rails = true) {
  const dx = end[0] - start[0], dz = end[2] - start[2], dy = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const turn = Math.atan2(dx, dz);
  for (let i = 0; i < steps; i++) {
    const t = (i + .5) / steps;
    tool.box(wood[i % wood.length], [start[0] + dx * t, start[1] + dy * (i + 1) / steps - .07, start[2] + dz * t],
      [width, .14, length / steps + .045], 'wood', [0, turn, 0]);
  }
  for (const offset of [-width * .42, width * .42]) {
    const x = Math.cos(turn) * offset, z = -Math.sin(turn) * offset;
    tool.beam(timber, [start[0] + x, start[1] - .16, start[2] + z], [end[0] + x, end[1] - .16, end[2] + z], .17);
    if (rails) railing(tool, [start[0] + x, start[1] + .1, start[2] + z], [end[0] + x, end[1], end[2] + z], 'wood', 3);
  }
}

export function drum(tool: Tools, center: Point3, diameter: number, length: number, color: number, sideways = false) {
  const [x, y, z] = center;
  const rotation: Point3 = sideways ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  tool.barrel(color, center, [diameter, length, diameter], rotation);
  for (const band of [-.33, .30]) {
    const offset = band * length;
    tool.round(sideways ? 0x334c50 : color, [x, y + (sideways ? 0 : offset), z + (sideways ? offset : 0)], [diameter * 1.014, .071, diameter * 1.014], 'paint', rotation);
  }
  tool.round(iron, [x + diameter * .19, y + (sideways ? .13 : length / 2), z + (sideways ? length / 2 : -.08)], [.17, .05, .17], 'metal', rotation);
}

export function crate(tool: Tools, x: number, y: number, z: number, size = .73, tone = 0xb37c4d) {
  tool.box(tone, [x, y + size * .44, z], [size, size * .86, size * .92]);
  for (const end of [-1, 1]) {
    tool.box(timber, [x + end * size * .38, y + size * .46, z + size * .46], [size * .13, size * .91, .075]);
    tool.box(wood[3], [x + end * size * .38, y + size * .89, z], [size * .14, .063, size * .93]);
  }
  tool.beam(wood[3], [x - size * .33, y + size * .19, z + size * .48], [x + size * .33, y + size * .74, z + size * .48], .07);
}

function raft(model: Model, root: Group, spec: Waterline, name: string, seed: number) {
  const [width, depth] = spec.size;
  const group = child(root, name, spec.position);
  group.rotation.y = spec.turn;
  const t = model.at(group);
  planks(t, width, depth, 0, seed);
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - .14), z = side * (depth / 2 - .21);
    t.box(timber, [x, -.29, 0], [.27, .44, depth - .15]);
    t.box(0x875c3c, [0, -.23, z], [width + .14, .40, .24]);
    t.box(wood[1], [0, -.20, z * .39], [width - .13, .32, .24]);
    const count = Math.max(2, Math.round(depth / 1.55));
    for (let i = 0; i < count; i++) {
      const dz = (i / (count - 1) - .5) * (depth - 1.38);
      const xPos = side * (width / 2 - .34);
      if ((i + seed) % 7 === 0) {
        t.box(0x637775, [xPos, -.83, dz], [.92, .86, 1.16], 'metal');
        t.box(iron, [xPos, -.48, dz], [.96, .12, 1.2], 'metal');
      } else {
        drum(t, [xPos, -.83, dz], .91, 1.18, blue[(i + seed) % blue.length], true);
      }
      for (const band of [-.30, .31]) {
        t.box(iron, [x + side * .02, -.33, dz + band], [.12, .32, .23], 'metal');
        t.round(0xc8ac78, [x + side * .089, -.32, dz + band], [.072, .06, .072], 'metal', [0, 0, Math.PI / 2]);
      }
      if ((i + seed) % 3 === 1) {
        t.ring(0x262f31, [x + side * .10, -.46, dz], [.61, .61, 1.70], 'matte', [0, Math.PI / 2, 0]);
        t.ring(rope, [x + side * .06, -.16, dz], [.18, .20, .52], 'fabric');
      }
    }
    t.box(iron, [x, -.08, z * .59], [.22, .19, .46], 'metal', [0, .12 * side, 0]);
  }
  t.box(0x87948a, [width * .19, -.02, depth * .31], [.45, .055, .27], 'metal', [0, .19, 0]);
  return group;
}

export const auxiliary: Record<'repair' | 'pier' | 'netFloat', Waterline> = {
  repair: { position: [-4.15, .79, 5.37], size: [3.2, 3.1], turn: .15 },
  pier: { position: [3.75, .65, 11.5], size: [1.75, 3.3], turn: -.24 },
  netFloat: { position: [6.15, .42, 8.5], size: [2.5, 1.8], turn: .14 }
};

const passage: { id: string; a: Point3; b: Point3; width: number }[] = [
  { id: 'workshop gangway', a: [-6.49, .96, 2.45], b: [-5.12, 1.18, 2.45], width: 1.71 },
  { id: 'watch gangway', a: [-6.2, 1.04, -3.22], b: [-5.13, 1.18, -3.22], width: 1.33 },
  { id: 'power gangway', a: [.89, 1.01, -6.54], b: [.89, 1.18, -4.16], width: 1.47 },
  { id: 'garden gangway', a: [3.05, 1.01, -7.63], b: [4.86, 1.02, -7.49], width: 1.53 },
  { id: 'water gangway', a: [2.95, 1.18, .86], b: [5.9, .96, .83], width: 1.75 },
  { id: 'irrigation gangway', a: [8.48, 1.02, -3.74], b: [8.49, .96, -1.48], width: 1.39 },
  { id: 'fishery gangway', a: [1.64, 1.18, 3.5], b: [1.82, .76, 5.47], width: 1.75 },
  { id: 'repair gangway', a: [-3.88, 1.18, 3.57], b: [-3.99, .79, 4.3], width: 1.15 },
  { id: 'pier steps', a: [3.48, .76, 9.65], b: [3.68, .65, 10.28], width: 1.25 },
  { id: 'salvage gangway', a: [4.22, .76, 7.97], b: [5.08, .42, 8.25], width: .85 }
];

export function buildDecks(model: Model, root: Group) {
  zoneIds.forEach((id, i) => raft(model, root, zones[id], `${id} raft`, i + 25));
  const repair = model.at(raft(model, root, auxiliary.repair, 'Repair float', 54));
  const pier = model.at(raft(model, root, auxiliary.pier, 'Jetty extension', 61));
  const net = model.at(raft(model, root, auxiliary.netFloat, 'Salvage float', 72));
  for (const { id, a, b, width } of passage) stairs(model.at(child(root, id)), a, b, width, Math.max(3, Math.ceil(Math.hypot(a[0] - b[0], a[2] - b[2]) * 3)), width > 1.2);
  railing(repair, [-1.46, 0, -.99], [-1.46, 0, 1.36], 'rope', 2);
  crate(repair, -.85, 0, .78, .69);
  drum(repair, [.78, .41, .75], .63, .82, blue[1]);
  for (let i = 0; i < 4; i++) repair.box(wood[i], [-.35 + i * .21, .09 + i * .02, -.48], [1.15, .11, .24], 'wood', [0, .50 - i * .15, 0]);
  for (const x of [-.67, .67]) {
    railing(pier, [x, 0, -.65], [x, 0, 1.53], 'rope', 2, .57);
    pier.box(timber, [x, .12, 1.44], [.20, 1.02, .22]);
  }
  net.box(iron, [0, .05, .26], [1.87, .10, 1.1], 'metal');
  crate(net, -.72, .1, .34, .55);
  drum(net, [.76, .42, .34], .48, .65, blue[0]);
  return [...zoneIds.map(id => zones[id]), ...Object.values(auxiliary)];
}
