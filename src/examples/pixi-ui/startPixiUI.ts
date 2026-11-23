import { startGame } from '../../framework/runtime/startGame';
import { createCubeScene } from '../../game/scenes/home/Cube';

export function startPixiUI() {
  return startGame((scene, _renderer, canvas) => createCubeScene(scene, canvas), {
    tag: '[PixiUI]',
    hudReadyMessage: 'Three and Pixi initialized',
    showHudErrorModal: true
  }, async () => (await import('./pixiUI')).createPixiUIDiagnostics);
}
