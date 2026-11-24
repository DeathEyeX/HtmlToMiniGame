import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { crate, line, planks, railing, stairs } from './decks';
import { child, cream, iron, rng, rope, rust, swatch, timber, wood, type Model, type Tools } from './model';

export interface Motion {
  update?(time: number): void;
  dispose?(): void;
}

export function corrugated(tool: Tools, x: number, width: number, a: [number, number], b: [number, number], colors: number[], seed: number) {
  const random = rng(seed);
  const sheets = Math.ceil(width / .97);
  const panel = width / sheets;
  const pitch = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 0; i < sheets; i++) {
    const left = x - width / 2 + i * panel, edge = (random() - .5) * .16;
    const tone = colors[i % colors.length];
    const center: Point3 = [left + panel / 2, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    tool.box(tone, center, [panel - .019, .095, length + edge], 'metal', [-pitch, 0, 0]);
    for (let j = 0; j < 4; j++) {
      tool.box(tone, [left + panel * (.13 + j * .244), center[1] + .048, center[2]], [.069, .097, length + edge + .034], 'metal', [-pitch, 0, 0]);
    }
    tool.round(0x6a5148, [center[0], b[0] + .065, b[1] - .11 * Math.sign(b[1] - a[1])], [.060, .023, .060]);
  }
}

function fence(tool: Tools, from: number, to: number, bottom: number, height: number, z: number, colors: number[]) {
  const count = Math.ceil((to - from) / .30);
  const width = (to - from) / count;
  for (let i = 0; i < count; i++) {
    tool.box(colors[i % colors.length], [from + (i + .5) * width, bottom + height / 2, z + .011 * (i % 3)], [width - .018, height, .125]);
  }
  for (const y of [bottom + .11, bottom + height - .10]) tool.box(timber, [(from + to) / 2, y, z + .085], [to - from + .09, .12, .115]);
}

function window(tool: Tools, x: number, y: number, z: number, w: number, h: number) {
  tool.box(0x25434a, [x, y, z], [w, h, .09], 'paint');
  tool.box(0x5d9ba1, [x + .04, y + .07, z + .06], [w - .18, h - .15, .044], 'paint');
  tool.box(0xb5d8cb, [x - w * .22, y + h * .22, z + .085], [w * .20, .115, .018], 'paint', [0, 0, .5]);
  for (const dx of [-w / 2, 0, w / 2]) tool.box(cream, [x + dx, y, z + .075], [.089, h + .10, .12]);
  for (const dy of [-h / 2, h / 2]) tool.box(cream, [x, y + dy, z + .075], [w + .21, .091, .15]);
  tool.box(wood[2], [x, y - h / 2 - .075, z + .12], [w + .29, .087, .245]);
}

export function lamp(tool: Tools, x: number, y: number, z: number, size = .26) {
  tool.beam(iron, [x, y + size * 1.1, z], [x, y + size * .32, z], .046, 'metal', true);
  tool.cone(0x294d4c, [x, y + size * .19, z], [size * 1.7, size * .50, size * 1.7], 'metal');
  tool.orb(0xffcf75, [x, y - size * .08, z], [size * .96, size * .60, size * .96], 'glow');
}

export function canopy(tool: Tools, x: number, z: number, y: number, w: number, depth: number, colors: number[], drop = .20) {
  // 把张紧的布沿深度分段，保留卷边和弧形下垂的侧面轮廓。
  const strips = colors.length * 4;
  const step = w / strips;
  for (let i = 0; i < strips; i++) {
    const g = new THREE.PlaneGeometry(step + .008, depth, 1, 7);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let j = 0; j < p.count; j++) {
      const fraction = p.getZ(j) / depth + .5;
      p.setY(j, -drop * fraction - .13 * Math.sin(Math.PI * fraction) + .026 * Math.sin(Math.PI * i / 2));
    }
    g.computeVertexNormals();
    tool.surface(g, colors[i % colors.length], 'fabric', [x - w / 2 + (i + .5) * step, y, z]);
    tool.box(colors[i % colors.length], [x - w / 2 + (i + .5) * step, y - drop - .055, z + depth / 2], [step + .013, .11 + .038 * (i % 2), .058], 'fabric');
  }
}

