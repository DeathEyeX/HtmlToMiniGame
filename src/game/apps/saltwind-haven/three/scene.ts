import * as THREE from 'three-platformize';
import { buildings, zones, type ZoneId } from '../content';
import { createOrbit } from './camera';
import { buildDecks } from './decks';
import { buildDebris, buildEmbers, buildSurvivor, flyGulls } from './life';
import { child, createModel, rng, swatch } from './model';
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

  // 水下装饰层：沙底 + 珊瑚 + 海草，渲染在水面之前，透过半透明水面可见。
  const seabed = new THREE.Group();
  seabed.name = 'Seabed';
  function buildSeabed() {
    const r = rng(9173);
    // 沙底大平面，浅沙黄色。
    const sandGeo = new THREE.PlaneGeometry(80, 70, 1, 1);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshBasicMaterial({ color: swatch(0xd4b86a) });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.y = -4.2;
    seabed.add(sand);

    // 珊瑚：用 InstancedMesh 渲染球体群，分橙红、粉红、紫色系。
    const coralColors = [0xe85030, 0xd44466, 0xc83896, 0xe86820, 0xf09030];
    const sphereGeo = new THREE.IcosahedronGeometry(.5, 0);
    // InstancedMesh 通过 setColorAt 设置逐实例颜色，材质使用白色基色作乘法底。
    const iMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const instanceCount = 48 * 3;
    const instMesh = new THREE.InstancedMesh(sphereGeo, iMat, instanceCount);
    instMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    let idx2 = 0;
    for (let i = 0; i < 48; i++) {
      const angle = r() * Math.PI * 2;
      const dist = 4 + r() * 22;
      const x = Math.cos(angle) * dist + (r() - .5) * 3;
      const z = Math.sin(angle) * dist + (r() - .5) * 3;
      const scale = .28 + r() * .72;
      const hex = coralColors[Math.floor(r() * coralColors.length)];
      tmpColor.setHex(hex).convertSRGBToLinear();
      const lumps = 2 + Math.floor(r() * 3);
      for (let j = 0; j < lumps; j++) {
        if (idx2 >= instanceCount) break;
        const dy = j * scale * .55;
        const s = scale * (1 - j * .18);
        dummy.position.set(x + (r() - .5) * scale * .4, -4.2 + .3 + dy, z + (r() - .5) * scale * .4);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        instMesh.setMatrixAt(idx2, dummy.matrix);
        instMesh.setColorAt(idx2, tmpColor);
        idx2++;
      }
    }
    // 填满剩余槽位，避免未初始化矩阵。
    while (idx2 < instanceCount) {
      dummy.position.set(0, -100, 0); dummy.scale.setScalar(.001); dummy.updateMatrix();
      instMesh.setMatrixAt(idx2, dummy.matrix);
      instMesh.setColorAt(idx2, tmpColor.setRGB(0, 0, 0));
      idx2++;
    }
    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
    seabed.add(instMesh);

    // 海草：细长的绿色平面片，随机分布在基地周围。
    const grassColors = [0x28a854, 0x40c860, 0x1e9048, 0x52d470];
    const bladeMaterials: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = r() * Math.PI * 2;
      const dist = 2 + r() * 20;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = .5 + r() * 1.1;
      const geoG = new THREE.PlaneGeometry(.22, h, 1, 3);
      const posG = geoG.getAttribute('position');
      for (let v = 0; v < posG.count; v++) {
        const frac = (posG.getY(v) + h / 2) / h;
        posG.setX(v, posG.getX(v) + frac * frac * .35 * (i % 2 ? 1 : -1));
      }
      geoG.computeVertexNormals();
      const gMat = new THREE.MeshBasicMaterial({
        color: swatch(grassColors[i % grassColors.length]),
        side: THREE.DoubleSide, transparent: true, opacity: .88
      });
      bladeMaterials.push(gMat);
      const blade = new THREE.Mesh(geoG, gMat);
      blade.position.set(x, -4.2 + h / 2, z);
      blade.rotation.y = r() * Math.PI;
      seabed.add(blade);
    }
    return {
      dispose() {
        sandGeo.dispose(); sandMat.dispose();
        sphereGeo.dispose(); iMat.dispose();
        bladeMaterials.forEach(m => m.dispose());
      }
    };
  }
  const seabedMotion = buildSeabed();
  // 水下层先加入场景，确保渲染顺序在半透明水面之前。
  scene.add(seabed);
  // 天光偏冷蓝，太阳色饱和金橙，形成卡通广告风的暖冷对比。
  const sky = new THREE.HemisphereLight(swatch(0xc0d8f0), swatch(0x5a7a60), 1.80);
  const sun = new THREE.DirectionalLight(swatch(0xffc060), 3.80);
  const bounce = new THREE.DirectionalLight(swatch(0x60b8e0), .55);
  sun.position.set(-14, 24, 14);
  bounce.position.set(14, 4, -13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -16, near: 3, far: 64 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00020;
  sun.shadow.normalBias = .039;
  sun.shadow.radius = 1;
  scene.background = swatch(0x5fc8e8);
  scene.add(base, drift, ocean.mesh, sky, sun, bounce);

  let time = 0;
  let shadowTime = -1;
  motion.forEach(item => item.update?.(0));
  return {
    camera: orbit.camera, resize: orbit.resize, touch: orbit.touch, view: orbit.view, changeZoom: orbit.changeZoom,
    renderSettings: { outputEncoding: THREE.sRGBEncoding },
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
      scene.remove(seabed, base, drift, ocean.mesh, sky, sun, bounce);
      ocean.dispose();
      motion.forEach(item => item.dispose?.());
      model.dispose();
      seabedMotion.dispose();
      seabed.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      (sun.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
    }
  };
}
