import * as THREE from 'three-platformize';
import { child, rotated, type Kit, type Tools } from './kit';
import { blue, cream, green, iron, random, rope, timber, wood } from './palette';
import { hose } from './pipes';
import { blueBarrel, bucket, canopy, cloth, pottedPlant, pottedTree, railing, sack, type Motion } from './props';

const leaf = [0x2f7a3a, 0x4b9a46, 0x69b552, 0x24663a, 0x86c45c, 0x3f8a3c];

/** 放射状叶丛：中心球加六片压扁的叶球，从俯视角度也能看出植物体积。 */
function rosette(t: Tools, x: number, y: number, z: number, size: number, phase: number) {
  t.orb(leaf[3], [x, y + size * .15, z], [size * .87, size * .71, size * .83]);
  for (let i = 0; i < 6; i++) {
    const angle = phase + i * Math.PI / 3;
    t.orb(leaf[i], [x + Math.sin(angle) * size * .34, y + size * (.2 + .09 * (i % 3)), z + Math.cos(angle) * size * .34],
      [size * .47, size * .27, size * .86], 'matte', [-.29, angle, .07]);
  }
  t.orb(leaf[4], [x, y + size * .46, z], [size * .5, size * .38, size * .47]);
}

function tomato(t: Tools, x: number, y: number, z: number, height: number, seed: number) {
  const roll = random(seed);
  t.beam(leaf[3], [x, y, z], [x + .1, y + height, z + .06], .045, 'matte', true);
  for (let i = 0; i < 5; i++) {
    const f = .22 + i * .16;
    const side = i % 2 ? 1 : -1;
    const px = x + side * (.14 + roll() * .16), pz = z + (roll() - .5) * .3;
    t.beam(leaf[2], [x, y + height * f, z], [px, y + height * (f + .1), pz], .032, 'matte', true);
    t.orb(leaf[(i + 2) % 6], [px, y + height * (f + .1), pz], [.3, .17, .27], 'matte', [0, roll() * 3, .1]);
    if (i > 1) {
      t.orb(i % 2 ? 0xdb6043 : 0xd99441, [px, y + height * (f + .02), pz + .05], [.18, .2, .2], 'paint');
      t.orb(0xc94a35, [px - .1, y + height * (f + .1), pz - .04], [.14, .16, .16], 'paint');
    }
  }
}

function corn(t: Tools, x: number, y: number, z: number, height: number, seed: number) {
  const roll = random(seed);
  t.beam(leaf[2], [x, y, z], [x, y + height, z], .038, 'matte', true);
  for (let i = 0; i < 4; i++) {
    const f = .28 + i * .18;
    const angle = roll() * Math.PI * 2;
    t.beam(leaf[i % 6], [x, y + height * f, z], [x + Math.sin(angle) * .34, y + height * (f + .13), z + Math.cos(angle) * .34],
      .028, 'matte', true);
  }
  t.orb(0xe0c264, [x + .07, y + height * .56, z], [.15, .3, .13], 'paint');
}

function planter(t: Tools, x: number, z: number, w: number, d: number) {
  t.box(0x554234, [x, .23, z], [w, .2, d], 'matte');
  for (const y of [.12, .29]) {
    for (const dir of [-1, 1]) {
      t.box(wood[y < .2 ? 2 : 0], [x, y, z + dir * d / 2], [w + .14, .16, .11]);
      t.box(wood[y < .2 ? 0 : 1], [x + dir * w / 2, y, z], [.12, .17, d]);
    }
  }
  for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) t.box(timber, [x + dx, .23, z + dz], [.146, .46, .15]);
}

