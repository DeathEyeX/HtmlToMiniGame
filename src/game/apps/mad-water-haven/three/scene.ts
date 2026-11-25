import * as THREE from 'three-platformize';
import { buildings, zones, type ZoneId } from '../content';
import { createCameraRig } from './camera';
import { buildDepths } from './depths';
import { buildDesalination } from './desalination';
import { buildEnergy } from './energy';
import { buildFishery, buildSkiff } from './fishery';
import { buildGarden } from './garden';
import { buildHabitat } from './habitat';
import { child, createKit } from './kit';
import { buildDebris, buildFireAndSmoke, buildSurvivor, flyGulls } from './life';
import { buildLookout } from './lookout';
import { green, random, swatch } from './palette';
import { buildPlatforms } from './platforms';
import { createOcean, waterHeight } from './ocean';
import { buildWorkshop } from './workshop';
import type { Motion } from './props';

const builders: Record<Exclude<ZoneId, 'depths'>, (kit: ReturnType<typeof createKit>, root: THREE.Group) => Motion[] | void> = {
  home: buildHabitat,
  tower: buildLookout,
  garden: buildGarden,
  works: buildWorkshop,
  water: buildDesalination,
  fish: buildFishery,
  power: buildEnergy
};

/** 海床：浅沙、碎石、珊瑚和海草。沉没的旧集装箱把水下城和自然海底连成一体。 */
function buildSeabed(kit: ReturnType<typeof createKit>, scene: THREE.Scene) {
  const group = child(scene, 'Seabed');
  const t = kit.at(group);
  const roll = random(9173);
  t.box(0xd8bd7d, [0, -7.3, 0], [110, .5, 100], 'matte');
  t.box(0xc8ad70, [-6, -7.08, 8], [18, .3, 12], 'matte', [0, .2, 0]);
  for (let i = 0; i < 34; i++) {
    const angle = roll() * Math.PI * 2, distance = 5 + roll() * 22;
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    const size = .35 + roll() * .9;
    t.orb(0x8f9a80, [x, -7.0 + size * .3, z], [size * 1.7, size * .8, size * 1.2], 'matte', [0, roll() * 3, 0]);
    if (i % 3 === 0) {
      t.orb(i % 2 ? 0xe07d5a : 0xdc9c86, [x + .5, -6.9, z - .2], [.5, .36, .44], 'matte');
      t.orb(0xa98ab8, [x + .25, -6.78, z + .1], [.3, .26, .28], 'matte');
    }
    if (i % 2 === 0) {
      const height = 1.1 + roll() * 1.9;
      for (let b = 0; b < 3; b++) {
        const ox = (b - 1) * .26, oz = b === 1 ? -.24 : .12;
        t.beam(green[(i + b) % 6], [x, -7.0, z], [x + ox, -7.0 + height * (1 - b * .1), z + oz], .07, 'matte', true);
        t.orb(green[(i + b + 1) % 6], [x + ox, -7.0 + height * (1 - b * .1), z + oz], [.3, .26, .28], 'matte');
      }
    }
  }
  // 沉在珊瑚间的旧货柜与管道，暗示水下城是从废弃设施扩建出来的。
  t.box(0x5a7c78, [-7.2, -6.4, -4.6], [3.4, 1.5, 1.7], 'metal', [0, .5, .08]);
  t.box(0x6b8a80, [-7.5, -5.7, -4.7], [3.1, .18, 1.5], 'metal', [0, .5, .08]);
  t.round(0x4b6663, [6.8, -6.6, -6.2], [.9, 4.2, .9], 'metal', [0, 0, Math.PI / 2]);
  t.round(0x4b6663, [8.5, -6.6, -4.6], [.9, 2.8, .9], 'metal', [0, .7, Math.PI / 2]);
  return group;
}

