import { startGame, type RendererFactory } from '../../../framework/runtime/startGame';

export function startModelViewer(createRenderer?: RendererFactory) {
  console.log('[ThreeDraco] Starting');
  return startGame(async (scene, _renderer, canvas) => {
    const { createLittlestTokyoScene } = await import('./LittlestTokyo');
    return createLittlestTokyoScene(scene, canvas, undefined, Boolean(createRenderer));
  }, {
    tag: '[ThreeDraco]',
    hudReadyMessage: 'Pixi HUD initialized',
    showHudErrorModal: Boolean(createRenderer),
    createWebGL2Renderer: createRenderer
  }, async () => (await import('../ui/controlsHud')).createControlsHud);
}
