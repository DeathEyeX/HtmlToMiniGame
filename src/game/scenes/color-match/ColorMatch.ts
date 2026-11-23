import { Mesh, MeshBasicMaterial, PerspectiveCamera, TorusKnotGeometry, type Scene } from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { createMatchRound, matchColors } from './round';

export function createColorMatchScene(scene: Scene, canvas: HTMLCanvasElement, refresh: () => void) {
  const camera = new PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(2, 1.4, 5);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 9;
  controls.update();

  const target = new Mesh(new TorusKnotGeometry(0.76, 0.24, 80, 12), new MeshBasicMaterial({ color: matchColors[0] }));
  scene.add(target);
  const round = createMatchRound();
  let shownSeconds = round.state().seconds;

  function showTarget() {
    target.material.color.setHex(matchColors[round.state().target]);
    refresh();
  }

  return {
    camera,
    controls,
    state: round.state,
    start() {
      round.start();
      shownSeconds = round.state().seconds;
      showTarget();
    },
    choose(index: number) {
      if (round.choose(index)) showTarget();
    },
    update(delta: number) {
      target.rotation.y += delta * 0.45;
      round.advance(delta);
      const { seconds } = round.state();
      if (seconds === shownSeconds) return;
      shownSeconds = seconds;
      refresh();
    },
    dispose() {
      target.geometry.dispose();
      target.material.dispose();
    }
  };
}
