import {
  BoxGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, PLATFORM, Scene, WebGL1Renderer
} from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { WechatPlatform } from './platform/WechatPlatform';
import { loadHud } from './ui/loadHud';

declare const MODEL_DEMO: boolean;

function screenSize() {
  const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();
  return { width: windowWidth, height: windowHeight, resolution: Math.min(pixelRatio || 1, 2) };
}

function createCubeScene(scene: Scene, canvas: HTMLCanvasElement) {
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(3, 2, 5);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 12;
  controls.update();

  const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshStandardMaterial({ color: 0xf09338 }));
  const sunlight = new DirectionalLight(0xffffff, 1.5);
  sunlight.position.set(3, 4, 2);
  scene.add(cube, sunlight, new HemisphereLight(0xffffff, 0x6688aa, 1.2));
  return {
    camera,
    controls,
    update(delta: number) { cube.rotation.y += delta * 0.6; }
  };
}

async function main() {
  const tag = MODEL_DEMO ? '[ThreeDraco]' : '[Framework]';
  if (MODEL_DEMO) console.log(`${tag} Starting`);
  const canvas = wx.createCanvas();
  const platform = new WechatPlatform(canvas);
  PLATFORM.set(platform);
  const element = canvas as unknown as HTMLCanvasElement;
  const renderer = new WebGL1Renderer({ canvas: element, antialias: true, alpha: false });
  const scene = new Scene();
  scene.background = new Color(0xdce6ed);
  const { camera, controls, update } = MODEL_DEMO
    ? (await import('./scenes/LittlestTokyo')).createLittlestTokyoScene(scene, renderer, element)
    : createCubeScene(scene, element);

  let hud: Awaited<ReturnType<typeof loadHud>> | undefined;
  function resize(size?: { windowWidth: number; windowHeight: number }) {
    const screen = screenSize();
    const width = size?.windowWidth || screen.width;
    const height = size?.windowHeight || screen.height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(screen.resolution);
    renderer.setSize(width, height);
    hud?.resize(width, height, screen.resolution);
    controls.update();
  }
  resize();
  wx.onWindowResize?.(resize);
  if (MODEL_DEMO) console.log(`${tag} Renderer initialized`);

  let frame: number | undefined;
  let previousTime: number | undefined;
  function animate(time: number) {
    if (previousTime !== undefined) {
      update(Math.min((time - previousTime) / 1000, 0.05));
    }
    previousTime = time;
    controls.update();
    renderer.resetState();
    renderer.render(scene, camera);
    if (hud) {
      try {
        hud.render();
      } catch (error) {
        hud = undefined;
        platform.hud = undefined;
        console.error(`${tag} HUD render failed`, error);
        if (!MODEL_DEMO) {
          wx.showModal({ title: 'HUD render failed', content: String(error), showCancel: false });
        }
      }
    }
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  wx.onHide(() => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    previousTime = undefined;
  });
  wx.onShow(() => {
    if (frame === undefined) frame = requestAnimationFrame(animate);
  });

  const { width, height, resolution } = screenSize();
  const gl = renderer.getContext();
  try {
    const overlay = await loadHud(canvas, gl, width, height, resolution);
    const current = screenSize();
    overlay.resize(current.width, current.height, current.resolution);
    hud = overlay;
    platform.hud = overlay;
    if (MODEL_DEMO) console.log(`${tag} Pixi HUD initialized`);
    else console.log(`${tag} Three and Pixi initialized`, gl.getParameter(gl.VERSION));
  } catch (error) {
    console.error(`${tag} HUD initialization failed`, error);
    if (!MODEL_DEMO) {
      wx.showModal({ title: 'HUD initialization failed', content: String(error), showCancel: false });
    }
  }
}

main().catch((error: unknown) => {
  if (MODEL_DEMO) console.error('[ThreeDraco] Fatal error', error);
  else {
    console.error('[Framework] Initialization failed', error);
    wx.showModal({ title: 'Initialization failed', content: String(error), showCancel: false });
  }
});
