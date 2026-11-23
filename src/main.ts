type BuildProfile = 'basic' | 'model' | 'app' | 'app-model' | 'webgl2' | 'webgl2-model' | 'pixi-ui';

declare const BUILD_PROFILE: BuildProfile;

async function main() {
  if (BUILD_PROFILE === 'app' || BUILD_PROFILE === 'app-model') {
    const { startGameApp } = await import('./game/startGameApp');
    await startGameApp(BUILD_PROFILE === 'app-model'
      ? async () => (await import('./game/scenes/littlest-tokyo/LittlestTokyo')).createLittlestTokyoScene
      : undefined);
  } else if (BUILD_PROFILE === 'model') {
    const { startModel } = await import('./examples/model/startModel');
    await startModel();
  } else if (BUILD_PROFILE === 'webgl2' || BUILD_PROFILE === 'webgl2-model') {
    const { createWebGL2Renderer } = await import('./examples/webgl2/webGL2');
    if (BUILD_PROFILE === 'webgl2-model') {
      const { startModel } = await import('./examples/model/startModel');
      await startModel(createWebGL2Renderer);
    } else {
      const { startBasic } = await import('./examples/basic/startBasic');
      await startBasic(createWebGL2Renderer);
    }
  } else if (BUILD_PROFILE === 'pixi-ui') {
    const { startPixiUI } = await import('./examples/pixi-ui/startPixiUI');
    await startPixiUI();
  } else {
    const { startBasic } = await import('./examples/basic/startBasic');
    await startBasic();
  }
}

main().catch((error: unknown) => {
  if (BUILD_PROFILE === 'webgl2' || BUILD_PROFILE === 'webgl2-model') {
    console.error('[WebGL2] Startup failed', error);
    wx.showModal({ title: 'WebGL2 诊断失败', content: String(error), showCancel: false });
  } else if (BUILD_PROFILE === 'model') {
    console.error('[ThreeDraco] Fatal error', error);
  } else {
    console.error('[Framework] Initialization failed', error);
    wx.showModal({ title: 'Initialization failed', content: String(error), showCancel: false });
  }
});
