import { createResourceLoader } from '../../../framework/assets/createResourceLoader';
import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createExhibitScene } from './three/exhibitScene';

const tag = '[CyberBeast]';
const resources = createResourceLoader({ kind: 'package', root: 'dist/resources/packaged/cyber-beast' });

async function startExhibit() {
  let exhibit: ReturnType<typeof createExhibitScene>;
  await startGame(scene => {
    exhibit = createExhibitScene(scene);
    return exhibit;
  }, {
    tag,
    hudReadyMessage: 'Exhibit controls ready',
    showHudErrorModal: true
  }, async () => {
    const [{ createExhibitHud }, labels] = await Promise.all([
      import('./hud/exhibitHud'),
      resources.loadImage('ui/labels.png')
    ]);
    return (stage, width, height) => createExhibitHud(stage, width, height, labels, exhibit);
  });
}

void startExhibit().catch((error: unknown) => reportStartupError(tag, '怪兽展厅启动失败', error));
