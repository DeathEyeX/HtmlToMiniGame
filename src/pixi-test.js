
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MiniProgramDRACOLoader } from 'threejs-miniprogram-adapter';

const MODEL_PATH = 'assets/model.glb';
const DRACO_WASM_PATH = 'libs/draco/draco_decoder.wasm';

let started = false;

function logError(tag, error) {
  console.error(tag, {
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  });
}

// ========================================
// 1. 环境兼容
// ========================================

function installPolyfills() {
  console.log('[Environment] Before:', {
    WebAssembly: typeof globalThis.WebAssembly,
    WXWebAssembly: typeof WXWebAssembly,
    AbortController: typeof globalThis.AbortController,
    Blob: typeof globalThis.Blob,
    createImageBitmap: typeof globalThis.createImageBitmap
  });

  // 微信小游戏通常提供 WXWebAssembly。
  // 优先保留原生 WebAssembly。
  if (
    typeof globalThis.WebAssembly === 'undefined' &&
    typeof WXWebAssembly !== 'undefined'
  ) {
    globalThis.WebAssembly = WXWebAssembly;

    console.log('[Polyfill] WXWebAssembly mapped');
  }

  if (typeof globalThis.AbortController === 'undefined') {
    class MiniAbortSignal {
      constructor() {
        this.aborted = false;
        this.reason = undefined;
        this.onabort = null;
        this.listeners = new Set();
      }

      addEventListener(type, callback) {
        if (type === 'abort' && typeof callback === 'function') {
          this.listeners.add(callback);
        }
      }

      removeEventListener(type, callback) {
        if (type === 'abort') {
          this.listeners.delete(callback);
        }
      }

      dispatchEvent(event) {
        if (event.type !== 'abort') return true;

        for (const callback of [...this.listeners]) {
          callback.call(this, event);
        }

        if (typeof this.onabort === 'function') {
          this.onabort.call(this, event);
        }

        return true;
      }

      throwIfAborted() {
        if (this.aborted) {
          throw this.reason || new Error('Aborted');
        }
      }
    }

    class MiniAbortController {
      constructor() {
        this.signal = new MiniAbortSignal();
      }

      abort(reason) {
        if (this.signal.aborted) return;

        this.signal.aborted = true;
        this.signal.reason = reason || new Error('Aborted');

        this.signal.dispatchEvent({
          type: 'abort',
          target: this.signal
        });
      }
    }

    globalThis.AbortController = MiniAbortController;
    globalThis.AbortSignal = MiniAbortSignal;

    console.log('[Polyfill] AbortController installed');
  }

  console.log('[Environment] After:', {
    WebAssembly: typeof globalThis.WebAssembly,
    AbortController: typeof globalThis.AbortController
  });
}

// ========================================
// 2. Draco 解码器
// ========================================

function createDracoLoader() {
  console.log('[Draco] Initializing');

  const fs = wx.getFileSystemManager();

  // Draco wrapper 随 JS 一起打包
  const DracoDecoderModule = require(
    '../libs/draco/draco_wasm_wrapper.js'
  );

  console.log('[Draco] Wrapper:', {
    type: typeof DracoDecoderModule,
    keys: Object.keys(DracoDecoderModule || {}).slice(0, 10)
  });

  const wasmBinary = fs.readFileSync(DRACO_WASM_PATH);

  console.log('[Draco] WASM:', {
    bytes: wasmBinary?.byteLength,
    isArrayBuffer: wasmBinary instanceof ArrayBuffer
  });

  if (!(wasmBinary instanceof ArrayBuffer)) {
    throw new Error('Draco WASM is not ArrayBuffer');
  }

  const dracoLoader = new MiniProgramDRACOLoader()
    .setDecoderModule(DracoDecoderModule)
    .setDecoderBinary(wasmBinary);

  console.log('[Draco] Loader configured');

  return dracoLoader;
}

// ========================================
// 3. GLB 文件读取
// ========================================

function readGLB(path) {
  return new Promise((resolve, reject) => {
    console.log('[GLB] Reading:', path);

    wx.getFileSystemManager().readFile({
      filePath: path,

      success(result) {
        const data = result.data;

        console.log('[GLB] Read success:', {
          bytes: data?.byteLength,
          isArrayBuffer: data instanceof ArrayBuffer
        });

        if (!(data instanceof ArrayBuffer)) {
          reject(new Error('GLB is not ArrayBuffer'));
          return;
        }

        resolve(data);
      },

      fail(error) {
        console.error('[GLB] Read failed:', error);
        reject(new Error('Cannot read ' + path));
      }
    });
  });
}

// ========================================
// 4. GLB 解析
// ========================================

