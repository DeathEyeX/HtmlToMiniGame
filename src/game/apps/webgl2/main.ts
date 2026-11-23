import { startControls } from '../../common/controls/startControls';
import { reportStartupError } from '../../common/ui/reportStartupError';
import { createWebGL2Renderer } from './webGL2';

void startControls(createWebGL2Renderer).catch((error: unknown) => reportStartupError('[WebGL2]', 'WebGL2 诊断失败', error));
