import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { crate, drum, line, railing } from './decks';
import { blue, child, cream, iron, rope, timber, wood, type Model, type Tools } from './model';
import { waterHeight, type Waterline } from './ocean';
import { hose, solar } from './production';
import { rotated, type Motion } from './shelter';

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
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: .049, bevelEnabled: true, bevelSize: .024, bevelThickness: .015,
    bevelSegments: 1, curveSegments: 4, steps: 1 });
  tool.surface(geometry, cream, 'metal', [0, 0, .017], [.06, .09, angle]);
  const x = -Math.sin(angle) * 1.81, y = Math.cos(angle) * 1.81;
  tool.box(0xb85f4b, [x - Math.cos(angle) * .052, y - Math.sin(angle) * .052, .082], [.265, .146, .023], 'paint', [0, 0, angle]);
}

export function buildPower(model: Model, root: THREE.Group): Motion[] {
  const t = model.at(root);
  const tower = child(root, 'Wind turbine', [-.53, 0, -1.01]);
  const mast = model.at(tower);
  for (const x of [-.55, .55]) for (const z of [-.51, .51]) {
    mast.box(iron, [x, .11, z], [.30, .17, .29], 'metal');
    mast.beam(iron, [x, .14, z], [x * .20, 4.31, z * .20], .094, 'metal');
    mast.beam(0x97a39a, [x, .54, z], [-x * .83, 1.72, z * .75], .061, 'metal');
  }
  mast.cone(0x789b9a, [0, 2.54, 0], [.25, 5.02, .26], 'metal');
  mast.round(iron, [0, 3.80, 0], [.37, .14, .37]);
  mast.barrel(teal, [0, 5.16, .03], [.48, .91, .47], [Math.PI / 2, 0, 0]);
  mast.beam(iron, [0, 5.177, -.34], [0, 5.32, -1.04], .087, 'metal', true);
  mast.box(cream, [0, 5.38, -.86], [.09, .37, .66], 'paint', [-.19, 0, 0]);
  const rotor = child(tower, 'Three-blade rotor', [0, 5.16, .58]);
  const rotorParts = model.at(rotor);
  rotorParts.round(iron, [0, 0, -.012], [.36, .23, .36], 'metal', [Math.PI / 2, 0, 0]);
  rotorParts.orb(gold, [0, 0, .13], [.41, .41, .34], 'paint');
  for (let i = 0; i < 3; i++) blade(rotorParts, i * Math.PI * 2 / 3);

  solar(t, 1.40, -.95, 2.20, 1.49);
  solar(t, 1.47, .69, 2.12, 1.30, 0x3a648d);
  t.box(gold, [-1.78, .39, .53], [1.20, .69, .75], 'metal');
  t.box(iron, [-1.78, .80, .53], [1.28, .19, .81], 'metal');
  t.box(iron, [-1.78, .48, .921], [.76, .14, .035], 'metal');
  for (const x of [-2.05, -1.85, -1.65]) t.round(x < -1.8 ? 0xaad17e : 0xf5a35f, [x, .482, .943], [.073, .029, .073], 'glow', [Math.PI / 2, 0, 0]);
  for (const x of [-2.05, -1.54]) t.round(0x6d6054, [x, .936, .62], [.14, .115, .14]);
  hose(t, 0x353f3e, [[-.53, 2.92, -.92], [-.58, .30, -.90], [-1.01, .15, -.63], [-1.64, .20, -.22], [-1.65, .74, .18]], .065);
  hose(t, 0x4b5555, [[1.12, .67, .86], [1.12, .12, .99], [.65, .09, 1.13], [-.73, .095, 1.30], [-1.59, .096, 1.01], [-1.57, .38, .89]], .057);
  railing(t, [-2.66, 0, -1.81], [2.65, 0, -1.81], 'rope', 4);
  return [{ update(time) { rotor.rotation.z = -time * 1.29; } }];
}

function fishingNet(tool: Tools, frame: Point3[], width: number, depth: number) {
  const [a, b] = frame;
  const position = (u: number, v: number): Point3 => [a[0] + (b[0] - a[0]) * u + v * depth, a[1] - v * width - .23 * Math.sin(u * Math.PI) * v,
    a[2] + (b[2] - a[2]) * u + .13 * Math.sin(u * Math.PI) * v];
  for (let u = 0; u <= 12; u++) {
    const start = position(u / 12, 0), middle = position(u / 12, .5), end = position(u / 12, 1);
    tool.beam(rope, start, middle, .024, 'fabric', true);
    tool.beam(rope, middle, end, .021, 'fabric', true);
    if (u % 3 === 0) tool.orb(0xd68a4e, end, [.13, .12, .12], 'paint');
  }
  for (let v = 1; v <= 6; v++) line(tool, rope, position(0, v / 6), position(1, v / 6), .23 * v / 6, .022);
}

