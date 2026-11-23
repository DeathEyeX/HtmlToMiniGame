import { startGame } from '../../framework/runtime/startGame';
import { createCubeScene } from '../../game/scenes/home/Cube';
import type { createWebGL2Renderer } from '../webgl2/webGL2';

export function startBasic(createRenderer?: typeof createWebGL2Renderer) {
  return startGame((scene, _renderer, canvas) => createCubeScene(scene, canvas), {
    tag: '[Framework]',
    hudReadyMessage: 'Three and Pixi initialized',
    showHudErrorModal: true,
    createWebGL2Renderer: createRenderer
  }, async () => (await import('./controlsHud')).createControlsHud);
}
