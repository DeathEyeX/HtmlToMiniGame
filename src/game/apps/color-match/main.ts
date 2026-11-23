import { startGame } from '../../../framework/runtime/startGame';
import { createColorMatchScene } from '../../common/color-match/ColorMatch';
import { reportStartupError } from '../../common/ui/reportStartupError';
import type { createColorMatchHud } from '../../common/color-match/ColorMatchHud';

async function startColorMatch() {
  let match: ReturnType<typeof createColorMatchScene>;
  let view: ReturnType<typeof createColorMatchHud> | undefined;
  await startGame((scene, _renderer, canvas) => {
    match = createColorMatchScene(scene, canvas, () => view?.refresh());
    return match;
  }, {
    tag: '[ColorMatch]',
    hudReadyMessage: 'Ready',
    showHudErrorModal: true
  }, async () => {
    const { createColorMatchHud } = await import('../../common/color-match/ColorMatchHud');
    return (stage, width, height) => {
      view = createColorMatchHud(stage, width, height, match);
      return view;
    };
  });
}

void startColorMatch().catch((error: unknown) => reportStartupError('[ColorMatch]', '颜色挑战启动失败', error));
