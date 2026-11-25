import * as THREE from 'three-platformize';
import { child, type Kit, type Tools } from './kit';
import { blue, cream, iron, random, rope, timber, wood } from './palette';
import { hose, gauge, valve } from './pipes';
import { blueBarrel, crate, canopy, drum, lamp, planks, railing, sack, type Motion } from './props';

function corrugatedRoof(t: Tools, x: number, width: number, a: [number, number], b: [number, number], colors: number[], seed: number) {
  const roll = random(seed);
  const sheets = Math.ceil(width / .97);
  const panel = width / sheets;
  const pitch = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 0; i < sheets; i++) {
    const left = x - width / 2 + i * panel;
    const tone = colors[i % colors.length];
    const center: [number, number, number] = [left + panel / 2, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    t.box(tone, center, [panel - .019, .095, length + (roll() - .5) * .16], 'metal', [-pitch, 0, 0]);
    for (let j = 0; j < 4; j++) {
      t.box(tone, [left + panel * (.13 + j * .244), center[1] + .048, center[2]], [.069, .097, length + .034], 'metal', [-pitch, 0, 0]);
    }
  }
}

export function buildWorkshop(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);
  const roll = random(812);

  // 加工棚：前侧敞开，后墙挂工具，上方阁楼存放木料和备件。
  for (const x of [-2.42, 1.62]) for (const z of [-2.72, -.34]) {
    t.box(timber, [x, 1.5, z], [.19, 3.0, .21]);
    t.beam(wood[2], [x, 1.05, z], [x + (x < 0 ? .5 : -.5), 2.3, z], .10);
  }
  for (const z of [-2.78, -.36]) t.box(timber, [-.4, 2.92, z], [4.36, .2, .24]);
  corrugatedRoof(t, -.4, 4.6, [3.24, -2.96], [2.52, .1], [0x5e8a89, 0x738e89, 0x3e7779, 0x9d6d51], 13);
  t.box(cream, [-.4, 2.54, .16], [4.4, .1, .12]);
  for (let i = 0; i < 13; i++) t.box(wood[(i + 1) % wood.length], [-2.4 + .255 * i, 1.48, -2.72], [.23, 2.42, .12]);

  // 阁楼地板压在横梁上，梯子从工作台右侧上到挑台。
  planks(t, 3.8, 2.2, 2.26, 44, -.38, -1.6);
  railing(t, [-2.28, 2.26, -.54], [1.5, 2.26, -.54], 'wood', 4, .62);
  for (const x of [-2.22, 1.44]) t.box(timber, [x, 2.24, -.5], [.18, .62, .16]);
  for (const x of [.88, 1.28]) t.beam(wood[2], [x, .02, .18], [x, 2.6, -.28], .09);
  for (let i = 0; i < 8; i++) t.beam(wood[i % 5], [.88, .26 + i * .3, .16 - i * .055], [1.28, .26 + i * .3, .16 - i * .055], .07, 'wood', true);
  t.box(0x9a7449, [.2, 2.6, -1.7], [1.0, .6, .66], 'wood');
  t.round(0xb08a55, [.2, 2.94, -1.7], [1.02, .08, .68], 'wood');

  // 工作台与工具墙。
  planks(t, 2.3, .96, .99, 19, -.96, -1.6);
  for (const x of [-2.0, .08]) for (const z of [-1.92, -1.28]) t.box(timber, [x, .49, z], [.14, .95, .14]);
  t.box(0x546060, [-.92, 1.66, -2.6], [1.98, .84, .05], 'metal');
  for (let i = 0; i < 7; i++) {
    const x = -1.7 + .253 * i;
    t.box(0xaaa38a, [x, 1.66 + .12 * (i % 2), -2.55], [.058, .38 - .036 * (i % 3), .058], 'metal', [0, 0, .19 * (i - 3)]);
    t.box(i % 2 ? 0xb37556 : 0x82926b, [x, 1.53 + .12 * (i % 2), -2.52], [.093, .21, .08], 'paint');
  }
  // 台钳、木屑桶、手锯和量尺。
  t.box(iron, [-1.66, 1.05, -1.55], [.44, .2, .38], 'metal');
  t.box(0x7c9392, [-1.67, 1.22, -1.55], [.5, .16, .32], 'metal');
  t.beam(iron, [-1.78, 1.05, -1.32], [-1.41, 1.05, -1.32], .052, 'metal', true);
  t.box(0xc4b895, [-.7, 1.11, -1.4], [.5, .03, .18], 'metal', [0, .3, 0]);
  t.round(0x8d6a42, [.1, 1.14, -1.5], [.3, .2, .3], 'paint');

  // 木料堆与废金属，数量用种子错开，避免同样的堆叠节奏。
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 6);
    const z = 1.05 + row * .31 + .04 * (i % 6);
    const x = -1.5 + (i % 6) * .1;
    t.round(0x976644, [x, .17 + row * .25, z], [.24, 1.3 - .04 * i, .24], 'wood', [0, 0, Math.PI / 2]);
    t.round(wood[3], [x + .64 - .02 * i, .17 + row * .25, z], [.175, .038, .175], 'wood', [0, 0, Math.PI / 2]);
  }
  for (let i = 0; i < 7; i++) {
    const x = 1.65 + (roll() - .5) * .8, z = 1.5 + (roll() - .5) * 1.1;
    t.box(i % 2 ? 0x7f8d88 : 0x9c7a58, [x, .12 + (i % 3) * .11, z], [.62 - .04 * i, .09, .34], 'metal', [0, roll() * 3, .06]);
  }
  t.ring(0x4f6060, [-1.79, .9, 2.1], [.46, .46, 1.1], 'metal', [Math.PI / 2, 0, .45]);
  t.ring(0x6f7f78, [1.4, .5, -2.1], [.7, .7, .9], 'metal', [0, .4, 0]);
  t.round(0xb08a55, [1.95, .62, .6], [.5, .18, .5], 'metal', [0, 0, Math.PI / 2]);

  // 熔炉与烟囱。炉门朝观察侧，烟囱穿过棚顶，排烟由 life.ts 接管。
  const furnace = child(root, 'Smelter', [1.32, 0, -1.28]);
  const f = kit.at(furnace);
  f.box(0x534a43, [0, .17, 0], [1.7, .31, 1.62], 'metal');
  f.barrel(0x765342, [0, .94, 0], [1.5, 1.47, 1.46]);
  for (const y of [.34, 1.52]) f.round(0x4c5555, [0, y, 0], [1.5, .116, 1.49], 'metal');
  f.round(0x343c3b, [0, .79, .722], [.88, .19, .88], 'metal', [Math.PI / 2, 0, 0]);
  f.round(0xaa7852, [0, .8, .82], [.72, .095, .72], 'metal', [Math.PI / 2, 0, 0]);
  f.round(0x492627, [0, .8, .875], [.6, .035, .6], 'matte', [Math.PI / 2, 0, 0]);
  f.round(0xf68548, [0, .71, .895], [.47, .033, .35], 'glow', [Math.PI / 2, 0, 0]);
  for (const y of [.59, .78, .97]) f.box(iron, [0, y, .92], [.57, .051, .055], 'metal');
  hose(f, 0x675956, [[.14, 1.5, -.3], [.14, 2.02, -.3], [.4, 2.3, -.3], [.42, 2.8, -.3], [.42, 3.9, -.3]], .35);
  f.round(iron, [.42, 3.86, -.3], [.48, .14, .48]);
  f.ring(0x2d383a, [.42, 3.94, -.3], [.38, .38, .6], 'metal', [Math.PI / 2, 0, 0]);
  t.ring(0x2f383a, [.42, 4.08, -.3], [.36, .36, .5], 'metal', [Math.PI / 2, 0, 0]);

  // 皮带轮和机械箱：转动由 scene 每帧更新。
  t.box(0x7f9a86, [1.24, .41, .98], [1.06, .79, .94], 'metal');
  t.box(iron, [1.24, .11, .98], [1.28, .17, 1.1], 'metal');
  const rotor = child(root, 'Belt wheel', [1.28, .58, 1.48]);
  const r = kit.at(rotor);
  r.ring(0xbb8a54, [0, 0, 0], [.78, .78, 1.06]);
  r.round(iron, [0, 0, .02], [.24, .11, .24], 'metal', [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    r.beam(iron, [0, 0, 0], [Math.cos(a) * .33, Math.sin(a) * .33, 0], .064, 'metal');
  }
  gauge(t, .32, 1.06, 1.46);
  valve(t, .68, .74, 1.44);
  hose(t, 0x6d5a4c, [[1.2, .5, .5], [.75, .45, .6], [.2, .42, .9], [-.4, .42, 1.2]], .09);

  // 散件：木桶、麻袋、蓝色油桶、废木板和吊灯。
  drum(t, [-2.4, .43, 2.45], .66, .86, 0x8f6a45);
  blueBarrel(t, 2.15, 0, 2.5, .6, blue[0]);
  sack(t, 1.15, 0, 2.72, .5, 0xb79a6c, .3);
  sack(t, .62, 0, 2.86, .44, 0xc0a373, -.2);
  crate(t, -2.45, 0, 1.55, .72, 0xa9734a, .25);
  crate(t, 1.75, 0, 2.1, .58, 0xb37c4d, -.3);
  t.box(wood[2], [-.2, .07, 2.7], [1.7, .12, .3], 'wood', [0, .22, .03]);
  // 木料堆上盖一块红色防水布，压在角上的石块用深色小球代替。
  t.box(0xc9543a, [-.88, .58, 1.5], [1.7, .05, 1.05], 'fabric', [0, -.08, .04]);
  t.box(0xb84a34, [-.88, .44, 1.95], [1.75, .3, .08], 'fabric');
  for (const x of [-1.55, -.25]) t.orb(0x5c6660, [x, .7, 1.5], [.14, .12, .14]);
  t.ring(0x3f6f78, [2.45, .62, -.4], [.5, .5, .5], 'paint', [0, .3, .1]);
  lamp(t, -.64, 2.42, -.52);
  for (const x of [-2.5, 1.8]) for (const z of [-3.0, 2.95]) t.box(iron, [x, .1, z], [.26, .2, .26], 'metal');
  canopy(t, 2.1, -2.2, 2.7, 1.3, 1.2, [0xb7a06a, 0x8a9b72], .16);
  return [{ update(time) { rotor.rotation.z = -time * .95; } }];
}
