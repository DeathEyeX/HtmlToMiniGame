import {
  ACESFilmicToneMapping, AnimationMixer, DirectionalLight, HemisphereLight, Mesh,
  PerspectiveCamera, sRGBEncoding, type Scene, type WebGL1Renderer
} from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { GLTFLoader, type GLTF } from 'three-platformize/examples/jsm/loaders/GLTFLoader';
import { loadRemoteGLB } from '../assets/WechatAssetLoader.js';
import { WechatDracoLoader } from '../draco/WechatDracoLoader.js';
import { applyAnimeToon } from '../rendering/AnimeToonMaterial.js';

const CONFIG = {
  modelURL: 'http://192.168.1.46:8080/model.glb',
  cacheKey: 'littlest-tokyo',
  modelVersion: 'network-test-v3'
};
const TAG = '[ThreeDraco]';

async function loadModel(scene: Scene) {
  const loader = new GLTFLoader();
  // GLTFLoader uses decodeDracoFile. Its declaration is tied to the bundled browser loader.
  const draco = new WechatDracoLoader();
  loader.setDRACOLoader(draco as unknown as Parameters<GLTFLoader['setDRACOLoader']>[0]);

  console.log(`${TAG} Loading remote model`, CONFIG.modelURL);
  const downloadStart = Date.now();
  let lastProgress = -1;
  const buffer = await loadRemoteGLB({
    url: CONFIG.modelURL,
    cacheKey: CONFIG.cacheKey,
    version: CONFIG.modelVersion,
    onProgress({ progress, fromCache }) {
      const step = Math.floor(progress / 10);
      if (step !== lastProgress) {
        lastProgress = step;
        console.log(`[AssetLoader] Progress: ${progress}%`, fromCache ? '(cache)' : '');
      }
    }
  });
  console.log(`${TAG} Resource ready`, { bytes: buffer.byteLength, elapsedMs: Date.now() - downloadStart });

  const parseStart = Date.now();
  const gltf = await new Promise<GLTF>((resolve, reject) => loader.parse(buffer, '', resolve, reject));
  console.log(`${TAG} GLB parsed`, { elapsedMs: Date.now() - parseStart, animations: gltf.animations.length });
  const model = gltf.scene;
  model.position.set(1, 1, 0);
  model.scale.setScalar(0.01);
  applyAnimeToon(model);
  scene.add(model);

  let mixer: AnimationMixer | undefined;
  const clip = gltf.animations[0];
  if (clip) {
    mixer = new AnimationMixer(model);
    mixer.clipAction(clip).play();
    console.log(`${TAG} Animation:`, clip.name);
  }
  let meshCount = 0;
  let vertexCount = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount++;
    vertexCount += object.geometry.getAttribute('position')?.count ?? 0;
  });
  console.log(`${TAG} Scene ready`, { meshCount, vertexCount, animations: gltf.animations.length });
  return mixer;
}

export function createLittlestTokyoScene(scene: Scene, renderer: WebGL1Renderer, canvas: HTMLCanvasElement) {
  renderer.outputEncoding = sRGBEncoding;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

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

  let mixer: AnimationMixer | undefined;
  loadModel(scene)
    .then((value) => { mixer = value; })
    .catch((error: unknown) => console.error(`${TAG} Model loading failed`, error));
  return { camera, controls, update(delta: number) { mixer?.update(delta); } };
}
