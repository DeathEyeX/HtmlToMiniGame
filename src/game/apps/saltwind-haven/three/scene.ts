import * as THREE from 'three-platformize';
import { buildings, zones, type ZoneId } from '../content';
import { createOrbit } from './camera';
import { buildDecks } from './decks';
import { buildDebris, buildEmbers, buildSurvivor, flyGulls } from './life';
import { child, createModel, swatch } from './model';
import { createOcean, waterHeight } from './ocean';
import { buildGarden, buildWater, buildWorks } from './production';
import { buildHome, buildTower, type Motion } from './shelter';
import { buildFishery, buildPower, buildSkiff } from './shoreline';

export function createHaven(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const orbit = createOrbit();
  const model = createModel();
  const base = new THREE.Group();
  base.name = 'Saltwind Haven';
  const deckWaterlines = buildDecks(model, base);
  const motion: Motion[] = [];
  function module(id: ZoneId, build: (model: ReturnType<typeof createModel>, root: THREE.Group) => Motion[] | void) {
    const deck = zones[id];
    const placement = buildings[id];
    // 功能模块独立于浮台，原点为其甲板中心。整个基地在同一坐标系升沉。
    const root = child(base, id, deck.position);
    root.rotation.y = deck.turn;
    if (placement.offset) {
      root.translateX(placement.offset[0]);
      root.translateY(placement.offset[1]);
      root.translateZ(placement.offset[2]);
    }
    root.rotation.y += placement.turn ?? 0;
    root.scale.setScalar(placement.scale ?? 1);
    root.userData = { type: id, footprint: placement.footprint };
    motion.push(...(build(model, root) ?? []));
    return root;
  }
  const home = module('home', buildHome);
  module('tower', buildTower);
  const garden = module('garden', buildGarden);
  const works = module('works', buildWorks);
  module('water', buildWater);
  module('power', buildPower);
  const fish = module('fish', buildFishery);
  const drift = new THREE.Group();
  const skiff = buildSkiff(model, drift, fish);
  const debris = buildDebris(model, drift);
  const ocean = createOcean(deckWaterlines, [skiff.waterline, ...debris.waterlines]);
  motion.push(skiff.motion, debris.motion, buildEmbers(model, works), flyGulls(model, drift),
    buildSurvivor(model, works, [-.68, 0, -1.15], Math.PI, 'saw', 0xb9734e),
    buildSurvivor(model, fish, [-.78, 0, -.48], -Math.PI / 2, 'sort', 0x527e96),
    buildSurvivor(model, garden, [.59, 0, .55], .09, 'water', 0x8f985e),
    buildSurvivor(model, home, [.61, 0, 2.48], .78, 'sweep', 0xbc805a)
  );
  model.mount();

  const sky = new THREE.HemisphereLight(swatch(0xe1f5ff), swatch(0x7f9e96), 1.55);
  const sun = new THREE.DirectionalLight(swatch(0xffe3b6), 2.45);
  const bounce = new THREE.DirectionalLight(swatch(0x96e2ff), .30);
  sun.position.set(-14, 24, 14);
  bounce.position.set(14, 4, -13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -16, near: 3, far: 64 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00020;
  sun.shadow.normalBias = .039;
  sun.shadow.radius = 2;
  scene.background = swatch(0x92cbd8);
  scene.add(base, drift, ocean.mesh, sky, sun, bounce);

  let time = 0;
  let shadowTime = -1;
  motion.forEach(item => item.update?.(0));
  return {
    camera: orbit.camera, resize: orbit.resize, touch: orbit.touch, view: orbit.view, changeZoom: orbit.changeZoom,
    renderSettings: { physicallyCorrectLights: true, outputEncoding: THREE.sRGBEncoding },
    shadowSettings: { enabled: true, type: THREE.PCFSoftShadowMap, autoUpdate: false, needsUpdate: true },
    update(delta: number) {
      time += delta;
      orbit.update(delta);
      base.position.y = waterHeight(0, 0, time) * .41;
      base.rotation.x = .006 * Math.sin(time * .56);
      base.rotation.z = .007 * Math.sin(time * .49 + .8);
      motion.forEach(item => item.update?.(time));
      ocean.update(time);
      // 低幅度摇摆允许主阴影低频刷新，水面与构件动画仍按显示帧更新。
      if (time - shadowTime > .125) {
        renderer.shadowMap.needsUpdate = true;
        shadowTime = time;
      }
    },
    dispose() {
      scene.remove(base, drift, ocean.mesh, sky, sun, bounce);
      ocean.dispose();
      motion.forEach(item => item.dispose?.());
      model.dispose();
      (sun.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
    }
  };
}
