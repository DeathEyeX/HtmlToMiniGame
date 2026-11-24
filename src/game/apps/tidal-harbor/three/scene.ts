import * as THREE from 'three-platformize';
import type { Stop, View } from '../content';
import { createHarborCamera } from './camera';
import { buildCity } from './city';
import { buildHarbor } from './harbor';
import { createModelBuilder, swatch } from './model';
import { createSea } from './sea';

export function createHarborScene(scene: THREE.Scene) {
  const orbit = createHarborCamera();
  const model = createModelBuilder();
  const harbor = buildHarbor(model);
  const city = buildCity(model);
  const sea = createSea();
  model.mount(new Set([harbor.group]));
  const daylight = swatch(0xffe0af);
  const skyLight = swatch(0xe7f5dd);
  const waterLight = swatch(0x84d1dc);
  const waterSky = swatch(0x97e0d7);
  const light = new THREE.HemisphereLight(skyLight.clone(), swatch(0xa0b9ae), 1.62);
  const sun = new THREE.DirectionalLight(daylight.clone(), 2.09);
  sun.position.set(-13, 23, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.far = 59;
  sun.shadow.bias = -.00011;
  sun.shadow.normalBias = .029;
  const warmHaze = swatch(0xa4cbc4);
  const deepHaze = swatch(0x226774);
  const fog = new THREE.Fog(warmHaze, 47, 134);
  const districtCenter = new THREE.Vector3(2.1, -10.4, 18.9);
  scene.fog = fog;
  scene.add(harbor.group, city.group, ...sea.meshes, light, sun);
  let time = 0;

  return {
    camera: orbit.camera,
    resize: orbit.resize,
    touch: orbit.touch,
    setView(view: View) { orbit.setView(view); },
    select(stop: Stop) {
      harbor.select(stop);
      orbit.selectArea(stop);
    },
    update(delta: number) {
      time += delta;
      orbit.update(delta);
      const under = sea.update(orbit.camera, time);
      harbor.update(time, delta);
      city.update(time, under);
      const distance = orbit.camera.position.distanceTo(districtCenter);
      sun.color.copy(daylight).lerp(waterLight, under * .78);
      light.color.copy(skyLight).lerp(waterSky, under * .86);
      fog.color.copy(warmHaze).lerp(deepHaze, under);
      // 竖屏的镜头离城区更远，把海底雾效按取景距离向后移动。
      fog.near = THREE.MathUtils.lerp(69, Math.max(1, distance - 16), under);
      fog.far = THREE.MathUtils.lerp(137, distance + 39, under);
    },
    // 只有固定建筑投射阴影，艇与巡查员的动画不触发整座浮城重算。
    shadowSettings: { enabled: true, type: THREE.PCFShadowMap, autoUpdate: false, needsUpdate: true },
    renderSettings: { physicallyCorrectLights: true, outputEncoding: THREE.sRGBEncoding },
    dispose() {
      scene.remove(harbor.group, city.group, ...sea.meshes, light, sun);
      for (const root of [harbor.group, city.group]) {
        root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      }
      harbor.dispose();
      sea.dispose();
      model.dispose();
      (sun.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
    }
  };
}
