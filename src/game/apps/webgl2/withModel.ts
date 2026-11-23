import { startModelViewer } from '../../common/model-viewer/startModelViewer';
import { reportStartupError } from '../../common/ui/reportStartupError';

void startModelViewer().catch((error: unknown) => reportStartupError('[WebGL2]', 'WebGL2 诊断失败', error));