function parseGLB(buffer, dracoLoader) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.setDRACOLoader(dracoLoader);

    console.log('[GLB] Parsing started');

    const startTime = Date.now();

    loader.parse(
      buffer,
      '',
      (gltf) => {
        console.log('[GLB] Parsing success:', {
          milliseconds: Date.now() - startTime,
          scenes: gltf.scenes.length,
          animations: gltf.animations.length
        });

        resolve(gltf);
      },
      (error) => {
        logError('[GLB] Parse failed', error);
        reject(error);
      }
    );
  });
}

// ========================================
// 5. 模型统计
// ========================================

function inspectModel(model) {
  const stats = {
    meshes: 0,
    skinnedMeshes: 0,
    vertices: 0,
    materials: 0
  };

  const materials = new Set();

  model.traverse((object) => {
    if (!object.isMesh) return;

    stats.meshes++;

    if (object.isSkinnedMesh) {
      stats.skinnedMeshes++;
    }

    const position = object.geometry?.attributes?.position;

    if (position) {
      stats.vertices += position.count;
    }

    const list = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of list) {
      if (material) materials.add(material);
    }
  });

  stats.materials = materials.size;

  console.log('[GLB] Model statistics:', stats);

  return stats;
}

// ========================================
// 6. 相机适配
// ========================================

function fitCamera(model, camera) {
  const bounds = new THREE.Box3().setFromObject(model);

  if (bounds.isEmpty()) {
    throw new Error('Model bounds empty');
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  model.position.sub(center);

  const radius = size.length() * 0.5;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const verticalDistance = radius / Math.sin(fov * 0.5);
  const horizontalFov = 2 * Math.atan(
    Math.tan(fov * 0.5) * camera.aspect
  );
  const horizontalDistance = radius / Math.sin(horizontalFov * 0.5);

  const distance = Math.max(
    verticalDistance,
    horizontalDistance,
    0.01
  ) * 1.4;

  camera.position.set(
    distance * 0.4,
    distance * 0.25,
    distance
  );

  camera.near = Math.max(distance / 1000, 0.001);
  camera.far = Math.max(distance * 100, 100);

  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  console.log('[Camera] Fitted:', {
    size: size.toArray(),
    distance
  });
}

// ========================================
// 7. 主程序
// ========================================

async function start() {
  if (started) return;
  started = true;

  console.log('[D12.3] Starting');

  installPolyfills();

  console.log('[Three] Revision:', THREE.REVISION);

  const canvas = wx.createCanvas();
  const info = wx.getWindowInfo();

  const width = info.windowWidth;
  const height = info.windowHeight;

  const gl =
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl');

  if (!gl) {
    throw new Error('WebGL unavailable');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  console.log('[Three] Renderer created');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x182536);

  const camera = new THREE.PerspectiveCamera(
    50,
    width / height,
    0.01,
    1000
  );

  scene.add(new THREE.AmbientLight(0xffffff, 2));

  const light = new THREE.DirectionalLight(
    0xffffff,
    3
  );

  light.position.set(5, 10, 7);
  scene.add(light);

  // 初始化 Draco
  const dracoLoader = createDracoLoader();

  // 读取 GLB
  const buffer = await readGLB(MODEL_PATH);

  // Draco 解码 + GLTF 解析
  const gltf = await parseGLB(buffer, dracoLoader);

  const model = gltf.scene;

  scene.add(model);

  inspectModel(model);
  fitCamera(model, camera);

  // ========================================
  // 8. 动画
  // ========================================

  let mixer = null;

  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);

    for (const clip of gltf.animations) {
      console.log('[Animation] Clip:', {
        name: clip.name,
        duration: clip.duration
      });
    }

    mixer.clipAction(gltf.animations[0]).play();

    console.log('[Animation] Playing first clip');
  }

  // ========================================
  // 9. 渲染循环
  // ========================================

  const requestFrame =
    typeof canvas.requestAnimationFrame === 'function'
      ? canvas.requestAnimationFrame.bind(canvas)
      : typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (callback) => setTimeout(
            () => callback(Date.now()),
            16
          );

  let lastTime = Date.now();
  let lastReport = lastTime;
  let frameCount = 0;

  function animate() {
    const now = Date.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1);

    lastTime = now;

    if (mixer) {
      mixer.update(delta);
    } else {
      model.rotation.y += delta * 0.4;
    }

    renderer.render(scene, camera);

    frameCount++;

    if (now - lastReport >= 3000) {
      console.log('[D12.3] Render stats:', {
        fps: (
          frameCount * 1000 / (now - lastReport)
        ).toFixed(1),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles
      });

      frameCount = 0;
      lastReport = now;
    }

    requestFrame(animate);
  }

  renderer.render(scene, camera);

  console.log('[D12.3] First frame success');

  requestFrame(animate);
}

start().catch((error) => {
  logError('[D12.3 ERROR]', error);
});