export function cloth(parent: THREE.Group, anchor: Point3, width: number, height: number, colors: number[], phase: number, flag = false): Motion {
  const geometry = new THREE.PlaneGeometry(width, height, 12, 7);
  geometry.translate(width / 2, -height / 2, 0);
  const p = geometry.getAttribute('position');
  const rest = Float32Array.from(p.array);
  const rgb: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const stripe = Math.min(colors.length - 1, Math.floor((-.999 * p.getY(i) / height) * colors.length));
    rgb.push(...swatch(colors[stripe]).toArray());
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...anchor);
  if (flag) mesh.rotation.y = -.25;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return {
    update(time) {
      for (let i = 0; i < p.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1];
        const free = flag ? x / width : -y / height;
        const wave = time * 2.2 - x * 3.7 + y * 2.0 + phase;
        p.setXYZ(i, x, y + (flag ? -.10 * free + .095 * free * Math.sin(wave - 1.6) : 0),
          free * (.13 * Math.sin(wave) + .045 * Math.sin(wave * 1.56)));
      }
      p.needsUpdate = true;
      geometry.computeVertexNormals();
    },
    dispose() { geometry.dispose(); material.dispose(); }
  };
}

function bench(tool: Tools, x: number, z: number, width: number, height: number) {
  for (const dx of [-width * .39, width * .39]) for (const dz of [-.34, .34]) tool.box(timber, [x + dx, height * .47, z + dz], [.11, height * .92, .12]);
  planks(tool, width, .94, height, 290, x, z);
}

