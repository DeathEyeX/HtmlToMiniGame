import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, MathUtils,
  PCFSoftShadowMap, PerspectiveCamera, Vector3, sRGBEncoding, type Scene, type WebGLRenderTarget
} from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';
import { createOutpostModel } from './outpostModel';

const presets = {
  iso: [.74, 1.02, 31],
  front: [0, 1.30, 31],
  side: [Math.PI / 2, 1.30, 31],
  back: [Math.PI, 1.22, 31],
  top: [0, .035, 37]
} as const;
const focusHeight = .9;
const maxCameraRadius = 125;

export type ViewPreset = keyof typeof presets;
type Touch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };
function point(touch: Touch) {
  return {
    x: touch.clientX ?? touch.pageX ?? touch.x ?? 0,
    y: touch.clientY ?? touch.pageY ?? touch.y ?? 0
  };
}

export function createScene(scene: Scene) {
  const model = createOutpostModel();
  scene.add(model.root);
  scene.background = new Color(0x343c3e);
  scene.fog = new Fog(0x343c3e, 110, 205);
  scene.add(new HemisphereLight(0xd8e4eb, 0x55523d, 2.15));
  const sun = new DirectionalLight(0xffe3bd, 3.2);
  sun.position.set(-12, 22, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 65 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .025;
  scene.add(sun);
  const rim = new DirectionalLight(0xa5bdcf, 1.25);
  rim.position.set(10, 8, -12);
  scene.add(rim);

  const camera = new PerspectiveCamera(38, 1, .1, 230);
  const target = new Vector3(0, focusHeight, 0);
  let theta: number = presets.iso[0];
  let phi: number = presets.iso[1];
  let distance: number = presets.iso[2];
  let framing = 1;
  let spinning = false;
  let wireframe = false;
  let preset: ViewPreset | undefined = 'iso';
  let previous: { x: number; y: number; span: number; count: number } | undefined;
  let onChange: (() => void) | undefined;

  function positionCamera() {
    const radius = distance * framing;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
  }
  function zoom(scale: number) {
    distance = MathUtils.clamp(distance * scale, 9, Math.min(70, maxCameraRadius / framing));
    positionCamera();
  }

  positionCamera();
  return {
    camera,
    renderSettings: {
      outputEncoding: sRGBEncoding, toneMapping: ACESFilmicToneMapping,
      toneMappingExposure: 1.35, physicallyCorrectLights: true
    },
    // 建筑、灯光与地台固定，相机移动时可复用首帧的阴影。
    shadowSettings: { enabled: true, type: PCFSoftShadowMap, autoUpdate: false, needsUpdate: true },
    update(delta: number) {
      if (spinning) {
        theta += delta * .25;
        positionCamera();
      }
    },
    resize(width: number, height: number) {
      // 给首屏地台四角留出空间，竖屏以水平视角为约束。
      framing = MathUtils.clamp(1.4 * height / width, 1.5, 3.15);
      zoom(1);
    },
    touch(event: RoutedTouchEvent) {
      const [first, second] = event.touches;
      if (!first || event.type === 'touchcancel') {
        previous = undefined;
        return;
      }
      const a = point(first);
      const b = second ? point(second) : a;
      const current = {
        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        span: Math.hypot(a.x - b.x, a.y - b.y), count: second ? 2 : 1
      };
      if (event.type === 'touchstart' && spinning) {
        spinning = false;
        onChange?.();
      }
      // 手指数量变化时重新取基准，避免从旋转切换到缩放时出现跳变。
      if (event.type === 'touchmove' && previous?.count === current.count) {
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        if (second) {
          target.x -= dx * .018 * Math.cos(theta);
          target.z += dx * .018 * Math.sin(theta);
          target.y += dy * .018;
          if (current.span > 1 && previous.span > 1) zoom(previous.span / current.span);
        } else {
          theta -= dx * .008;
          phi = MathUtils.clamp(phi - dy * .008, .03, 1.53);
        }
        if (preset) {
          preset = undefined;
          onChange?.();
        }
        positionCamera();
      }
      previous = current;
    },
    selectView(view: ViewPreset) {
      [theta, phi, distance] = presets[view];
      preset = view;
      spinning = false;
      target.set(0, focusHeight, 0);
      positionCamera();
      onChange?.();
    },
    zoom,
    toggleSpin() {
      spinning = !spinning;
      if (spinning) preset = undefined;
      onChange?.();
    },
    toggleWireframe() {
      wireframe = !wireframe;
      model.setWireframe(wireframe);
      onChange?.();
    },
    state: () => ({ preset, spinning, wireframe }),
    onControlsChanged(listener: () => void) { onChange = listener; },
    dispose() {
      model.dispose();
      (sun.shadow.map as WebGLRenderTarget | null)?.dispose();
      onChange = undefined;
    }
  };
}
