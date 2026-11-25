import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { child, rotated, type Kit, type Tools } from './kit';
import { blue, cream, iron, rope, teal, timber, wood } from './palette';
import { waterHeight, type Waterline } from './ocean';
import { blueBarrel, cloth, crate, drum, line, railing, type Motion } from './props';

const gold = 0xe4a844;

function netPanel(tool: Tools, a: Point3, b: Point3, width: number) {
  for (let u = 0; u <= 10; u++) {
    const f = u / 10;
    const top: Point3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const bottom: Point3 = [top[0] + .05, top[1] - width, top[2] + .04];
    tool.beam(rope, top, bottom, .021, 'fabric', true);
    if (u % 3 === 0) tool.orb(0xd68a4e, bottom, [.12, .11, .11], 'paint');
  }
  for (let v = 1; v <= 4; v++) {
    const y = a[1] - width * v / 4;
    tool.beam(rope, [a[0], y, a[2]], [b[0], y, b[2]], .018, 'fabric', true);
  }
}

/** 捕鱼区：栈桥、渔网、吊装绞盘、鱼篓和系在边上的小木船。 */
export function buildFishery(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);

  railing(t, [-2.55, 0, -1.75], [-2.55, 0, 1.9], 'rope', 3, .76);
  railing(t, [-2.4, 0, 2.42], [-.4, 0, 2.42], 'wood', 2, .7);
  railing(t, [2.45, 0, -2.25], [2.45, 0, -.7], 'rope', 2, .68);

  // 分鱼台：台面铺浅色塑料板，三条鱼按大小排开。
  const bench = rotated(root, 'Fish sorting table', [-1.62, 0, -.64], -.11);
  const b = kit.at(bench);
  b.box(wood[2], [0, .77, 0], [1.18, .13, 1.72]);
  for (const x of [-.45, .45]) for (const z of [-.68, .68]) b.box(timber, [x, .34, z], [.13, .71, .14]);
  b.box(0x5d8a7d, [0, .86, -.08], [.72, .065, 1.12], 'paint');
  for (let i = 0; i < 4; i++) {
    const z = -.48 + i * .3;
    b.orb(i === 1 ? 0x87c5ba : 0x73a6b3, [.02, .952, z], [.56, .13, .24], 'paint', [0, -.22, 0]);
    b.box(0x5c8e9a, [-.28, .94, z - .06], [.21, .057, .2], 'paint', [0, .6, 0]);
    b.orb(0x25363c, [.176, 1.0, z + .05], [.042, .055, .048]);
  }
  for (const [x, z] of [[-.85, 1.28], [-1.82, 1.6], [.7, -1.8]]) {
    t.cone(0xb18354, [x, .23, z], [.6, .48, .6], 'fabric', [Math.PI, 0, 0]);
    t.round(0x5c4435, [x, .475, z], [.55, .043, .55], 'matte');
    t.ring(rope, [x, .49, z], [.63, .63, .7], 'fabric', [Math.PI / 2, 0, 0]);
  }

  // 晾鱼架：两根立柱、一根横杆，鱼干错落悬挂。
  for (const x of [1.1, 2.3]) t.beam(timber, [x, 0, -2.2], [x, 2.28, -2.2], .1);
  t.beam(wood[1], [1.1, 2.24, -2.2], [2.3, 2.24, -2.2], .07);
  for (let i = 0; i < 6; i++) {
    const x = 1.24 + i * .18;
    t.beam(rope, [x, 2.22, -2.2], [x, 1.8, -2.2], .016, 'fabric', true);
    t.orb(i % 2 ? 0xa8bcc0 : 0x87a8b3, [x, 1.72, -2.2], [.12, .22, .16], 'paint');
  }

  // 手摇绞盘和吊臂，绳索垂到水面。
  const crane = rotated(root, 'Hand winch', [1.55, 0, .85], .24);
  const c = kit.at(crane);
  c.box(iron, [0, .102, 0], [.86, .19, .88], 'metal');
  c.beam(gold, [0, .14, 0], [0, 2.86, 0], .21, 'metal');
  c.beam(gold, [0, 2.8, 0], [1.14, 2.56, .4], .18, 'metal');
  c.beam(iron, [0, 1.78, 0], [1.04, 2.57, .36], .1, 'metal');
  c.round(iron, [1.15, 2.6, .4], [.38, .17, .38], 'metal', [Math.PI / 2, 0, -.17]);
  c.round(rope, [.12, 1.03, .14], [.4, .3, .4], 'fabric', [Math.PI / 2, 0, 0]);
  c.beam(iron, [.13, 1.01, .33], [.35, 1.17, .33], .054, 'metal', true);
  line(c, 0x605a45, [.13, 1.14, .16], [1.16, 2.72, .42], .032, .035);
  c.beam(rope, [1.16, 2.64, .42], [1.16, 1.15, .42], .038, 'fabric', true);
  c.ring(iron, [1.16, 1.13, .42], [.19, .23, .95], 'metal');

  // 渔网与浮标挂在平台外沿。
  for (const [i, [x, z]] of [[2.55, -.15], [2.68, 1.62]].entries()) {
    t.beam(timber, [x, -.09, z], [x, .72, z], .11);
    if (i === 0) netPanel(t, [2.55, .66, -.1], [2.68, .66, 1.55], .62);
  }
  line(t, rope, [2.58, .68, -.1], [2.7, .68, 1.6], .08, .04);
  for (const [i, [x, z]] of [[2.64, -.46], [2.7, .5], [2.73, 1.45]].entries()) {
    t.orb(i % 2 ? 0xec9761 : 0xf0c883, [x, .11, z], [.22, .24, .25], 'paint');
    t.round(cream, [x, .15, z], [.21, .05, .22], 'paint');
  }

  const rod = child(root, 'Fishing rod', [-2.18, .68, 2.16]);
  const r = kit.at(rod);
  r.beam(wood[0], [0, -.24, 0], [-.28, .42, .52], .063, 'wood', true);
  r.beam(0x8f835a, [-.28, .42, .52], [-.45, .68, 1.06], .034, 'wood', true);
  r.beam(rope, [-.45, .68, 1.06], [-.58, -.98, 1.3], .013, 'fabric', true);
  r.round(iron, [-.12, -.04, .15], [.19, .09, .19], 'metal', [Math.PI / 2, 0, .33]);

  // 捞上来的海洋垃圾：塑料浮球、破网、轮胎和木箱。
  t.ring(0x2f3f40, [-2.2, .26, -1.55], [.7, .7, .92], 'matte', [Math.PI / 2, .3, 0]);
  t.orb(0x5ea0b8, [-1.35, .2, -1.55], [.46, .4, .44], 'paint');
  for (let i = 0; i < 9; i++) line(t, rope, [-.9 + i * .12, .3, -2.1 + (i % 3) * .1], [-.9 + i * .12 + .1, .06, -2.0 + (i % 3) * .14], .06, .012);
  crate(t, 1.05, 0, -1.9, .68, 0xb37c4d, -.2);
  blueBarrel(t, 2.1, 0, .3, .56, blue[3]);
  drum(t, [-2.4, .42, -.55], .54, .78, 0xb8975c);

  railing(t, [-2.55, 0, -2.3], [-1.0, 0, -2.3], 'rope', 2, .7);
  // 码头旗杆与红旗，兼作风向参照；布片随风持续摆动。
  t.beam(timber, [2.35, 0, 2.2], [2.35, 3.1, 2.2], .07);
  return [
    { update(time) { rod.rotation.x = .036 * Math.sin(time * 1.25); } },
    cloth(root, [2.35, 2.96, 2.2], .85, .4, [0xd8553c, cream, cream], 2.6, true)
  ];
}

