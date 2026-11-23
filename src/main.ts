import { startGame } from './runtime/startGame';

declare const MODEL_DEMO: boolean;

async function main() {
  if (MODEL_DEMO) {
    console.log('[ThreeDraco] Starting');
    await startGame(async (scene, renderer, canvas) => {
      const { createLittlestTokyoScene } = await import('./scenes/LittlestTokyo');
      return createLittlestTokyoScene(scene, renderer, canvas);
    }, {
      tag: '[ThreeDraco]',
      hudReadyMessage: 'Pixi HUD initialized',
      showHudErrorModal: false
    });
  } else {
    await startGame(async (scene, _renderer, canvas) => {
      const { createCubeScene } = await import('./scenes/Cube');
      return createCubeScene(scene, canvas);
    }, {
      tag: '[Framework]',
      hudReadyMessage: 'Three and Pixi initialized',
      showHudErrorModal: true
    });
  }
}

main().catch((error: unknown) => {
  if (MODEL_DEMO) console.error('[ThreeDraco] Fatal error', error);
  else {
    console.error('[Framework] Initialization failed', error);
    wx.showModal({ title: 'Initialization failed', content: String(error), showCancel: false });
  }
});
