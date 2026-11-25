import type * as THREE from 'three-platformize';
import { child, type Kit } from './kit';
import { cream, iron, teal, timber, wood } from './palette';
import { canopy, cloth, crate, lamp, planks, railing, type Motion } from './props';

/** 观察塔是基地最高的构架，比住宅屋顶再高约 4 米，形成清晰的纵向标志。 */
export function buildLookout(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);
  const deck = 6.72;
  const roof = 9.24;

  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const foot: [number, number, number] = [x * 1.62, 0, z * 1.66];
    const top: [number, number, number] = [x * 1.0, deck + .12, z * 1.02];
    t.beam(timber, foot, top, .31);
    t.box(iron, [foot[0], .18, foot[2]], [.47, .34, .48], 'metal');
    t.beam(wood[0], [foot[0], .3, foot[2]], [-top[0], deck * .52, z * 1.3], .14);
    t.beam(wood[2], [x * 1.32, deck * .53, z * 1.3], [-top[0], deck - .18, top[2]], .16);
    // 交叉斜撑让塔架从任何一面看都不是空框。
    t.beam(timber, [x * 1.42, 2.2, z * 1.46], [x * 1.28, 4.5, -z * 1.3], .13);
  }
  for (const y of [1.85, 3.8, 6.6]) {
    const radius = 1.68 - .085 * y;
    for (const z of [-radius, radius]) t.box(timber, [0, y, z], [radius * 2.16, .19, .20]);
    for (const x of [-radius, radius]) t.box(wood[0], [x, y, 0], [.20, .19, radius * 2.12]);
  }

  // 爬梯贴着南侧两根立柱，梯口留在一块开口盖板上。
  for (const x of [-.36, .36]) t.beam(wood[2], [x, .04, 1.78], [x, deck + .4, 1.3], .12);
  for (let i = 0; i < 20; i++) t.beam(wood[i % 5], [-.36, .36 + i * .35, 1.82 - i * .024], [.36, .36 + i * .35, 1.82 - i * .024], .098, 'wood', true);

  planks(t, 2.86, 2.72, deck, 60);
  for (const x of [-1.24, 1.24]) {
    railing(t, [x, deck, -1.2], [x, deck, 1.18], 'wood', 2, .82);
    for (const z of [-1.12, 1.1]) t.beam(timber, [x, deck, z], [x, roof - .12, z], .14);
  }
  railing(t, [-1.24, deck, -1.2], [1.24, deck, -1.2], 'wood', 2, .82);
  railing(t, [-.48, deck, 1.18], [-1.24, deck, 1.18], 'wood', 1, .82);
  for (const z of [-1.12, 1.1]) t.box(timber, [0, roof - .12, z], [2.7, .14, .15]);
  canopy(t, 0, 0, roof, 3.0, 2.8, [0xdc9f70, 0xffd6a5, 0xf1be8a], .27);

  // 瞭望设备：探照灯、望远镜、海图和木箱。
  t.box(0x457573, [.72, deck + .42, -.72], [.8, .72, .54]);
  t.round(iron, [-.74, deck + .48, .76], [.15, .9, .15]);
  t.round(0xd5a35b, [-.74, deck + 1.02, .8], [.6, .5, .6], 'metal', [Math.PI / 2 - .17, 0, 0]);
  t.round(cream, [-.74, deck + 1.06, 1.05], [.51, .06, .51], 'glow', [Math.PI / 2 - .17, 0, 0]);
  t.ring(iron, [-.74, deck + 1.04, 1.07], [.56, .56, .66]);
  t.beam(wood[0], [.6, deck, .28], [.6, deck + .9, .28], .11);
  t.round(0x31565b, [.6, deck + 1.0, .25], [.25, .76, .25], 'metal', [1.31, 0, -.38]);
  t.round(0xd0a766, [.62, deck + 1.11, .6], [.32, .17, .32], 'metal', [1.31, 0, -.38]);
  crate(t, -.78, deck, -.7, .6, 0xb37c4d, -.2);
  lamp(t, .2, deck + 1.7, -.2, .2);

  // 信号旗杆从顶棚穿出，比棚面再高 2.4 米。
  t.beam(timber, [-1.12, roof + .1, -.95], [-1.12, roof + 2.2, -.95], .105);
  t.orb(0xffcc79, [-1.12, roof + 2.22, -.95], [.16, .16, .16]);
  t.box(teal[3], [.02, deck + .2, -1.22], [1.2, .34, .1], 'fabric');
  return [
    cloth(root, [-1.06, roof + 2.08, -.95], 1.8, .82, [0xbb5746, cream, cream, 0x518885], .7, true),
    cloth(root, [.2, deck + 1.5, -1.2], .8, .45, [0x518885, cream, 0xbb5746], 2.4)
  ];
}
