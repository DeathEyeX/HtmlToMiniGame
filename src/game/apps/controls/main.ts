import { startControls } from '../../common/controls/startControls';
import { reportStartupError } from '../../common/ui/reportStartupError';

void startControls().catch((error: unknown) => reportStartupError('[Framework]', 'Initialization failed', error));
