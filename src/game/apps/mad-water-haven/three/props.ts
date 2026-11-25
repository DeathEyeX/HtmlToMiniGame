import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import type { Tools } from './kit';
import { blue, cream, green, iron, random, rope, swatch, timber, wood } from './palette';

export interface Motion {
  update?(time: number): void;
  dispose?(): void;
}

/** 甲板木板：逐行错缝，板缝、色差和铆钉都随种子变化。 */
export function planks(tool: Tools, width: number, depth: number, y: number, seed: number, x = 0, z = 0) {
  const roll = random(seed);
  const rows = Math.ceil(depth / .43);
  const row = depth / rows;
  for (let i = 0; i < rows; i++) {
    const line = z - depth / 2 + row * (i + .5);
    const pieces = width > 6.2 ? 3 : width > 3.4 ? 2 : 1;
    let start = x - width / 2 + (roll() - .5) * .11;
    for (let k = 1; k <= pieces; k++) {
      const end = x - width / 2 + width * k / pieces + (roll() - .5) * (k === pieces ? .15 : .82);
      const tone = wood[Math.floor(roll() * wood.length)];
      tool.box(tone, [(start + end) / 2, y - .081 + roll() * .02, line], [end - start - .026, .14, row - .024]);
      // 少量补丁板在旧板上加一层浅色木片，读得出反复修补的痕迹。
      if ((i * 3 + k) % 11 === 0) {
        tool.box(wood[(i + k) % wood.length], [(start + end) / 2 + .1, y + .002, line],
          [Math.min(.86, end - start - .3), .033, row * .62], 'wood', [0, 0, .004]);
      }
      if ((i + k * 2) % 5 === 0) {
        for (const bolt of [start + .12, end - .13]) tool.round(0x51402f, [bolt, y + .012, line + .08], [.066, .023, .066]);
      }
      start = end;
    }
  }
}

/** 悬垂绳索：分段折线近似弧垂，两端与栈桥或桅杆共点。 */
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
    tool.round(i % 2 && style === 'rope' ? 0x7b5a34 : iron, [p[0], top[1] + .05, p[2]], [.09, .034, .09]);
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
    tool.round(sideways ? 0x334c50 : color, [x, y + (sideways ? 0 : offset), z + (sideways ? offset : 0)],
      [diameter * 1.014, .071, diameter * 1.014], 'paint', rotation);
  }
  tool.round(iron, [x + diameter * .19, y + (sideways ? .13 : length / 2), z + (sideways ? length / 2 : -.08)], [.17, .05, .17], 'metal', rotation);
}

export function crate(tool: Tools, x: number, y: number, z: number, size = .73, tone = 0xb37c4d, turn = 0) {
  tool.box(tone, [x, y + size * .44, z], [size, size * .86, size * .92], 'wood', [0, turn, 0]);
  const cos = Math.cos(turn), sin = Math.sin(turn);
  for (const end of [-1, 1]) {
    const ex = end * size * .38;
    tool.box(timber, [x + ex * cos, y + size * .46, z - ex * sin + size * .46], [size * .13, size * .91, .075], 'wood', [0, turn, 0]);
    tool.box(wood[3], [x + ex * cos, y + size * .89, z - ex * sin], [size * .14, .063, size * .93], 'wood', [0, turn, 0]);
  }
  tool.beam(wood[3], [x - size * .33 * cos, y + size * .19, z + size * .48 - size * .33 * sin],
    [x + size * .33 * cos, y + size * .74, z + size * .48 + size * .33 * sin], .07);
}

/** 麻袋与提桶是甲板上最常见的散件，用来打破木板面的规则网格。 */
export function sack(tool: Tools, x: number, y: number, z: number, size = .5, tone = 0xc8ad7d, turn = 0) {
  tool.orb(tone, [x, y + size * .36, z], [size * .94, size * .86, size * .72], 'fabric', [0, turn, -.12]);
  tool.orb(0xb09666, [x + size * .18, y + size * .5, z + size * .1], [size * .34, size * .3, size * .3], 'fabric', [0, turn, 0]);
  tool.beam(rope, [x - size * .28, y + size * .62, z], [x + size * .3, y + size * .58, z], .022, 'fabric', true);
}

