import { startGame } from '../../framework/runtime/startGame';
import type { createWebGL2Renderer } from '../webgl2/webGL2';

export function startModel(createRenderer?: typeof createWebGL2Renderer) {
  console.log('[ThreeDraco] Starting');
  return startGame(async (scene, _renderer, canvas) => {
    const { createLittlestTokyoScene } = await import('../../game/scenes/littlest-tokyo/LittlestTokyo');
    return createLittlestTokyoScene(scene, canvas, undefined, Boolean(createRenderer));
  }, {
    tag: '[ThreeDraco]',
    hudReadyMessage: 'Pixi HUD initialized',
    showHudErrorModal: Boolean(createRenderer),
    createWebGL2Renderer: createRenderer
  }, async () => (await import('../basic/controlsHud')).createControlsHud);
}
