import type { ModelLoadAttempt } from './ModelLoadAttempt';

declare const GAME_WEB_MODEL_URL: string | undefined;

// The Web preview uses HTTP and shares GLTF parsing with the WeChat build.
export async function loadRemoteGLB({ url, attempt, onProgress }: {
  url: string; attempt: ModelLoadAttempt; onProgress?: (info: { progress: number }) => void;
}): Promise<{ buffer: ArrayBuffer }> {
  attempt.check();
  const controller = new AbortController();
  const unsubscribe = attempt.onCancel(() => controller.abort());
  try {
    const response = await fetch(GAME_WEB_MODEL_URL ?? url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}: ${response.url}`);
    const buffer = await response.arrayBuffer();
    attempt.check();
    onProgress?.({ progress: 100 });
    return { buffer };
  } finally {
    unsubscribe();
  }
}
