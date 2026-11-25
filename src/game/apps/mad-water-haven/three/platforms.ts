import type { Group } from 'three-platformize';
import { zoneIds, zones, type Point3, type ZoneId } from '../content';
import { child, type Kit } from './kit';
import { blue, iron, random, rope, timber, wood } from './palette';
import { bucket, buoys, crate, drum, line, planks, pottedPlant, pottedTree, railing, sack, stairs } from './props';
import type { Waterline } from './ocean';

type Wing = { offset: [number, number]; size: [number, number]; turn: number };

// 每块主浮台再拼一块错位小平台，轮廓不再是单一矩形。Wing 的位置会同时登记为水线，
// 保证浪花沿真实边缘出现，而不是沿主矩形的包围盒。
const wings: Partial<Record<ZoneId, Wing>> = {
  home: { offset: [3.55, 2.35], size: [3.4, 2.6], turn: .26 },
  garden: { offset: [-2.75, 1.65], size: [2.9, 2.3], turn: -.2 },
  works: { offset: [2.15, -2.55], size: [2.4, 2.1], turn: .34 },
  water: { offset: [-2.45, -1.7], size: [2.6, 2.0], turn: -.24 },
  power: { offset: [-2.35, .95], size: [2.5, 2.2], turn: .18 },
  tower: { offset: [-.85, 1.95], size: [2.3, 1.7], turn: -.3 },
  fish: { offset: [2.45, -1.85], size: [2.2, 1.9], turn: .22 }
};

export const auxiliary = {
  repair: { position: [-4.7, .78, 5.9], size: [3.4, 3.2], turn: .15 },
  jetty: { position: [4.5, .62, 12.6], size: [1.8, 3.4], turn: -.24 },
  salvage: { position: [7.2, .42, 9.5], size: [2.6, 1.9], turn: .14 },
  fishPen: { position: [-9.9, .52, 9.6], size: [3.6, 3.0], turn: .3 },
  kelpFloat: { position: [12.3, .5, 6.1], size: [2.2, 2.0], turn: -.18 }
} satisfies Record<string, Waterline>;

const passage: { id: string; a: Point3; b: Point3; width: number; canopy?: number[] }[] = [
  { id: 'workshop gangway', a: [-6.95, .96, 3.4], b: [-6.0, 1.22, 3.4], width: 1.7 },
  { id: 'tower gangway', a: [-6.55, 1.06, -4.6], b: [-5.95, 1.22, -4.6], width: 1.3 },
  { id: 'power gangway', a: [.85, 1.0, -6.65], b: [.85, 1.22, -4.85], width: 1.5 },
  { id: 'garden gangway', a: [3.75, 1.0, -8.2], b: [5.05, 1.02, -8.05], width: 1.5 },
  { id: 'market bridge', a: [3.15, 1.22, 1.2], b: [6.35, .96, 1.1], width: 1.7, canopy: [0xdc9f70, 0xf3cf9a, 0xc77f58] },
  { id: 'irrigation gangway', a: [9.35, 1.02, -4.05], b: [9.35, .96, -1.3], width: 1.4 },
  { id: 'fishery gangway', a: [2.1, 1.22, 3.65], b: [2.25, .74, 5.95], width: 1.75 },
  { id: 'repair gangway', a: [-4.4, 1.22, 3.65], b: [-4.5, .78, 4.5], width: 1.15 },
  { id: 'jetty steps', a: [3.2, .74, 10.75], b: [3.9, .62, 11.6], width: 1.25 },
  { id: 'salvage gangway', a: [5.1, .74, 9.1], b: [6.0, .42, 9.3], width: .9 },
  { id: 'fish pen gangway', a: [-9.9, .96, 7.15], b: [-9.9, .52, 8.25], width: 1.2 }
];