export function buildFishery(model: Model, root: THREE.Group): Motion[] {
  const t = model.at(root);
  railing(t, [-2.32, 0, -1.70], [-2.32, 0, 1.86], 'rope', 3, .76);
  railing(t, [-2.20, 0, 2.35], [-.29, 0, 2.35], 'wood', 2, .70);
  railing(t, [2.33, 0, -2.15], [2.33, 0, -.62], 'rope', 2, .68);
  const fishBench = model.at(rotated(root, 'Fish sorting table', [-1.58, 0, -.60], -.11));
  fishBench.box(wood[2], [0, .77, 0], [1.12, .13, 1.66]);
  for (const x of [-.43, .43]) for (const z of [-.65, .65]) fishBench.box(timber, [x, .34, z], [.13, .71, .14]);
  fishBench.box(0x5d8a7d, [0, .86, -.08], [.69, .065, 1.08], 'paint');
  for (let i = 0; i < 3; i++) {
    const z = -.41 + i * .33;
    fishBench.orb(i === 1 ? 0x87c5ba : 0x73a6b3, [0, .954, z], [.54, .13, .23], 'paint', [0, -.22, 0]);
    fishBench.box(0x5c8e9a, [-.28, .94, z - .058], [.20, .057, .19], 'paint', [0, .6, 0]);
    fishBench.orb(0x25363c, [.168, 1.0, z + .047], [.042, .055, .048]);
  }
  for (const [x, z] of [[-.82, 1.24], [-1.76, 1.55], [.65, -1.74]]) {
    t.cone(0xb18354, [x, .23, z], [.60, .48, .60], 'fabric', [Math.PI, 0, 0]);
    t.round(0x5c4435, [x, .475, z], [.55, .043, .55], 'matte');
    t.ring(rope, [x, .49, z], [.63, .63, .70], 'fabric', [Math.PI / 2, 0, 0]);
  }
  crate(t, 1.45, 0, -1.86, .69);
  drum(t, [2.02, .42, -1.22], .58, .82, blue[3]);

  const crane = model.at(rotated(root, 'Hand winch and jib', [1.48, 0, .76], .24));
  crane.box(iron, [0, .102, 0], [.84, .19, .86], 'metal');
  crane.beam(gold, [0, .14, 0], [0, 2.82, 0], .205, 'metal');
  crane.beam(gold, [0, 2.76, 0], [1.12, 2.53, .38], .18, 'metal');
  crane.beam(iron, [0, 1.75, 0], [1.02, 2.54, .34], .099, 'metal');
  crane.round(iron, [1.13, 2.57, .38], [.38, .17, .38], 'metal', [Math.PI / 2, 0, -.17]);
  crane.round(rope, [.11, 1.02, .13], [.39, .29, .39], 'fabric', [Math.PI / 2, 0, 0]);
  crane.beam(iron, [.12, 1.0, .32], [.34, 1.16, .32], .054, 'metal', true);
  line(crane, 0x605a45, [.12, 1.13, .15], [1.14, 2.69, .40], .032, .035);
  crane.beam(rope, [1.14, 2.61, .40], [1.14, .63, .40], .038, 'fabric', true);
  crane.ring(iron, [1.14, .61, .40], [.19, .23, .95], 'metal');

  const net: [Point3, Point3] = [[2.41, .56, -.14], [2.54, .56, 1.59]];
  for (const [x, y, z] of net) t.beam(timber, [x, -.09, z], [x, y + .11, z], .114);
  line(t, rope, net[0], net[1], .08, .044);
  fishingNet(t, net, .67, .65);
  const pole = child(root, 'Fishing rod', [-2.03, .63, 2.10]);
  const rod = model.at(pole);
  rod.beam(wood[0], [0, -.23, 0], [-.27, .42, .52], .063, 'wood', true);
  rod.beam(0x8f835a, [-.27, .42, .52], [-.43, .66, 1.05], .035, 'wood', true);
  rod.beam(rope, [-.43, .66, 1.05], [-.57, -.96, 1.30], .014, 'fabric', true);
  rod.round(iron, [-.12, -.04, .15], [.19, .09, .19], 'metal', [Math.PI / 2, 0, .33]);
  return [{ update(time) { pole.rotation.x = .036 * Math.sin(time * 1.25); } }];
}

