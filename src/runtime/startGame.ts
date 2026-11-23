import {
  Color, type PerspectiveCamera, PLATFORM, Scene, WebGL1Renderer
} from 'three-platformize';
import type { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { WechatPlatform } from '../platform/WechatPlatform';
import { loadHud } from '../ui/loadHud';

interface SceneSetup {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  update(delta: number): void;
}

type CreateScene = (
  scene: Scene,
  renderer: WebGL1Renderer,
  canvas: HTMLCanvasElement
) => SceneSetup | Promise<SceneSetup>;

interface StartupDiagnostics {
  tag: string;
  hudReadyMessage: string;
  showHudErrorModal: boolean;
}

function screenSize() {
  const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();
  return { width: windowWidth, height: windowHeight, resolution: Math.min(pixelRatio || 1, 2) };
}

export async function startGame(createScene: CreateScene, diagnostics: StartupDiagnostics) {
  const { tag, hudReadyMessage, showHudErrorModal } = diagnostics;
  const canvas = wx.createCanvas();
  const platform = new WechatPlatform(canvas);
  PLATFORM.set(platform);
  const element = canvas as unknown as HTMLCanvasElement;
  const renderer = new WebGL1Renderer({ canvas: element, antialias: true, alpha: false });
  const scene = new Scene();
  scene.background = new Color(0xdce6ed);
  const { camera, controls, update } = await createScene(scene, renderer, element);

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

  function reportHudError(title: string, error: unknown) {
    console.error(`${tag} ${title}`, error);
    if (showHudErrorModal) {
      wx.showModal({ title, content: String(error), showCancel: false });
    }
  }

  resize();
  wx.onWindowResize?.(resize);
  console.log(`${tag} Renderer initialized`);

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
        reportHudError('HUD render failed', error);
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
    console.log(`${tag} ${hudReadyMessage}`, gl.getParameter(gl.VERSION));
  } catch (error) {
    reportHudError('HUD initialization failed', error);
  }
}