function underFrame(t: ReturnType<Kit['at']>, width: number, depth: number, seed: number) {
  const roll = random(seed);
  // 承重梁与斜撑沿边缘闭合，斜侧面能读到甲板的受力方向。
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - .14), z = side * (depth / 2 - .21);
    t.box(timber, [x, -.29, 0], [.27, .44, depth - .15]);
    t.box(0x875c3c, [0, -.23, z], [width + .14, .40, .24]);
    t.box(wood[1], [0, -.20, z * .39], [width - .13, .32, .24]);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    t.beam(timber, [0, -.30, 0], [sx * (width / 2 - .3), -.44, sz * (depth / 2 - .3)], .115);
  }

  // 沿长边排浮桶、废旧轮胎和金属浮箱；材质随机错开，避免一眼看出重复阵列。
  const count = Math.max(2, Math.round(Math.max(width, depth) / 1.55));
  for (const side of [-1, 1]) {
    const along = width >= depth;
    for (let i = 0; i < count; i++) {
      const offset = (i / (count - 1) - .5) * ((along ? width : depth) - 1.38);
      const x = along ? offset : side * (width / 2 - .34);
      const z = along ? side * (depth / 2 - .34) : offset;
      const pick = (i + seed + (side > 0 ? 2 : 0)) % 7;
      if (pick === 0) {
        t.box(0x637775, [x, -.83, z], [1.02, .86, 1.22], 'metal');
        t.box(iron, [x, -.48, z], [1.06, .12, 1.26], 'metal');
      } else {
        drum(t, [x, -.83, z], .91, 1.18, blue[(i + seed + (side > 0 ? 1 : 0)) % blue.length], along);
      }
      for (const band of [-.30, .31]) {
        const bx = along ? x : x + side * .02;
        const bz = along ? z + band : z + band;
        t.box(iron, [bx, -.33, bz], [.12, .32, .23], 'metal');
        t.round(0xc8ac78, [along ? x : x + side * .089, -.32, bz], [.072, .06, .072], 'metal', [0, 0, Math.PI / 2]);
      }
      if ((i + seed) % 3 === 1) {
        t.ring(0x262f31, [x + (along ? .1 : side * .1), -.46, z], [.61, .61, 1.70], 'matte', [0, Math.PI / 2, 0]);
        t.ring(rope, [x, -.16, z], [.18, .20, .52], 'fabric');
      }
      if (roll() < .2) t.box(0x8d9990, [x, -.12, z], [.44, .05, .28], 'metal', [0, .19, 0]);
    }
  }
}

function raft(kit: Kit, root: Group, spec: Waterline, name: string, seed: number, wing?: Wing) {
  const [width, depth] = spec.size;
  const group = child(root, name, spec.position);
  group.rotation.y = spec.turn;
  const t = kit.at(group);
  planks(t, width, depth, 0, seed);
  underFrame(t, width, depth, seed);
  const lines: Waterline[] = [{ ...spec }];

  if (wing) {
    const [ox, oz] = wing.offset;
    const cos = Math.cos(spec.turn), sin = Math.sin(spec.turn);
    const wingGroup = child(group, `${name} annex`, [ox, .012, oz]);
    wingGroup.rotation.y = wing.turn;
    const w = kit.at(wingGroup);
    planks(w, wing.size[0], wing.size[1], 0, seed + 7);
    underFrame(w, wing.size[0], wing.size[1], seed + 7);
    lines.push({
      position: [spec.position[0] + ox * cos + oz * sin, spec.position[1], spec.position[2] - ox * sin + oz * cos],
      size: wing.size, turn: spec.turn + wing.turn
    });
  }
  return lines;
}

