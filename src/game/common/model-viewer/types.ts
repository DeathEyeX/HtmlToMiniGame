import type { CreateLocalScene } from '../../../framework/runtime/startGame';

export type ModelStatus =
  | { stage: 'loading'; progress: number }
  | { stage: 'ready' }
  | { stage: 'error'; message: string };

export type ModelScene = ReturnType<CreateLocalScene> & {
  status(): ModelStatus;
  retry(): void;
};

export type ModelSceneFactory = (
  scene: Parameters<CreateLocalScene>[0],
  canvas: HTMLCanvasElement,
  onStatus?: (status: ModelStatus) => void
) => ModelScene;
