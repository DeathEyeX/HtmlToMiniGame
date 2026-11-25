import { MathUtils, PerspectiveCamera, Vector3 } from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';
import { zones, type ZoneId } from '../content';

const homeYaw = .54;
// 44° 俯角同时看到屋顶和立面，符合经营建造类广告的斜俯视构图。
const homePitch = .77;
const center = new Vector3(-.4, 3.15, 1.0);
type Touch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };
const pointAt = (touch: Touch) => ({
  id: touch.identifier, x: touch.clientX ?? touch.pageX ?? touch.x ?? 0,
  y: touch.clientY ?? touch.pageY ?? touch.y ?? 0
});

export function createCameraRig() {
  const camera = new PerspectiveCamera(27, 1, .24, 520);
  const look = center.clone();
  const target = center.clone();
  let yaw = homeYaw, pitch = homePitch, goalYaw = yaw, goalPitch = pitch;
  let distance = 78, fit = distance, zoom = 1, scale = 1;
  let zone: ZoneId | undefined;
  let reveal = 0, goalReveal = 0;
  let active: ReturnType<typeof pointAt> | undefined;
  let pinch = 0;

  function fitView() {
    // 全景按横向跨度取景，让基地占满画面宽度；竖屏时以 33 个世界单位为准，
    // 横屏时用 23.5 的垂直跨度兜底，避免上下留白过多。
    const span = zone
      ? (zone === 'depths' ? Math.max(18.0 / camera.aspect, 16.0) : Math.max(14.6 / camera.aspect, 13.4))
      : Math.max(33.0 / camera.aspect, 26.6);
    fit = span / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  }

  function depthPitch() {
    // 相机降到水面以下约 1.9 米，从侧面看进水下层；距离越远俯角越小。
    return Math.asin(MathUtils.clamp(1.9 / fit, .012, .62));
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
      // 竖屏时把取景中心上提一点，基地位于画面中部，底部留给功能区。
      camera.setViewOffset(width, height, 0, camera.aspect < .8 ? height * .052 : 0, width, height);
      scale = 3.5 / Math.min(width, height);
      fitView();
      distance = fit * zoom;
      if (zone === 'depths') goalPitch = depthPitch();
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
      goalReveal = next === 'depths' ? 1 : 0;
      zoom = 1;
      fitView();
      // 水下城用贴近水面的侧视镜头，水面透明度同步提高，避难舱才能读清。
      goalPitch = next === 'depths' ? depthPitch() : next ? .66 : homePitch;
    },
    changeZoom,
    reveal: () => reveal,
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
      reveal = MathUtils.lerp(reveal, goalReveal, 1 - Math.exp(-delta * 4.2));
      place();
    }
  };
}