export function buildHome(model: Model, root: THREE.Group): Motion[] {
  const t = model.at(root);
  const teal = [0x478a88, 0x5b9d96, 0x88aca0, 0x689b90, 0x3e7678];
  const white = [0xe5c49a, 0xe2ccaa, 0xcfaa80, 0xdeb793];
  const bottom = 2.60;
  const front = 1.10, rear = -3.10;
  // 前侧为开放工作和起居空间，二层走廊压在支撑梁上，楼梯接右侧开口。
  planks(t, 5.65, 5.5, bottom, 92, -.82, -.48);
  for (const x of [-3.52, -1.62, .25, 1.84]) for (const z of [front, rear]) {
    t.box(timber, [x, 1.36, z], [.24, 2.72, .24]);
    t.box(iron, [x, .12, z], [.34, .22, .34], 'metal');
    t.beam(wood[2], [x, 1.84, z], [x + (x < 0 ? .48 : -.48), 2.44, z], .115);
  }
  for (const z of [-3.19, -1.21, .95, 2.13]) t.box(timber, [-.78, 2.45, z], [5.86, .24, .24]);
  t.box(wood[0], [-3.61, 2.46, -.48], [.29, .27, 5.55]);
  t.box(wood[1], [1.99, 2.46, -.48], [.29, .27, 5.55]);
  fence(t, -3.59, 1.88, 0, 2.50, rear, teal);
  fence(model.at(rotated(root, 'Windward siding', [-3.57, 0, -.65], Math.PI / 2)), -2.43, 2.43, 0, 2.47, 0, white);
  fence(model.at(rotated(root, 'Ground-floor kitchen partition', [1.84, 0, -1.94], Math.PI / 2)), -1.10, 1.10, 0, 2.40, 0, teal);

  for (const x of [-3.59, 1.53]) for (const z of [-3.11, -.07]) t.box(timber, [x, 3.83, z], [.20, 2.45, .20]);
  fence(t, -3.60, -1.63, bottom, 2.24, -.14, white);
  fence(t, -.77, 1.57, bottom, 2.24, -.14, teal);
  fence(t, -3.58, 1.58, bottom, 2.33, -3.14, teal);
  for (const [x, name, color] of [[-3.58, 'West wall', white], [1.53, 'East wall', teal]] as const) {
    const side = model.at(rotated(root, name, [x, 0, -1.60], Math.PI / 2));
    fence(side, -1.51, 1.51, bottom, 2.28, 0, color);
    if (x > 0) window(side, .10, 3.95, .10, 1.27, .92);
  }
  window(t, -2.65, 3.89, -.02, 1.13, .90);
  window(t, .48, 3.89, -.01, 1.32, .91);
  t.box(0x6e4f38, [-1.2, 3.50, -.92], [.89, 1.88, .12]);
  for (const y of [2.67, 4.64]) t.box(timber, [-1.05, y, -.10], [5.31, .15, .17]);
  for (const z of [-3.17, .04]) t.box(timber, [-1.06, 4.83, z], [5.63, .19, .28]);
  for (const x of [-3.49, -1.85, -.13, 1.48]) {
    t.beam(timber, [x, 4.79, -3.42], [x, 6.03, -1.62], .17);
    t.beam(timber, [x, 6.03, -1.62], [x, 4.79, .21], .17);
  }
  corrugated(t, -1.05, 5.88, [4.87, -3.55], [6.02, -1.62], [rust[2], rust[0], rust[3], rust[0], rust[4]], 26);
  corrugated(t, -1.05, 5.88, [6.02, -1.62], [4.88, .29], [rust[0], rust[1], rust[3], rust[2], 0x817f66, rust[1]], 83);
  t.box(0xd99069, [-1.05, 6.08, -1.62], [6.05, .12, .23], 'metal');
  t.box(cream, [-1.06, 4.84, .24], [5.81, .13, .13]);

  // 后坡穿出的小阁楼沿原屋顶收口，保留住宅的偏心轮廓。
  const loft = model.at(child(root, 'Radio loft', [-2.26, 0, -2.04]));
  fence(loft, -1.04, .99, 5.35, 1.53, .28, teal);
  fence(loft, -.99, 1.05, 5.36, 1.53, -.85, white);
  for (const x of [-1.02, 1.01]) loft.box(teal[1], [x, 6.12, -.30], [.13, 1.52, 1.12]);
  window(loft, -.10, 6.32, .39, 1.23, .74);
  corrugated(loft, -.01, 2.48, [7.04, -.98], [6.95, .57], [0x3d7b80, 0x5d9690, 0x3f7479], 15);
  loft.beam(iron, [.63, 7.07, -.42], [.63, 8.12, -.42], .065, 'metal', true);
  loft.beam(iron, [.18, 7.84, -.42], [1.25, 7.84, -.42], .050, 'metal', true);
  loft.orb(0xff9861, [.63, 8.12, -.42], [.13, .13, .13], 'glow');

  stairs(t, [3.00, 0, 3.55], [2.66, bottom, .25], 1.11, 12);
  planks(t, 1.1, .94, bottom, 71, 2.39, .14);
  t.box(timber, [2.64, 1.26, -.27], [.20, 2.52, .21]);
  railing(t, [-3.56, bottom, .24], [-3.56, bottom, 2.18], 'wood', 2, .83);
  railing(t, [-3.55, bottom, 2.18], [1.97, bottom, 2.18], 'wood', 4, .83);
  railing(t, [1.94, bottom, -.27], [2.95, bottom, -.27], 'wood', 1, .78);
  railing(t, [-4.10, 0, -3.92], [-.28, 0, -3.92], 'rope', 3);
  railing(t, [-3.32, 0, 3.91], [.06, 0, 3.91], 'rope', 3);
  railing(t, [4.08, 0, -3.65], [4.08, 0, -.66], 'rope', 3);
  t.box(0x629287, [3.55, .43, -2.81], [.72, .87, 1.20]);
  t.box(wood[3], [3.55, .90, -2.81], [.81, .115, 1.31]);
  crate(t, 2.82, 0, -3.20, .63);
  t.round(0x5a8d88, [3.50, 1.04, -2.90], [.28, .16, .28], 'paint');
  t.ring(0xd17b58, [4.11, .57, -2.36], [.52, .53, 1.19], 'paint', [0, Math.PI / 2, 0]);
  for (const y of [.39, .75]) t.box(cream, [4.12, y, -2.36], [.15, .095, .12], 'fabric');

  bench(t, -.63, 1.48, 1.53, .84);
  bench(t, -.58, 2.21, 1.26, .45);
  t.round(cream, [-.91, .912, 1.52], [.29, .056, .29], 'paint');
  t.round(0x498887, [-.48, .97, 1.69], [.22, .24, .22], 'paint');
  t.orb(0xf0a54e, [-.8, .99, 1.50], [.11, .10, .11]);
  t.box(wood[2], [-2.44, .25, -.18], [1.36, .34, 2.10]);
  t.box(cream, [-2.44, .47, -.18], [1.30, .26, 2.03], 'fabric');
  t.box(0x729b8a, [-2.44, .61, .15], [1.32, .13, 1.20], 'fabric');
  t.box(0xca735c, [-2.44, .685, .56], [1.35, .04, .35], 'fabric');
  t.orb(0xf1dfc0, [-2.42, .66, -.93], [.96, .23, .47], 'fabric');
  t.box(timber, [-2.46, .56, -1.25], [1.36, .76, .16]);
  t.box(0x557e73, [.83, .62, -2.53], [1.30, 1.22, .67]);
  for (const x of [.51, 1.14]) {
    t.box(0x779b87, [x, .63, -2.17], [.56, 1.11, .09]);
    t.box(iron, [x - .15, .64, -2.10], [.055, .14, .05], 'metal');
  }
  crate(t, -3.75, 0, 2.75, .66);
  crate(t, -.41, bottom, 1.50, .65);
  for (const x of [-2.47, .95]) {
    t.round(0xb77757, [x, bottom + .23, 1.77], [.42, .42, .41], 'paint');
    t.orb(0x4d804d, [x, bottom + .58, 1.77], [.53, .45, .47]);
    t.orb(0x8faf54, [x + .10, bottom + .71, 1.77], [.26, .33, .29]);
  }
  canopy(t, -.64, .60, 4.54, 3.81, 1.15, [cream, 0xc16954], .19);
  for (const x of [-2.56, 1.27]) t.beam(timber, [x, 4.04, -.04], [x, 4.31, 1.17], .075);
  lamp(t, -.95, 2.34, .98, .31);
  lamp(t, 1.22, 4.27, .20, .22);

  const laundryA: Point3 = [-3.31, 1.98, 3.48], laundryB: Point3 = [-.20, 1.88, 3.28];
  for (const [x, y, z] of [laundryA, laundryB]) t.beam(timber, [x, 0, z], [x, y + .12, z], .103);
  line(t, rope, laundryA, laundryB, .11, .038);
  return [
    cloth(root, [-3.04, 1.93, 3.47], .61, .65, [cream, 0xd3795c, 0xd3795c], .45),
    cloth(root, [-2.12, 1.835, 3.40], .46, .52, [0x7cabaa, 0x477f86], 1.8),
    cloth(root, [-1.36, 1.82, 3.35], .74, .70, [0xd8c18d, 0xeee0b0, 0x8eae82], 3.3),
    cloth(root, [-2.54, 4.31, 1.18], .48, .25, [cream], 2.6),
    cloth(root, [.79, 4.31, 1.18], .47, .24, [0xc16954], 4.1)
  ];
}

