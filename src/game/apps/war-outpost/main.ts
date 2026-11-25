import { createResourceLoader } from '../../../framework/assets/createResourceLoader';
import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createScene } from './three/outpostScene';

const tag = '[WarOutpost]';
const resources = createResourceLoader({ kind: 'package', root: 'dist/resources/packaged/war-outpost' });

async function startOutpost() {
  let outpost: ReturnType<typeof createScene>;
  await startGame(scene => {
    outpost = createScene(scene);
    return outpost;
  }, {
    tag, hudReadyMessage: 'Outpost controls ready', showHudErrorModal: true
  }, async () => {
    const [{ createOutpostHud }, labels] = await Promise.all([
      import('./hud/outpostHud'), resources.loadImage('ui/outpost-labels.png')
    ]);
    return (stage, width, height) => createOutpostHud(stage, width, height, labels, outpost);
  });
}

void startOutpost().catch((error: unknown) => reportStartupError(tag, '前线前哨站启动失败', error));
