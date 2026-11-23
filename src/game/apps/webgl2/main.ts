import { startControls } from '../../common/controls/startControls';
import { reportStartupError } from '../../common/ui/reportStartupError';

void startControls().catch((error: unknown) => reportStartupError('[WebGL2]', 'WebGL2 诊断失败', error));
