import { startGameApp } from './startGameApp';
import { reportStartupError } from '../../common/ui/reportStartupError';

void startGameApp().catch((error: unknown) => reportStartupError('[App]', 'Initialization failed', error));
