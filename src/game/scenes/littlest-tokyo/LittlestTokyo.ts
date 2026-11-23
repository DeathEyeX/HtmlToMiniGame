import {
  ACESFilmicToneMapping, AnimationMixer, DirectionalLight, HemisphereLight, Mesh,
  PerspectiveCamera, sRGBEncoding, type Object3D, type Scene
} from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { loadModelGLB, collectModelAssets } from '../../../framework/assets/model/loadModelGLB';
import { ModelLoadAttempt } from '../../../framework/assets/model/ModelLoadAttempt';
import { applyAnimeToon } from './AnimeToonMaterial.js';
import { littlestTokyoAsset } from './modelAsset';

export type ModelStatus =
  | { stage: 'loading'; progress: number }
  | { stage: 'ready' }
  | { stage: 'error'; message: string };

const LOAD_TIMEOUT = 45_000;
const TAG = '[ThreeDraco]';

export function createLittlestTokyoScene(
  scene: Scene, canvas: HTMLCanvasElement, onStatus?: (status: ModelStatus) => void, usesWebGL2 = false
) {
  const camera = new PerspectiveCamera(40, 1, 1, 100);
  camera.position.set(5, 2, 8);
  const sunlight = new DirectionalLight(0xffe5b8, 2.2);
  sunlight.position.set(-5, 12, 8);
  scene.add(new HemisphereLight(0xfff3df, 0x8198b2, 1.1), sunlight);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 100;
  controls.target.set(0, 0.7, 0);
  controls.update();

  let status: ModelStatus = { stage: 'loading', progress: 0 };
  let current: ModelLoadAttempt | undefined;
  let model: Object3D | undefined;
  let assets: ReturnType<typeof collectModelAssets> | undefined;
  let mixer: AnimationMixer | undefined;
  let disposed = false;

  function publish(next: ModelStatus) {
    status = next;
    onStatus?.(next);
  }

  async function load() {
    if (disposed || current || model) return;
    const attempt = new ModelLoadAttempt();
    current = attempt;
    publish({ stage: 'loading', progress: 0 });

    function fail(error: unknown) {
      if (current !== attempt) return;
      current = undefined;
      console.error(`${TAG} Model loading failed`, error);
      publish({ stage: 'error', message: error instanceof Error ? error.message : String(error) });
    }

    const timer = setTimeout(() => attempt.cancel(new Error('Model loading timed out')), LOAD_TIMEOUT);
    const unsubscribe = attempt.onCancel((error) => {
      clearTimeout(timer);
      fail(error);
    });
    try {
      const { gltf, save } = await loadModelGLB(littlestTokyoAsset, attempt, (progress) => {
        if (current === attempt) publish({ stage: 'loading', progress });
      });
      const loaded = collectModelAssets(gltf);
      if (attempt.cancelled) {
        loaded.dispose();
        return;
      }

      const root = gltf.scene;
      try {
        root.position.set(1, 1, 0);
        root.scale.setScalar(0.01);
        applyAnimeToon(root, usesWebGL2);
        loaded.collectConvertedMaterials();
        const clip = gltf.animations[0];
        if (clip) {
          mixer = new AnimationMixer(root);
          mixer.clipAction(clip).play();
          console.log(`${TAG} Animation:`, clip.name);
        }
      } catch (error) {
        loaded.collectConvertedMaterials();
        loaded.dispose();
        throw error;
      }
      assets = loaded;
      model = root;
      scene.add(model);

      let meshCount = 0;
      let vertexCount = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        meshCount++;
        vertexCount += object.geometry.getAttribute('position')?.count ?? 0;
      });
      console.log(`${TAG} Scene ready`, { meshCount, vertexCount, animations: gltf.animations.length });
      publish({ stage: 'ready' });
      void save?.();
    } catch (error) {
      fail(error);
    } finally {
      clearTimeout(timer);
      unsubscribe();
      if (current === attempt) current = undefined;
    }
  }

  void load();
  return {
    camera,
    controls,
    renderSettings: { outputEncoding: sRGBEncoding, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 },
    status: () => status,
    retry() { void load(); },
    update(delta: number) { mixer?.update(delta); },
    dispose() {
      if (disposed) return;
      disposed = true;
      const pending = current;
      current = undefined;
      pending?.cancel();
      if (model) {
        mixer?.stopAllAction();
        mixer?.uncacheRoot(model);
        scene.remove(model);
        assets?.dispose();
      }
    }
  };
}
