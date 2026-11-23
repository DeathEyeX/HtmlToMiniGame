import {
  BoxGeometry, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, type Scene
} from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';

export function createCubeScene(scene: Scene, canvas: HTMLCanvasElement) {
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(3, 2, 5);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 12;
  controls.update();

  const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshStandardMaterial({ color: 0xf09338 }));
  const sunlight = new DirectionalLight(0xffffff, 1.5);
  sunlight.position.set(3, 4, 2);
  scene.add(cube, sunlight, new HemisphereLight(0xffffff, 0x6688aa, 1.2));
  return {
    camera,
    controls,
    update(delta: number) { cube.rotation.y += delta * 0.6; },
    dispose() {
      cube.geometry.dispose();
      cube.material.dispose();
    }
  };
}
