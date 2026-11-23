import { startModelViewer } from '../../common/model-viewer/startModelViewer';

void startModelViewer().catch((error: unknown) => console.error('[ThreeDraco] Fatal error', error));
