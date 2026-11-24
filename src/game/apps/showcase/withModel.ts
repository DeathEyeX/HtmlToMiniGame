import { startGameApp } from './startGameApp';
import { reportStartupError } from '../../common/ui/reportStartupError';

void startGameApp({
  loadScene: async () => (await import('../../common/model-viewer/LittlestTokyo')).createLittlestTokyoScene,
  loadHud: async () => (await import('./hud/ModelHud')).drawModelHud
}).catch((error: unknown) => reportStartupError('[App]', 'Initialization failed', error));
