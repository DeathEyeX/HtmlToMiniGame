import * as THREE from 'three-platformize';
import { deckRoute, landings, stops, type Position, type Stop } from '../content';
import { createRandom, type ModelBuilder } from './model';

const timber = [0xb47948, 0xc58d53, 0xd4a367, 0xa9754e, 0xe2b780];
const frame = 0x354e53;
const cream = 0xf4dcaa;
const red = 0xd7614b;
const blue = 0x438d98;
const amber = 0xe2a052;
const night = 0x25434b;
const glass = 0x84c4b7;

export function buildHarbor(model: ModelBuilder) {
  const group = new THREE.Group();
  const { box, beam, round, pebble } = model.groupTools(group);
  const random = createRandom(711);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

  function deck(x0: number, x1: number, z0: number, z1: number, y: number) {
    const count = Math.ceil((x1 - x0) / .49);
    const step = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const x = x0 + (i + .5) * step;
      const seam = (z0 + z1) / 2 + (random() - .5) * 1.2;
      box(pick(timber), x, y - .11, (z0 + seam) / 2, step - .024, .22, seam - z0 - .02, 'grain');
      box(pick(timber), x, y - .11, (seam + z1) / 2, step - .024, .22, z1 - seam - .02, 'grain');
      if (i % 2 === 0) box(0x75634b, x, y + .009, z1 - .14, .068, .021, .068);
    }
    for (const z of [z0 + .13, z1 - .13]) {
      box(frame, (x0 + x1) / 2, y - .39, z, x1 - x0 + .24, .38, .33, 'paint');
      box(0x6f8172, (x0 + x1) / 2, y - .26, z, x1 - x0 + .24, .08, .42);
    }
    for (const x of [x0 + .04, x1 - .04]) box(frame, x, y - .38, (z0 + z1) / 2, .28, .36, z1 - z0, 'paint');
  }

  function rail(a: Position, b: Position) {
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.16);
    for (let i = 0; i <= count; i++) {
      const x = a[0] + (b[0] - a[0]) * i / count;
      const y = a[1] + (b[1] - a[1]) * i / count;
      const z = a[2] + (b[2] - a[2]) * i / count;
      box(frame, x, y + .32, z, .092, .67, .092);
      box(cream, x, y + .668, z, .15, .077, .15);
    }
    for (const y of [.30, .61]) beam(0x8b8268, [a[0], a[1] + y, a[2]], [b[0], b[1] + y, b[2]], .062);
  }

  function stairs(from: Position, to: Position) {
    const count = Math.ceil((to[1] - from[1]) / .178);
    const depth = Math.abs(to[2] - from[2]) / count + .07;
    for (let i = 0; i <= count; i++) {
      const y = from[1] + (to[1] - from[1]) * i / count;
      const z = from[2] + (to[2] - from[2]) * i / count;
      box(timber[i % timber.length], from[0], y - .07, z, 1.3, .14, depth, 'grain');
      box(i % 4 === 0 ? amber : frame, from[0], y - .06, z + depth / 2, 1.26, .06, .042);
    }
    for (const side of [-.64, .64]) {
      beam(frame, [from[0] + side, from[1] - .2, from[2]], [to[0] + side, to[1] - .2, to[2]], .15);
      rail([from[0] + side, from[1], from[2]], [to[0] + side, to[1], to[2]]);
    }
  }

  function crate(x: number, y: number, z: number, s: number, color = amber) {
    box(color, x, y + s * .44, z, s, s * .88, s * .88, 'grain');
    for (const side of [-.35, .35]) {
      box(timber[3], x + side * s, y + s * .91, z, s * .12, .05, s * .91);
      box(timber[3], x + side * s, y + s * .44, z + s * .452, s * .12, s * .9, .035);
    }
    box(cream, x, y + s * .58, z + s * .46, s * .28, s * .14, .026);
  }

  function barrel(x: number, y: number, z: number, color: number, s = 1) {
    round(color, x, y + .38 * s, z, .57 * s, .76 * s);
    for (const rim of [.18, .61]) round(frame, x, y + rim * s, z, .60 * s, .071 * s);
    round(cream, x + .097 * s, y + .77 * s, z - .10 * s, .098 * s, .026);
  }

  function lantern(x: number, y: number, z: number) {
    box(night, x, y, z, .22, .29, .23);
    box(0xffdc8b, x, y - .023, z + .06, .16, .15, .16);
    box(0x655e4f, x, y + .15, z, .28, .06, .28);
  }

  function lifesaver(x: number, y: number, z: number, yaw = 0) {
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const dx = Math.cos(angle) * .24;
      box(i % 3 === 0 ? cream : red, x + dx * Math.cos(yaw), y + Math.sin(angle) * .24, z - dx * Math.sin(yaw), .15, .12, .11, 'plain', [0, yaw, angle + Math.PI / 2]);
    }
  }

  deck(-7.95, 8.08, -5.32, 5.35, 1.35);
  deck(-7.75, -1.77, 5.36, 8.15, 1.35);
  deck(-4.42, -2.12, 4.95, 5.91, 1.35);
  deck(-7.10, 6.95, -5.50, .48, 4.08);
  deck(-4.12, 6.72, -5.98, -2.56, 6.78);
  stairs(landings[2], landings[3]);
  stairs(landings[3], landings[6]);

  rail([-7.93, 1.35, -5.18], [-7.93, 1.35, 5.10]);
  rail([-7.70, 1.35, 8.08], [-5.96, 1.35, 8.08]);
  rail([-2.21, 1.35, 8.08], [-1.80, 1.35, 8.08]);
  rail([-7.72, 1.35, 5.47], [-7.72, 1.35, 8.06]);
  rail([-1.71, 1.35, 5.26], [7.92, 1.35, 5.26]);
  rail([7.98, 1.35, -5.18], [7.98, 1.35, 5.26]);
  rail([-6.98, 4.08, .42], [3.98, 4.08, .42]);
  rail([5.50, 4.08, .42], [6.87, 4.08, .42]);
  rail([-6.96, 4.08, -5.40], [-6.96, 4.08, .42]);
  rail([-4.08, 6.78, -2.59], [4.02, 6.78, -2.59]);
  rail([5.53, 6.78, -2.59], [6.66, 6.78, -2.59]);
  rail([-4.08, 6.78, -5.93], [6.67, 6.78, -5.93]);

  // 横置浮筒从四周可见，水线附近保留深色连接带，方便辨认浮体和甲板。
  for (const z of [-4.86, 4.82]) {
    for (let x = -6.75; x <= 7.20; x += 2.29) {
      const color = pick([0xe4a057, 0xd97b47, 0x5a9296, 0x93aa83]);
      round(color, x, .17, z, 1.44, 2.05, [0, 0, Math.PI / 2]);
      for (const edge of [-.66, .66]) round(frame, x + edge, .17, z, 1.51, .12, [0, 0, Math.PI / 2]);
      box(cream, x, .35, z + .73, .38, .09, .036);
    }
  }
  for (const x of [-7.6, 7.7]) {
    for (const z of [-2.7, .0, 2.78]) {
      round(blue, x, .15, z, 1.14, 2.34, [Math.PI / 2, 0, 0]);
      round(frame, x, .15, z + .76, 1.23, .09, [Math.PI / 2, 0, 0]);
    }
  }
  for (const x of [-7.44, -5.78, -3.78, -2.17]) {
    box(timber[3], x, .48, 7.99, .26, 1.62, .31, 'grain');
    box(night, x, .60, 8.12, .41, .36, .19);
    box(blue, x, .61, 8.24, .20, .18, .05);
    box(blue, x, .2, 6.98, 1.18, .65, 1.5, 'paint');
  }

  for (const x of [-6.84, -3.35, .2, 3.62, 6.63]) {
    for (const z of [-5.14, .17]) {
      box(frame, x, 2.64, z, .25, 2.59, .28, 'paint');
      box(amber, x, 3.69, z + .03, .30, .24, .32);
      beam(frame, [x, 2.74, z], [x + .75, 3.89, z], .14);
    }
  }
  for (const x of [-3.84, -.19, 3.24, 6.48]) {
    for (const z of [-5.60, -2.75]) {
      box(frame, x, 5.36, z, .22, 2.54, .22, 'paint');
      beam(timber[3], [x, 5.43, z], [x + .68, 6.60, z], .13);
    }
  }

  // 生活舱的灯窗、净水工坊的罐体和露天货物形成可从侧面辨认的层次。
  box(blue, -1.37, 2.48, -3.93, 7.15, 2.20, 2.12, 'paint');
  box(cream, -1.37, 3.55, -3.91, 7.27, .17, 2.28, 'grain');
  for (const x of [-4.7, -2.1, .5, 2.06]) {
    box(frame, x, 2.5, -2.83, .13, 2.2, .12);
    box(frame, x, 2.5, -5.04, .13, 2.2, .12);
  }
  for (const x of [-3.73, -1.10, 1.10]) {
    for (const z of [-2.84, -5.01]) {
      box(night, x, 2.79, z, 1.17, .82, .09);
      box(0xb8d6a6, x, 2.79, z + (z > -4 ? .056 : -.056), 1.03, .67, .035);
      box(cream, x, 2.79, z + (z > -4 ? .086 : -.086), .062, .70, .031);
    }
  }
  for (const x of [-4.98, 2.23]) box(night, x, 2.78, -3.90, .09, .72, 1.0);
  for (let i = 0; i < 6; i++) {
    crate(-5.58 + (i % 3) * .92, 1.35 + (i > 2 ? .66 : 0), -1.62, i > 2 ? .59 : .76, i % 2 === 0 ? amber : 0x649693);
  }
  for (const x of [1.4, 2.07, 2.76, 3.43]) barrel(x, 1.35, -1.74, x > 2 ? red : blue);
  for (const x of [-5.45, -3.42, -.36]) lantern(x, 3.71, .19);
  lifesaver(-6.80, 2.29, .34);
  lifesaver(7.04, 2.12, 5.36);

  // 露天鱼档与泵组靠平台内侧布置，外侧留通往码头和楼梯的连续走道。
  for (const x of [-6.58, -3.73]) {
    for (const z of [1.10, 3.17]) box(frame, x, 2.43, z, .11, 2.15, .11);
  }
  for (let i = 0; i < 12; i++) box(i % 3 === 1 ? cream : 0xde8459, -6.54 + i * .248, 3.51, 2.14, .239, .075, 2.29, 'paint', [.13, 0, 0]);
  box(timber[2], -5.12, 2.08, 1.77, 2.42, .17, .93, 'grain');
  for (const x of [-6.12, -4.13]) {
    box(frame, x, 1.69, 1.77, .14, .67, .72);
    box(blue, x, 1.56, 2.87, .57, .42, .45, 'paint');
  }
  for (let i = 0; i < 8; i++) {
    const x = -6.08 + i % 4 * .48;
    const z = i < 4 ? 1.57 : 1.91;
    pebble(i < 4 ? 0x7bb9b7 : 0xd89274, x, 2.22, z, .36, .12, .18, [0, i * .31, 0]);
    box(0xb5d1b4, x + .118, 2.22, z + .02, .10, .044, .09, 'plain', [0, .46, 0]);
  }
  lantern(-3.75, 3.23, 3.18);
  for (const x of [.82, 2.58]) {
    round(night, x, 1.53, 2.20, 1.47, .35);
    round(blue, x, 2.02, 2.20, 1.17, .78);
    round(cream, x, 2.45, 2.20, 1.21, .16);
    round(amber, x, 2.59, 2.20, .33, .15);
    box(night, x, 2.10, 2.79, .36, .25, .06);
    box(glass, x, 2.10, 2.83, .26, .14, .04);
  }
  for (const z of [1.88, 2.39]) beam(amber, [.82, 1.67, z], [2.58, 1.67, z], .18);
  crate(6.60, 1.35, 3.17, .78, red);
  crate(6.59, 1.35, 4.20, .54, amber);
  lifesaver(7.96, 2.07, .42, Math.PI / 2);
  for (let x = -2.02; x < 4.38; x += .51) box(0xe8c981, x, 1.362, 4.47, .24, .018, .088);

  for (let x = -6.67; x < -.55; x += .37) box(pick([0x7b9184, 0x9ba68d, 0x8e9e86]), x, 5.14, -4.95, .33, 2.1, .13, 'grain');
  box(blue, -6.62, 5.13, -3.76, .13, 2.11, 2.28, 'paint');
  box(red, -5.27, 6.13, -3.12, 2.82, .14, 1.41, 'paint', [-.12, 0, 0]);
  for (const x of [-6.60, -3.96]) {
    box(frame, x, 5.14, -2.48, .14, 2.17, .13);
    lantern(x, 5.86, -2.38);
  }
  for (const x of [-5.89, -4.54, -3.36]) {
    const h = x > -4 ? 1.27 : 1.77;
    round(x > -4 ? amber : blue, x, 4.12 + h / 2, -3.71, .87, h);
    for (const dy of [.26, h - .23]) round(frame, x, 4.12 + dy, -3.71, .93, .10);
    round(cream, x, 4.16 + h, -3.71, .34, .14);
    beam(amber, [x, 4.46, -3.22], [x, 4.46, -2.67], .12);
  }
  beam(cream, [-6.1, 4.45, -2.67], [-2.75, 4.45, -2.67], .14);
  box(0x618481, -2.40, 4.76, -3.43, .80, 1.26, .61, 'paint');
  box(night, -2.40, 5.09, -3.10, .52, .26, .04);
  box(0xd7eea8, -2.41, 5.09, -3.068, .33, .13, .035);
  crate(-5.93, 4.08, -.68, .70, blue);
  barrel(-6.48, 4.08, -1.25, red);
  crate(3.37, 4.08, -1.00, .75);

  const awningColors = [0xe0ab72, 0xe8c498, 0xce795d];
  for (let i = 0; i < 12; i++) box(awningColors[i % 3], .06 + i * .25, 5.95, -3.71, .24, .07, 3.0, 'paint', [.13, 0, 0]);
  for (const x of [.06, 2.87]) for (const z of [-4.99, -2.31]) box(frame, x, 5.05, z, .11, 1.99, .11);
  box(timber[1], 1.41, 4.68, -3.61, 2.24, .14, .88, 'grain');
  for (const x of [.48, 2.30]) box(frame, x, 4.37, -3.61, .12, .61, .61);
  for (const x of [.67, 1.31, 1.95]) crate(x, 4.76, -3.54, .29, 0xe3c38e);

  // 温室屋顶保留开口，旋转镜头时还能看到植株和集雨槽。
  for (const x of [-.66, .50, 1.66, 2.82, 3.98]) {
    beam(frame, [x, 8.52, -5.80], [x, 9.22, -4.47], .12);
    beam(frame, [x, 9.22, -4.47], [x, 8.52, -3.13], .12);
    for (const z of [-5.80, -3.13]) box(0x709486, x, 7.65, z, .12, 1.74, .12);
  }
  for (const [y, z] of [[8.52, -5.8], [9.21, -4.47], [8.52, -3.13]]) box(frame, 1.66, y, z, 4.84, .112, .105);
  for (let i = 0; i < 17; i++) {
    const x = -.67 + i * .292;
    box(pick([0x8ccabe, 0xa4d1bb, 0x69aaa6]), x, 8.86, -5.14, .27, .053, 1.47, 'paint', [.48, 0, 0]);
    if (i < 5 || i > 12) box(pick([glass, 0xa4d1bb, 0x69aaa6]), x, 8.86, -3.79, .27, .053, 1.47, 'paint', [-.48, 0, 0]);
  }
  for (const z of [-5.18, -3.86]) {
    box(timber[3], 1.54, 6.99, z, 3.85, .40, .76, 'grain');
    box(0x625c37, 1.54, 7.20, z, 3.62, .04, .66);
    for (let i = 0; i < 26; i++) {
      const x = -.14 + random() * 3.55;
      const depth = z + (random() - .5) * .52;
      const h = .28 + random() * .54;
      box(0x6d8f49, x, 7.19 + h / 2, depth, .048, h, .048);
      for (const side of [-1, 1]) pebble(pick([0x8ab95a, 0xafcc6a, 0x519454, 0x8bb85f]), x + side * .12, 7.22 + h * .63, depth, .41, .18, .25, [0, random() * 2, side * .36]);
      if (i % 5 === 0) box(pick([0xf29465, 0xe5bd68]), x, 7.19 + h, depth, .13, .14, .13);
    }
  }
  barrel(4.27, 6.78, -4.69, blue, 1.31);

  for (const [x, z] of [[5.62, -4.67], [5.62, -5.47]]) {
    box(frame, x, 7.14, z, .14, .70, .15);
    box(frame, x, 7.49, z, 1.77, .105, .70, 'plain', [-.23, 0, 0]);
    for (let i = 0; i < 5; i++) box(pick([0x386f9c, 0x558ab5, 0x4e80aa]), x - .69 + i * .345, 7.555, z, .318, .04, .65, 'paint', [-.23, 0, 0]);
  }

  const towerX = -2.72;
  const towerZ = -4.73;
  round(frame, towerX, 7.13, towerZ, 1.77, .72);
  round(cream, towerX, 8.20, towerZ, 1.38, 1.53);
  round(red, towerX, 8.25, towerZ, 1.44, .43);
  round(red, towerX, 9.02, towerZ, 1.60, .23);
  round(glass, towerX, 9.49, towerZ, 1.31, .73);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    box(frame, towerX + Math.cos(a) * .65, 9.48, towerZ + Math.sin(a) * .65, .075, .78, .075);
  }
  round(cream, towerX, 9.90, towerZ, 1.64, .18);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(.93, .64, 8), new THREE.MeshLambertMaterial({ color: 0xa33024 }));
  roof.position.set(towerX, 10.22, towerZ);
  group.add(roof);
  beam(frame, [towerX, 10.47, towerZ], [towerX, 11.47, towerZ], .074);
  beam(cream, [towerX - .51, 11.18, towerZ], [towerX + .52, 11.18, towerZ], .045);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc46a }));
  beacon.position.set(towerX, 11.51, towerZ);
  group.add(beacon);

  // 港口吊臂、货箱和橙色作业艇在水线旁拉开纵深。
  const craneX = -6.65;
  round(frame, craneX, 1.55, 6.94, .86, .40);
  beam(amber, [craneX, 1.72, 6.94], [craneX + .36, 4.26, 6.75], .22);
  beam(red, [craneX + .36, 4.26, 6.75], [craneX + 2.95, 4.26, 7.79], .17);
  beam(amber, [craneX + .36, 4.26, 6.75], [craneX + 2.95, 4.26, 7.79], .06);
  beam(frame, [craneX + .13, 3.03, 6.84], [craneX + 2.20, 4.24, 7.50], .08);
  beam(night, [craneX + 2.95, 4.25, 7.79], [craneX + 2.95, 2.12, 7.79], .038);
  lantern(craneX + 2.95, 2.1, 7.79);
  for (const [x, z, s] of [[-7.19, 6.07, .79], [-5.96, 6.35, .61], [-5.38, 7.49, .53], [-2.27, 7.54, .59]]) crate(x, 1.35, z, s, x < -6 ? blue : amber);
  barrel(-2.34, 1.35, 6.35, red);
  lifesaver(-7.32, 2.08, 8.15);
  for (const x of [-5.06, -3.43, -2.45]) round(amber, x, 1.47, 8.07, .16, .26);

  const boat = new THREE.Group();
  const hull = model.groupTools(boat);
  hull.pebble(red, 0, .02, 0, 3.64, .83, 1.62);
  hull.box(0xed9355, -.18, .21, 0, 2.65, .22, 1.23, 'paint');
  hull.box(timber[2], -.18, .33, 0, 2.52, .06, .95, 'grain');
  for (const z of [-.63, .63]) hull.box(cream, -.19, .39, z, 2.57, .15, .12);
  for (const x of [-.62, .34]) hull.box(timber[1], x, .43, 0, .17, .14, 1.1, 'grain');
  hull.box(night, -1.59, .27, 0, .30, .42, .43, 'paint');
  hull.box(blue, .78, .49, .29, .57, .27, .42, 'paint');
  hull.box(cream, .79, .64, .28, .59, .056, .45);
  boat.position.set(-2.84, .15, 9.20);
  boat.rotation.y = -.16;

  const scout = new THREE.Group();
  const person = model.groupTools(scout);
  person.box(0xf0ab5d, 0, .53, 0, .31, .29, .23, 'paint');
  person.box(0xdeb288, 0, .76, .026, .24, .23, .21);
  person.box(0xf0e1a6, 0, .87, .039, .30, .091, .26);
  person.box(red, 0, .72, .135, .238, .058, .034);
  person.box(0x447b79, 0, .52, -.151, .25, .26, .15, 'paint');
  const legs = [-.087, .087].map(x => {
    const leg = new THREE.Group();
    leg.position.set(x, .40, 0);
    const tools = model.groupTools(leg);
    tools.box(0x516f77, 0, -.13, 0, .139, .25, .15);
    tools.box(night, 0, -.29, .036, .148, .16, .23);
    scout.add(leg);
    return leg;
  });
  group.add(boat, scout);
  scout.position.set(...landings[0]);

  const point = new THREE.Vector3();
  let at = 0;
  let selected: Stop = 'dock';
  let traveling: number | undefined;
  let path: number[] = [];

  return {
    group,
    select(stop: Stop) {
      if (selected === stop) return;
      selected = stop;
      // 改选区域时先经过当前路段的落脚点，保持脚步在楼梯上。
      path = deckRoute(traveling ?? at, stops[stop].node);
      if (traveling === undefined) traveling = path.shift();
    },
    update(time: number, delta: number) {
      boat.position.y = .15 + Math.sin(time * 1.5) * .11;
      boat.rotation.z = Math.sin(time * 1.1) * .045;
      beacon.scale.setScalar(.82 + Math.sin(time * 3.5) * .16);
      const gait = traveling === undefined ? 0 : Math.sin(time * 17) * .59;
      legs[0].rotation.x = gait;
      legs[1].rotation.x = -gait;
      let distance = delta * 5.8;
      while (traveling !== undefined && distance > 0) {
        point.set(...landings[traveling]).sub(scout.position);
        const remaining = point.length();
        if (remaining > .0001) scout.rotation.y = Math.atan2(point.x, point.z);
        if (remaining > distance) {
          scout.position.addScaledVector(point, distance / remaining);
          break;
        }
        scout.position.set(...landings[traveling]);
        at = traveling;
        traveling = path.shift();
        distance -= remaining;
      }
    },
    dispose() {
      roof.geometry.dispose();
      roof.material.dispose();
      beacon.geometry.dispose();
      beacon.material.dispose();
    }
  };
}