export function buildGarden(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);
  const motion: Motion[] = [];
  const roll = random(335);
  const bedX = .6;

  // 三排高低不同的种植箱，前排矮、后排高，俯视能看出阶梯。
  const rows: { z: number; w: number; d: number; h: number }[] = [
    { z: -1.42, w: 4.4, d: .96, h: .34 },
    { z: .06, w: 4.2, d: .9, h: .28 },
    { z: 1.5, w: 3.8, d: .84, h: .24 }
  ];
  for (const [i, row] of rows.entries()) {
    planter(t, bedX, row.z, row.w, row.d);
    for (let col = 0; col < 7; col++) {
      const x = bedX - row.w / 2 + .36 + col * (row.w - .58) / 6;
      const z = row.z + (roll() - .5) * .3;
      if (i === 0 && col % 3 === 1) tomato(t, x, .38, z, 1.15 + roll() * .25, 61 + col);
      else if (i === 2 && col % 4 === 2) corn(t, x, .3, z, 1.05, 91 + col);
      else rosette(t, x, .36, z, .32 + roll() * .24, roll() * 5);
      // 每排再塞一丛前排小叶菜，俯视时盆面不露出大片空土。
      if (col % 2 === 0) rosette(t, x + .16, .34, z + (row.d / 2 - .16), .2 + roll() * .1, roll() * 6);
    }
    hose(t, 0x3a5552, [[-1.45, .12, row.z - .5], [-1.5, .38, row.z - .3], [-.2, .39, row.z - .28], [bedX + row.w / 2, .38, row.z - .28]], .05);
  }

  // 靠左的立体菜架：立柱、横杆和垂挂的藤蔓。
  for (const z of [-2.3, 2.1]) {
    t.beam(timber, [-2.55, 0, z], [-2.55, 2.2, z], .09);
    t.beam(timber, [-2.55, 2.16, z], [-1.04, 2.16, z], .06);
  }
  for (let i = 0; i < 5; i++) {
    const z = -1.92 + i * .96;
    t.beam(rope, [-2.5, .3, z], [-2.42, 2.08, z], .042, 'wood', true);
    t.orb(leaf[i % 6], [-2.44, 1.1 + i * .18, z], [.34, .5, .3], 'matte');
    t.orb(leaf[(i + 3) % 6], [-2.4, 1.45 + i * .12, z], [.28, .4, .26], 'matte');
    if (i % 2 === 0) t.orb(0xdb6043, [-2.32, 1.28 + i * .2, z + .12], [.15, .16, .16], 'paint');
  }

  // 温室：面向观察侧的玻璃斜面，背风面用木板收口。
  const nursery = child(root, 'Greenhouse', [-1.05, 0, -2.28]);
  const g = kit.at(nursery);
  for (const x of [-1.5, -.5, .5, 1.5]) for (const side of [-1, 1]) {
    const z = side * .52;
    g.beam(0x3c7c76, [x, 0, z], [x, 1.4, z], .085);
    g.beam(cream, [x, 1.38, z], [x, 1.82, 0], .077);
  }
  for (const [y, z] of [[.74, -.52], [1.4, -.53], [1.82, 0], [1.4, .53], [.06, -.53]]) g.beam(0x3c7c76, [-1.55, y, z], [1.55, y, z], .083);
  planter(g, 0, -.1, 2.7, .74);
  for (let i = 0; i < 8; i++) {
    g.round(0x996447, [-1.18 + i * .34, .42, -.14], [.24, .2, .22], 'paint');
    rosette(g, -1.18 + i * .34, .48, -.14, .16 + roll() * .1, roll() * 7);
  }
  const glass = new THREE.PlaneGeometry(3.1, .78);
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb9e5ca).convertSRGBToLinear(), roughness: .26, transparent: true,
    opacity: .33, side: THREE.DoubleSide, depthWrite: false
  });
  const sheet = new THREE.Mesh(glass, glassMaterial);
  sheet.position.set(0, 1.6, -.28);
  sheet.rotation.x = -Math.PI / 2 + .57;
  nursery.add(sheet);

  // 灌溉与储水：高位桶经阀门和软管接到每排种植箱。
  blueBarrel(t, 2.72, 0, -2.02, .74, blue[1]);
  t.round(cream, [2.72, 1.18, -2.02], [.8, .08, .79], 'paint');
  hose(t, 0x427b79, [[2.62, .24, -1.8], [2.82, .22, -1.3], [2.7, .1, .1], [2.4, .14, 1.1]], .07);
  blueBarrel(t, 2.95, 0, 1.7, .58, blue[3]);
  bucket(t, 2.25, 0, 2.32, 0x8fae7a);
  bucket(t, -2.9, 0, 2.55, 0xc8a86a);
  sack(t, -2.2, 0, 1.86, .48, 0xc2a06c, .4);
  sack(t, -1.68, 0, 2.1, .42, 0xb79763, -.2);

  // 遮阳棚、堆肥箱和农具架。棚架上爬满藤蔓，给种植区增加一层头顶绿色。
  for (const x of [-.2, 2.1]) for (const z of [-1.7, .5]) t.beam(timber, [x, 0, z], [x, 2.32, z], .08);
  canopy(t, .92, -.6, 2.34, 2.5, 2.4, [0xd6c687, 0x869e71], .12);
  for (let i = 0; i < 9; i++) {
    const x = -.15 + (i % 5) * .55, z = -1.6 + Math.floor(i / 5) * 1.9;
    t.beam(leaf[3], [x, 2.1, z], [x + .12, 2.28, z + .3], .026, 'matte', true);
    t.orb(leaf[(i + 1) % 6], [x + .12, 2.2, z + .32], [.34, .18, .34], 'matte', [0, i, .2]);
    t.orb(0xdb6043, [x + .2, 2.08, z + .4], [.12, .14, .14], 'paint');
  }
  pottedPlant(t, -.35, 2.06, -.62, .3, leaf[2]);
  pottedPlant(t, 2.0, 2.06, -.55, .28, leaf[1]);
  t.box(0x6d5138, [2.5, .35, -1.2], [1.15, .7, .85], 'wood');
  t.box(0x8a6a45, [2.5, .72, -1.2], [1.2, .09, .9], 'wood', [0, 0, -.06]);
  t.box(iron, [2.5, .8, -1.6], [.16, .2, .14], 'metal');
  t.box(0x546060, [-2.7, .78, .4], [1.05, .82, .06], 'metal');
  for (let i = 0; i < 5; i++) {
    t.box(0xaaa38a, [-3.05 + i * .17, .78, .44], [.05, .56, .05], 'metal', [0, 0, .12 * (i - 2)]);
    t.box(i % 2 ? 0xb37556 : 0x82926b, [-3.05 + i * .17, .6, .48], [.09, .18, .07], 'paint');
  }
  t.beam(wood[3], [-2.2, .1, .52], [-2.2, 1.42, .42], .06, 'wood', true);
  t.box(0x9b8f74, [-2.2, 1.5, .4], [.2, .18, .1], 'metal', [0, 0, .4]);

  pottedPlant(t, -3.0, 0, -.4, .45, green[1]);
  pottedPlant(t, 3.0, 0, .42, .42, green[4]);
  pottedTree(t, -2.95, 0, -.95, 1.9, 1);
  pottedTree(t, 2.95, 0, -1.95, 1.6, 2);
  // 温室屋脊上的小旗：纯色布片，给绿色区域加一个远景可认的亮点。
  t.beam(timber, [1.45, 1.75, -2.28], [1.45, 2.85, -2.28], .05);
  motion.push(cloth(root, [1.45, 2.72, -2.28], .72, .34, [0x37a7c8, cream], 1.4, true));
  railing(t, [3.28, 0, -2.65], [3.28, 0, 2.45], 'rope', 4, .72);
  railing(t, [-.4, 0, 2.68], [3.2, 0, 2.68], 'rope', 2, .7);
  railing(t, [-3.28, 0, 1.2], [-3.28, 0, 2.6], 'rope', 2, .7);
  motion.push({ dispose() { glass.dispose(); glassMaterial.dispose(); } });
  return motion;
}
