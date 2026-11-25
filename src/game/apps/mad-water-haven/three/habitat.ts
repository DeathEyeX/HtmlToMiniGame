import type * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { child, rotated, type Kit, type Tools } from './kit';
import { blue, cream, green, iron, random, rope, rust, teal, timber, wood } from './palette';
import { bench, bucket, canopy, cloth, corrugated, crate, fence, lamp, planks, pottedPlant, railing, sack, stairs, window, type Motion } from './props';

/**
 * 中央生活住宅。三层结构：底层开放起居与厨房，二层带环绕露台的卧室层，
 * 顶层前部是晒台、后部是带阁楼和无线电杆的坡屋顶。整体原点在甲板中心，
 * 换模型时只要保持 9×8 的占地即可直接替换。
 */
export function buildHabitat(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);
  const floor2 = 2.58;
  const floor3 = 5.18;
  const white = [0xe5c49a, 0xe2ccaa, 0xcfaa80, 0xdeb793];
  const tealWall = [0x478a88, 0x5b9d96, 0x88aca0, 0x689b90, 0x3e7678];

  // ── 底层结构 ────────────────────────────────────────────────
  planks(t, 6.15, 5.95, floor2, 92, -.75, -.42);
  for (const x of [-3.72, -1.86, .06, 1.94]) for (const z of [2.5, -3.28]) {
    t.box(timber, [x, floor2 / 2, z], [.24, floor2 + .04, .24]);
    t.box(iron, [x, .12, z], [.36, .22, .36], 'metal');
    t.beam(wood[2], [x, 1.82, z], [x + (x < 0 ? .5 : -.5), 2.42, z], .115);
  }
  for (const z of [-3.34, -1.2, .96, 2.18]) t.box(timber, [-.78, 2.44, z], [6.3, .24, .24]);
  t.box(wood[0], [-3.79, 2.45, -.42], [.29, .27, 6.0]);
  t.box(wood[1], [2.0, 2.45, -.42], [.29, .27, 6.0]);
  fence(t, -3.76, 1.95, 0, 2.48, -3.3, tealWall);
  fence(kit.at(rotated(root, 'Windward siding', [-3.77, 0, -.6], Math.PI / 2)), -2.72, 2.72, 0, 2.46, 0, white);
  fence(kit.at(rotated(root, 'Kitchen partition', [1.9, 0, -1.9], Math.PI / 2)), -1.05, 1.05, 0, 2.38, 0, tealWall);

  // ── 二层：地板、露台与带窗卧室 ──────────────────────────────
  for (const x of [-3.76, 1.92]) for (const z of [-3.28, 1.2]) {
    t.box(timber, [x, floor2 + 1.24, z], [.21, 2.5, .21]);
    t.beam(wood[2], [x, floor2 + .9, z], [x + (x < 0 ? .48 : -.48), floor2 + 2.2, z], .10);
  }
  fence(t, -3.77, -1.9, floor2, 2.32, 1.2, white);
  fence(t, -.9, 1.9, floor2, 2.32, 1.2, tealWall);
  t.box(0x6e4f38, [-1.4, floor2 + .96, .5], [.92, 1.94, .12]);
  window(t, -2.72, floor2 + 1.28, 1.26, 1.14, .92);
  window(t, .52, floor2 + 1.28, 1.26, 1.34, .93);
  fence(t, -3.75, 1.93, floor2, 2.4, -3.3, tealWall);
  for (const [x, name, color] of [[-3.76, 'West bedroom wall', white], [1.9, 'East bedroom wall', tealWall]] as const) {
    const side = rotated(root, name, [x, 0, -1.02], Math.PI / 2);
    fence(kit.at(side), -2.3, 2.28, floor2, 2.28, 0, color);
    window(kit.at(side), .35, floor2 + 1.3, .1, 1.22, .88);
  }
  for (const y of [floor2 + .08, floor2 + 2.42]) t.box(timber, [-.9, y, 1.22], [5.7, .15, .17]);
  t.box(cream, [-.92, floor2 + 2.44, 1.28], [5.8, .12, .1]);

  // 露台沿正立面和东侧连续转折，栅栏在楼梯口断开。
  railing(t, [-3.74, floor2, 2.36], [1.2, floor2, 2.36], 'wood', 4, .84);
  railing(t, [-3.74, floor2, -3.24], [-3.74, floor2, 2.36], 'wood', 4, .84);
  railing(t, [1.92, floor2, -3.24], [1.92, floor2, -.5], 'wood', 2, .84);
  stairs(t, [3.05, 0, 3.5], [2.62, floor2, .85], 1.1, 12);

  // 二层室内：床铺、床头柜、地毯和带罐子的搁架。
  t.box(wood[2], [-2.2, floor2 + .26, -1.82], [1.72, .34, 2.42]);
  t.box(cream, [-2.2, floor2 + .5, -1.82], [1.66, .26, 2.35], 'fabric');
  t.box(0x6f9b93, [-2.2, floor2 + .64, -1.4], [1.68, .14, 1.3], 'fabric');
  t.box(0xc9705c, [-2.2, floor2 + .72, -.88], [1.72, .06, .42], 'fabric');
  t.orb(0xf2e3c2, [-2.2, floor2 + .7, -2.62], [1.2, .24, .5], 'fabric');
  t.box(timber, [-2.2, floor2 + .58, -3.02], [1.74, .82, .16]);
  t.box(0x557e73, [-.46, floor2 + .62, -2.5], [1.1, 1.2, .62]);
  for (const dx of [-.18, .18]) t.box(0x8aa895, [-.46 + dx, floor2 + .64, -2.17], [.44, 1.1, .08]);
  for (const dx of [-.15, .12]) t.round(0x9a6a47, [-.46 + dx, floor2 + 1.4, -2.42], [.2, .26, .2], 'paint');
  t.box(0xbf9d6b, [-.8, floor2 + .035, .1], [2.9, .035, 1.6], 'fabric', [0, .12, 0]);

  // ── 顶层：晒台、坡屋顶和阁楼 ────────────────────────────────
  fence(t, -3.76, 1.93, floor3, 1.32, -3.3, tealWall);
  for (const x of [-3.75, 1.92]) fence(kit.at(rotated(root, 'Loft side', [x, 0, -2.35], Math.PI / 2)), -1.0, 1.0, floor3, 1.32, 0, white);
  window(t, -.98, floor3 + .72, -3.24, 1.28, .7);
  corrugated(t, -.9, 5.95, [floor3 + 1.5, -3.44], [floor3 + .7, -1.1], [rust[2], rust[0], rust[3], rust[0], rust[4]], 26);
  corrugated(t, -.9, 5.95, [floor3 + .7, -1.1], [floor3 + .02, .5], [rust[0], rust[1], rust[3], rust[2], 0x817f66], 83);
  t.box(0xd99069, [-.9, floor3 + .02, .5], [6.08, .12, .23], 'metal');
  t.box(cream, [-.9, floor3 + .04, .56], [5.9, .10, .1]);
  for (const x of [-3.55, -2.0, -.45, 1.1]) t.beam(timber, [x, floor3 - .02, -3.42], [x, floor3 + 1.56, -1.1], .15);

  // 前部晒台：四根立柱撑起帆布棚，围一圈木栏，留出上下梯口。
  planks(t, 4.2, 2.5, floor3, 71, -1.55, 1.2);
  for (const x of [-3.5, .4]) for (const z of [.1, 2.42]) t.beam(timber, [x, floor3 - .02, z], [x, floor3 + 1.9, z], .11);
  railing(t, [-3.68, floor3, 2.42], [-.4, floor3, 2.42], 'wood', 2, .8);
  railing(t, [-3.68, floor3, .06], [-3.68, floor3, 2.42], 'wood', 2, .8);
  railing(t, [.42, floor3, 2.42], [1.9, floor3, 2.42], 'wood', 1, .8);
  // 帆布棚单独成组并关闭投影：它悬在坡屋顶正上方，投影会把整片屋顶压暗。
  const awning = child(root, 'Terrace awning');
  awning.userData.castShadow = false;
  canopy(kit.at(awning), -1.55, 1.45, floor3 + 1.95, 4.0, 2.2, [cream, 0xc16954, cream], .2);

  // 晒台的储物与生活痕迹。
  t.barrel(0x4b8fa4, [-3.05, floor3 + .52, .72], [.96, 1.0, .94]);
  for (const y of [floor3 + .22, floor3 + .84]) t.round(0x8bb8c0, [-3.05, y, .72], [.98, .07, .96]);
  for (const x of [-1.4, -.78]) {
    t.round(0xb77757, [x, floor3 + .22, 1.82], [.44, .4, .43], 'paint');
    t.orb(green[2], [x, floor3 + .52, 1.82], [.54, .44, .48]);
    t.orb(green[4], [x + .1, floor3 + .66, 1.82], [.27, .32, .3]);
  }
  t.box(iron, [.9, floor3 + .45, 1.0], [.8, .9, .7], 'metal');
  t.round(cream, [.9, floor3 + .92, 1.0], [.84, .09, .72], 'paint');
  t.beam(timber, [1.05, floor3 + .9, .72], [1.05, floor3 + 1.62, .72], .08);
  t.round(0x31565b, [1.05, floor3 + 1.7, .68], [.22, .78, .22], 'metal', [1.28, 0, -.4]);
  t.round(0xd0a766, [1.12, floor3 + 1.86, 1.0], [.3, .16, .3], 'metal', [1.28, 0, -.4]);
  t.beam(timber, [-3.3, floor3 + 1.92, .4], [-3.3, floor3 + 3.3, .4], .09);
  t.orb(0xffcc79, [-3.3, floor3 + 3.32, .4], [.16, .16, .16]);

  // ── 东侧两层附属房：底层工具间，上层水箱和晒网 ─────────────
  const annex = child(root, 'Two-storey annex', [2.82, 0, -2.1]);
  const a = kit.at(annex);
  planks(a, 2.5, 3.1, 0, 133);
  planks(a, 2.5, 3.1, 3.12, 137);
  for (const x of [-1.16, 1.14]) for (const z of [-1.46, 1.44]) a.box(timber, [x, 1.56, z], [.18, 3.14, .19]);
  fence(a, -1.2, 1.18, 0, 2.0, -1.5, white);
  fence(kit.at(rotated(annex, 'Annex back wall', [1.2, 0, 0], Math.PI / 2)), -1.45, 1.45, 0, 2.0, 0, tealWall);
  a.box(0x6e4f38, [0, .98, -1.44], [.7, 1.75, .1]);
  a.box(wood[3], [0, 1.83, -1.48], [2.4, .1, .2]);
  a.box(0x546060, [.1, 1.3, 1.48], [1.55, .86, .05], 'metal');
  for (let i = 0; i < 6; i++) {
    a.box(0xaaa38a, [-.6 + i * .24, 1.3 + .08 * (i % 2), 1.52], [.045, .34 - .03 * (i % 3), .05], 'metal', [0, 0, .18 * (i - 2)]);
  }
  a.box(0xd9a949, [.28, 3.3, .2], [1.28, .52, .84], 'metal');
  a.round(iron, [.28, 3.58, .2], [1.34, .12, .9], 'metal');
  a.barrel(0x3b8fae, [-.2, 4.16, -.4], [1.0, 1.1, .98]);
  a.round(cream, [-.2, 4.74, -.4], [1.03, .06, 1.0], 'paint');
  a.box(0xc08a52, [.62, 3.78, 1.0], [1.0, .9, .62], 'wood', [0, .12, 0]);
  corrugated(a, 0, 2.9, [3.2, -1.62], [3.2, 1.62], [0x3d7b80, 0x5d9690, 0x3f7479], 15);
  for (let i = 0; i < 6; i++) a.beam(wood[i % 5], [-.9, 3.16 + i * .34, 1.5], [.9, 3.16 + i * .34, 1.5], .075, 'wood', true);

  // ── 底层家具与杂物 ─────────────────────────────────────────
  bench(t, -.6, 1.62, 1.62, .84);
  bench(t, -.55, 2.3, 1.3, .45);
  t.round(cream, [-.9, .912, 1.66], [.32, .056, .32], 'paint');
  t.round(0x498887, [-.45, .97, 1.8], [.24, .26, .24], 'paint');
  t.orb(0xf0a54e, [-.76, .99, 1.62], [.12, .11, .12]);
  t.box(wood[2], [-2.55, .25, .1], [1.42, .34, 2.2]);
  t.box(cream, [-2.55, .47, .1], [1.36, .26, 2.12], 'fabric');
  t.box(0x729b8a, [-2.55, .61, .46], [1.38, .13, 1.24], 'fabric');
  t.box(0xca735c, [-2.55, .685, .88], [1.4, .04, .35], 'fabric');
  t.orb(0xf1dfc0, [-2.53, .66, -.52], [1.0, .23, .48], 'fabric');
  t.box(timber, [-2.57, .56, -.86], [1.42, .76, .16]);
  // 厨房：炉台、锅具、水槽与吊挂的杯具。
  t.box(0x557e73, [.9, .62, -2.5], [1.4, 1.22, .7]);
  for (const x of [.58, 1.2]) {
    t.box(0x779b87, [x, .63, -2.12], [.58, 1.11, .09]);
    t.box(iron, [x - .15, .64, -2.05], [.055, .14, .05], 'metal');
  }
  t.round(0x4c5c5c, [.9, 1.29, -2.46], [.66, .1, .6], 'metal');
  t.cone(0x8f8f7a, [.75, 1.38, -2.46], [.32, .18, .32], 'metal', [Math.PI, 0, 0]);
  t.cone(0xa05a3f, [1.1, 1.4, -2.6], [.34, .2, .34], 'metal', [Math.PI, 0, 0]);
  t.round(cream, [1.62, 1.02, -2.44], [.16, .22, .16], 'paint');
  for (const x of [-1.9, .2, 1.0]) t.box(timber, [x, 1.98, -.98], [.08, .42, .08]);
  t.box(wood[3], [-1.0, 2.2, -.98], [2.35, .09, .1]);
  for (const x of [-1.75, -1.25, -.2, .5]) t.round(cream, [x, 2.06, -.98], [.13, .2, .13], 'paint');

  crate(t, -3.72, 0, 2.9, .68);
  crate(t, -2.92, 0, 3.08, .55, 0xa9734a, .3);
  sack(t, 3.4, 0, 2.9, .52);
  bucket(t, 2.75, 0, 3.24, 0x7fa8a0);
  // 门口市集小桌与盆栽，给中央住宅一层留出生活气息。
  t.box(wood[2], [2.58, .62, 3.08], [1.0, .12, .62], 'wood', [0, .18, 0]);
  for (const x of [2.16, 3.0]) for (const z of [2.86, 3.3]) t.box(timber, [x, .3, z], [.1, .58, .11]);
  t.orb(0xe0a24a, [2.4, .76, 3.02], [.28, .18, .26], 'paint');
  t.orb(0xc3673f, [2.75, .75, 3.14], [.24, .16, .22], 'paint');
  pottedPlant(t, 3.62, 0, 1.55, .38);
  pottedPlant(t, -3.72, 0, -.5, .34, green[4]);
  t.beam(timber, [3.1, 0, 3.55], [3.1, 1.55, 3.55], .08);
  t.orb(0xffcf75, [3.1, 1.42, 3.55], [.2, .16, .2], 'glow');
  t.ring(0xe06a45, [3.1, 1.02, 3.55], [.58, .58, .18], 'paint', [0, 0, Math.PI / 2]);
  t.ring(cream, [3.1, 1.02, 3.55], [.34, .34, .2], 'paint', [0, 0, Math.PI / 2]);
  t.box(0x629287, [3.55, .43, -3.0], [.74, .87, 1.2]);
  t.box(wood[3], [3.55, .9, -3.0], [.83, .115, 1.31]);
  t.round(0x5a8d88, [3.5, 1.04, -3.1], [.28, .16, .28], 'paint');

  railing(t, [-4.55, 0, -4.0], [-.3, 0, -4.0], 'rope', 3);
  railing(t, [-3.4, 0, 3.92], [.1, 0, 3.92], 'rope', 3);
  railing(t, [4.55, 0, -3.7], [4.55, 0, -.8], 'rope', 3);
  lamp(t, -1.0, 2.3, 1.32, .3);
  lamp(t, 1.3, floor2 + 1.94, .5, .22);
  lamp(t, -2.4, 1.9, -2.9, .2);

  // 晾衣绳与帆布都挂在结构上，帆布随海风持续摆动。
  const laundryA: Point3 = [-3.4, 2.02, 3.42], laundryB: Point3 = [-.2, 1.92, 3.2];
  for (const [x, y, z] of [laundryA, laundryB]) t.beam(timber, [x, 0, z], [x, y + .14, z], .1);
  ropeLine(t, laundryA, laundryB);

  return [
    cloth(root, [-3.08, 1.97, 3.42], .64, .68, [cream, 0xd3795c, 0xd3795c], .45),
    cloth(root, [-2.14, 1.87, 3.34], .48, .55, [0x7cabaa, 0x477f86], 1.8),
    cloth(root, [-1.34, 1.86, 3.3], .78, .72, [0xd8c18d, 0xeee0b0, 0x8eae82], 3.3),
    cloth(root, [.15, floor3 + 1.9, 1.3], .5, .26, [cream], 2.6),
    cloth(root, [1.0, floor3 + 1.9, 1.2], .5, .26, [0xc16954], 4.1),
    cloth(root, [-1.3, 1.9, 2.95], .42, .82, [0x8ba9a0, 0xefe6c8], 5.2),
    cloth(root, [2.6, 1.9, -.9], .5, .9, [0xe7d7ae, 0x8ba9a0, 0xc98062], 2.2)
  ];
}

function ropeLine(t: Tools, a: Point3, b: Point3) {
  const steps = 5;
  let previous = a;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const next: Point3 = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]) - 4 * .11 * f * (1 - f), a[2] + f * (b[2] - a[2])];
    t.beam(rope, previous, next, .036, 'fabric', true);
    previous = next;
  }
}
