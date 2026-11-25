import * as THREE from 'three-platformize';
import { createMeshKit } from './meshKit';

const floorLevel = -.18;
export const deckHeight = .63;
const quarterTurn = Math.PI / 2;

export function createStage(scene: THREE.Scene) {
  const { add, box } = createMeshKit();
  const painted = (color: number) => new THREE.Color(color).convertSRGBToLinear();
  const steel = new THREE.MeshStandardMaterial({ color: painted(0x253043), metalness: .42, roughness: .48 });
  const panel = new THREE.MeshStandardMaterial({ color: painted(0x182535), metalness: .28, roughness: .64 });
  const bevel = new THREE.MeshStandardMaterial({ color: painted(0x485d78), metalness: .55, roughness: .4 });
  const light = (color: number) => new THREE.MeshBasicMaterial({ color: painted(color), toneMapped: false });
  const cyan = light(0x71ffe4);
  const teal = light(0x28616c);
  const rose = light(0xff436f);
  const violet = light(0x713f79);
  const gold = light(0xe1a46c);
  const turntable = new THREE.Group();
  scene.add(turntable);

  function cylinder(parent: THREE.Object3D, material: THREE.Material, top: number, bottom: number,
    height: number, y: number, segments = 64) {
    add(parent, new THREE.CylinderGeometry(top, bottom, height, segments), material, [0, y, 0], [1, 1, 1]);
  }

  function ring(parent: THREE.Object3D, material: THREE.Material, radius: number, thickness: number, y: number,
    start = 0, sweep = Math.PI * 2) {
    add(parent, new THREE.RingGeometry(radius - thickness, radius, Math.max(8, Math.ceil(sweep * 12)), 1, start, sweep),
      material, [0, y, 0], [1, 1, 1], [-quarterTurn, 0, 0]);
  }

  function floorGlow(color: number, opacity: number, shadow = false) {
    return new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 tint;
        uniform float opacity;
        void main() {
          float fade = 1.0 - smoothstep(0.0, 0.5, distance(vUv, vec2(0.5)));
          gl_FragColor = vec4(tint, opacity * fade * fade);
        }`,
      transparent: true,
      depthWrite: false,
      blending: shadow ? THREE.NormalBlending : THREE.AdditiveBlending
    });
  }

  const floor = light(0x161f2d);
  const plane = new THREE.PlaneGeometry(1, 1);
  add(scene, plane, floor, [0, floorLevel, 0], [115, 115, 1], [-quarterTurn, 0, 0]);
  add(scene, plane, floorGlow(0x126673, .38), [-2, floorLevel + .005, -1], [19, 19, 1], [-quarterTurn, 0, 0]);
  add(scene, plane, floorGlow(0x66244b, .42), [4.5, floorLevel + .008, -1], [17, 16, 1], [-quarterTurn, 0, 0]);
  const grid = new THREE.GridHelper(72, 54, 0x33465c, 0x283448);
  grid.position.y = floorLevel + .013;
  Object.assign(grid.material, { transparent: true, opacity: .27, depthWrite: false });
  scene.add(grid);

  cylinder(scene, steel, 4.26, 4.56, .24, -.046, 48);
  cylinder(scene, panel, 4.12, 4.23, .21, .168, 48);
  cylinder(scene, teal, 4.15, 4.15, .04, .238, 64);
  cylinder(scene, bevel, 4.15, 4.33, .12, .32, 64);
  cylinder(turntable, steel, 4.02, 4.19, .23, .5);
  cylinder(turntable, cyan, 4.115, 4.136, .035, .492);
  cylinder(turntable, panel, 3.92, 3.98, .027, deckHeight - .0135);
  ring(turntable, teal, 3.86, .025, deckHeight + .006);
  ring(turntable, teal, 2.69, .015, deckHeight + .006);
  ring(turntable, steel, 1.99, .014, deckHeight + .006);
  ring(scene, violet, 4.89, .019, floorLevel + .022);
  ring(scene, teal, 5.61, .016, floorLevel + .022);
  ring(scene, teal, 8.33, .017, floorLevel + .022);

  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    const x = Math.sin(angle);
    const z = Math.cos(angle);
    const accent = index % 4 === 1 ? rose : cyan;
    ring(turntable, accent, 3.75, .047, deckHeight + .009, angle + .05, .56);
    ring(scene, index % 2 ? violet : teal, 6.04, .05, floorLevel + .025, angle + .11, .51);
    box(scene, steel, [x * 4.21, .20, z * 4.21], [.72, .35, .48], [0, angle, 0]);
    box(scene, accent, [x * 4.46, .23, z * 4.46], [.4, .067, .025], [0, angle, 0]);
    box(scene, panel, [x * 6.51, -.115, z * 6.51], [1.15, .135, 1.6], [0, angle, 0]);
    box(scene, teal, [x * 6.65, -.037, z * 6.65], [.89, .015, .035], [0, angle, 0]);
    for (let mark = -1; mark <= 1; mark++) {
      box(turntable, gold, [x * 3.34 + z * mark * .12, deckHeight + .011, z * 3.34 - x * mark * .12],
        [.052, .018, .2], [0, angle + .28, 0]);
    }
  }

  // Soft contact shadows follow the stance feet without a second geometry pass on WebGL1.
  const shadow = floorGlow(0x010307, .84, true);
  const bodyShadow = add(turntable, plane, shadow, [0, deckHeight + .013, -.12], [3.5, 5.37, 1], [-quarterTurn, 0, 0]);
  const footShadows = Array.from({ length: 4 }, () =>
    add(turntable, plane, shadow, [0, deckHeight + .015, 0], [1.29, 1.43, 1], [-quarterTurn, 0, 0]));

  // The back faces form the hangar walls and keep the near side open when a narrow viewport pulls back.
  const wall = new THREE.MeshBasicMaterial({
    color: painted(0x151c2a), toneMapped: false, side: THREE.BackSide
  });
  const wallRail = new THREE.MeshBasicMaterial({
    color: painted(0x263443), toneMapped: false, side: THREE.BackSide
  });
  const wallRadius = 33;
  add(scene, new THREE.CylinderGeometry(wallRadius, wallRadius, 11, 32, 1, true),
    wall, [0, floorLevel + 5.5, 0], [1, 1, 1]);
  for (const y of [.27, 2.1, 5.6]) {
    add(scene, new THREE.CylinderGeometry(wallRadius - .09, wallRadius - .09, .12, 32, 1, true),
      wallRail, [0, y, 0], [1, 1, 1]);
  }
  for (let index = 0; index < 16; index++) {
    const angle = index * Math.PI / 8;
    const radius = wallRadius - .4;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    box(scene, panel, [x, 3.95, z], [.66, 8.26, .58], [0, angle, 0]);
    box(scene, index % 3 ? teal : violet, [Math.sin(angle) * (radius - .3), 3.57, Math.cos(angle) * (radius - .3)],
      [.11, 3.15, .04], [0, angle, 0]);
    box(scene, bevel, [x, .53, z], [1.42, 1.35, .93], [0, angle, 0]);
  }

  return {
    turntable,
    updateContacts(contacts: THREE.Vector3[]) {
      const biped = contacts.length === 2;
      bodyShadow.scale.set(biped ? 2.78 : 3.5, biped ? 2.73 : 5.37, 1);
      footShadows.forEach((mesh, index) => {
        const contact = contacts[index];
        mesh.visible = Boolean(contact);
        if (!contact) return;
        const size = 1 - Math.min(.66, contact.y * 1.65);
        mesh.position.x = contact.x;
        mesh.position.z = contact.z + (biped ? .19 : .12);
        mesh.scale.set(size * (biped ? 1.06 : 1.29), size * 1.43, 1);
      });
    }
  };
}
