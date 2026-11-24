import { createResourceLoader } from '../../../framework/assets/createResourceLoader';
import { startGame } from '../../../framework/runtime/startGame';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createDriftGame } from './game';
import type { createDriftHud } from './hud/driftHud';
import { driftLayout } from './layout';
import { zones } from './routes';
import { createDriftWorld } from './three/world';

const resourceRoot = 'dist/resources/packaged/drift-era';
const resources = createResourceLoader({ kind: 'package', root: resourceRoot });

async function startDriftEra() {
  let immersive = false;
  let sound = false;
  let audio: ReturnType<typeof wx.createInnerAudioContext> | undefined;
  let hud: ReturnType<typeof createDriftHud> | undefined;
  let world: ReturnType<typeof createDriftWorld>;
  const viewport = wx.getSystemInfoSync();
  const browser = String(viewport.platform) === 'browser';
  let layout = driftLayout(viewport.windowWidth, viewport.windowHeight, immersive);

  function chime() {
    if (sound && audio) {
      audio.stop();
      audio.play();
    }
  }

  function toggleSound() {
    if (!audio) {
      audio = wx.createInnerAudioContext();
      audio.src = `${resourceRoot}/audio/chime.wav`;
    }
    sound = !sound;
    if (sound) chime();
    else audio.stop();
    return sound;
  }

  const game = createDriftGame(() => {
    if (game.at in zones) chime();
    hud?.refresh();
  }, chime);

  function resize(width: number, height: number) {
    layout = driftLayout(width, height, immersive);
    world.fit(layout);
  }

  // 键盘是浏览器联调的快捷键，微信端的全部操作通过 HUD 触摸完成。
  function onKey(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey || event.altKey || !hud) return;
    if (key === 'escape' && hud.hasDialog) hud.closeDialog();
    if (hud.hasDialog) return;
    switch (key) {
      case 'w': case 'arrowup': game.step(0, 1); break;
      case 's': case 'arrowdown': game.step(0, -1); break;
      case 'a': case 'arrowleft': game.step(-1, 0); break;
      case 'd': case 'arrowright': game.step(1, 0); break;
      case 'e':
        if (!event.repeat && game.interact() === 'log') hud.openLog();
        break;
      default: return;
    }
    event.preventDefault();
    hud.refresh();
  }

  await startGame((scene, renderer) => {
    world = createDriftWorld(scene, renderer, game);
    if (browser) globalThis.addEventListener('keydown', onKey);
    return {
      ...world,
      resize,
      dispose() {
        if (browser) globalThis.removeEventListener('keydown', onKey);
        audio?.destroy();
        world.dispose();
      }
    };
  }, {
    tag: '[Drift Era]', hudReadyMessage: 'Shelter HUD ready', showHudErrorModal: true
  }, async () => {
    const [{ createDriftHud }, page] = await Promise.all([
      import('./hud/driftHud'), resources.loadImage('ui/glyphs.png')
    ]);
    return stage => {
      hud = createDriftHud(stage, page, game, {
        layout: () => layout,
        project: world.marker,
        toggleView() {
          immersive = !immersive;
          resize(layout.width, layout.height);
        },
        toggleSound: typeof wx.createInnerAudioContext === 'function' ? toggleSound : undefined
      });
      return hud;
    };
  });
}

void startDriftEra().catch((error: unknown) => reportStartupError('[Drift Era]', '潮汐庇护所启动失败', error));
