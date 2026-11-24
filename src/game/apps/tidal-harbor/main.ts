import { createResourceLoader } from '../../../framework/assets/createResourceLoader';
import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createHarborScene } from './three/scene';

const resources = createResourceLoader({ kind: 'package', root: 'dist/resources/packaged/tidal-harbor' });

async function startHarbor() {
  let world: ReturnType<typeof createHarborScene>;
  await startGame(scene => {
    world = createHarborScene(scene);
    return world;
  }, {
    tag: '[Tidal Harbor]', hudReadyMessage: 'Harbor HUD ready', showHudErrorModal: true
  }, async () => {
    const [{ createHarborHud }, page] = await Promise.all([
      import('./hud/hud'), resources.loadImage('ui/glyphs.png')
    ]);
    return (stage, width, height) => createHarborHud(stage, width, height, page, world.setView, world.select);
  });
}

void startHarbor().catch((error: unknown) => reportStartupError('[Tidal Harbor]', '潮汐浮城启动失败', error));