const hullStations = [[-2.00, .04, .40], [-1.56, .56, .17], [-.92, .81, .04], [-.12, .94, .01],
  [.76, .88, .04], [1.45, .67, .12], [1.92, .37, .30], [2.22, .025, .54]];

function hullBand(t: Tools, color: number, lower: number, upper: number, side: number, inside: boolean) {
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  const s = inside ? -1 : 1;
  for (const [i, [z, width, rise]] of hullStations.entries()) {
    for (const u of [lower, upper]) {
      vertices.push(side * width * (.43 + .57 * Math.sqrt(u)) * (inside ? .93 : 1), rise + u * .61 - (inside ? .07 : .14), z);
      uv.push((z + 2) * .48, u * 1.9);
    }
    if (i > 0) {
      const a = (i - 1) * 2, b = i * 2;
      if (side * s > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
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

export function buildSkiff(model: Model, scene: THREE.Group, dock: THREE.Group): { waterline: Waterline; motion: Motion } {
  const waterline: Waterline = { position: [-.49, -.05, 11.86], size: [1.66, 4.04], turn: -.78, roundness: .81 };
  const boat = rotated(scene, 'Moored wooden skiff', waterline.position, waterline.turn);
  const t = model.at(boat);
  for (const side of [-1, 1]) {
    hullBand(t, 0x658983, 0, .29, side, false);
    hullBand(t, 0x588783, .285, .61, side, false);
    hullBand(t, 0xc39669, .603, .84, side, false);
    hullBand(t, 0xa5734c, .835, 1, side, false);
    hullBand(t, 0x936747, .04, .99, side, true);
    for (let i = 1; i < hullStations.length; i++) {
      const [z0, x0, y0] = hullStations[i - 1], [z1, x1, y1] = hullStations[i];
      t.beam(timber, [side * x0, y0 + .47, z0], [side * x1, y1 + .47, z1], .103);
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
  for (let i = 0; i < 6; i++) t.box(wood[i % wood.length], [(i - 2.5) * .165, .099, .08], [.155, .095, 2.76 - Math.abs(i - 2.5) * .17]);
  for (const [z, w] of [[-1.23, 1.20], [-.16, 1.68], [1.07, 1.49]]) {
    t.box(wood[3], [0, .41, z], [w, .11, .38]);
    t.box(timber, [0, .30, z], [w * .88, .15, .13]);
  }
  crate(t, .22, .16, .57, .49);
  t.beam(wood[1], [-.57, .44, -.52], [.66, .49, .83], .072, 'wood', true);
  t.box(wood[3], [.73, .50, .97], [.23, .069, .49], 'wood', [0, .75, 0]);
  t.ring(rope, [.30, .49, -1.17], [.34, .36, .66], 'fabric', [Math.PI / 2, 0, 0]);
  t.round(wood[2], [0, .85, -1.96], [.13, .19, .13], 'wood');
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
        boat.position.x = -.49 + .13 * Math.sin(time * .52);
        boat.position.z = 11.86 + .11 * Math.sin(time * .63 + .7);
        boat.position.y = -.055 + waterHeight(boat.position.x, boat.position.z, time) * .87;
        boat.rotation.set(.041 * Math.sin(time * .83), -.78 + .075 * Math.sin(time * .47), .05 * Math.sin(time * .89 + 1.4));
        waterline.position[0] = boat.position.x;
        waterline.position[2] = boat.position.z;
        waterline.turn = boat.rotation.y;
        // 绘制前更新两端的世界变换，避免缆绳滞后一帧。
        boat.updateWorldMatrix(true, false);
        dock.updateWorldMatrix(true, false);
        boat.localToWorld(cleat.set(0, .88, -1.96));
        dock.localToWorld(post.set(-1.24, .71, 2.35));
        for (let i = 0; i < points.count; i++) {
          const a = i / (points.count - 1);
          points.setXYZ(i, THREE.MathUtils.lerp(cleat.x, post.x, a), THREE.MathUtils.lerp(cleat.y, post.y, a) - .61 * a * (1 - a),
            THREE.MathUtils.lerp(cleat.z, post.z, a));
        }
        points.needsUpdate = true;
      },
      dispose() { tether.dispose(); material.dispose(); }
    }
  };
}