export function bucket(tool: Tools, x: number, y: number, z: number, color = 0xd8c07a, size = .34) {
  tool.round(color, [x, y + size * .5, z], [size, size, size], 'paint');
  tool.round(0x8c6d42, [x, y + size * .98, z], [size * 1.03, .05, size * 1.03], 'metal');
  tool.ring(iron, [x, y + size * 1.05, z], [size * 1.5, size * 1.2, size * 1.2], 'metal', [0, 0, Math.PI / 2]);
}

export function window(tool: Tools, x: number, y: number, z: number, w: number, h: number) {
  tool.box(0x25434a, [x, y, z], [w, h, .09], 'paint');
  tool.box(0x5d9ba1, [x + .04, y + .07, z + .06], [w - .18, h - .15, .044], 'paint');
  tool.box(0xb5d8cb, [x - w * .22, y + h * .22, z + .085], [w * .20, .115, .018], 'paint', [0, 0, .5]);
  for (const dx of [-w / 2, 0, w / 2]) tool.box(cream, [x + dx, y, z + .075], [.089, h + .10, .12]);
  for (const dy of [-h / 2, h / 2]) tool.box(cream, [x, y + dy, z + .075], [w + .21, .091, .15]);
  tool.box(wood[2], [x, y - h / 2 - .075, z + .12], [w + .29, .087, .245]);
  tool.box(wood[3], [x, y + h / 2 + .085, z + .11], [w + .34, .075, .30]);
}

/** 竖向木板墙，端部与横梁用同一批倒角盒，避免瓦楞板与木墙之间出现缝隙。 */
export function fence(tool: Tools, from: number, to: number, bottom: number, height: number, z: number, colors: number[]) {
  const count = Math.ceil((to - from) / .30);
  const width = (to - from) / count;
  for (let i = 0; i < count; i++) {
    tool.box(colors[i % colors.length], [from + (i + .5) * width, bottom + height / 2, z + .011 * (i % 3)],
      [width - .018, height, .125]);
  }
  for (const y of [bottom + .11, bottom + height - .10]) tool.box(timber, [(from + to) / 2, y, z + .085], [to - from + .09, .12, .115]);
}

/** 波纹铁皮屋顶：每张铁皮带四条凸棱，板间留出叠压边。 */
export function corrugated(tool: Tools, x: number, width: number, a: [number, number], b: [number, number], colors: number[], seed: number) {
  const roll = random(seed);
  const sheets = Math.ceil(width / .97);
  const panel = width / sheets;
  const pitch = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 0; i < sheets; i++) {
    const left = x - width / 2 + i * panel, edge = (roll() - .5) * .16;
    const tone = colors[i % colors.length];
    const center: Point3 = [left + panel / 2, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    tool.box(tone, center, [panel - .019, .095, length + edge], 'metal', [-pitch, 0, 0]);
    for (let j = 0; j < 4; j++) {
      tool.box(tone, [left + panel * (.13 + j * .244), center[1] + .048, center[2]], [.069, .097, length + edge + .034], 'metal', [-pitch, 0, 0]);
    }
    tool.round(0x6a5148, [center[0], b[0] + .065, b[1] - .11 * Math.sign(b[1] - a[1])], [.060, .023, .060]);
  }
}

/** 张紧的帆布遮阳棚，沿深度分条并保留卷边。 */
export function canopy(tool: Tools, x: number, z: number, y: number, w: number, depth: number, colors: number[], drop = .20) {
  const strips = colors.length * 4;
  const step = w / strips;
  for (let i = 0; i < strips; i++) {
    const geometry = new THREE.PlaneGeometry(step + .008, depth, 1, 7);
    geometry.rotateX(-Math.PI / 2);
    const p = geometry.getAttribute('position');
    for (let j = 0; j < p.count; j++) {
      const fraction = p.getZ(j) / depth + .5;
      p.setY(j, -drop * fraction - .13 * Math.sin(Math.PI * fraction) + .026 * Math.sin(Math.PI * i / 2));
    }
    geometry.computeVertexNormals();
    tool.surface(geometry, colors[i % colors.length], 'fabric', [x - w / 2 + (i + .5) * step, y, z]);
    tool.box(colors[i % colors.length], [x - w / 2 + (i + .5) * step, y - drop - .055, z + depth / 2], [step + .013, .11 + .038 * (i % 2), .058], 'fabric');
  }
}

