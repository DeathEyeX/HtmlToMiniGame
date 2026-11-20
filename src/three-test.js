
import {
  PLATFORM,
  WebGL1Renderer,
  Scene,
  PerspectiveCamera,
  HemisphereLight,
  DirectionalLight,
  Color,
  Clock,
  AnimationMixer,
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  sRGBEncoding
} from 'three-platformize';

import { WechatPlatform } from './platform/WechatPlatform';
import { loadHud } from './ui/loadHud';

import {
  GLTFLoader
} from 'three-platformize/examples/jsm/loaders/GLTFLoader';

import {
  OrbitControls
} from 'three-platformize/examples/jsm/controls/OrbitControls';

import {
  WechatDracoLoader
} from './draco/WechatDracoLoader.js';

import {
  applyAnimeToon
} from './rendering/AnimeToonMaterial.js';

import {
  loadRemoteGLB
} from './assets/WechatAssetLoader.js';

// ==================================================
// 配置
// ==================================================

const CONFIG = {
  modelURL: 'http://192.168.1.46:8080/model.glb',
  cacheKey: 'littlest-tokyo',
  maxPixelRatio: 2,
  modelVersion: 'network-test-v3'
};

const TAG = '[ThreeDraco]';

// ==================================================
// 工具函数
// ==================================================

function getScreenSize() {
  const info = wx.getSystemInfoSync();

  return {
    width: info.windowWidth,
    height: info.windowHeight,
    pixelRatio: Math.min(
      info.pixelRatio || 1,
      CONFIG.maxPixelRatio
    )
  };
}

function parseGLB(loader, buffer) {
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      resolve,
      reject
    );
  });
}

function installInputDiagnostics(canvas) {
  if (!CONFIG.enableTouchDebug) return;

  if (typeof canvas.addEventListener !== 'function') {
    console.warn(
      '[Input] addEventListener unavailable'
    );
    return;
  }

  canvas.addEventListener('touchstart', (event) => {
    console.log('[Input] touchstart', {
      touches: event.touches?.length
    });
  });

  canvas.addEventListener('touchend', () => {
    console.log('[Input] touchend');
  });

  canvas.addEventListener('wheel', (event) => {
    console.log('[Input] wheel', {
      deltaY: event.deltaY
    });
  });
}

// ==================================================
// 主入口
// ==================================================

