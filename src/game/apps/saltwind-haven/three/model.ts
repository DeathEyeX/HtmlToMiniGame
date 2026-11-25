import * as THREE from 'three-platformize';
import type { Point3 } from '../content';

// 卡通风格高饱和度调板，参考疯狂水世界广告色彩。
export const wood = [0xd4813a, 0xe89a4a, 0xc97030, 0xf0aa58, 0xd98840, 0xea9e52];
export const timber = 0x8a4418;
export const rope = 0xd4b06a;
export const iron = 0x3c5058;
export const cream = 0xfbf0cc;
export const rust = [0xd44e22, 0xe86030, 0xc04418, 0xf07238, 0xc84e20];
export const blue = [0x1878cc, 0x1e96e0, 0x1470b8, 0x2290ca];
export const swatch = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();

export function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

type Finish = 'wood' | 'metal' | 'fabric' | 'paint' | 'matte' | 'glow';
type Batch = { position: number[]; normal: number[]; uv: number[]; color: number[]; index: number[] };

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

export function createModel() {
  const box = chamferedBox();
  const round = new THREE.CylinderGeometry(.5, .5, 1, 12);
  const cable = new THREE.CylinderGeometry(.5, .5, 1, 7, 1, true);
  const tapered = new THREE.CylinderGeometry(.34, .5, 1, 12);
  const orb = new THREE.IcosahedronGeometry(.5, 1);
  const tube = new THREE.TorusGeometry(.42, .08, 6, 16);
  const barrel = new THREE.LatheGeometry([
    [0, -.5], [.39, -.5], [.47, -.46], [.49, -.35], [.5, -.17], [.5, .17], [.49, .35],
    [.47, .46], [.39, .5], [0, .5]
  ].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  // 3 阶梯度图：暗部 / 中间调 / 亮部，产生卡通硬边着色。
  function toonGradient(shadow: number, mid: number) {
    const steps = [shadow, shadow, mid, mid, 255, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    const tex = new THREE.DataTexture(data, steps.length, 1);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }
  const gradient = toonGradient(80, 180);
  const gradientFlat = toonGradient(100, 195); // 布料/哑光用较浅的阴影
  const toon = (g: THREE.DataTexture) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: g });
  const materials = {
    wood: toon(gradient), metal: toon(gradient), fabric: toon(gradientFlat),
    paint: toon(gradientFlat), matte: toon(gradientFlat),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true })
  };
  // 描边材质：BackSide 略微放大，产生卡通墨线轮廓。
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
        // 木纹沿构件的长轴延伸，窄端面使用独立的横截取样。
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
      // 每个可替换或动画节点各自合批。WebGL1 批次控制在 16 位索引范围内。
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
          // glow 和极细构件不加描边，避免描边宽度超过构件本身。
          if (finish !== 'glow' && data.position.length / 3 > 12) {
            const outline = new THREE.Mesh(geometry, outlineMaterial);
            outline.scale.setScalar(1.045);
            outline.castShadow = false;
            outline.receiveShadow = false;
            group.add(outline);
          }
          mounted.push(geometry);
        }
      chunks.clear();
    },
    dispose() {
      [box, round, cable, tapered, orb, tube, barrel, ...mounted].forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
      outlineMaterial.dispose();
      gradient.dispose();
      gradientFlat.dispose();
    }
  };
}

export type Model = ReturnType<typeof createModel>;
export type Tools = ReturnType<Model['at']>;

export function child(parent: THREE.Group, name: string, position: Point3 = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  return group;
}
