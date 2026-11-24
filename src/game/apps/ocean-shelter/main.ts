import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { loadOceanHudImages } from './hud/assets';
import type { createOceanShelterHud } from './hud/OceanShelterHud';
import { createOceanShelterScene } from './three/OceanShelter';

async function startOceanShelter() {
  let ocean: ReturnType<typeof createOceanShelterScene>;
  let images: Awaited<ReturnType<typeof loadOceanHudImages>>;
  let view: ReturnType<typeof createOceanShelterHud> | undefined;

  wx.showLoading({ title: '正在加载船体', mask: true });
  try {
    await startGame(async (scene, renderer) => {
      images = await loadOceanHudImages();
      ocean = createOceanShelterScene(scene, renderer, () => view?.refresh());
      await ocean.ready;
      return ocean;
    }, {
      tag: '[Ocean Shelter]',
      hudReadyMessage: 'HUD ready',
      showHudErrorModal: true
    }, async () => {
      const [{ createOceanShelterHud }, { createOceanHudArt }] = await Promise.all([
        import('./hud/OceanShelterHud'),
        import('./hud/OceanHudArt')
      ]);
      return (stage, width, height) => {
        const art = createOceanHudArt(images);
        view = createOceanShelterHud(stage, width, height, ocean, art);
        return view;
      };
    });
  } finally {
    wx.hideLoading();
  }
}

void startOceanShelter().catch((error: unknown) => reportStartupError('[Ocean Shelter]', '海上避难所启动失败', error));
