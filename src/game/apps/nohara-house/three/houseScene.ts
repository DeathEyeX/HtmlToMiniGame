import { Box3, Color, DirectionalLight, HemisphereLight, MathUtils, PerspectiveCamera, Spherical, Vector3, type Scene } from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';
import { createHouseModel } from './houseModels';
import type { RoomId } from '../rooms';

const backdrops: Record<RoomId, number> = {
  exterior: 0xe9edcf,
  living: 0xf4e4c6,
  kitchen: 0xe4ead1,
  tatami: 0xece9c5,
  kids: 0xf7e4bd,
  bath: 0xdcebec
};

type SceneTouch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };

function dragPoint(touch: SceneTouch) {
  const x = touch.clientX ?? touch.pageX ?? touch.x;
  const y = touch.clientY ?? touch.pageY ?? touch.y;
  if (x !== undefined && y !== undefined) return { id: touch.identifier, x, y };
}

export function createHouseScene(scene: Scene, room: RoomId) {
  const model = createHouseModel(room);
  const camera = new PerspectiveCamera(35, 1, .1, 160);
  const daylight = new DirectionalLight(0xfff5df, .76);
  daylight.position.set(-3, 7, 5);
  scene.background = new Color(backdrops[room]);
  scene.add(model.group, new HemisphereLight(0xfff4dc, 0xc5a08d, .53), daylight);

  const center = new Box3().setFromObject(model.group).getCenter(new Vector3());
  const orbit = new Spherical().setFromVector3(new Vector3(1.04, 1, 1.58).normalize());
  const outside = room === 'exterior';
  const widthInView = room === 'exterior' ? 17.3 : 11.8;
  const heightInView = room === 'exterior' ? 10.6 : 7.45;
  let drag: ReturnType<typeof dragPoint>;
  let radiansPerPixel = 0;
  let progress = outside ? 1 : 0;
  camera.zoom = progress === 1 ? 1 : .948;

  function aimCamera() {
    camera.position.setFromSpherical(orbit).add(center);
    camera.lookAt(center);
  }

  return {
    camera,
    resize(width: number, height: number) {
      const aspect = width / height;
      radiansPerPixel = 4.1 / width;
      orbit.radius = Math.max(widthInView / aspect, heightInView) / (2 * Math.tan(camera.fov * Math.PI / 360));
      aimCamera();
      // Shift the model up to leave room for the bottom controls.
      camera.setViewOffset(width, height, 0, height * .08, width, height);
    },
    touch(event: RoutedTouchEvent) {
      if (event.type === 'touchcancel' || event.type === 'touchend' || event.touches.length !== 1) {
        drag = undefined;
        return;
      }
      const point = dragPoint(event.touches[0]);
      if (event.type === 'touchstart') {
        drag = point;
        return;
      }
      if (event.type !== 'touchmove' || !point || !drag || point.id !== drag.id) return;
      const yaw = orbit.theta - (point.x - drag.x) * radiansPerPixel;
      // Interior sets have two fixed walls. Keep the orbit within their open sides.
      orbit.theta = outside ? yaw % (2 * Math.PI) : MathUtils.clamp(yaw, -.12, Math.PI / 2 + .12);
      orbit.phi = MathUtils.clamp(orbit.phi - (point.y - drag.y) * radiansPerPixel, .52, 1.32);
      drag = point;
      aimCamera();
    },
    update(delta: number) {
      if (progress >= 1) return;
      progress = Math.min(1, progress + delta * 4);
      camera.zoom = 1 - .052 * (1 - progress) ** 3;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.remove(model.group);
      model.dispose();
    }
  };
}
