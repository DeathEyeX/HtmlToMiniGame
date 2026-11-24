import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { crate, drum, planks, railing } from './decks';
import { blue, child, cream, iron, rng, rope, rust, swatch, timber, wood, type Model, type Tools } from './model';
import { canopy, corrugated, lamp, rotated, type Motion } from './shelter';

const copper = 0xbb855a;
const jade = 0x3c7c76;
const yellow = 0xd9a949;

export function hose(t: Tools, color: number, points: Point3[], diameter: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  t.surface(new THREE.TubeGeometry(curve, (points.length - 1) * 4, diameter / 2, 7, false), color, 'metal');
}

function planter(t: Tools, x: number, z: number, w: number, d: number) {
  t.box(0x554234, [x, .24, z], [w, .21, d], 'matte');
  for (const y of [.12, .29]) {
    for (const dir of [-1, 1]) {
      t.box(wood[y < .2 ? 2 : 0], [x, y, z + dir * d / 2], [w + .14, .16, .11]);
      t.box(wood[y < .2 ? 0 : 1], [x + dir * w / 2, y, z], [.12, .17, d]);
    }
  }
  for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) t.box(timber, [x + dx, .23, z + dz], [.146, .46, .15]);
}

const greens = [0x568c4d, 0x91ae53, 0x76a256, 0x417d4c, 0xa1b95d, 0x6a9a4b];

function rosette(t: Tools, x: number, y: number, z: number, size: number, phase: number) {
  t.orb(greens[3], [x, y + size * .15, z], [size * .87, size * .71, size * .83]);
  for (let i = 0; i < 6; i++) {
    const angle = phase + i * Math.PI / 3;
    t.orb(greens[i], [x + Math.sin(angle) * size * .34, y + size * (.20 + .09 * (i % 3)), z + Math.cos(angle) * size * .34],
      [size * .47, size * .27, size * .86], 'matte', [-.29, angle, .07]);
  }
  t.orb(greens[4], [x, y + size * .46, z], [size * .50, size * .38, size * .47]);
}

export function buildGarden(model: Model, root: THREE.Group): Motion[] {
  const t = model.at(root);
  const random = rng(335);
  for (const z of [-.28, 1.38]) {
    planter(t, .91, z, 3.42, 1.01);
    for (let col = 0; col < 6; col++) for (const row of [-1, 1]) {
      rosette(t, -.47 + col * .55 + random() * .12, .36, z + .25 * row, .26 + random() * .23, random() * 5);
    }
    hose(t, 0x3a5552, [[-.66, .10, z - .54], [-.71, .37, z - .33], [-.08, .38, z - .30], [2.38, .38, z - .30]], .052);
  }
  planter(t, -1.93, -.21, .76, 2.85);
  for (let i = 0; i < 5; i++) {
    const z = -1.33 + i * .56;
    t.beam(rope, [-1.96, .35, z], [-1.88, 1.68, z], .048, 'wood', true);
    for (let branch = 0; branch < 4; branch++) {
      const side = branch % 2 ? -1 : 1;
      const y = .61 + branch * .22;
      t.beam(greens[3], [-1.94, y, z], [-1.94 + side * .29, y + .17, z + .10], .041, 'matte', true);
      t.orb(greens[branch], [-1.95 + side * .21, y + .16, z + .10], [.33, .13, .29]);
      if (i + branch > 2) t.orb(branch % 3 === 0 ? 0xd99441 : 0xdb6043,
        [-1.94 + side * .19, y + .04, z + .17], [.16 + random() * .08, .18, .18], 'paint');
    }
  }
  for (const color of [0x52776a, 0x748c57]) {
    const x = color === 0x52776a ? -1.64 : -2.29;
    t.beam(timber, [x, 0, -1.68], [x, 1.85, -1.68], .074);
    t.beam(timber, [x, 0, 1.25], [x, 1.85, 1.25], .074);
    t.beam(color, [x, 1.82, -1.70], [x, 1.82, 1.28], .054);
  }
  // 只保留背风面的半透明顶片，正面可直接读到育苗架和温室骨架。
  const nursery = child(root, 'Nursery', [.64, 0, -1.75]);
  const g = model.at(nursery);
  for (const x of [-1.63, -.57, .55, 1.62]) {
    for (const side of [-1, 1]) {
      const z = side * .68;
      g.beam(jade, [x, 0, z], [x, 1.47, z], .085);
      g.beam(cream, [x, 1.46, z], [x, 1.91, 0], .077);
    }
  }
  for (const [y, z] of [[.78, -.68], [1.48, -.69], [1.91, 0], [1.48, .69], [.06, -.69]]) g.beam(jade, [-1.68, y, z], [1.68, y, z], .083);
  planter(g, 0, -.12, 2.8, .80);
  for (let i = 0; i < 8; i++) {
    g.round(0x996447, [-1.23 + i * .34, .45, -.17], [.24, .20, .22], 'paint');
    rosette(g, -1.23 + i * .34, .52, -.17, .16 + random() * .11, random() * 7);
  }
  const glass = new THREE.PlaneGeometry(3.30, .82);
  const glassMaterial = new THREE.MeshStandardMaterial({ color: swatch(0xb9e5ca), roughness: .26, transparent: true,
    opacity: .31, side: THREE.DoubleSide, depthWrite: false });
  const sheet = new THREE.Mesh(glass, glassMaterial);
  sheet.position.set(0, 1.688, -.35);
  sheet.rotation.x = -Math.PI / 2 + .57;
  nursery.add(sheet);

  drum(t, [2.62, .55, -.99], .77, 1.07, blue[1]);
  t.round(cream, [2.62, 1.10, -.99], [.82, .08, .81], 'paint');
  hose(t, 0x427b79, [[2.58, .25, -.79], [2.78, .22, -.49], [2.73, .09, .51], [2.54, .15, 1.39]], .073);
  for (const z of [.74, 1.20]) t.orb(0xc8ad7d, [-2.52, .27, z], [.63, .58, .47], 'fabric', [0, 0, -.18]);
  t.beam(wood[3], [-2.55, .12, .42], [-2.59, 1.58, .11], .072, 'wood', true);
  t.box(iron, [-2.55, .17, .43], [.27, .32, .062], 'metal', [-.33, .12, 0]);
  for (const x of [-2.81, -.91]) for (const z of [-2.27, -1.32]) t.beam(timber, [x, 0, z], [x, 2.24, z], .083);
  canopy(t, -2.06, -1.81, 2.25, 1.88, 1.13, [0xd6c687, 0x869e71], .12);
  railing(t, [2.98, 0, -2.38], [2.98, 0, 2.20], 'rope', 4, .72);
  railing(t, [.67, 0, 2.41], [2.88, 0, 2.41], 'rope', 2, .70);
  return [{ dispose() { glass.dispose(); glassMaterial.dispose(); } }];
}

