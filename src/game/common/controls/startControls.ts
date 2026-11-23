import { startGame } from '../../../framework/runtime/startGame';
import { createCubeScene } from '../three/Cube';

export function startControls() {
  return startGame((scene, _renderer, canvas) => createCubeScene(scene, canvas), {
    tag: '[Framework]',
    hudReadyMessage: 'Three and Pixi initialized',
    showHudErrorModal: true
  }, async () => (await import('../ui/controlsHud')).createControlsHud);
}
