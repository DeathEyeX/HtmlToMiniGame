import { MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3, type Object3D } from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';

export type OceanView =
  | { kind: 'overview' | 'roof' }
  | { kind: 'room' | 'workbench'; roomId: string };

interface RoomTarget {
  id: string;
  anchor: Vector3;
  side: number;
  close?: boolean;
}

const cameraDistance = 31.65;

export function createOceanCamera(
  camera: PerspectiveCamera,
  rooms: readonly RoomTarget[],
  roof: number,
  workbenchLook: Vector3,
  proportions: Vector3,
  pickTargets: Object3D[],
  onChange: () => void
) {
  let view: OceanView = { kind: 'overview' };
  let width = 1, height = 1, span = 24.15;
  let yaw = .47, pitch = .60, zoom = 1;
  let goalYaw = yaw, goalPitch = pitch, goalZoom = zoom;
  const look = new Vector3(.58, 8.52, .62);
  const target = look.clone();
  const offset = new Vector3();
  const ray = new Raycaster();
  const pointer = new Vector2();

  function setTarget(next: OceanView) {
    const aspect = width / height;
    const compact = aspect < 1;
    const visibleSpan = span * Math.min(1, aspect);
    if (next.kind === 'workbench') {
      target.copy(workbenchLook).multiply(proportions);
      if (compact) target.y -= .07;
      goalYaw = -.13;
      goalPitch = .25;
      goalZoom = Math.min(9.2, visibleSpan / 1.85);
    } else if (next.kind === 'room') {
      const room = rooms.find(item => item.id === next.roomId);
      if (!room) return false;
      target.copy(room.anchor).multiply(proportions);
      if (compact) target.y -= .14;
      goalYaw = room.close ? (room.side < 0 ? .20 : .14) : .10;
      goalPitch = room.close ? .125 : .17;
      goalZoom = Math.min(6.2, visibleSpan / 4.22);
    } else if (next.kind === 'roof') {
      target.set(0, roof * proportions.y + .68, -.60);
      goalYaw = .36;
      goalPitch = .69;
      goalZoom = Math.min(2.2, visibleSpan / 9);
    } else {
      target.set(.58, 8.52, .62);
      goalYaw = .47;
      goalPitch = .60;
      goalZoom = compact ? .94 : 1;
    }
    return true;
  }

  function setView(next: OceanView) {
    if (!setTarget(next)) return;
    view = next;
    onChange();
  }

  function placeCamera() {
    const flat = Math.cos(pitch) * cameraDistance;
    offset.set(Math.sin(yaw) * flat, Math.sin(pitch) * cameraDistance, Math.cos(yaw) * flat);
    camera.position.copy(look).add(offset);
    camera.lookAt(look);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    const aspect = width / height;
    span = Math.max(24.15, 11.10 / aspect);
    camera.aspect = aspect;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(span / (2 * cameraDistance)));
    setTarget(view);
    placeCamera();
  }

  type Press = { id: number; x: number; y: number; moved: boolean };
  let press: Press | undefined;
  let pinch = 0;
  type Touch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };
  const xAt = (touch: Touch) => touch.clientX ?? touch.pageX ?? touch.x ?? 0;
  const yAt = (touch: Touch) => touch.clientY ?? touch.pageY ?? touch.y ?? 0;
  const distance = (a: Touch, b: Touch) => Math.hypot(xAt(a) - xAt(b), yAt(a) - yAt(b));

  function start(event: RoutedTouchEvent) {
    if (event.touches.length === 2) {
      press = undefined;
      pinch = distance(event.touches[0], event.touches[1]);
    } else if (event.touches.length === 1) {
      const touch = event.touches[0];
      press = { id: touch.identifier, x: xAt(touch), y: yAt(touch), moved: false };
    }
  }

  function move(event: RoutedTouchEvent) {
    if (event.touches.length === 2) {
      const spacing = distance(event.touches[0], event.touches[1]);
      if (pinch > 0 && spacing > 0) {
        const next = goalZoom * spacing / pinch;
        goalZoom = view.kind === 'workbench' ? MathUtils.clamp(next, 4.6, 12)
          : MathUtils.clamp(next, .63, view.kind === 'room' ? 6.2 : 4.9);
      }
      pinch = spacing;
      return;
    }
    const touch = event.touches[0];
    if (!press || !touch || press.id !== touch.identifier) return;
    const dx = xAt(touch) - press.x;
    const dy = yAt(touch) - press.y;
    if (!press.moved && Math.hypot(dx, dy) < 4) return;
    press.moved = true;
    press.x = xAt(touch);
    press.y = yAt(touch);
    goalYaw = MathUtils.clamp(goalYaw - dx * .008, -1.24, 1.24);
    goalPitch = MathUtils.clamp(goalPitch + dy * .005, .07, 1.02);
  }

  function end(event: RoutedTouchEvent) {
    pinch = 0;
    const touch = event.changedTouches.find(item => item.identifier === press?.id);
    const tapped = press && !press.moved && touch && Math.hypot(xAt(touch) - press.x, yAt(touch) - press.y) < 4;
    press = undefined;
    if (!tapped || !touch || event.type === 'touchcancel') return;
    pointer.set(xAt(touch) / width * 2 - 1, 1 - yAt(touch) / height * 2);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(pickTargets)[0];
    const room = hit?.object.userData.room as RoomTarget | undefined;
    if (room) setView({ kind: 'room', roomId: room.id });
  }

  placeCamera();

  return {
    view: () => view,
    setView,
    resize,
    update(fade: number) {
      look.lerp(target, fade);
      yaw = MathUtils.lerp(yaw, goalYaw, fade);
      pitch = MathUtils.lerp(pitch, goalPitch, fade);
      zoom = MathUtils.lerp(zoom, goalZoom, fade);
      placeCamera();
      return { yaw, pitch, zoom };
    },
    touch(event: RoutedTouchEvent) {
      if (event.type === 'touchstart') start(event);
      else if (event.type === 'touchmove') move(event);
      else end(event);
    }
  };
}
