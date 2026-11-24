import * as THREE from 'three-platformize';
import type { Position } from '../content';

type Shape = 'box' | 'round' | 'orb';
type Finish = 'plain' | 'grain' | 'paint';

export function swatch(color: number) {
  return new THREE.Color(color).convertSRGBToLinear();
}

export function createRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function pixelTexture(grain: boolean) {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  const random = createRandom(grain ? 16 : 51);
  for (let y = 0; y < size; y++) {
    const streak = grain ? Math.floor(random() * 9) : 0;
    for (let x = 0; x < size; x++) {
      const index = (x + y * size) * 4;
      const notch = grain ? (x + y * 9) % 17 < 5 && y % 5 === 0 : random() < .11;
      const level = 255 - streak - (notch ? 19 : 0) - Math.floor(random() * 8);
      data.set([level, level, level, 255], index);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createModelBuilder() {
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    round: new THREE.CylinderGeometry(.5, .5, 1, 12),
    orb: new THREE.IcosahedronGeometry(.5, 0)
  };
  const maps = { plain: null, grain: pixelTexture(true), paint: pixelTexture(false) };
  const chunks = new Map<THREE.Group, Map<string, { shape: Shape; material: THREE.Material; matrices: THREE.Matrix4[] }>>();
  const materials = new Map<string, THREE.Material>();
  const transform = new THREE.Object3D();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);

  function add(group: THREE.Group, shape: Shape, color: number, finish: Finish) {
    const key = `${color}:${finish}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color: swatch(color), map: maps[finish] });
      materials.set(key, material);
    }
    let groupBatches = chunks.get(group);
    if (!groupBatches) chunks.set(group, groupBatches = new Map());
    const batchKey = `${shape}:${key}`;
    let batch = groupBatches.get(batchKey);
    if (!batch) groupBatches.set(batchKey, batch = { shape, material, matrices: [] });
    transform.updateMatrix();
    batch.matrices.push(transform.matrix.clone());
  }

  function shape(group: THREE.Group, kind: Shape, color: number, center: Position, size: Position, finish: Finish = 'plain', rotation: Position = [0, 0, 0]) {
    transform.position.set(...center);
    transform.scale.set(...size);
    transform.rotation.set(...rotation);
    add(group, kind, color, finish);
  }

  function groupTools(group: THREE.Group) {
    return {
      box(color: number, x: number, y: number, z: number, w: number, h: number, d: number, finish: Finish = 'plain', rotation?: Position) {
        shape(group, 'box', color, [x, y, z], [w, h, d], finish, rotation);
      },
      round(color: number, x: number, y: number, z: number, diameter: number, height: number, rotation?: Position) {
        shape(group, 'round', color, [x, y, z], [diameter, height, diameter], 'paint', rotation);
      },
      pebble(color: number, x: number, y: number, z: number, w: number, h: number, d: number, rotation?: Position) {
        shape(group, 'orb', color, [x, y, z], [w, h, d], 'plain', rotation);
      },
      beam(color: number, a: Position, b: Position, width: number) {
        start.set(...a);
        end.set(...b).sub(start);
        transform.position.copy(start).addScaledVector(end, .5);
        transform.scale.set(width, end.length(), width);
        transform.quaternion.setFromUnitVectors(axis, end.normalize());
        add(group, 'box', color, 'plain');
      }
    };
  }

  function mount(shadows: Set<THREE.Group>) {
    // 同色的重复零件共用一个实例批次。转动镜头时可以看到每一面的部件。
    for (const [group, batches] of chunks) {
      for (const { shape, material, matrices } of batches.values()) {
        const mesh = new THREE.InstancedMesh(geometry[shape], material, matrices.length);
        matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.castShadow = mesh.receiveShadow = shadows.has(group);
        group.add(mesh);
      }
    }
    chunks.clear();
  }

  return {
    groupTools, mount,
    dispose() {
      Object.values(geometry).forEach(item => item.dispose());
      materials.forEach(item => item.dispose());
      maps.grain.dispose();
      maps.paint.dispose();
    }
  };
}

export type ModelBuilder = ReturnType<typeof createModelBuilder>;
