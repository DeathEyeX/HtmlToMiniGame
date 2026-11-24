import { createResourceLoader } from '../../../framework/assets/createResourceLoader';
import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createHouseScene } from './three/houseScene';

const resources = createResourceLoader({
  kind: 'package',
  root: 'dist/resources/packaged/nohara-house'
});

async function startHouse() {
  // Decode once for the first frame and reuse the image when switching rooms.
  const character = await resources.loadImage('characters/shinnosuke.png');
  const game = await startGame(scene => createHouseScene(scene, 'exterior', character), {
    tag: '[NoharaHouse]',
    hudReadyMessage: 'Room selector ready',
    showHudErrorModal: true
  }, async () => {
    const [{ createHouseHud }, page] = await Promise.all([
      import('./hud/houseHud'),
      resources.loadImage('ui/labels.png')
    ]);
    return (stage, width, height) => createHouseHud(stage, width, height, page, room => {
      game.switchScene(scene => createHouseScene(scene, room, character));
    });
  });
}

void startHouse().catch((error: unknown) => reportStartupError('[NoharaHouse]', '房屋场景启动失败', error));
