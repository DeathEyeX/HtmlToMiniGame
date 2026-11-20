import {
  BoxGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, PLATFORM, Scene, WebGL1Renderer
} from 'three-platformize';
import { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { WechatPlatform } from './platform/WechatPlatform';
import { loadHud } from './ui/loadHud';

function screenSize() {
  const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();
  return { width: windowWidth, height: windowHeight, resolution: Math.min(pixelRatio || 1, 2) };
}

async function main() {
  const canvas = wx.createCanvas();
  const platform = new WechatPlatform(canvas);
  PLATFORM.set(platform);
  const element = canvas as unknown as HTMLCanvasElement;
  const renderer = new WebGL1Renderer({ canvas: element, antialias: true });
  const scene = new Scene();
  scene.background = new Color(0xdce6ed);
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(3, 2, 5);
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 12;
  controls.update();

  const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshStandardMaterial({ color: 0xf09338 }));
  const sunlight = new DirectionalLight(0xffffff, 1.5);
  sunlight.position.set(3, 4, 2);
  scene.add(cube, sunlight, new HemisphereLight(0xffffff, 0x6688aa, 1.2));

  let hud: Awaited<ReturnType<typeof loadHud>> | undefined;
  function resize() {
    const { width, height, resolution } = screenSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(resolution);
    renderer.setSize(width, height);
    hud?.resize(width, height, resolution);
  }
  resize();
  wx.onWindowResize?.(resize);

  let frame: number | undefined;
  let previousTime: number | undefined;
  function animate(time: number) {
    if (previousTime !== undefined) {
      cube.rotation.y += Math.min((time - previousTime) / 1000, 0.05) * 0.6;
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
        console.error('[Framework] HUD render failed', error);
        wx.showModal({ title: 'HUD render failed', content: String(error), showCancel: false });
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
  hud = await loadHud(canvas, renderer.getContext(), width, height, resolution);
  platform.hud = hud;
  resize();
  console.log('[Framework] Three and Pixi initialized', renderer.getContext().getParameter(renderer.getContext().VERSION));
}

main().catch((error: unknown) => {
  console.error('[Framework] Initialization failed', error);
  wx.showModal({ title: 'Initialization failed', content: String(error), showCancel: false });
});
