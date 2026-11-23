import { startGame, type CreateLocalScene } from '../framework/runtime/startGame';
import { createCubeScene } from './scenes/home/Cube';
import type { createWorkbenchScene } from './scenes/workbench/Workbench';
import type { createLittlestTokyoScene, ModelStatus } from './scenes/littlest-tokyo/LittlestTokyo';
import type { createAppHud } from './AppHud';

type LoadModelScene = () => Promise<typeof createLittlestTokyoScene>;

export async function startGameApp(loadModelScene?: LoadModelScene) {
  let workbench: ReturnType<typeof createWorkbenchScene> | undefined;
  let model: ReturnType<typeof createLittlestTokyoScene> | undefined;
  let appHud: ReturnType<typeof createAppHud> | undefined;
  let loading = false;
  const home: CreateLocalScene = (scene, _renderer, canvas) => createCubeScene(scene, canvas);

  const openModel = loadModelScene ? async () => {
    if (loading || workbench || model) return;
    loading = true;
    try {
      const createLittlestTokyoScene = await loadModelScene();
      model = game.switchScene((scene, _renderer, canvas) => createLittlestTokyoScene(scene, canvas, onModelStatus));
    } catch (error) {
      console.error('[App] Model scene failed to open', error);
      wx.showModal({ title: '模型场景启动失败', content: String(error), showCancel: false });
    } finally {
      loading = false;
    }
  } : undefined;

  const game = await startGame(home, {
    tag: '[App]',
    hudReadyMessage: 'Home ready',
    showHudErrorModal: true
  }, async () => {
    const { createAppHud } = await import('./AppHud');
    return (stage, width, height) => {
      const hud = createAppHud(stage, width, height, {
        open: openWorkbench,
        openColorMatch,
        openModel,
        back: returnHome,
        state: () => {
          if (model) return { screen: 'model', load: model.status() };
          if (workbench) return { screen: 'workbench', ...workbench.selection() };
          return { screen: 'home' };
        },
        choose: (index) => workbench?.choose(index),
        confirm: () => workbench?.confirm(),
        retry: () => model?.retry()
      });
      appHud = hud;
      return hud;
    };
  });

  function returnHome() {
    game.switchScene(home);
    workbench = undefined;
    model = undefined;
    appHud?.closeActivity();
    appHud?.refresh();
  }

  function onModelStatus(status: ModelStatus) {
    appHud?.refresh();
    const failedScene = model;
    if (status.stage !== 'error' || !failedScene) return;
    wx.showModal({
      title: '模型加载失败',
      content: status.message,
      confirmText: '重试',
      cancelText: '返回',
      success(result) {
        if (model !== failedScene || model.status() !== status) return;
        if (result.confirm) model.retry();
        if (result.cancel) returnHome();
      }
    });
  }

  async function openColorMatch() {
    if (loading || workbench || model || !appHud) return;
    const hud = appHud;
    loading = true;
    try {
      const [{ createColorMatchScene }, { createColorMatchHud }] = await Promise.all([
        import('./scenes/color-match/ColorMatch'),
        import('./scenes/color-match/ColorMatchHud')
      ]);
      let view: ReturnType<typeof createColorMatchHud> | undefined;
      const match = game.switchScene((scene, _renderer, canvas) => createColorMatchScene(scene, canvas, () => view?.refresh()));
      try {
        hud.mountActivity((stage, width, height) => {
          view = createColorMatchHud(stage, width, height, match, returnHome);
          return view;
        });
      } catch (error) {
        returnHome();
        throw error;
      }
    } catch (error) {
      console.error('[App] Color match failed to open', error);
      wx.showModal({ title: '颜色挑战启动失败', content: String(error), showCancel: false });
    } finally {
      loading = false;
    }
  }

  async function openWorkbench() {
    if (loading || workbench || model) return;
    loading = true;
    try {
      const { createWorkbenchScene } = await import('./scenes/workbench/Workbench');
      workbench = game.switchScene((scene, _renderer, canvas) => createWorkbenchScene(scene, canvas));
    } catch (error) {
      console.error('[App] Workbench failed to open', error);
      wx.showModal({ title: '配装台加载失败', content: String(error), showCancel: false });
    } finally {
      loading = false;
    }
  }
}
