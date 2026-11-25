import * as THREE from 'three-platformize';
import type { RoutedTouchEvent } from '../../../../framework/platform/WechatPlatform';
import { createBeast } from './beast';
import { createStage, deckHeight } from './stage';
import { createWraith } from './wraith';

const framing = {
  wraith: { yaw: -.43, pitch: 1.42, focus: 3.14, radius: 12.2, portraitRadius: 6.95 },
  hound: { yaw: .83, pitch: 1.26, focus: 1.91, radius: 12.6, portraitRadius: 10.6 }
};
export type Specimen = keyof typeof framing;
type Touch = RoutedTouchEvent['touches'][number] & { x?: number; y?: number };

function pointOf(touch: Touch) {
  const x = touch.clientX ?? touch.pageX ?? touch.x;
  const y = touch.clientY ?? touch.pageY ?? touch.y;
  if (x !== undefined && y !== undefined) return { id: touch.identifier, x, y };
}

export function createExhibitScene(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x101622);
  scene.fog = new THREE.Fog(0x101622, 22, 64);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 85);
  const focus = new THREE.Vector3();
  const orbit = new THREE.Spherical();
  const { turntable, updateContacts } = createStage(scene);
  const models = { wraith: createWraith(), hound: createBeast() };
  let specimen: Specimen = 'wraith';
  for (const { root } of Object.values(models)) {
    root.position.y = deckHeight + .018;
    turntable.add(root);
  }
  models.hound.root.visible = false;

  const key = new THREE.DirectionalLight(0xe7f6ff, 1.42);
  key.position.set(4, 8, 6);
  const rim = new THREE.DirectionalLight(0x58ffe4, 1.65);
  rim.position.set(-4, 3, -5);
  const fill = new THREE.DirectionalLight(0xff579f, .92);
  fill.position.set(5, 2, -4);
  const stageLight = new THREE.PointLight(0x32f6e8, .64, 6, 2);
  stageLight.position.set(-1, 1, 1.5);
  scene.add(new THREE.HemisphereLight(0xafc8e8, 0x7b6785, .73), key, rim, fill, stageLight);

  let drag: ReturnType<typeof pointOf>;
  let radiansPerPixel = .01;
  let spinning = true;
  let walking = true;
  let activity = 1;
  let walkTime = 0;
  let aspect = 1;
  let time = 0;
  let resumeAt = 0;

  function aim() {
    camera.position.setFromSpherical(orbit).add(focus);
    camera.lookAt(focus);
  }

  function fitOrbit() {
    const { focus: height, radius, portraitRadius } = framing[specimen];
    focus.y = height;
    orbit.radius = Math.max(radius, portraitRadius / aspect);
    aim();
  }

  function poseModel() {
    const model = models[specimen];
    model.update(time, walkTime, activity);
    updateContacts(model.contacts);
  }

  function resetView() {
    orbit.theta = framing[specimen].yaw;
    orbit.phi = framing[specimen].pitch;
    turntable.rotation.y = 0;
    resumeAt = time + 1.5;
    fitOrbit();
  }

  resetView();
  poseModel();

  return {
    camera,
    renderSettings: {
      outputEncoding: THREE.sRGBEncoding,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.05
    },
    resize(width: number, height: number) {
      aspect = width / height;
      radiansPerPixel = 4.35 / Math.max(300, Math.min(width, height * 1.2));
      camera.setViewOffset(width, height, 0, -height * .018, width, height);
      fitOrbit();
    },
    touch(event: RoutedTouchEvent) {
      if (event.type === 'touchend' || event.type === 'touchcancel' || event.touches.length !== 1) {
        if (drag) resumeAt = time + 1.5;
        drag = undefined;
        return;
      }
      const point = pointOf(event.touches[0]);
      if (event.type === 'touchstart') {
        drag = point;
        return;
      }
      if (event.type !== 'touchmove' || !point || !drag || point.id !== drag.id) return;
      orbit.theta -= (point.x - drag.x) * radiansPerPixel;
      // Stay above the plinth as the camera circles.
      orbit.phi = THREE.MathUtils.clamp(orbit.phi - (point.y - drag.y) * radiansPerPixel, .78, 1.51);
      drag = point;
      aim();
    },
    update(delta: number) {
      time += delta;
      if (spinning && !drag && time >= resumeAt) turntable.rotation.y += delta * .18;
      if (activity > 0 || walking) walkTime += delta;
      activity = THREE.MathUtils.clamp(activity + delta * (walking ? 3.2 : -3.2), 0, 1);
      poseModel();
    },
    toggleTurntable() {
      spinning = !spinning;
      resumeAt = time;
      return spinning;
    },
    toggleWalk() {
      walking = !walking;
      return walking;
    },
    switchSpecimen() {
      models[specimen].root.visible = false;
      specimen = specimen === 'wraith' ? 'hound' : 'wraith';
      models[specimen].root.visible = true;
      resetView();
      poseModel();
      return specimen;
    },
    resetView,
    dispose() {
      // A scene owns its resources, including geometries and materials shared between meshes.
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    }
  };
}