/** 渐变天穹：顶部饱和蓝、地平线淡淡的奶油色，并在太阳方向加一团暖光。 */
function createSky() {
  const geometry = new THREE.SphereGeometry(240, 24, 14);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: new THREE.Vector3(-.32, .52, .32) } },
    vertexShader: `
      varying vec3 axis;
      void main() {
        axis = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 sun;
      varying vec3 axis;
      void main() {
        vec3 dir = normalize(axis);
        float height = smoothstep(-.08, .62, dir.y);
        vec3 sky = mix(vec3(.86, .96, .95), vec3(.20, .60, .86), height);
        sky = mix(vec3(.98, .94, .82), sky, smoothstep(-.02, .22, dir.y));
        float glow = pow(max(dot(dir, normalize(sun)), 0.0), 12.0);
        sky += vec3(.30, .20, .08) * glow;
        // 少量横向云带，用方向角与高度组合出平缓的带状分布。
        float band = sin(dir.y * 15.0 + sin(atan(dir.z, dir.x) * 2.2) * 1.6) * .5 + .5;
        float clouds = smoothstep(.58, .82, band) * smoothstep(.08, .26, dir.y) * (1.0 - smoothstep(.5, .8, dir.y));
        sky = mix(sky, vec3(.99, .97, .90), clouds * .38);
        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  return {
    mesh,
    dispose() { geometry.dispose(); material.dispose(); }
  };
}

/** 水下光柱：面向相机的加法混合平面，只在潜水镜头里出现。 */
function createShafts(scene: THREE.Scene) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, amount: { value: 0 } },
    // three 会给 ShaderMaterial 预置 attribute uv，varying 不能再叫 uv。
    vertexShader: `
      varying vec2 shaftUv;
      void main() {
        shaftUv = vec2(position.x + .5, position.y + .5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 shaftUv;
      uniform float time;
      uniform float amount;
      void main() {
        float side = smoothstep(0.0, .42, shaftUv.x) * smoothstep(1.0, .58, shaftUv.x);
        float fall = smoothstep(0.0, .35, shaftUv.y) * (1.0 - smoothstep(.72, 1.0, shaftUv.y));
        float flow = .62 + .38 * sin(shaftUv.y * 9.0 + time * 1.3 + shaftUv.x * 4.0);
        gl_FragColor = vec4(.46, .86, .82, side * fall * flow * amount);
      }
    `
  });
  const shafts = [[-4.1, 1.4], [-.4, 3.4], [3.9, .8]].map(([x, z], i) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, -3.4, z);
    mesh.scale.set(2.4 + i * .55, 6.8, 1);
    mesh.renderOrder = 3;
    scene.add(mesh);
    return mesh;
  });
  return {
    update(time: number, amount: number, camera: THREE.Camera) {
      material.uniforms.time.value = time;
      material.uniforms.amount.value = .2 * amount;
      for (const shaft of shafts) {
        shaft.visible = amount > .02;
        shaft.rotation.y = Math.atan2(camera.position.x - shaft.position.x, camera.position.z - shaft.position.z);
      }
    },
    dispose() { scene.remove(...shafts); geometry.dispose(); material.dispose(); }
  };
}

export function createHaven(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const rig = createCameraRig();
  const kit = createKit();
  const base = new THREE.Group();
  base.name = 'Floating haven';
  const motion: Motion[] = [];

  const decks = buildPlatforms(kit, base);
  const modules = {} as Record<ZoneId, THREE.Group>;
  function mount(id: ZoneId, build: (kit: ReturnType<typeof createKit>, root: THREE.Group) => Motion[] | void) {
    const deck = zones[id];
    const placement = buildings[id];
    // 每个功能模块独立挂在自己的节点上，原点在甲板中心。基地整体升沉在 base 上完成，
    // 模块内部只保留机械与布料动画，替换单栋建筑不会牵动其它区域。
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
    modules[id] = root;
    motion.push(...(build(kit, root) ?? []));
    return root;
  }
  for (const [id, build] of Object.entries(builders) as [Exclude<ZoneId, 'depths'>, typeof builders.home][]) {
    mount(id, build);
  }
  // 水下城是独立模块，原点在水下舱群中心，向上通过升降井连到住宅甲板底面。
  modules.depths = child(base, 'depths', zones.depths.position);
  modules.depths.userData = { type: 'depths', footprint: buildings.depths.footprint };
  motion.push(...buildDepths(kit, modules.depths));
  // 水下层单独补三盏点光源：太阳从上方照不到舱体下半部，补光放在舱体外侧才会照亮轮廓。
  const domeGlow = new THREE.PointLight(swatch(0xffd7a6), 4.8, 17, 2);
  domeGlow.position.set(.6, 2.2, 3.6);
  const cabinGlow = new THREE.PointLight(swatch(0x9ff4df), 3.6, 19, 2);
  cabinGlow.position.set(-4.6, -.4, -2.8);
  const bellyGlow = new THREE.PointLight(swatch(0xaee4f0), 3.0, 20, 2);
  bellyGlow.position.set(3.2, -3.2, 5.0);
  modules.depths.add(domeGlow, cabinGlow, bellyGlow);

  // 独立漂浮物不属于基地，随各自水线升降；木船系在捕鱼区码头。
  const drift = child(scene, 'Drifting props');
  const skiff = buildSkiff(kit, drift, modules.fish);
  const debris = buildDebris(kit, drift);
  const ocean = createOcean(decks, [skiff.waterline, ...debris.waterlines]);
  const seabed = buildSeabed(kit, scene);
  const shafts = createShafts(scene);
  const skyDome = createSky();
  scene.add(skyDome.mesh);

  motion.push(
    skiff.motion,
    debris.motion,
    buildFireAndSmoke(kit, modules.works),
    flyGulls(kit, drift),
    buildSurvivor(kit, modules.works, [-.72, 0, -1.1], Math.PI, 'saw', 0xb9734e),
    buildSurvivor(kit, modules.fish, [-.85, 0, -.5], -Math.PI / 2, 'sort', 0x527e96),
    buildSurvivor(kit, modules.garden, [.5, 0, .62], .09, 'water', 0x8f985e),
    buildSurvivor(kit, modules.home, [.68, 0, 2.9], .72, 'sweep', 0xbc805a),
    buildSurvivor(kit, modules.water, [2.5, 0, 1.4], Math.PI, 'sort', 0x9d7f5c),
    buildSurvivor(kit, modules.works, [1.55, 0, .62], -1.9, 'sort', 0xd08a4e),
    buildSurvivor(kit, modules.home, [-2.2, 2.58, 1.9], .4, 'sort', 0x5c8fa8)
  );
  kit.mount();

  // 天光偏冷、太阳偏暖，形成蓝绿海面和橙色屋顶的冷暖关系。
  // 太阳抬高并偏向侧后方，顶层帆布棚不会把主屋顶整片压进阴影。
  const skyTone = swatch(0x63cbe8), deepTone = swatch(0x1b6a7d);
  scene.background = skyTone.clone();
  scene.fog = new THREE.Fog(deepTone.clone(), 150, 340);
  const sky = new THREE.HemisphereLight(swatch(0xc4dcf2), swatch(0x6f9a78), 1.85);
  const ambient = new THREE.AmbientLight(swatch(0x6f94a4), .46);
  const sun = new THREE.DirectionalLight(swatch(0xffc266), 3.7);
  // 反向暖色补光不带阴影，顶层帆布棚在屋顶上留下的阴影仍有木材暖色，不会发黑。
  const fill = new THREE.DirectionalLight(swatch(0xffb070), 1.2);
  const bounce = new THREE.DirectionalLight(swatch(0x69bde2), .62);
  sun.position.set(-11, 32, 11);
  fill.position.set(13, 8, -16);
  bounce.position.set(16, 5, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -19, near: 3, far: 72 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00020;
  sun.shadow.normalBias = .04;
  sun.shadow.radius = 1;
  scene.add(base, drift, ocean.mesh, seabed, sky, sun, fill, bounce, ambient);

  let time = 0;
  let shadowTime = -1;
  motion.forEach(item => item.update?.(0));
  return {
    camera: rig.camera, resize: rig.resize, touch: rig.touch, view: rig.view, changeZoom: rig.changeZoom,
    renderSettings: { outputEncoding: THREE.sRGBEncoding },
    shadowSettings: { enabled: true, type: THREE.PCFSoftShadowMap, autoUpdate: false, needsUpdate: true },
    update(delta: number) {
      time += delta;
      rig.update(delta);
      // 整座基地随长波缓慢升沉、横摇，幅度控制在 1 厘米级，避免建筑看起来分离。
      base.position.y = waterHeight(0, 0, time) * .42;
      base.rotation.x = .006 * Math.sin(time * .56);
      base.rotation.z = .007 * Math.sin(time * .49 + .8);
      motion.forEach(item => item.update?.(time));
      const reveal = rig.reveal();
      ocean.update(time, reveal);
      shafts.update(time, reveal, rig.camera);
      skyDome.mesh.visible = reveal < .4;
      // 潜水镜头下用近距青绿色雾包住整片海床，远景仍恢复晴朗天空。
      const fog = scene.fog as THREE.Fog;
      fog.near = THREE.MathUtils.lerp(150, 7, reveal);
      fog.far = THREE.MathUtils.lerp(340, 62, reveal);
      (scene.background as THREE.Color).copy(skyTone).lerp(deepTone, reveal);
      // 摇摆幅度很小，主阴影每 0.125 秒刷新一次即可，静态构件仍会随相机变化。
      if (time - shadowTime > .125) {
        renderer.shadowMap.needsUpdate = true;
        shadowTime = time;
      }
    },
    dispose() {
      scene.remove(base, drift, ocean.mesh, seabed, skyDome.mesh, sky, sun, fill, bounce, ambient);
      ocean.dispose();
      shafts.dispose();
      skyDome.dispose();
      motion.forEach(item => item.dispose?.());
      kit.dispose();
      seabed.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(material => material.dispose());
          else obj.material.dispose();
        }
      });
      (sun.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
    }
  };
}
