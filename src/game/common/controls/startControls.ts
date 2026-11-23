import { startGame, type RendererFactory } from '../../../framework/runtime/startGame';
import { createCubeScene } from '../three/Cube';

export function startControls(createRenderer?: RendererFactory) {
  return startGame((scene, _renderer, canvas) => createCubeScene(scene, canvas), {
    tag: '[Framework]',
    hudReadyMessage: 'Three and Pixi initialized',
    showHudErrorModal: true,
    createWebGL2Renderer: createRenderer
  }, async () => (await import('../ui/controlsHud')).createControlsHud);
}
