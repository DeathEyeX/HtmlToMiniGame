import {
  Color, type PerspectiveCamera, PLATFORM, Scene, WebGL1Renderer, type WebGLRenderer
} from 'three-platformize';
import type { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
import { WechatPlatform, type RoutedTouchEvent } from '../platform/WechatPlatform';
import { loadHud } from '../ui/loadHud';
import type { CreateHudView } from '../ui/PixiHud';

declare const GAME_RENDERER: 'webgl1' | 'webgl2';

interface SceneSetup {
  camera: PerspectiveCamera;
  controls?: OrbitControls;
  touch?(event: RoutedTouchEvent): void;
  resize?(width: number, height: number): void;
  update(delta: number): void;
  afterRender?(): void;
  dispose?(): void;
  renderSettings?: Partial<Pick<WebGLRenderer, 'outputEncoding' | 'toneMapping' | 'toneMappingExposure' | 'physicallyCorrectLights'>>;
  shadowSettings?: Partial<Pick<WebGLRenderer['shadowMap'], 'enabled' | 'type' | 'autoUpdate' | 'needsUpdate'>>;
}

export type CreateLocalScene = (
  scene: Scene,
  renderer: WebGLRenderer,
  canvas: HTMLCanvasElement
) => SceneSetup;

type CreateScene = (...args: Parameters<CreateLocalScene>) => SceneSetup | Promise<SceneSetup>;

interface StartupDiagnostics {
  tag: string;
  hudReadyMessage: string;
  showHudErrorModal: boolean;
}

function screenSize() {
  const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();
  return { width: windowWidth, height: windowHeight, resolution: Math.min(pixelRatio || 1, 2) };
}

export async function startGame(
  createScene: CreateScene, diagnostics: StartupDiagnostics, loadHudView?: () => Promise<CreateHudView>
) {
  const { tag, hudReadyMessage, showHudErrorModal } = diagnostics;
  const canvas = wx.createCanvas();
  const platform = new WechatPlatform(canvas);
  PLATFORM.set(platform);
  const element = canvas as unknown as HTMLCanvasElement;
  const renderer = typeof GAME_RENDERER !== 'undefined' && GAME_RENDERER === 'webgl2'
    ? (await import('../rendering/createWebGL2Renderer')).createWebGL2Renderer(element)
    : new WebGL1Renderer({ canvas: element, antialias: true, alpha: false });
  const gl = renderer.getContext();
  const webGLVersion = renderer.capabilities.isWebGL2 ? 2 : 1;
  const defaultRenderSettings = {
    outputEncoding: renderer.outputEncoding,
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    physicallyCorrectLights: renderer.physicallyCorrectLights
  };
  const shadowMap = renderer.shadowMap;
  const defaultShadowSettings = shadowMap && {
    enabled: shadowMap.enabled,
    type: shadowMap.type,
    autoUpdate: shadowMap.autoUpdate,
    needsUpdate: shadowMap.needsUpdate
  };
  function createWorld() {
    const scene = new Scene();
    scene.background = new Color(0xdce6ed);
    return scene;
  }

  let scene = createWorld();
  let active = await createScene(scene, renderer, element);
  let viewport = screenSize();

  let hud: Awaited<ReturnType<typeof loadHud>> | undefined;
  function applySceneSettings() {
    Object.assign(renderer, defaultRenderSettings, active.renderSettings);
    if (shadowMap) Object.assign(shadowMap, defaultShadowSettings, active.shadowSettings);
    platform.sceneTouch = active.touch;
  }
  function fitCamera() {
    active.camera.aspect = viewport.width / viewport.height;
    active.resize?.(viewport.width, viewport.height);
    active.camera.updateProjectionMatrix();
    active.controls?.update();
  }
  function resize() {
    fitCamera();
    renderer.setPixelRatio(viewport.resolution);
    renderer.setSize(viewport.width, viewport.height);
    hud?.resize(viewport.width, viewport.height, viewport.resolution);
  }

  function reportHudError(title: string, error: unknown) {
    console.error(`${tag} ${title}`, error);
    if (showHudErrorModal || webGLVersion === 2) {
      wx.showModal({ title, content: String(error), showCancel: false });
    }
  }

  applySceneSettings();
  resize();
  wx.onWindowResize?.((size) => {
    const screen = screenSize();
    viewport = {
      width: size?.windowWidth || screen.width,
      height: size?.windowHeight || screen.height,
      resolution: screen.resolution
    };
    resize();
  });
  console.log(`${tag} Renderer initialized`);

  let frame: number | undefined;
  let previousTime: number | undefined;
  let reportFirstThreeFrame = webGLVersion === 2;
  let reportFirstPixiFrame = webGLVersion === 2;
  function reportFrame(engine: string) {
    const error = gl.getError();
    if (error !== gl.NO_ERROR) console.error(`[WebGL2] ${engine} first frame GL error`, error);
    else console.log(`[WebGL2] ${engine} first frame GL_NO_ERROR`);
  }
  function animate(time: number) {
    if (previousTime !== undefined) {
      active.update(Math.min((time - previousTime) / 1000, 0.05));
    }
    previousTime = time;
    active.controls?.update();
    renderer.resetState();
    renderer.render(scene, active.camera);
    active.afterRender?.();
    if (reportFirstThreeFrame) {
      reportFirstThreeFrame = false;
      reportFrame('Three');
    }
    if (hud) {
      try {
        hud.render();
        if (reportFirstPixiFrame) {
          reportFirstPixiFrame = false;
          reportFrame('Pixi');
        }
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

  const { width, height, resolution } = viewport;
  try {
    const overlay = await loadHud(canvas, gl, width, height, resolution, loadHudView, webGLVersion);
    overlay.resize(viewport.width, viewport.height, viewport.resolution);
    hud = overlay;
    platform.hud = overlay;
    console.log(`${tag} ${hudReadyMessage}`, gl.getParameter(gl.VERSION));
  } catch (error) {
    reportHudError('HUD initialization failed', error);
  }

  return {
    switchScene<T extends SceneSetup>(createNext: (...args: Parameters<CreateLocalScene>) => T): T {
      const next = createWorld();
      const setup = createNext(next, renderer, element);
      active.controls?.dispose();
      active.dispose?.();
      scene = next;
      active = setup;
      applySceneSettings();
      previousTime = undefined;
      fitCamera();
      return setup;
    }
  };
}