/** 布片按行取色，逐帧改动顶点；只需一次法线重算，适合晾衣和旗帜。 */
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

export function lamp(tool: Tools, x: number, y: number, z: number, size = .26) {
  tool.beam(iron, [x, y + size * 1.1, z], [x, y + size * .32, z], .046, 'metal', true);
  tool.cone(0x294d4c, [x, y + size * .19, z], [size * 1.7, size * .50, size * 1.7], 'metal');
  tool.orb(0xffcf75, [x, y - size * .08, z], [size * .96, size * .60, size * .96], 'glow');
}

export function bench(tool: Tools, x: number, z: number, width: number, height: number) {
  for (const dx of [-width * .39, width * .39]) for (const dz of [-.34, .34]) tool.box(timber, [x + dx, height * .47, z + dz], [.11, height * .92, .12]);
  planks(tool, width, .94, height, 290, x, z);
}

/** 小型盆栽树：木桶加三团错位树冠，是俯视时最容易读出绿色体量的物件。 */
export function pottedTree(tool: Tools, x: number, y: number, z: number, height = 1.9, seed = 1) {
  tool.barrel(0x9a6a45, [x, y + .3, z], [.72, .6, .7]);
  tool.round(0x7d5638, [x, y + .62, z], [.78, .08, .76], 'metal');
  tool.beam(0x6f4a30, [x, y + .6, z], [x + .05, y + height * .72, z], .11, 'wood', true);
  tool.beam(0x6f4a30, [x, y + height * .48, z], [x + .34, y + height * .68, z], .06, 'wood', true);
  tool.orb(green[3], [x, y + height * .82, z], [1.05, .86, 1.0]);
  tool.orb(green[2], [x + .3, y + height * .72, z + .18], [.68, .56, .64]);
  tool.orb(green[4], [x - .26, y + height * .95, z - .16], [.56, .46, .52]);
  if (seed % 2) tool.orb(0xdb6043, [x + .2, y + height * .62, z + .36], [.14, .15, .15], 'paint');
}

/** 低矮盆栽：深色花盆加两三团叶球，用于填补甲板空角。 */
export function pottedPlant(tool: Tools, x: number, y: number, z: number, size = .4, tone = green[2]) {
  tool.cone(0xa8673f, [x, y + size * .28, z], [size * .62, size * .58, size * .62], 'paint', [Math.PI, 0, 0]);
  tool.orb(tone, [x, y + size * .78, z], [size * .92, size * .78, size * .86]);
  tool.orb(green[4], [x + size * .16, y + size * 1.02, z - size * .1], [size * .48, size * .42, size * .5]);
  tool.orb(green[1], [x - size * .14, y + size * .96, z + size * .14], [size * .38, size * .34, size * .36]);
}

export function buoys(tool: Tools, x: number, y: number, z: number, color: number, count = 3, spacing = .34) {
  for (let i = 0; i < count; i++) {
    const zz = z + i * spacing;
    tool.orb(color, [x, y + .09, zz], [.21, .23, .24], 'paint');
    tool.round(cream, [x, y + .13, zz], [.2, .05, .21], 'paint');
    tool.ring(iron, [x, y + .2, zz], [.08, .09, .5]);
  }
}

export function blueBarrel(tool: Tools, x: number, y: number, z: number, size = .7, color = blue[1]) {
  drum(tool, [x, y + size * .58, z], size, size * 1.16, color);
  tool.round(cream, [x, y + size * 1.19, z], [size * 1.02, .05, size * 1.02], 'paint');
}
