import * as THREE from 'three-platformize';
import { child, type Kit, type Tools } from './kit';
import { cream, iron, rust, wood } from './palette';
import { hose, gauge } from './pipes';
import { crate, railing, type Motion } from './props';

const gold = 0xe4a844;
const teal = 0x4d8584;

function blade(tool: Tools, angle: number) {
  const outline = new THREE.Shape();
  outline.moveTo(-.073, .20);
  outline.lineTo(-.29, .61);
  outline.quadraticCurveTo(-.35, 1.25, -.20, 1.97);
  outline.lineTo(.08, 2.02);
  outline.quadraticCurveTo(.14, 1.45, .10, .67);
  outline.lineTo(.066, .20);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: .049, bevelEnabled: true, bevelSize: .024, bevelThickness: .015, bevelSegments: 1, curveSegments: 4, steps: 1
  });
  tool.surface(geometry, cream, 'metal', [0, 0, .017], [.06, .09, angle]);
  const x = -Math.sin(angle) * 1.81, y = Math.cos(angle) * 1.81;
  tool.box(0xb85f4b, [x - Math.cos(angle) * .052, y - Math.sin(angle) * .052, .082], [.265, .146, .023], 'paint', [0, 0, angle]);
}

function panel(tool: Tools, x: number, z: number, w: number, d: number, tilt = .42, tone = 0x325978) {
  const h = .84;
  for (const dx of [-w * .38, w * .38]) {
    for (const dz of [-d * .4, d * .4]) {
      const height = h - dz * Math.sin(tilt);
      tool.beam(iron, [x + dx, 0, z + dz], [x + dx, height + .06, z + dz], .085, 'metal');
    }
  }
  tool.box(0x87958f, [x, h, z], [w + .1, .085, d + .08], 'metal', [tilt, 0, 0]);
  const cols = 5, rows = 3;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const dz = (j + .5 - rows / 2) * d / rows;
    tool.box((i + j * 2) % 7 === 0 ? 0x496d91 : tone,
      [x + (i + .5 - cols / 2) * w / cols, h + .05 - dz * Math.sin(tilt), z + dz * Math.cos(tilt)],
      [w / cols - .03, .03, d / rows - .025], 'paint', [tilt, 0, 0]);
  }
  for (const dx of [-w * .49, w * .49]) tool.box(wood[3], [x + dx, h - .02, z], [.06, .09, d * .92], 'wood', [tilt, 0, 0]);
}

/** 能源区：风机、太阳能板、电池柜和配电盘组成一套可读的供电链路。 */
export function buildEnergy(kit: Kit, root: THREE.Group): Motion[] {
  const t = kit.at(root);

  const tower = child(root, 'Wind turbine', [-1.52, 0, -.82]);
  const m = kit.at(tower);
  for (const x of [-.62, .62]) for (const z of [-.57, .57]) {
    m.box(iron, [x, .12, z], [.32, .18, .31], 'metal');
    m.beam(iron, [x, .15, z], [x * .2, 4.6, z * .2], .096, 'metal');
    m.beam(0x97a39a, [x, .6, z], [-x * .84, 1.85, z * .78], .062, 'metal');
  }
  m.cone(0x789b9a, [0, 2.7, 0], [.26, 5.3, .27], 'metal');
  m.round(iron, [0, 4.05, 0], [.38, .14, .38]);
  m.barrel(teal, [0, 5.45, .03], [.5, .94, .49], [Math.PI / 2, 0, 0]);
  m.beam(iron, [0, 5.47, -.36], [0, 5.62, -1.1], .09, 'metal', true);
  m.box(cream, [0, 5.68, -.9], [.09, .38, .68], 'paint', [-.19, 0, 0]);
  const rotor = child(tower, 'Three-blade rotor', [0, 5.45, .6]);
  const rp = kit.at(rotor);
  rp.round(iron, [0, 0, -.012], [.37, .23, .37], 'metal', [Math.PI / 2, 0, 0]);
  rp.orb(gold, [0, 0, .13], [.42, .42, .34], 'paint');
  for (let i = 0; i < 3; i++) blade(rp, i * Math.PI * 2 / 3);

  // 太阳能板分两组错开高度，向瞭望塔方向形成斜面。
  panel(t, .95, -1.18, 2.25, 1.52, .4);
  panel(t, 1.75, .55, 2.05, 1.32, .46, 0x3a648d);
  panel(t, -.45, 1.62, 1.9, 1.15, .38, 0x2f5470);

  // 电池柜与配电盘。
  t.box(gold, [-1.72, .4, 1.1], [1.22, .7, .76], 'metal');
  t.box(iron, [-1.72, .82, 1.1], [1.3, .2, .82], 'metal');
  t.box(0x2f3d3d, [-1.72, .48, 1.49], [.8, .18, .04], 'metal');
  for (const x of [-2.02, -1.82, -1.62]) t.round(x < -1.8 ? 0xaad17e : 0xf5a35f, [x, .49, 1.52], [.075, .03, .075], 'glow', [Math.PI / 2, 0, 0]);
  t.box(0x506a68, [-1.7, 1.2, 1.1], [.94, .62, .66], 'metal');
  gauge(t, -1.92, 1.26, 1.44);
  gauge(t, -1.5, 1.26, 1.44);
  t.box(cream, [-1.7, 1.02, 1.44], [.5, .16, .02], 'paint');
  t.box(rust[1], [-1.7, 1.36, 1.44], [.1, .022, .02], 'paint', [0, 0, .6]);

  // 电缆沿甲板走线，把三处设备串在一起。
  hose(t, 0x353f3e, [[-1.52, 3.1, -.82], [-1.62, .32, -.8], [-1.75, .18, -.2], [-1.78, .2, .9], [-1.72, .72, 1.06]], .06);
  hose(t, 0x4b5555, [[.12, .6, -1.0], [.2, .12, -.6], [-.45, .1, .35], [-1.5, .1, .95], [-1.7, .38, 1.0]], .055);
  hose(t, 0x353f3e, [[1.9, .8, .62], [1.95, .15, .9], [1.4, .1, 1.4], [-.6, .1, 1.5], [-1.5, .22, 1.32]], .052);

  crate(t, 2.6, 0, -1.95, .62, 0xa9734a, .3);
  t.ring(0x4f6060, [-2.6, .45, -1.7], [.6, .6, .8], 'metal', [0, .3, 0]);
  railing(t, [-2.95, 0, -2.05], [2.95, 0, -2.05], 'rope', 5);
  railing(t, [2.95, 0, -1.9], [2.95, 0, 1.9], 'rope', 3);
  return [{ update(time) { rotor.rotation.z = -time * 1.32; } }];
}
