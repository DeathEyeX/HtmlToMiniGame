import { startGame, type CreateLocalScene } from '../../../framework/runtime/startGame';
import { createCubeScene } from '../../common/three/Cube';
import type { ModelScene, ModelSceneFactory, ModelStatus } from '../../common/model-viewer/types';
import type { createAppHud, ModelHudRenderer } from './AppHud';

interface ModelOptions {
  loadScene: () => Promise<ModelSceneFactory>;
  loadHud: () => Promise<ModelHudRenderer>;
}

export async function startGameApp(modelOptions?: ModelOptions) {
  let model: ModelScene | undefined;
  let appHud: ReturnType<typeof createAppHud> | undefined;
  let opening = false;
  const home: CreateLocalScene = (scene, _renderer, canvas) => createCubeScene(scene, canvas);

  const openModel = modelOptions ? () => open('模型场景', async () => {
    const createScene = await modelOptions.loadScene();
    model = game.switchScene((scene, _renderer, canvas) => createScene(scene, canvas, onModelStatus));
  }) : undefined;

  const game = await startGame(home, {
    tag: '[App]',
    hudReadyMessage: 'Home ready',
    showHudErrorModal: true
  }, async () => {
    await import('../../common/ui/packagedUIAtlas');
    const { createAppHud } = await import('./AppHud');
    const drawModel = await modelOptions?.loadHud();
    return (stage, width, height) => {
      const hud = createAppHud(stage, width, height, {
        openWorkbench,
        openColorMatch,
        openModel,
        modelStatus: () => model?.status(),
        drawModel,
        back: returnHome,
        retryModel: () => model?.retry()
      });
      appHud = hud;
      return hud;
    };
  });

  function returnHome() {
    game.switchScene(home);
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

  async function open(name: string, prepare: (hud: ReturnType<typeof createAppHud>) => Promise<void>) {
    if (opening || model || !appHud) return;
    opening = true;
    try {
      await prepare(appHud);
    } catch (error) {
      console.error('[App] Failed to open ' + name, error);
      wx.showModal({ title: name + '启动失败', content: String(error), showCancel: false });
    } finally {
      opening = false;
    }
  }

  function mount(hud: ReturnType<typeof createAppHud>, create: Parameters<typeof hud.mountActivity>[0]) {
    try {
      hud.mountActivity(create);
    } catch (error) {
      returnHome();
      throw error;
    }
  }

  function openColorMatch() {
    return open('颜色挑战', async (hud) => {
      const [{ createColorMatchScene }, { createColorMatchHud }] = await Promise.all([
        import('../../common/color-match/ColorMatch'),
        import('../../common/color-match/ColorMatchHud')
      ]);
      let view: ReturnType<typeof createColorMatchHud> | undefined;
      const match = game.switchScene((scene, _renderer, canvas) => createColorMatchScene(scene, canvas, () => view?.refresh()));
      mount(hud, (stage, width, height) => {
        view = createColorMatchHud(stage, width, height, match, returnHome);
        return view;
      });
    });
  }

  function openWorkbench() {
    return open('配装台', async (hud) => {
      const [{ createWorkbenchScene }, { createWorkbenchHud }] = await Promise.all([
        import('../../common/workbench/Workbench'),
        import('../../common/workbench/WorkbenchHud')
      ]);
      const workbench = game.switchScene((scene, _renderer, canvas) => createWorkbenchScene(scene, canvas));
      mount(hud, (stage, width, height) => createWorkbenchHud(stage, width, height, workbench, returnHome));
    });
  }
}