export function buildWorks(model: Model, root: THREE.Group): Motion[] {
  const t = model.at(root);
  for (const x of [-2.36, .66]) for (const z of [-2.60, -.27]) {
    const y = z < -1 ? 3.18 : 2.46;
    t.box(timber, [x, y / 2, z], [.18, y, .20]);
    t.beam(wood[2], [x, y - .60, z], [x + (x < 0 ? .48 : -.48), y - .14, z], .10);
  }
  for (const z of [-2.65, -.27]) t.box(timber, [-.85, z < -1 ? 3.10 : 2.39, z], [3.27, .18, .23]);
  corrugated(t, -.88, 3.56, [3.29, -2.86], [2.52, .09], [0x5e8a89, 0x738e89, 0x3e7779, 0x9d6d51], 13);
  for (let i = 0; i < 12; i++) t.box(wood[(i + 1) % wood.length], [-2.35 + .265 * i, 1.64, -2.62], [.24, 2.51, .12]);
  lamp(t, -.64, 2.15, -.51);
  planks(t, 2.34, .94, .97, 19, -.96, -1.77);
  for (const x of [-2.01, .10]) for (const z of [-2.08, -1.48]) t.box(timber, [x, .48, z], [.14, .94, .14]);
  t.box(0x546060, [-.93, 1.65, -2.52], [1.97, .84, .045], 'metal');
  for (let i = 0; i < 7; i++) {
    const x = -1.70 + .253 * i;
    t.box(0xaaa38a, [x, 1.64 + .12 * (i % 2), -2.465], [.058, .38 - .036 * (i % 3), .058], 'metal', [0, 0, .19 * (i - 3)]);
    t.box(i % 2 ? 0xb37556 : 0x82926b, [x, 1.51 + .12 * (i % 2), -2.435], [.093, .21, .080], 'paint');
  }
  t.box(iron, [-1.66, 1.04, -1.55], [.44, .19, .38], 'metal');
  t.box(0x7c9392, [-1.67, 1.21, -1.55], [.50, .16, .32], 'metal');
  t.beam(iron, [-1.78, 1.04, -1.32], [-1.41, 1.04, -1.32], .052, 'metal', true);
  for (let i = 0; i < 10; i++) {
    const z = .55 + Math.floor(i / 5) * .34 + .05 * (i % 5);
    const x = -1.42 + (i % 5) * .088;
    t.round(0x976644, [x, .16 + Math.floor(i / 5) * .25, z], [.23, 1.33 - .05 * i, .23], 'wood', [0, 0, Math.PI / 2]);
    t.round(wood[3], [x + .66 - .025 * i, .16 + Math.floor(i / 5) * .25, z], [.171, .038, .171], 'wood', [0, 0, Math.PI / 2]);
  }
  crate(t, -1.82, 0, 2.08, .86);
  crate(t, -.89, 0, 2.32, .62);
  t.ring(0x4f6060, [-1.79, .90, 2.10], [.46, .46, 1.1], 'metal', [Math.PI / 2, 0, .45]);

  // 炉门朝可观察的一侧，烟囱在棚外升高，排烟沿下风方向飘离屋顶。
  const furnace = model.at(child(root, 'Smelter', [1.25, 0, -1.27]));
  furnace.box(0x534a43, [0, .17, 0], [1.77, .31, 1.68], 'metal');
  furnace.barrel(0x765342, [0, .94, 0], [1.56, 1.47, 1.51]);
  for (const y of [.34, 1.52]) furnace.round(0x4c5555, [0, y, 0], [1.56, .116, 1.55], 'metal');
  furnace.round(0x343c3b, [0, .79, .751], [.91, .19, .91], 'metal', [Math.PI / 2, 0, 0]);
  furnace.round(0xaa7852, [0, .80, .854], [.75, .095, .75], 'metal', [Math.PI / 2, 0, 0]);
  furnace.round(0x492627, [0, .80, .908], [.62, .035, .62], 'matte', [Math.PI / 2, 0, 0]);
  furnace.round(0xf68548, [0, .71, .93], [.49, .033, .37], 'glow', [Math.PI / 2, 0, 0]);
  for (const y of [.59, .78, .97]) furnace.box(iron, [0, y, .952], [.59, .051, .055], 'metal');
  hose(furnace, 0x675956, [[.14, 1.50, -.30], [.14, 2.01, -.30], [.39, 2.25, -.30], [.56, 2.48, -.30], [.56, 3.85, -.30]], .36);
  furnace.round(iron, [.56, 3.80, -.30], [.49, .14, .49]);
  furnace.ring(0x2d383a, [.56, 3.88, -.30], [.39, .39, .62], 'metal', [Math.PI / 2, 0, 0]);
  furnace.round(0x2a3333, [.56, 3.89, -.30], [.33, .018, .33]);
  t.box(0x7f9a86, [1.18, .41, 1.02], [1.10, .79, .96], 'metal');
  t.box(iron, [1.18, .11, 1.02], [1.32, .17, 1.15], 'metal');
  const rotor = child(root, 'Belt wheel', [1.22, .56, 1.55]);
  const r = model.at(rotor);
  r.ring(0xbb8a54, [0, 0, 0], [.79, .79, 1.08]);
  r.round(iron, [0, 0, .02], [.24, .11, .24], 'metal', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    r.beam(iron, [0, 0, 0], [Math.cos(a) * .34, Math.sin(a) * .34, 0], .064, 'metal');
  }
  railing(t, [-2.51, 0, .12], [-2.51, 0, 2.92], 'rope', 3);
  railing(t, [-2.46, 0, 2.95], [2.29, 0, 2.95], 'rope', 4);
  return [{ update(time) { rotor.rotation.z = -time * .95; } }];
}

