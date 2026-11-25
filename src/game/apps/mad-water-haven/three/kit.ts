import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { swatch, toonGradient } from './palette';

export type Finish = 'wood' | 'metal' | 'fabric' | 'paint' | 'matte' | 'glow' | 'glass';
type Batch = { position: number[]; normal: number[]; uv: number[]; color: number[]; index: number[] };

// 手工倒角盒：12 条棱各切一个斜面，卡通描边才有连续的转折高光。
function chamferedBox() {
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  const inside = .466, outside = .50;
  function face(points: Point3[]) {
    const a = new THREE.Vector3(...points[0]);
    const b = new THREE.Vector3(...points[1]).sub(a);
    const c = new THREE.Vector3(...points[2]).sub(a);
    if (b.cross(c).dot(a) < 0) points.reverse();
    const center = vertices.length / 3;
    points.forEach((p, i) => { vertices.push(...p); uv.push(i === 1 || i === 2 ? 1 : 0, i > 1 ? 1 : 0); });
    for (let i = 1; i < points.length - 1; i++) indices.push(center, center + i, center + i + 1);
  }
  for (let axis = 0; axis < 3; axis++) {
    const b = (axis + 1) % 3, c = (axis + 2) % 3;
    const at = (x: number, y: number, z: number): Point3 => {
      const p: Point3 = [0, 0, 0];
      p[axis] = x; p[b] = y; p[c] = z;
      return p;
    };
    for (const s of [-1, 1]) {
      face([at(s * outside, -inside, -inside), at(s * outside, inside, -inside),
        at(s * outside, inside, inside), at(s * outside, -inside, inside)]);
      for (const d of [-1, 1]) face([at(s * outside, d * inside, -inside), at(s * inside, d * outside, -inside),
        at(s * inside, d * outside, inside), at(s * outside, d * inside, inside)]);
    }
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) face([
    [x * outside, y * inside, z * inside], [x * inside, y * outside, z * inside], [x * inside, y * inside, z * outside]
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createKit() {
  const box = chamferedBox();
  const round = new THREE.CylinderGeometry(.5, .5, 1, 14);
  const cable = new THREE.CylinderGeometry(.5, .5, 1, 7, 1, true);
  const tapered = new THREE.CylinderGeometry(.34, .5, 1, 14);
  const orb = new THREE.IcosahedronGeometry(.5, 1);
  const shell = new THREE.SphereGeometry(.5, 18, 12);
  const tube = new THREE.TorusGeometry(.42, .08, 6, 18);
  const barrel = new THREE.LatheGeometry([
    [0, -.5], [.39, -.5], [.47, -.46], [.49, -.35], [.5, -.17], [.5, .17], [.49, .35],
    [.47, .46], [.39, .5], [0, .5]
  ].map(([x, y]) => new THREE.Vector2(x, y)), 18);
  // 阴影段不要压得太黑，木材在背光面仍保留暖色，符合广告里明亮的卡通感。
  const gradient = toonGradient(104, 188);
  const gradientFlat = toonGradient(122, 204);
  const toon = (map: THREE.DataTexture) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: map });
  const glass = new THREE.MeshStandardMaterial({
    color: swatch(0xa9e0d4), roughness: .22, metalness: .1, transparent: true, opacity: .55, side: THREE.DoubleSide
  });
  const materials: Record<Finish, THREE.Material> = {
    wood: toon(gradient), metal: toon(gradient), fabric: toon(gradientFlat), paint: toon(gradientFlat),
    // 舷窗和炉火不参与雾衰减，水下镜头里仍能看见暖色光点。
    matte: toon(gradientFlat), glass, glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })
  };
  // 卡通描边：背面放大，墨线只包住轮廓，不参与光照。
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1208, side: THREE.BackSide });
  const chunks = new Map<THREE.Group, Map<Finish, Batch[]>>();
  const mounted: THREE.BufferGeometry[] = [];
  const object = new THREE.Object3D();
  const normalMatrix = new THREE.Matrix3();
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), color = new THREE.Color();
  const start = new THREE.Vector3(), end = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0);

  function append(group: THREE.Group, geometry: THREE.BufferGeometry, finish: Finish, hex: number) {
    let batches = chunks.get(group);
    if (!batches) chunks.set(group, batches = new Map());
    const pos = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
    let parts = batches.get(finish);
    if (!parts) batches.set(finish, parts = []);
    let batch = parts[parts.length - 1];
    if (!batch || batch.position.length / 3 + pos.count > 60_000) {
      batch = { position: [], normal: [], uv: [], color: [], index: [] };
      parts.push(batch);
    }
    const indices = geometry.getIndex();
    const offset = batch.position.length / 3;
    object.updateMatrix();
    normalMatrix.getNormalMatrix(object.matrix);
    color.setHex(hex).convertSRGBToLinear();
    const { x, y, z } = object.scale;
    const longest = x >= y && x >= z ? 'x' : y >= z ? 'y' : 'z';
    for (let i = 0; i < pos.count; i++) {
      point.fromBufferAttribute(pos, i);
      normal.fromBufferAttribute(n, i);
      if (geometry === box && finish === 'wood') {
        // 木纹沿构件长轴延伸，窄端面另取横向坐标，避免整块木头看起来像平涂色块。
        const across = longest === 'y'
          ? (Math.abs(normal.x) > .65 ? 'z' : 'x')
          : (Math.abs(normal.y) > .65 ? (longest === 'x' ? 'z' : 'x') : 'y');
        batch.uv.push(point[longest] * object.scale[longest] * .34 + hex % 23 * .137,
          point[across] * object.scale[across] * 1.55 + hex % 11 * .19);
      } else batch.uv.push(uv?.getX(i) ?? point.x, uv?.getY(i) ?? point.z);
      const shade = .91 + .09 * THREE.MathUtils.clamp(point.y + .5, 0, 1);
      point.applyMatrix4(object.matrix);
      normal.applyMatrix3(normalMatrix).normalize();
      batch.position.push(point.x, point.y, point.z);
      batch.normal.push(normal.x, normal.y, normal.z);
      batch.color.push(color.r * shade, color.g * shade, color.b * shade);
    }
    for (let i = 0; i < (indices?.count ?? pos.count); i++) batch.index.push(offset + (indices?.getX(i) ?? i));
  }

  function shape(group: THREE.Group, geometry: THREE.BufferGeometry, hex: number, center: Point3, size: Point3, finish: Finish, rotation: Point3) {
    object.position.set(...center);
    object.scale.set(...size);
    object.rotation.set(...rotation);
    append(group, geometry, finish, hex);
  }

  const zero: Point3 = [0, 0, 0];
  const unit: Point3 = [1, 1, 1];

  function at(group: THREE.Group) {
    return {
      box(hex: number, center: Point3, size: Point3, finish: Finish = 'wood', rotation = zero) {
        shape(group, box, hex, center, size, finish, rotation);
      },
      round(hex: number, center: Point3, size: Point3, finish: Finish = 'metal', rotation = zero) {
        shape(group, round, hex, center, size, finish, rotation);
      },
      cone(hex: number, center: Point3, size: Point3, finish: Finish = 'matte', rotation = zero) {
        shape(group, tapered, hex, center, size, finish, rotation);
      },
      orb(hex: number, center: Point3, size: Point3, finish: Finish = 'matte', rotation = zero) {
        shape(group, orb, hex, center, size, finish, rotation);
      },
      shell(hex: number, center: Point3, size: Point3, finish: Finish = 'metal', rotation = zero) {
        shape(group, shell, hex, center, size, finish, rotation);
      },
      ring(hex: number, center: Point3, size: Point3, finish: Finish = 'metal', rotation = zero) {
        shape(group, tube, hex, center, size, finish, rotation);
      },
      barrel(hex: number, center: Point3, size: Point3, rotation = zero) {
        shape(group, barrel, hex, center, size, 'paint', rotation);
      },
      beam(hex: number, a: Point3, b: Point3, width: number, finish: Finish = 'wood', circular = false) {
        start.set(...a);
        end.set(...b).sub(start);
        object.position.copy(start).addScaledVector(end, .5);
        object.scale.set(width, end.length(), width);
        object.quaternion.setFromUnitVectors(axis, end.normalize());
        append(group, circular ? (width < .10 ? cable : round) : box, finish, hex);
      },
      surface(geometry: THREE.BufferGeometry, hex: number, finish: Finish, position = zero, rotation = zero) {
        shape(group, geometry, hex, position, unit, finish, rotation);
        geometry.dispose();
      }
    };
  }

  return {
    at,
    mount() {
      // 每个可替换或动画节点独立合批。批次控制在 WebGL1 的 16 位索引范围内。
      for (const [group, batches] of chunks) for (const [finish, parts] of batches) for (const data of parts) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
        geometry.setIndex(data.index);
        const mesh = new THREE.Mesh(geometry, materials[finish]);
        mesh.castShadow = group.userData.castShadow !== false && finish !== 'glow';
        mesh.receiveShadow = finish !== 'glow';
        group.add(mesh);
        // 描边不能靠放大整个节点：合并后的顶点离原点很远，缩放会把屋顶推出去遮住表面。
        // 这里沿每个顶点法线外扩固定距离，得到贴合轮廓的背面壳。
        if (finish !== 'glow' && finish !== 'glass' && data.position.length / 3 > 12) {
          const shell = new Float32Array(data.position.length);
          for (let i = 0; i < data.position.length; i++) shell[i] = data.position[i] + data.normal[i] * .022;
          const outlineGeometry = new THREE.BufferGeometry();
          outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shell, 3));
          outlineGeometry.setIndex(data.index);
          const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
          outline.castShadow = false;
          outline.receiveShadow = false;
          group.add(outline);
          mounted.push(outlineGeometry);
        }
        mounted.push(geometry);
      }
      chunks.clear();
    },
    dispose() {
      [box, round, cable, tapered, orb, shell, tube, barrel, ...mounted].forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
      outlineMaterial.dispose();
      gradient.dispose();
      gradientFlat.dispose();
    }
  };
}

export type Kit = ReturnType<typeof createKit>;
export type Tools = ReturnType<Kit['at']>;

export function child(parent: THREE.Object3D, name: string, position: Point3 = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  return group;
}

export function rotated(parent: THREE.Object3D, name: string, position: Point3, turn: number) {
  const group = child(parent, name, position);
  group.rotation.y = turn;
  return group;
}
