import { startGame } from '../../../framework/runtime/startGame';

export function startModelViewer() {
  console.log('[ThreeDraco] Starting');
  return startGame(async (scene, renderer, canvas) => {
    const { createLittlestTokyoScene } = await import('./LittlestTokyo');
    return createLittlestTokyoScene(scene, renderer, canvas);
  }, {
    tag: '[ThreeDraco]',
    hudReadyMessage: 'Pixi HUD initialized',
    showHudErrorModal: false
  }, async () => (await import('../ui/controlsHud')).createControlsHud);
}
