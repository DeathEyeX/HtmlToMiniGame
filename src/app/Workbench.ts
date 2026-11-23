import {
  CylinderGeometry, DirectionalLight, DodecahedronGeometry, HemisphereLight,
  Mesh, MeshStandardMaterial, PerspectiveCamera, type Scene
} from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { finishes } from './finishes';

export function createWorkbenchScene(scene: Scene, canvas: HTMLCanvasElement) {
  const camera = new PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(3, 2, 5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.3, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 9;
  controls.update();

  const base = new Mesh(new CylinderGeometry(1.05, 1.15, 0.24, 24),
    new MeshStandardMaterial({ color: 0x283c50 }));
  base.position.y = -0.55;
  const model = new Mesh(new DodecahedronGeometry(0.82),
    new MeshStandardMaterial({ color: finishes[0], roughness: 0.35, metalness: 0.2 }));
  model.position.y = 0.36;
  const light = new DirectionalLight(0xffffff, 2);
  light.position.set(3, 4, 3);
  scene.add(base, model, light, new HemisphereLight(0xffffff, 0x75899c, 1.1));

  let selected = 0;
  let confirmed = false;
  return {
    camera,
    controls,
    selection: () => ({ selected, confirmed }),
    choose(index: number) {
      selected = index;
      confirmed = false;
      model.material.color.setHex(finishes[index]);
    },
    confirm() { confirmed = true; },
    update(delta: number) {
      if (confirmed) model.rotation.y += delta * 0.55;
    },
    dispose() {
      base.geometry.dispose();
      base.material.dispose();
      model.geometry.dispose();
      model.material.dispose();
    }
  };
}
