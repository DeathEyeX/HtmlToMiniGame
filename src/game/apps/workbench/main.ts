import { startGame } from '../../../framework/runtime/startGame';
import { createWorkbenchScene } from '../../common/workbench/Workbench';
import { reportStartupError } from '../../common/ui/reportStartupError';

async function startWorkbench() {
  let workbench: ReturnType<typeof createWorkbenchScene>;
  await startGame((scene, _renderer, canvas) => {
    workbench = createWorkbenchScene(scene, canvas);
    return workbench;
  }, {
    tag: '[Workbench]',
    hudReadyMessage: 'Ready',
    showHudErrorModal: true
  }, async () => {
    const { createWorkbenchHud } = await import('../../common/workbench/WorkbenchHud');
    return (stage, width, height) => createWorkbenchHud(stage, width, height, workbench);
  });
}

void startWorkbench().catch((error: unknown) => reportStartupError('[Workbench]', '配装台启动失败', error));
