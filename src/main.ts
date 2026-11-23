import { startGame } from './runtime/startGame';

declare const MODEL_DEMO: boolean;
declare const APP_DEMO: boolean;
declare const WEBGL2_DIAGNOSTIC: boolean;
declare const UI_DIAGNOSTIC: boolean;

async function main() {
  const createWebGL2Renderer = WEBGL2_DIAGNOSTIC
    ? (await import('./diagnostics/webGL2')).createWebGL2Renderer
    : undefined;
  if (APP_DEMO) {
    const { startApp } = await import('./app/startApp');
    await startApp();
  } else if (MODEL_DEMO) {
    console.log('[ThreeDraco] Starting');
    await startGame(async (scene, _renderer, canvas) => {
      const { createLittlestTokyoScene } = await import('./scenes/LittlestTokyo');
      return createLittlestTokyoScene(scene, canvas, undefined, WEBGL2_DIAGNOSTIC);
    }, {
      tag: '[ThreeDraco]',
      hudReadyMessage: 'Pixi HUD initialized',
      showHudErrorModal: WEBGL2_DIAGNOSTIC,
      createWebGL2Renderer
    });
  } else {
    await startGame(async (scene, _renderer, canvas) => {
      const { createCubeScene } = await import('./scenes/Cube');
      return createCubeScene(scene, canvas);
    }, {
      tag: UI_DIAGNOSTIC ? '[PixiUI]' : '[Framework]',
      hudReadyMessage: 'Three and Pixi initialized',
      showHudErrorModal: true,
      createWebGL2Renderer
    }, UI_DIAGNOSTIC
      ? async () => (await import('./diagnostics/pixiUI')).createPixiUIDiagnostics
      : undefined);
  }
}

main().catch((error: unknown) => {
  if (WEBGL2_DIAGNOSTIC) {
    console.error('[WebGL2] Startup failed', error);
    wx.showModal({ title: 'WebGL2 诊断失败', content: String(error), showCancel: false });
  } else if (MODEL_DEMO && !APP_DEMO) console.error('[ThreeDraco] Fatal error', error);
  else {
    console.error('[Framework] Initialization failed', error);
    wx.showModal({ title: 'Initialization failed', content: String(error), showCancel: false });
  }
});