async function main() {
  console.log(`${TAG} Starting`);

  // ------------------------------------------------
  // 1. 创建微信 Canvas 和平台适配
  // ------------------------------------------------

  const canvas = wx.createCanvas();

  const platform = new WechatPlatform(canvas);
  PLATFORM.set(platform);

  const screen = getScreenSize();

  // ------------------------------------------------
  // 2. Renderer
  // ------------------------------------------------

  const renderer = new WebGL1Renderer({
    canvas,
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(screen.pixelRatio);

  renderer.setSize(
    screen.width,
    screen.height
  );

  renderer.outputEncoding = sRGBEncoding;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  renderer.shadowMap.enabled =
    CONFIG.enableShadows;

  renderer.shadowMap.type =
    PCFSoftShadowMap;

  // ------------------------------------------------
  // 3. Scene
  // ------------------------------------------------

  const scene = new Scene();

  // 暂时使用静态背景。
  // 原工程 Sky / PMREM 后续单独迁移。
  scene.background = new Color(0xdce6ed);

  // ------------------------------------------------
  // 4. Camera
  // ------------------------------------------------

  const camera = new PerspectiveCamera(
    40,
    screen.width / screen.height,
    1,
    100
  );

  camera.position.set(5, 2, 8);

  // ------------------------------------------------
  // 5. Lighting
  // ------------------------------------------------

  const ambient = new HemisphereLight(
    0xfff3df,
    0x8198b2,
    1.1
  );

  scene.add(ambient);

  const sunlight = new DirectionalLight(
    0xffe5b8,
    2.2
  );

  sunlight.position.set(-5, 12, 8);

  sunlight.castShadow =
    CONFIG.enableShadows;

  sunlight.shadow.mapSize.set(
    1024,
    1024
  );

  sunlight.shadow.bias = -0.0001;
  sunlight.shadow.normalBias = 0.02;

  scene.add(sunlight);

  // ------------------------------------------------
  // 6. OrbitControls
  // ------------------------------------------------

  const controls = new OrbitControls(
    camera,
    canvas
  );

  controls.enableDamping = true;
  controls.enableRotate = true;
  controls.enableZoom = true;

  controls.zoomSpeed = 1.0;
  controls.minDistance = 0.5;
  controls.maxDistance = 100;

  controls.target.set(0, 0.7, 0);

  controls.update();

  installInputDiagnostics(canvas);

  // ------------------------------------------------
  // 7. Animation
  // ------------------------------------------------

  const clock = new Clock();

  let mixer = null;
  let hud;

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(
      clock.getDelta(),
      0.05
    );

    if (mixer) {
      mixer.update(delta);
    }

    controls.update();

    if (hud) renderer.resetState();
    renderer.render(scene, camera);
    if (hud) {
      try {
        hud.render();
      } catch (error) {
        hud = undefined;
        platform.hud = undefined;
        console.error(`${TAG} HUD render failed`, error);
      }
    }
  }

  animate();

  loadHud(canvas, renderer.getContext(), screen.width, screen.height, screen.pixelRatio)
    .then((overlay) => {
      const current = getScreenSize();
      overlay.resize(current.width, current.height, current.pixelRatio);
      hud = overlay;
      platform.hud = overlay;
      console.log(`${TAG} Pixi HUD initialized`);
    })
    .catch((error) => console.error(`${TAG} HUD initialization failed`, error));

  if (typeof wx.onWindowResize === 'function') {
    wx.onWindowResize((result) => {
      const current = getScreenSize();
      const width = result.size?.windowWidth || current.width;
      const height = result.size?.windowHeight || current.height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(current.pixelRatio);
      renderer.setSize(width, height);
      hud?.resize(width, height, current.pixelRatio);
      controls.update();
    });
  }

  console.log(
    `${TAG} Renderer initialized`
  );

  // ------------------------------------------------
  // 8. Draco Loader
  // ------------------------------------------------

  const dracoLoader = new WechatDracoLoader();

  const gltfLoader = new GLTFLoader();

  gltfLoader.setDRACOLoader(dracoLoader);

  // ------------------------------------------------
  // 9. 异步下载 GLB
  // ------------------------------------------------

  try {
    console.log(
      `${TAG} Loading remote model`,
      CONFIG.modelURL
    );

    const downloadStart = Date.now();

    let lastProgress = -1;

    const arrayBuffer = await loadRemoteGLB({
      url: CONFIG.modelURL,

      cacheKey: CONFIG.cacheKey,

      version: CONFIG.modelVersion,

      onProgress(info) {
        const progress = info.progress ?? 0;

        // 每 10% 输出一次日志
        const step = Math.floor(progress / 10);

        if (step !== lastProgress) {
          lastProgress = step;

          console.log(
            `[AssetLoader] Progress: ${progress}%`,
            info.fromCache ? '(cache)' : ''
          );
        }
      }
    });

    console.log(
      `${TAG} Resource ready`,
      {
        bytes: arrayBuffer.byteLength,
        elapsedMs: Date.now() - downloadStart
      }
    );

    // ----------------------------------------------
    // 10. 解析 Draco GLB
    // ----------------------------------------------

    const parseStart = Date.now();

    const gltf = await parseGLB(
      gltfLoader,
      arrayBuffer
    );

    console.log(
      `${TAG} GLB parsed`,
      {
        elapsedMs: Date.now() - parseStart,
        animations: gltf.animations.length
      }
    );

    // ----------------------------------------------
    // 11. 模型变换
    // ----------------------------------------------

    const model = gltf.scene;

    model.position.set(1, 1, 0);
    model.scale.setScalar(0.01);

    // ----------------------------------------------
    // 12. Toon 材质
    // ----------------------------------------------

    applyAnimeToon(model);

    scene.add(model);

    // ----------------------------------------------
    // 13. 动画
    // ----------------------------------------------

    if (gltf.animations.length > 0) {
      mixer = new AnimationMixer(model);

      const clip = gltf.animations[0];

      mixer.clipAction(clip).play();

      console.log(
        `${TAG} Animation:`,
        clip.name
      );
    }

    // ----------------------------------------------
    // 14. 统计
    // ----------------------------------------------

    let meshCount = 0;
    let vertexCount = 0;

    model.traverse((object) => {
      if (!object.isMesh) return;

      meshCount++;

      const position =
        object.geometry.getAttribute('position');

      if (position) {
        vertexCount += position.count;
      }
    });

    console.log(`${TAG} Scene ready`, {
      meshCount,
      vertexCount,
      animations: gltf.animations.length
    });
  } catch (error) {
    console.error(
      `${TAG} Model loading failed`,
      error
    );
  }

}

main().catch((error) => {
  console.error(
    `${TAG} Fatal error`,
    error
  );
});