function gauge(t: Tools, x: number, y: number, z: number) {
  t.round(iron, [x, y, z], [.31, .095, .31], 'metal', [Math.PI / 2, 0, 0]);
  t.round(cream, [x, y, z + .051], [.245, .026, .245], 'paint', [Math.PI / 2, 0, 0]);
  t.box(rust[0], [x + .025, y + .027, z + .067], [.11, .023, .018], 'paint', [0, 0, .78]);
}

export function buildWater(model: Model, root: THREE.Group) {
  const t = model.at(root);
  const tank: Point3 = [.90, 1.47, -.77];
  t.box(iron, [.90, .14, -.77], [2.26, .26, 2.33], 'metal');
  for (const x of [.15, 1.59]) for (const z of [-1.49, -.04]) t.box(jade, [x, .38, z], [.23, .74, .25], 'metal');
  t.barrel(0x308eb5, tank, [1.94, 2.02, 1.92]);
  for (const y of [.66, 1.16, 1.70, 2.27]) t.round(y === 2.27 ? cream : 0x6cafc0, [.90, y, -.77], [1.956, .080, 1.945], 'paint');
  t.round(0x376b77, [.90, 2.47, -.77], [1.05, .15, 1.05]);
  t.round(cream, [.90, 2.56, -.77], [.54, .065, .54], 'paint');
  for (const x of [.07, 1.66]) t.beam(0x2c6978, [x, .36, -.19], [x, 2.67, -.23], .089, 'metal');
  hose(t, copper, [[.98, 1.69, .14], [.98, 1.68, .48], [.98, 1.45, .62], [.98, .80, .62], [.60, .54, .71], [-.75, .54, .90]], .13);
  hose(t, 0x6b9e9a, [[1.08, 2.54, -.79], [1.68, 2.56, -.79], [2.14, 2.44, -.79], [2.23, 1.12, -.79], [2.23, .56, -.60]], .12);
  for (const [i, x] of [-1.92, -1.20, -.48].entries()) {
    const y = 1.03 - i * .044;
    t.box(iron, [x, .16, .56], [.58, .19, .60], 'metal');
    t.barrel(i ? 0xb8c4a7 : 0x78b4be, [x, y, .57], [.53, 1.52, .53]);
    for (const cap of [-.64, .62]) t.round(iron, [x, y + cap, .57], [.552, .098, .552]);
    gauge(t, x, y + .28, .855);
    hose(t, copper, [[x, y + .64, .57], [x, 1.90, .57], [x + .19, 1.99, .57]], .088);
  }
  t.beam(copper, [-1.92, 1.99, .57], [.03, 1.99, .57], .097, 'metal', true);
  t.box(iron, [.16, .22, 1.30], [.90, .36, .69], 'metal');
  t.barrel(yellow, [.18, .59, 1.33], [.59, .83, .59], [0, 0, Math.PI / 2]);
  gauge(t, .20, 1.05, 1.38);
  hose(t, copper, [[-.63, .53, .62], [-.68, .52, 1.05], [-.60, .54, 1.31], [-.21, .59, 1.32]], .15);
  for (const [x, z] of [[1.80, .53], [2.43, .75], [2.34, .01]]) drum(t, [x, .43, z], .63, .80, blue[Math.round(x) % blue.length]);
  t.ring(0xd86b54, [.98, .99, .75], [.31, .31, .62], 'metal');
  t.box(iron, [.98, .99, .76], [.23, .043, .042], 'metal');

  const distiller = model.at(rotated(root, 'Solar still', [-1.18, .05, -1.54], -.09));
  solar(distiller, 0, 0, 2.36, .96, 0x408d96, true);
  hose(t, jade, [[-.17, .55, -1.49], [0, .44, -1.49], [.02, .20, -1.35], [-.04, .19, -.65], [.24, .30, -.32]], .067);
  railing(t, [-2.69, 0, 2.30], [2.65, 0, 2.30], 'rope', 5, .75);
  railing(t, [2.72, 0, -2.23], [2.72, 0, -.52], 'rope', 2, .73);
}

export function solar(t: Tools, x: number, z: number, w: number, d: number, tone = 0x325978, still = false) {
  const slope = .38;
  for (const dx of [-w * .39, w * .39]) {
    for (const dz of [-d * .43, d * .43]) {
      const height = .86 - dz * slope;
      t.beam(iron, [x + dx, 0, z + dz], [x + dx, height, z + dz], .109, 'metal');
    }
    t.beam(iron, [x + dx, .07, z + d * .43], [x + dx, .76 + d * .43 * slope, z - d * .43], .066, 'metal');
  }
  t.box(0x91a6a4, [x, .89, z], [w + .11, .097, d + .09], 'metal', [slope, 0, 0]);
  const cols = still ? 2 : 6;
  const rows = still ? 2 : 4;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const dz = (j + .5 - rows / 2) * d / rows;
    const color = still ? (i === j ? 0x73adad : tone) : (i + j * 2) % 5 === 0 ? 0x496d91 : tone;
    t.box(color, [x + (i + .5 - cols / 2) * w / cols, .948 - dz * Math.sin(slope), z + dz * Math.cos(slope)],
      [w / cols - .029, .032, d / rows - .024], 'paint', [slope, 0, 0]);
  }
}