export function rotated(parent: THREE.Group, name: string, position: Point3, turn: number) {
  const group = child(parent, name, position);
  group.rotation.y = turn;
  return group;
}

export function buildTower(model: Model, root: THREE.Group): Motion[] {
  const t = model.at(root);
  const deck = 6.55;
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const foot: Point3 = [x * 1.53, 0, z * 1.58];
    const top: Point3 = [x * .98, deck + .11, z * .98];
    t.beam(timber, foot, top, .30);
    t.box(iron, [foot[0], .18, foot[2]], [.45, .32, .46], 'metal');
    t.beam(wood[0], [foot[0], .28, foot[2]], [-top[0], deck * .52, z * 1.25], .14);
    t.beam(wood[2], [x * 1.25, deck * .53, z * 1.25], [-top[0], deck - .17, top[2]], .16);
    t.beam(timber, [x * 1.36, 2.1, z * 1.40], [x * 1.23, 4.14, -z * 1.24], .13);
  }
  for (const y of [1.78, 3.65, 6.34]) {
    const radius = 1.60 - .083 * y;
    for (const z of [-radius, radius]) t.box(timber, [0, y, z], [radius * 2.16, .19, .20]);
    for (const x of [-radius, radius]) t.box(wood[0], [x, y, 0], [.20, .19, radius * 2.12]);
  }
  for (const x of [-.34, .34]) t.beam(wood[2], [x, .04, 1.68], [x, deck + .35, 1.21], .12);
  for (let i = 0; i < 19; i++) t.beam(wood[i % 5], [-.34, .34 + i * .34, 1.72 - i * .024], [.34, .34 + i * .34, 1.72 - i * .024], .098, 'wood', true);
  planks(t, 2.72, 2.59, deck, 60);
  for (const x of [-1.18, 1.18]) {
    railing(t, [x, deck, -1.13], [x, deck, 1.12], 'wood', 2, .81);
    for (const z of [-1.04, 1.04]) t.beam(timber, [x, deck, z], [x, 8.67 - z * .13, z], .14);
  }
  railing(t, [-1.18, deck, -1.13], [1.18, deck, -1.13], 'wood', 2, .81);
  railing(t, [.44, deck, 1.12], [1.18, deck, 1.12], 'wood', 1, .81);
  railing(t, [-1.18, deck, 1.12], [-.44, deck, 1.12], 'wood', 1, .81);
  for (const z of [-1.08, 1.08]) t.box(timber, [0, 8.67 - z * .13, z], [2.56, .13, .14]);
  canopy(t, 0, 0, 8.81, 2.89, 2.69, [0xdc9f70, 0xffd6a5, 0xf1be8a], .27);
  t.box(0x457573, [.68, 6.94, -.69], [.78, .71, .52]);
  t.round(iron, [-.72, 7.02, .73], [.15, .88, .15]);
  t.round(0xd5a35b, [-.72, 7.53, .76], [.59, .48, .59], 'metal', [Math.PI / 2 - .17, 0, 0]);
  t.round(cream, [-.72, 7.56, 1.015], [.50, .058, .50], 'glow', [Math.PI / 2 - .17, 0, 0]);
  t.ring(iron, [-.72, 7.55, 1.037], [.55, .55, .65]);
  t.beam(wood[0], [.59, deck, .25], [.59, 7.40, .25], .11);
  t.round(0x31565b, [.59, 7.51, .22], [.24, .74, .24], 'metal', [1.31, 0, -.38]);
  t.round(0xd0a766, [.61, 7.62, .56], [.31, .16, .31], 'metal', [1.31, 0, -.38]);
  t.beam(timber, [-1.10, 8.28, -.91], [-1.10, 10.27, -.91], .10);
  t.orb(0xffcc79, [-1.10, 10.27, -.91], [.16, .16, .16]);
  return [cloth(root, [-1.04, 10.14, -.91], 1.81, .83, [0xbb5746, cream, cream, 0x518885], .7, true)];
}
