import { MathUtils, PerspectiveCamera, Vector3 } from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';
import { landings, stops, type Position, type Stop, type View } from '../content';

const presets: Record<View, { center: Position; yaw: number; pitch: number; width: number; height: number }> = {
  harbor: { center: [0, 3.7, .7], yaw: .60, pitch: .47, width: 24.2, height: 22.8 },
  coast: { center: [20, .95, -10.9], yaw: .54, pitch: .28, width: 24, height: 19.1 },
  depths: { center: [2.10, -10.4, 18.9], yaw: .59, pitch: .29, width: 24.7, height: 23.9 }
};

type Point = { id: number; x: number; y: number };
type Touch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };
const pointAt = (touch: Touch): Point => ({
  id: touch.identifier,
  x: touch.clientX ?? touch.pageX ?? touch.x ?? 0,
  y: touch.clientY ?? touch.pageY ?? touch.y ?? 0
});

export function createHarborCamera() {
  const camera = new PerspectiveCamera(37, 1, .15, 290);
  const center = new Vector3(...presets.harbor.center);
  const target = center.clone();
  const offset = new Vector3();
  let view: View = 'harbor';
  let area: Stop | undefined;
  let width = 1;
  let height = 1;
  let fit = 1;
  let radius = 1;
  let yaw: number = presets.harbor.yaw;
  let pitch: number = presets.harbor.pitch;
  let goalYaw = yaw;
  let goalPitch = pitch;
  let zoom = 1;
  let dive = 0;
  let drag: Point | undefined;
  let pinch = 0;

  function fitDistance() {
    const preset = presets[view];
    const span = area ? Math.max(15.4 / camera.aspect, 14.2) : Math.max(preset.width / camera.aspect, preset.height);
    fit = span / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  }

  function place() {
    const horizontal = Math.cos(pitch) * radius;
    offset.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * radius, Math.cos(yaw) * horizontal);
    camera.position.copy(center).add(offset);
    // 海底灯光和水面背光以镜头的真实高度为准。潜入后把镜头留在海床和水面之间。
    const submergedY = MathUtils.clamp(camera.position.y, -15.6, -1.26);
    camera.position.y = MathUtils.lerp(camera.position.y, submergedY, dive);
    camera.lookAt(center);
    camera.updateMatrixWorld();
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    camera.aspect = width / height;
    fitDistance();
    radius = fit * zoom;
    // 给底部 Pixi 导航保留空间，同时让横屏仍能看到船头。
    camera.setViewOffset(width, height, 0, height * (camera.aspect < 1 ? .045 : .048), width, height);
    place();
  }

  function setView(next: View) {
    view = next;
    area = undefined;
    const preset = presets[view];
    target.set(...preset.center);
    goalYaw = yaw + Math.atan2(Math.sin(preset.yaw - yaw), Math.cos(preset.yaw - yaw));
    goalPitch = preset.pitch;
    zoom = 1;
    fitDistance();
  }

  function selectArea(id: Stop) {
    if (view !== 'harbor') setView('harbor');
    area = id;
    const [x, y, z] = landings[stops[id].node];
    target.set(x * .55, 1.75 + y * .58, z * .53);
    goalPitch = .46;
    zoom = 1;
    fitDistance();
  }

  function touch(event: RoutedTouchEvent) {
    if (event.type === 'touchcancel') {
      drag = undefined;
      pinch = 0;
      return;
    }
    if (event.touches.length === 2) {
      const [a, b] = event.touches.map(pointAt);
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (event.type === 'touchmove' && pinch > 0 && distance > 0) zoom = MathUtils.clamp(zoom * pinch / distance, .68, 1.62);
      pinch = distance;
      drag = undefined;
      return;
    }
    if (event.touches.length !== 1) {
      drag = undefined;
      pinch = 0;
      return;
    }
    const point = pointAt(event.touches[0]);
    if (event.type === 'touchmove' && drag?.id === point.id) {
      const scale = 4.35 / Math.min(width, height);
      goalYaw -= (point.x - drag.x) * scale;
      goalPitch = MathUtils.clamp(goalPitch + (point.y - drag.y) * scale * .55, view === 'depths' ? -.18 : .09, view === 'depths' ? .51 : 1.03);
    }
    // 从双指回到单指时重新记录起点，避免继承缩放前的拖动位置。
    drag = point;
    pinch = 0;
  }

  return {
    camera, resize, touch, setView, selectArea,
    update(delta: number) {
      const amount = 1 - Math.exp(-delta * 7.4);
      center.lerp(target, amount);
      yaw = MathUtils.lerp(yaw, goalYaw, amount);
      pitch = MathUtils.lerp(pitch, goalPitch, amount);
      radius = MathUtils.lerp(radius, fit * zoom, amount);
      dive = MathUtils.lerp(dive, view === 'depths' ? 1 : 0, amount);
      place();
    }
  };
}
