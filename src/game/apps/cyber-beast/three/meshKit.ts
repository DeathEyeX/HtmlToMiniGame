import * as THREE from 'three-platformize';

export type Position = [number, number, number];

export function createMeshKit() {
  const chamfer = new THREE.Shape();
  chamfer
    .moveTo(-.36, -.44).lineTo(.36, -.44).lineTo(.44, -.36).lineTo(.44, .36)
    .lineTo(.36, .44).lineTo(-.36, .44).lineTo(-.44, .36).lineTo(-.44, -.36).closePath();
  const cube = new THREE.ExtrudeGeometry(chamfer, {
    depth: .88, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 1, steps: 1
  }).center();
  const joint = new THREE.IcosahedronGeometry(.5, 1);
  const cylinder = new THREE.CylinderGeometry(.5, .5, 1, 10);
  const taper = new THREE.CylinderGeometry(.31, .5, 1, 6);
  const spike = new THREE.ConeGeometry(.5, 1, 5);
  const up = new THREE.Vector3(0, 1, 0);

  function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
    position: Position, size: Position, rotation: Position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  }

  function align(mesh: THREE.Mesh, from: Position, to: Position, width: number, depth: number) {
    const start = new THREE.Vector3(...from);
    const direction = new THREE.Vector3(...to).sub(start);
    mesh.position.copy(start).addScaledVector(direction, .5);
    mesh.scale.set(width, direction.length(), depth);
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
    return mesh;
  }

  return {
    add,
    box: (parent: THREE.Object3D, material: THREE.Material, at: Position, size: Position, rotation?: Position) =>
      add(parent, cube, material, at, size, rotation),
    joint: (parent: THREE.Object3D, material: THREE.Material, at: Position, size: Position) =>
      add(parent, joint, material, at, size),
    link(parent: THREE.Object3D, material: THREE.Material, from: Position, to: Position, width: number,
      profile: 'round' | 'armor' | 'spike' = 'round', depth = width) {
      const geometry = profile === 'spike' ? spike : profile === 'armor' ? taper : cylinder;
      return align(add(parent, geometry, material, from, [1, 1, 1]), from, to, width, depth);
    },
    cable(parent: THREE.Object3D, material: THREE.Material, points: Position[], radius: number) {
      const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
      return add(parent, new THREE.TubeGeometry(curve, 18, radius, 5, false), material, [0, 0, 0], [1, 1, 1]);
    }
  };
}
