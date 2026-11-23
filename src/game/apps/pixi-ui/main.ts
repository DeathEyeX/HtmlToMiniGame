import { startGame } from '../../../framework/runtime/startGame';
import { createCubeScene } from '../../common/three/Cube';
import { reportStartupError } from '../../common/ui/reportStartupError';

function startPixiUI() {
  return startGame((scene, _renderer, canvas) => createCubeScene(scene, canvas), {
    tag: '[PixiUI]',
    hudReadyMessage: 'Three and Pixi initialized',
    showHudErrorModal: true
  }, async () => (await import('./pixiUI')).createPixiUIDiagnostics);
}

void startPixiUI().catch((error: unknown) => reportStartupError('[PixiUI]', 'Initialization failed', error));
