import { MathUtils, PerspectiveCamera, Vector3 } from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';
import { zones, type ZoneId } from '../content';

const homeYaw = .52;
const homePitch = .77;
const center = new Vector3(0, 2.34, 1.36);
type Touch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };
const pointAt = (touch: Touch) => ({
  id: touch.identifier, x: touch.clientX ?? touch.pageX ?? touch.x ?? 0,
  y: touch.clientY ?? touch.pageY ?? touch.y ?? 0
});

export function createOrbit() {
  const camera = new PerspectiveCamera(28, 1, .24, 380);
  const look = center.clone();
  const target = center.clone();
  let yaw = homeYaw, pitch = homePitch, goalYaw = yaw, goalPitch = pitch;
  let distance = 70, fit = distance, zoom = 1, scale = 1;
  let zone: ZoneId | undefined;
  let active: ReturnType<typeof pointAt> | undefined;
  let pinch = 0;

  function fitView() {
    // 竖屏按横向跨度取景，横屏则保留观察塔和近侧栈桥的上下余量。
    const span = zone ? Math.max(10.9 / camera.aspect, 10.7) : Math.max(33.0 / camera.aspect, 29.2);
    fit = span / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  }

  function place() {
    const flat = Math.cos(pitch) * distance;
    camera.position.set(look.x + flat * Math.sin(yaw), look.y + distance * Math.sin(pitch), look.z + flat * Math.cos(yaw));
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }

  function changeZoom(factor: number) {
    zoom = MathUtils.clamp(zoom * factor, zone ? .70 : .49, 1.48);
  }

  return {
    camera,
    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.setViewOffset(width, height, 0, camera.aspect < .8 ? height * .030 : 0, width, height);
      scale = 3.5 / Math.min(width, height);
      fitView();
      distance = fit * zoom;
      place();
    },
    view(next?: ZoneId) {
      zone = next;
      target.copy(center);
      if (next) {
        const { position, view } = zones[next];
        target.set(position[0] + view[0], position[1] + view[1], position[2] + view[2]);
      }
      goalYaw = yaw + Math.atan2(Math.sin(homeYaw - yaw), Math.cos(homeYaw - yaw));
      goalPitch = next ? .64 : homePitch;
      zoom = 1;
      fitView();
    },
    changeZoom,
    touch(event: RoutedTouchEvent) {
      if (event.type === 'touchcancel' || event.touches.length === 0 || event.touches.length > 2) {
        active = undefined;
        pinch = 0;
        return;
      }
      if (event.touches.length === 2) {
        const a = pointAt(event.touches[0]);
        const b = pointAt(event.touches[1]);
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch && gap && event.type === 'touchmove') changeZoom(pinch / gap);
        pinch = gap;
        active = undefined;
        return;
      }
      const point = pointAt(event.touches[0]);
      if (active?.id === point.id && event.type === 'touchmove') {
        goalYaw -= (point.x - active.x) * scale;
        goalPitch = MathUtils.clamp(goalPitch + (point.y - active.y) * scale * .56, .26, 1.14);
      }
      active = point;
      pinch = 0;
    },
    update(delta: number) {
      const alpha = 1 - Math.exp(-delta * 8.5);
      look.lerp(target, alpha);
      yaw = MathUtils.lerp(yaw, goalYaw, alpha);
      pitch = MathUtils.lerp(pitch, goalPitch, alpha);
      distance = MathUtils.lerp(distance, fit * zoom, alpha);
      place();
    }
  };
}
