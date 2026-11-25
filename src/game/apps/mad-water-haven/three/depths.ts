import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { child, type Kit, type Tools } from './kit';
import { cream, green, iron, rope, teal, timber } from './palette';
import { line, type Motion } from './props';

const shellBlue = 0x74b3b8;
const shellTeal = 0x68a5a2;
const glowWarm = 0xffc46a;
const glowCool = 0x9fe8d4;

/** 每段连廊都带加强环，读起来是拼接起来的耐压舱段，而不是一根光滑圆柱。 */
function corridor(t: Tools, a: Point3, b: Point3, radius: number, color: number) {
  t.beam(color, a, b, radius * 2, 'metal', true);
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  const rings = Math.max(2, Math.round(length / .62));
  for (let i = 1; i < rings; i++) {
    const f = i / rings;
    const c: Point3 = [a[0] + dx * f, a[1] + dy * f, a[2] + dz * f];
    // 环面朝向由轴向决定：先把环立起来，再绕 y 轴对准舱段方向。
    t.ring(0x2f4b52, c, [radius * 2.2, radius * 2.2, radius * .5], 'metal', [Math.PI / 2, Math.atan2(dx, dz), 0]);
  }
}

function porthole(t: Tools, x: number, y: number, z: number, angle: number, color = glowWarm) {
  const r = .24;
  // 圆柱默认沿 y 轴，绕 x 立起后再绕 y 转到径向，玻璃面才真正朝向舱外。
  const nx = Math.sin(angle), nz = Math.cos(angle);
  t.round(0x273f45, [x + nx * .04, y, z + nz * .04], [r * 2.5, .07, r * 2.5], 'metal', [Math.PI / 2, angle, 0]);
  t.round(color, [x + nx * .09, y, z + nz * .09], [r * 1.8, .05, r * 1.8], 'glow', [Math.PI / 2, angle, 0]);
}

