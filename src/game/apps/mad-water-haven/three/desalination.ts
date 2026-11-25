import type * as THREE from 'three-platformize';
import { child, rotated, type Kit, type Tools } from './kit';
import { blue, cream, iron, rust, timber, wood } from './palette';
import { hose, gauge, valve } from './pipes';
import { blueBarrel, canopy, cloth, crate, drum, planks, railing, sack, type Motion } from './props';

const copper = 0xbb855a;
const jade = 0x3c7c76;
const yellow = 0xd9a949;

/** 斜面蒸馏器：一面玻璃、一面浅水盘，四周留出冷凝槽。 */
function still(t: Tools, x: number, z: number, w: number, d: number) {
  const slope = .38;
  for (const dx of [-w * .4, w * .4]) for (const dz of [-d * .44, d * .44]) {
    const height = .84 - dz * slope;
    t.beam(iron, [x + dx, 0, z + dz], [x + dx, height, z + dz], .105, 'metal');
  }
  for (const dx of [-w * .4, w * .4]) t.beam(iron, [x + dx, .08, z + d * .44], [x + dx, .74 + d * .44 * slope, z - d * .44], .064, 'metal');
  t.box(0x91a6a4, [x, .88, z], [w + .1, .095, d + .08], 'metal', [slope, 0, 0]);
  t.box(0x6fb6bd, [x, .95, z], [w - .14, .025, d - .1], 'paint', [slope, 0, 0]);
  t.box(cream, [x, .76, z + d * .47], [w + .16, .06, .1], 'paint');
  hose(t, jade, [[x + w * .4, .5, z + d * .46], [x + w * .4 + .2, .36, z + d * .46], [x + w * .4 + .2, .28, z + d * .2]], .05);
}

export function buildDesalination(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);
  const tankX = .75, tankZ = -.75;

  // 高位储水罐落在四条斜腿上，底部留出泵和管阀的空间。
  t.box(iron, [tankX, .14, tankZ], [2.3, .26, 2.36], 'metal');
  for (const x of [tankX - .8, tankX + .8]) for (const z of [tankZ - .74, tankZ + .74]) {
    t.box(jade, [x, .4, z], [.23, .78, .25], 'metal');
  }
  t.barrel(0x308eb5, [tankX, 1.52, tankZ], [1.96, 2.06, 1.94]);
  for (const y of [.68, 1.16, 1.72, 2.3]) t.round(y === 2.3 ? cream : 0x6cafc0, [tankX, y, tankZ], [1.975, .08, 1.96], 'paint');
  t.round(0x376b77, [tankX, 2.52, tankZ], [1.06, .15, 1.06]);
  t.round(cream, [tankX, 2.61, tankZ], [.55, .065, .55], 'paint');
  for (const x of [tankX - .83, tankX + .76]) t.beam(0x2c6978, [x, .36, tankZ + .55], [x, 2.7, tankZ + .5], .088, 'metal');
  for (let i = 0; i < 6; i++) t.beam(wood[i % 5], [tankX - .72, .5 + i * .34, tankZ + .55], [tankX + .68, .5 + i * .34, tankZ + .55], .06, 'wood', true);
  gauge(t, tankX + 1.0, 1.5, tankZ + .1);

  // 过滤柱：三根不同直径的罐体，管道在顶部汇合。
  for (const [i, x] of [-1.95, -1.22, -.5].entries()) {
    const y = 1.02 - i * .04;
    t.box(iron, [x, .16, .5], [.58, .19, .6], 'metal');
    t.barrel(i ? 0xb8c4a7 : 0x78b4be, [x, y, .5], [.53, 1.5, .53]);
    for (const cap of [-.64, .62]) t.round(iron, [x, y + cap, .5], [.552, .098, .552]);
    gauge(t, x, y + .28, .785);
    hose(t, copper, [[x, y + .62, .5], [x, 1.9, .5], [x + .19, 1.99, .5]], .086);
  }
  t.beam(copper, [-1.95, 1.99, .5], [.06, 1.99, .5], .096, 'metal', true);
  hose(t, copper, [[tankX + .2, 1.62, tankZ + .82], [tankX + .2, 1.4, .88], [0, 1.4, .9], [-.05, 1.35, .78]], .12);
  hose(t, 0x6b9e9a, [[tankX + .18, 2.58, tankZ], [tankX + .8, 2.6, tankZ], [1.62, 2.48, tankZ], [1.72, 1.1, tankZ], [1.72, .56, tankZ + .2]], .115);

  // 手压泵、阀门和压力表接在过滤柱与储水罐之间。
  t.box(iron, [.15, .22, 1.32], [.92, .37, .7], 'metal');
  t.barrel(yellow, [.17, .6, 1.35], [.6, .84, .6], [0, 0, Math.PI / 2]);
  t.beam(wood[3], [.5, .6, 1.55], [.86, 1.32, 1.7], .06, 'wood', true);
  t.round(0x5e6b68, [.9, 1.38, 1.72], [.2, .16, .2], 'paint');
  gauge(t, .2, 1.04, 1.4);
  valve(t, -.48, .52, .68);
  valve(t, -.05, 1.4, .88, 0x6aa8b5);

  // 太阳能蒸馏棚与观察猫道。
  const distiller = rotated(root, 'Solar still', [-1.32, .04, -1.96], -.09);
  still(kit.at(distiller), 0, 0, 2.4, .96);
  hose(t, jade, [[-1.3, .5, -1.5], [-1.1, .42, -1.35], [-.9, .2, -1.0], [-.5, .2, -.2], [-.2, .3, .1]], .06);
  for (const x of [-2.8, 2.75]) t.beam(timber, [x, 0, -2.45], [x, 1.62, -2.45], .1);
  planks(t, 5.5, .95, 1.64, 61, 0, -2.42);
  railing(t, [-2.7, 1.64, -2.9], [-.4, 1.64, -2.9], 'wood', 2, .62);
  railing(t, [.4, 1.64, -2.9], [2.65, 1.64, -2.9], 'wood', 2, .62);
  for (let i = 0; i < 5; i++) t.box(wood[i % 5], [-2.65 + i * .28, 1.72, -2.42], [.25, .17, .9], 'wood', [0, .05, 0]);

  // 蓝色水桶与杂物集中在外侧，给主要设备留出可读间距。
  blueBarrel(t, 2.15, 0, -.92, .66, blue[1]);
  blueBarrel(t, 2.3, 0, -.1, .56, blue[3]);
  drum(t, [1.9, .42, 1.7], .62, .8, blue[0]);
  crate(t, -2.45, 0, 2.35, .7, 0xb37c4d, .2);
  sack(t, -1.8, 0, 2.5, .46, 0xc2a06c, -.4);
  canopy(t, -1.7, 2.0, 2.05, 1.7, 1.3, [0x4d8fa8, 0xd7e4d2], .14);
  // 四角立柱把遮阳布撑起来，斜俯视时不会像一块悬空的板。
  for (const x of [-2.4, -1.0]) for (const z of [1.42, 2.58]) t.beam(timber, [x, 0, z], [x, 2.06, z], .075);
  railing(t, [2.95, 0, -2.3], [2.95, 0, -.2], 'rope', 2, .72);
  railing(t, [-2.85, 0, 2.72], [2.9, 0, 2.72], 'rope', 5, .72);
  // 储水罐顶上的黄旗，给左侧蓝绿色设备堆加一点暖色。
  t.beam(iron, [tankX, 2.66, tankZ], [tankX, 3.9, tankZ], .045);
  return [cloth(root, [tankX, 3.76, tankZ], .72, .3, [0xf1c857, cream], 3.4, true)];
}
