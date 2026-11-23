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
  ...args: [...Parameters<CreateLocalScene>, onStatus?: (status: ModelStatus) => void]
) => ModelScene;
