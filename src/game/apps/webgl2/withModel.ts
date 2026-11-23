import { startModelViewer } from '../../common/model-viewer/startModelViewer';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createWebGL2Renderer } from './webGL2';

void startModelViewer(createWebGL2Renderer).catch((error: unknown) => reportStartupError('[WebGL2]', 'WebGL2 诊断失败', error));
