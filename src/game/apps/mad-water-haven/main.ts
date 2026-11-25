import { createResourceLoader } from '../../../framework/assets/createResourceLoader';
import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createHaven } from './three/scene';

const tag = '[Mad Water Haven]';
const assets = createResourceLoader({ kind: 'package', root: 'dist/resources/packaged/mad-water-haven' });

async function startHaven() {
  // 先解码小字形图集，避免首帧编译 Shader 时推迟图像的加载回调。
  const glyphs = await assets.loadImage('ui/glyphs.png');
  let haven: ReturnType<typeof createHaven>;
  await startGame((scene, renderer) => {
    haven = createHaven(scene, renderer);
    return haven;
  }, { tag, hudReadyMessage: 'HUD ready', showHudErrorModal: true }, async () => {
    const { createHavenHud } = await import('./hud/havenHud');
    return (stage, width, height) => createHavenHud(stage, width, height, glyphs, haven.view, haven.changeZoom);
  });
}

void startHaven().catch((error: unknown) => reportStartupError(tag, '海上庇护所启动失败', error));