// 木船横剖面：z 为船长方向，width 为半宽，rise 为船底高度。
const hullStations = [[-2.05, .04, .40], [-1.58, .58, .16], [-.9, .84, .03], [-.1, .96, .0],
  [.78, .9, .03], [1.48, .68, .12], [1.96, .37, .3], [2.26, .025, .55]];

function hullBand(t: Tools, color: number, lower: number, upper: number, side: number, inside: boolean) {
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  for (const [i, [z, width, rise]] of hullStations.entries()) {
    for (const u of [lower, upper]) {
      vertices.push(side * width * (.43 + .57 * Math.sqrt(u)) * (inside ? .93 : 1),
        rise + u * .62 - (inside ? .07 : .14), z);
      uv.push((z + 2) * .48, u * 1.9);
    }
    if (i > 0) {
      const a = (i - 1) * 2, b = i * 2;
      if (side * (inside ? -1 : 1) > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
      else indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  t.surface(geometry, color, 'wood');
}

export function buildSkiff(kit: Kit, scene: THREE.Group, dock: THREE.Group): { waterline: Waterline; motion: Motion } {
  const waterline: Waterline = { position: [-.7, -.05, 12.2], size: [1.7, 4.1], turn: -.82, roundness: .81 };
  const boat = rotated(scene, 'Moored skiff', waterline.position, waterline.turn);
  const t = kit.at(boat);
  for (const side of [-1, 1]) {
    hullBand(t, 0x658983, 0, .29, side, false);
    hullBand(t, 0x588783, .285, .61, side, false);
    hullBand(t, 0xc39669, .603, .84, side, false);
    hullBand(t, 0xa5734c, .835, 1, side, false);
    hullBand(t, 0x936747, .04, .99, side, true);
    for (let i = 1; i < hullStations.length; i++) {
      const [z0, x0, y0] = hullStations[i - 1], [z1, x1, y1] = hullStations[i];
      t.beam(timber, [side * x0, y0 + .47, z0], [side * x1, y1 + .47, z1], .1);
    }
  }
  const floor = new THREE.BufferGeometry();
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  for (const [i, [z, width, rise]] of hullStations.entries()) {
    vertices.push(-width * .65, rise + .065, z, width * .65, rise + .065, z);
    uv.push((z + 2) * .48, 0, (z + 2) * .48, 1);
    if (i) indices.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1);
  }
  floor.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  floor.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  floor.setIndex(indices);
  floor.computeVertexNormals();
  t.surface(floor, 0x896149, 'wood');
  for (let i = 0; i < 6; i++) t.box(wood[i % wood.length], [(i - 2.5) * .165, .1, .08], [.155, .095, 2.8 - Math.abs(i - 2.5) * .17]);
  for (const [z, w] of [[-1.25, 1.2], [-.16, 1.7], [1.1, 1.5]]) {
    t.box(wood[3], [0, .42, z], [w, .11, .38]);
    t.box(timber, [0, .31, z], [w * .88, .15, .13]);
  }
  crate(t, .22, .16, .58, .48);
  t.beam(wood[1], [-.58, .45, -.54], [.67, .5, .84], .07, 'wood', true);
  t.box(wood[3], [.74, .51, .98], [.23, .069, .48], 'wood', [0, .75, 0]);
  t.ring(rope, [.3, .5, -1.18], [.34, .36, .66], 'fabric', [Math.PI / 2, 0, 0]);
  t.round(wood[2], [0, .86, -1.98], [.13, .19, .13], 'wood');
  t.orb(0xec9761, [-.62, .5, .96], [.2, .21, .22], 'paint');

  // 缆绳两端都在世界坐标里逐帧追踪，船漂移时不会脱开码头。
  const tether = new THREE.BufferGeometry();
  const points = new THREE.Float32BufferAttribute(new Float32Array(39), 3);
  points.setUsage(THREE.DynamicDrawUsage);
  tether.setAttribute('position', points);
  const material = new THREE.LineBasicMaterial({ color: 0xbba476 });
  const mooring = new THREE.Line(tether, material);
  mooring.frustumCulled = false;
  scene.add(mooring);
  const cleat = new THREE.Vector3(), post = new THREE.Vector3();
  return {
    waterline,
    motion: {
      update(time) {
        boat.position.x = -.7 + .13 * Math.sin(time * .52);
        boat.position.z = 12.2 + .11 * Math.sin(time * .63 + .7);
        boat.position.y = -.055 + waterHeight(boat.position.x, boat.position.z, time) * .87;
        boat.rotation.set(.041 * Math.sin(time * .83), -.82 + .075 * Math.sin(time * .47), .05 * Math.sin(time * .89 + 1.4));
        waterline.position[0] = boat.position.x;
        waterline.position[2] = boat.position.z;
        waterline.turn = boat.rotation.y;
        boat.updateWorldMatrix(true, false);
        dock.updateWorldMatrix(true, false);
        boat.localToWorld(cleat.set(0, .9, -1.98));
        dock.localToWorld(post.set(-.7, .72, 1.52));
        for (let i = 0; i < points.count; i++) {
          const f = i / (points.count - 1);
          points.setXYZ(i, THREE.MathUtils.lerp(cleat.x, post.x, f),
            THREE.MathUtils.lerp(cleat.y, post.y, f) - .62 * f * (1 - f),
            THREE.MathUtils.lerp(cleat.z, post.z, f));
        }
        points.needsUpdate = true;
      },
      dispose() { tether.dispose(); material.dispose(); }
    }
  };
}