export function buildPlatforms(kit: Kit, root: Group) {
  const decks: Waterline[] = [];
  zoneIds.filter(id => id !== 'depths').forEach((id, i) => {
    decks.push(...raft(kit, root, zones[id], `${id} raft`, i + 25, wings[id]));
  });
  for (const [name, spec] of Object.entries(auxiliary)) decks.push(...raft(kit, root, spec, `${name} float`, 54 + name.length));

  const dress = (spec: Waterline) => kit.at(child(root, `${spec.position.join()} dressing`, spec.position));

  // 栈桥在两端各下一级台阶，桥面与两侧甲板自然错开高度。
  for (const { id, a, b, width, canopy } of passage) {
    const group = child(root, id);
    const t = kit.at(group);
    const steps = Math.max(3, Math.ceil(Math.hypot(a[0] - b[0], a[2] - b[2]) * 3));
    stairs(t, a, b, width, steps, width > 1.2);
    if (canopy) {
      for (const end of [0, 1]) {
        const x = a[0] + (b[0] - a[0]) * end, z = a[2] + (b[2] - a[2]) * end;
        const y = a[1] + (b[1] - a[1]) * end;
        for (const side of [-1, 1]) {
          t.beam(timber, [x + side * width * .47, y - .12, z], [x + side * width * .47, y + 2.05, z], .12);
        }
      }
      const midX = (a[0] + b[0]) / 2, midZ = (a[2] + b[2]) / 2, midY = (a[1] + b[1]) / 2;
      // 棚面长轴要沿桥向，绕 y 轴旋转后才是顺着栈桥的雨棚，而不是横在甲板上的一块布。
      const along = Math.atan2(b[0] - a[0], b[2] - a[2]);
      t.box(canopy[0], [midX, midY + 2.1, midZ], [width + .5, .11, Math.hypot(b[0] - a[0], b[2] - a[2]) + .4], 'fabric', [-.03, along, 0]);
      t.box(canopy[2], [midX, midY + 2.0, midZ], [width + .58, .09, .24], 'metal', [0, along, 0]);
    }
  }

  const repair = dress(auxiliary.repair);
  railing(repair, [-1.55, 0, -1.05], [-1.55, 0, 1.42], 'rope', 2);
  crate(repair, -.9, 0, .82, .69);
  drum(repair, [.82, .41, .8], .63, .82, blue[1]);
  for (let i = 0; i < 4; i++) repair.box(wood[i], [-.35 + i * .21, .09 + i * .02, -.5], [1.15, .11, .24], 'wood', [0, .50 - i * .15, 0]);
  repair.box(wood[3], [-.2, .05, .2], [1.7, .09, .34], 'wood', [0, -.28, .02]);
  repair.ring(0x2f3f40, [1.05, .24, -1.0], [.66, .66, .9], 'matte', [Math.PI / 2, .2, 0]);
  repair.ring(rope, [-1.1, .16, -.7], [.5, .5, .55], 'fabric', [Math.PI / 2, 0, 0]);
  pottedPlant(repair, 1.05, 0, 1.15, .38);
  pottedTree(repair, -.95, 0, -1.05, 1.55, 3);

  const jetty = dress(auxiliary.jetty);
  for (const x of [-.7, .7]) {
    railing(jetty, [x, 0, -.7], [x, 0, 1.58], 'rope', 2, .57);
    jetty.box(timber, [x, .12, 1.5], [.20, 1.02, .22]);
  }
  jetty.box(iron, [0, .06, .1], [1.45, .1, 1.9], 'metal');
  line(jetty, rope, [-.7, .95, 1.5], [-.7, .35, 2.6], .18, .04);

  const salvage = dress(auxiliary.salvage);
  salvage.box(iron, [0, .05, .26], [1.87, .10, 1.1], 'metal');
  crate(salvage, -.72, .1, .34, .55);
  drum(salvage, [.76, .42, .34], .48, .65, blue[0]);
  salvage.ring(rope, [-.4, .22, -.3], [.78, .78, .62], 'fabric', [Math.PI / 2, .3, 0]);
  buoys(salvage, .55, .06, -.62, 0xec9761, 3, .3);
  bucket(salvage, -.95, .1, -.4, 0x8fb0aa);

  const pen = dress(auxiliary.fishPen);
  railing(pen, [-1.7, 0, -1.4], [-1.7, 0, 1.42], 'rope', 3);
  railing(pen, [-1.7, 0, 1.42], [1.55, 0, 1.42], 'rope', 3);
  for (let i = 0; i < 3; i++) {
    const x = -1.2 + i * 1.15;
    pen.box(timber, [x, .25, -.9], [.16, .95, .16]);
    pen.box(wood[2], [x, .98, -.9], [.9, .10, .18]);
  }
  for (let i = 0; i < 4; i++) line(pen, rope, [-1.6 + i * 1.0, .95, -.9], [-1.45 + i * 1.0, .28, .9], .25, .018);

  const kelp = dress(auxiliary.kelpFloat);
  kelp.box(wood[1], [0, .03, 0], [1.85, .16, 1.6]);
  for (const [x, z] of [[-.7, -.5], [.68, -.46], [.66, .54]]) kelp.box(timber, [x, .1, z], [.16, .55, .16]);
  line(kelp, rope, [-.7, .6, -.5], [.68, .58, -.46], .1, .028);
  // 晒海带的横杆：深绿色长条挂在绳上，与上方种植区颜色呼应但更暗。
  for (let i = 0; i < 7; i++) {
    const x = -.62 + i * .2;
    kelp.beam(0x2f6b4a, [x, .55, -.08], [x + .02, .17, -.08], .07, 'matte', true);
    kelp.orb(0x3d7a50, [x + .02, .19, -.08], [.12, .14, .09], 'matte');
  }
  sack(kelp, .62, .1, .62, .4, 0xb79a6c, .3);

  return decks;
}
