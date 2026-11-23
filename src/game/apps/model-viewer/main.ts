import { startModelViewer } from '../../common/model-viewer/startModelViewer';
import { reportStartupError } from '../../common/ui/reportStartupError';

void startModelViewer().catch((error: unknown) => reportStartupError('[ThreeDraco]', 'Fatal error', error));
