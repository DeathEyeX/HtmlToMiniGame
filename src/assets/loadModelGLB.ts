import { BufferGeometry, Material, Mesh, Texture } from 'three-platformize';
import { GLTFLoader, type GLTF } from 'three-platformize/examples/jsm/loaders/GLTFLoader';
import { WechatDracoLoader } from '../draco/WechatDracoLoader.js';
import type { ModelLoadAttempt } from './ModelLoadAttempt';
import { modelAsset } from './modelCatalog';
import { loadRemoteGLB } from './WechatAssetLoader.js';

export function collectModelAssets(gltf: GLTF) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const roots = new Set([gltf.scene, ...gltf.scenes]);

  function collectMaterials(collectTextures: boolean) {
    for (const root of roots) {
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if (collectTextures) {
            for (const value of Object.values(material)) {
              if (value instanceof Texture) textures.add(value);
            }
          }
        }
      });
    }
  }
  collectMaterials(true);
  return {
    collectConvertedMaterials() {
      // The shared Toon gradient belongs to the material module.
      collectMaterials(false);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    }
  };
}

export function parseModelGLB(buffer: ArrayBuffer, attempt: ModelLoadAttempt) {
  return new Promise<GLTF>((resolve, reject) => {
    attempt.check();
    let abandoned = false;
    const fail = (error: unknown) => {
      abandoned = true;
      unsubscribe();
      reject(error);
    };
    const unsubscribe = attempt.onCancel(fail);
    const loader = new GLTFLoader();
    // This loader uses preload and the geometry callback. Its declaration targets the browser Draco loader.
    const draco = new WechatDracoLoader(fail);
    loader.setDRACOLoader(draco as unknown as Parameters<GLTFLoader['setDRACOLoader']>[0]);
    try {
      loader.parse(buffer, '', (gltf) => {
        unsubscribe();
        if (abandoned) collectModelAssets(gltf).dispose();
        else resolve(gltf);
      }, fail);
    } catch (error) {
      fail(error);
    }
  });
}

export async function loadModelGLB(id: Parameters<typeof modelAsset>[0], attempt: ModelLoadAttempt, onProgress: (percent: number) => void) {
  const asset = modelAsset(id);
  console.log('[ThreeDraco] Loading remote model', asset.url);
  const downloadStart = Date.now();
  let lastProgress = -1;
  const resource = await loadRemoteGLB({
    ...asset,
    attempt,
    onProgress({ progress, fromCache }) {
      onProgress(progress);
      const step = Math.floor(progress / 10);
      if (step !== lastProgress) {
        lastProgress = step;
        console.log(`[AssetLoader] Progress: ${progress}%`, fromCache ? '(cache)' : '');
      }
    }
  });
  console.log('[ThreeDraco] Resource ready', {
    bytes: resource.buffer.byteLength, elapsedMs: Date.now() - downloadStart
  });
  const parseStart = Date.now();
  try {
    const gltf = await parseModelGLB(resource.buffer, attempt);
    console.log('[ThreeDraco] GLB parsed', {
      animations: gltf.animations.length, elapsedMs: Date.now() - parseStart
    });
    return { gltf, save: resource.save };
  } catch (error) {
    if (!attempt.cancelled && resource.invalidate) {
      await resource.invalidate();
      console.warn('[AssetLoader] Invalidated cache after GLB parse failure');
    }
    throw error;
  }
}