export function buildDepths(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);

  // 主舱：下方厚壳承压，上方玻璃穹顶让暖光透出水面。
  t.shell(shellBlue, [0, -.42, 0], [5.5, 4.3, 5.1]);
  t.shell(shellTeal, [0, -.95, 0], [4.6, 2.9, 4.3]);
  t.shell(0xa9e0d4, [0, .52, 0], [4.3, 2.9, 4.0], 'glass');
  // 亮色舱箍把主舱从深色海水里勾出轮廓。
  for (const a of [0, Math.PI / 2]) t.ring(cream, [0, -.5, 0], [5.9, 4.8, .14], 'paint', [Math.PI / 2, a, 0]);
  for (const [y, s] of [[.52, 4.32], [-.1, 5.02], [-.82, 4.8], [-1.5, 4.1]] as const) {
    t.ring(0x2f4b52, [0, y, 0], [s, s, .22], 'metal', [Math.PI / 2, 0, 0]);
  }
  t.ring(0x2f4b52, [0, -.4, 0], [5.52, 5.12, .2], 'metal', [0, Math.PI / 2, 0]);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + .2;
    porthole(t, Math.sin(a) * 2.72, -.15, Math.cos(a) * 2.55, a, i % 3 ? glowWarm : glowCool);
  }
  // 穹顶内部的暖光和几张模糊的家具轮廓，让舱内不是空壳。
  t.orb(glowWarm, [0, .1, 0], [1.5, 1.1, 1.4], 'glow');
  t.orb(0x2f4b52, [.7, -.2, .3], [.5, .8, .5]);
  t.orb(0x2f4b52, [-.6, -.15, .5], [.7, .5, .7]);
  t.orb(0x2f4b52, [0, -.5, -.9], [1.1, .4, .6]);

  // 中央升降井：从主舱顶通到住宅甲板底部，外壁带检修环和爬梯。
  t.round(0x35565c, [0, 2.98, 0], [1.28, 3.4, 1.28], 'metal');
  for (const y of [1.45, 2.2, 2.95, 3.7, 4.45]) t.ring(0x273f45, [0, y, 0], [1.44, 1.44, .16], 'metal', [Math.PI / 2, 0, 0]);
  t.round(glowCool, [-.66, 3.0, 0], [.16, .55, .35], 'glow', [0, 0, .0]);
  for (const x of [-.52, .52]) t.beam(iron, [x, 1.34, .68], [x, 4.55, .68], .07, 'metal');
  for (let i = 0; i < 10; i++) t.beam(iron, [-.52, 1.5 + i * .31, .68], [.52, 1.5 + i * .31, .68], .05, 'metal', true);
  t.round(0x2f4b52, [0, 4.62, 0], [1.7, .18, 1.7], 'metal');

  // 侧舱与连廊：左右延伸不同深度，前方再挂一个观察舱。
  corridor(t, [-1.5, -.3, -.15], [-3.4, -.85, -.72], .56, shellTeal);
  t.shell(shellTeal, [-3.95, -1.05, -.88], [3.3, 2.7, 3.1]);
  t.shell(0xa9e0d4, [-3.95, -.35, -.88], [2.3, 1.6, 2.2], 'glass');
  t.ring(0x2f4b52, [-3.95, -.3, -.88], [2.36, 2.26, .16], 'metal', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    porthole(t, -3.95 + Math.sin(a) * 1.62, -1.0, -.88 + Math.cos(a) * 1.5, a, i % 2 ? glowWarm : glowCool);
  }
  t.round(0x35565c, [-3.95, .5, -.88], [1.0, .5, 1.0], 'metal');
  t.beam(iron, [-3.95, .7, -.88], [-3.95, 2.15, -.88], .08, 'metal');
  t.orb(0xff8a5e, [-3.95, 2.18, -.88], [.18, .18, .18], 'glow');

  corridor(t, [1.5, -.45, .35], [3.1, -1.18, 1.22], .5, shellBlue);
  t.shell(shellBlue, [3.65, -1.35, 1.45], [2.95, 2.4, 2.8]);
  t.shell(0xa9e0d4, [3.65, -.75, 1.45], [2.0, 1.3, 1.9], 'glass');
  porthole(t, 4.32, -1.35, 1.45, Math.PI / 2, glowWarm);
  porthole(t, 3.4, -1.3, 2.35, 0, glowCool);
  t.round(0x35565c, [3.65, -.35, 1.45], [.95, .46, .95], 'metal');

  corridor(t, [0, -1.15, 1.9], [-.1, -1.75, 3.1], .46, shellTeal);
  t.shell(shellTeal, [-.12, -1.9, 3.55], [2.45, 2.05, 2.2]);
  t.shell(0xa9e0d4, [-.12, -1.35, 3.55], [1.6, 1.0, 1.5], 'glass');
  porthole(t, -.12, -2.0, 4.45, 0, glowWarm);
  t.ring(rope, [0, -1.9, 3.55], [2.4, 2.2, .3], 'fabric', [Math.PI / 2, 0, 0]);

  // 前侧观察舱伸出主浮台边缘，俯视时能透过水面看到水下巴掌大的玻璃穹顶，
  // 这是默认机位里唯一直接可读的水下设施，也是潜水管线的入口。
  corridor(t, [-.1, -1.9, 3.6], [.35, -1.5, 4.45], .42, shellBlue);
  t.shell(shellBlue, [.4, -1.15, 4.85], [2.05, 1.75, 1.95]);
  t.shell(0xa9e0d4, [.4, -.66, 4.85], [1.3, .9, 1.2], 'glass');
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .4;
    porthole(t, .4 + Math.sin(a) * 1.02, -1.05, 4.85 + Math.cos(a) * .94, a, i % 2 ? glowCool : glowWarm);
  }
  t.beam(iron, [.4, -.3, 4.85], [.4, 4.5, 4.85], .07, 'metal');
  t.orb(0xffcc79, [.4, 2.4, 4.85], [.14, .14, .14], 'glow');

  // 右侧再挂一个更深的设备舱，连廊穿过主舱与侧舱之间，远看是断续的舱段链。
  corridor(t, [4.5, -1.5, 1.1], [4.9, -2.2, -.5], .4, shellTeal);
  t.shell(shellTeal, [5.0, -2.3, -.75], [1.85, 1.55, 1.75]);
  porthole(t, 5.0, -2.35, .15, 0, glowWarm);
  t.round(0x35565c, [5.0, -1.55, -.75], [.8, .4, .8], 'metal');
  // 舱体外挂储气罐与天线，让轮廓不再是一个光滑的球。
  t.round(0xa7b5ab, [-1.2, .85, 1.55], [.5, 1.5, .5], 'metal', [0, 0, Math.PI / 2]);
  t.round(0x8aa39a, [.2, .95, 1.7], [.44, 1.3, .44], 'metal', [0, 0, Math.PI / 2]);
  t.beam(iron, [-3.95, .3, -.88], [-3.95, 2.4, -.88], .05, 'metal');
  t.round(0xd7d1b8, [-3.95, 2.5, -.88], [.7, .12, .7], 'paint', [Math.PI / 2, 0, 0]);
  t.beam(iron, [5.0, -1.4, -.75], [5.0, .5, -.75], .05, 'metal');
  t.orb(0xff8a5e, [5.0, .55, -.75], [.14, .14, .14], 'glow');

  // 通向观察舱的透明走廊：玻璃管外加奶油色加强环，暖光从舱内透出来。
  t.beam(0xa9e0d4, [-.1, -1.25, 2.1], [.35, -1.15, 4.3], 1.05, 'glass', true);
  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    t.ring(cream, [-.1 + .45 * f, -1.25 + .1 * f, 2.15 + 2.1 * f], [1.16, 1.16, .12], 'paint', [Math.PI / 2 - .04, 0, 0]);
  }
  t.orb(glowWarm, [.15, -1.35, 3.2], [.24, .24, .9], 'glow');

  // 靠在主舱边的小型潜航器，给水下层增加一件人工器物和可读尺度。
  const sub = child(root, 'Docked submersible');
  const s = kit.at(sub);
  s.shell(0xe2b04e, [3.1, -2.25, 3.1], [2.2, 1.25, 1.15]);
  s.shell(0xa9e0d4, [3.55, -2.1, 3.1], [.9, .8, .85], 'glass');
  s.round(0x35565c, [2.15, -2.2, 3.1], [.42, .5, .42], 'metal', [0, 0, Math.PI / 2]);
  for (const z of [2.72, 3.48]) s.box(0x4f5f5c, [2.9, -2.78, z], [1.5, .12, .12], 'metal');
  s.round(0x2f4b52, [4.05, -2.28, 3.1], [.62, .5, .62], 'metal', [Math.PI / 2, 0, 0]);
  s.orb(0xffd36e, [4.18, -2.05, 3.6], [.13, .13, .13], 'glow');
  s.beam(0x4f5f5c, [2.9, -2.6, 3.1], [2.9, -3.35, 3.1], .1, 'metal');
  s.box(rope, [3.6, -2.95, 3.1], [.5, .05, .5], 'fabric', [0, .4, 0]);

  // 支撑：四根立柱从住宅甲板底面落到主舱肩部，外加斜撑。
  for (const x of [-2.35, 2.35]) for (const z of [-2.2, 2.2]) {
    t.beam(timber, [x, 1.35, z], [x * .9, 4.62, z * .9], .34);
    t.box(iron, [x, 1.28, z], [.62, .3, .62], 'metal');
    t.beam(iron, [x, 1.5, z], [x * .35, -.1, z * .4], .14, 'metal');
  }
  t.beam(iron, [-2.35, 1.45, -2.2], [2.35, 1.45, 2.2], .12, 'metal');
  t.beam(iron, [2.35, 1.45, -2.2], [-2.35, 1.45, 2.2], .12, 'metal');

  // 外部管线、锚链、压载块。
  t.round(0x2f4b52, [-2.7, .4, .9], [.34, 2.4, .34], 'metal');
  t.round(0x2f4b52, [2.55, .1, -1.4], [.3, 2.8, .3], 'metal');
  line(t, rope, [3.65, -1.6, 1.45], [3.65, -3.6, 1.45], .02, .09);
  line(t, rope, [-3.95, -1.6, -.88], [-3.95, -3.6, -.88], .02, .09);
  t.box(0x53605e, [3.65, -3.75, 1.45], [1.3, .7, 1.3], 'metal');
  t.box(0x53605e, [-3.95, -3.75, -.88], [1.2, .65, 1.2], 'metal');

  // 海床植被：海草、珊瑚和散落的石块，与上方种植区形成呼应。
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, radius = 2.6 + (i % 5) * 1.05;
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const h = .7 + (i % 4) * .3;
    // 每丛三根草叶向不同方向弯出，避免出现单根“棒棒糖”的剪影。
    const blades: [number, number][] = [[0, .16], [.18, -.1], [-.16, .06]];
    for (const [bi, [ox, oz]] of blades.entries()) {
      const top: Point3 = [x + ox, -3.3 + h * (1 - bi * .12), z + oz];
      t.beam(green[(i + bi) % 6], [x, -3.3, z], top, .06, 'matte', true);
      t.orb(green[(i + bi + 2) % 6], [top[0], top[1], top[2]], [.26, .22, .24], 'matte', [0, 0, ox * 1.6]);
    }
    if (i % 3 === 0) {
      t.orb(i % 2 ? 0xe07d5a : 0xdc9c86, [x - .3, -3.2, z + .2], [.44, .34, .4]);
      t.orb(0xa98ab8, [x - .15, -3.05, z + .34], [.28, .24, .26]);
    }
  }
  t.box(0x6b8f88, [-4.9, -3.42, 2.6], [1.6, .9, 1.4], 'matte', [0, .4, 0]);
  t.box(0x5f8380, [4.75, -3.5, -1.6], [1.4, .8, 1.2], 'matte', [0, -.3, 0]);

  // 鱼群与气泡是水下层唯一的持续运动，速度比甲板动画更慢。
  const school = child(root, 'Reef school');
  const sf = kit.at(school);
  const fishes: [number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.1, r = 1.2 + (i % 4) * .9;
    const p: [number, number, number] = [Math.cos(a) * r, -.4 + (i % 3) * .35, Math.sin(a) * r];
    fishes.push(p);
    sf.orb(i % 3 === 0 ? 0xf7be6d : 0xa5e7cf, p, [.36, .16, .12], 'glow');
    sf.box(i % 3 === 0 ? 0xf7be6d : 0xa5e7cf, [p[0] - .2, p[1], p[2]], [.14, .1, .05], 'glow', [0, 0, .5]);
  }
  // 每串气泡用独立节点，合批后只剩一个网格，节点本身仍可逐帧移动。
  const bubbles: THREE.Group[] = [];
  const bubbleSpots: [number, number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const x = -3.4 + (i % 3) * 2.9, z = -1.8 + Math.floor(i / 3) * 1.9;
    const bubble = child(root, 'Vent bubble');
    bubble.userData.castShadow = false;
    const bt = kit.at(bubble);
    bt.orb(0xb7e7df, [0, 0, 0], [.16, .16, .16], 'glow');
    bubbles.push(bubble);
    bubbleSpots.push([x, -2.8, z, .5 + (i % 4) * .3]);
  }
  const beacon = child(root, 'Airlock beacon');
  const beaconKit = kit.at(beacon);
  beaconKit.orb(0xff8a5e, [0, 4.72, 0], [.24, .24, .24], 'glow');

  return [
    {
      update(time) {
        school.position.set(Math.sin(time * .21) * 1.6, Math.sin(time * .43) * .4, Math.cos(time * .27) * 1.3);
        school.rotation.y = time * .18;
        // 气泡沿固定轨迹上浮，到达水面后从水下层顶端重新开始。
        for (const [i, [x, , z, speed]] of bubbleSpots.entries()) {
          const rise = (time * speed + i * .37) % 5.2;
          bubbles[i].position.set(x + Math.sin(time * 1.1 + i) * .12, -2.9 + rise, z);
        }
        beacon.rotation.y = time * .6;
        beacon.children.forEach((mesh, i) => { mesh.visible = (time * 1.3 + i) % 2 > .7; });
      }
    }
  ];
}
