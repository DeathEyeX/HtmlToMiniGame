import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import type { Tools } from './kit';
import { cream, iron, rust } from './palette';

/** 沿折线生成管件，弯头由 Catmull-Rom 自动圆化。 */
export function hose(t: Tools, color: number, points: Point3[], diameter: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  t.surface(new THREE.TubeGeometry(curve, (points.length - 1) * 4, diameter / 2, 7, false), color, 'metal');
}

export function gauge(t: Tools, x: number, y: number, z: number) {
  t.round(iron, [x, y, z], [.31, .095, .31], 'metal', [Math.PI / 2, 0, 0]);
  t.round(cream, [x, y, z + .051], [.245, .026, .245], 'paint', [Math.PI / 2, 0, 0]);
  t.box(rust[0], [x + .025, y + .027, z + .067], [.11, .023, .018], 'paint', [0, 0, .78]);
}

export function valve(t: Tools, x: number, y: number, z: number, color = 0xc05c3c) {
  t.round(iron, [x, y, z], [.17, .16, .17], 'metal');
  t.ring(color, [x, y + .12, z], [.42, .42, .5], 'paint', [Math.PI / 2, 0, 0]);
  t.beam(color, [x - .21, y + .12, z], [x + .21, y + .12, z], .035, 'paint', true);
}
