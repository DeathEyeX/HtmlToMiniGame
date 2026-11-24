import * as THREE from 'three-platformize';
import { buildShelter } from './shelter';
import type { DriftGame } from '../game';
import type { DriftLayout } from '../layout';
import { routes, type ZoneId } from '../routes';

const seaFragment = `
  varying vec3 ground;
  uniform vec2 size;
  uniform float time;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
  }

  void main() {
    vec2 uv = floor(gl_FragCoord.xy) / size;
    float cloud = noise(vec2(uv.x * 10.0 + time * .025, uv.y * 34.0));
    cloud += noise(vec2(uv.x * 31.0, uv.y * 62.0)) * .27;
    vec3 sky = mix(vec3(.32, .49, .50), vec3(.12, .26, .33), smoothstep(.65, 1.04, uv.y));
    sky += floor(cloud * 6.0 - 2.0) * vec3(.028, .036, .034);
    float distantX = floor(uv.x * 115.0);
    float outline = .704 + noise(vec2(distantX * .092, 2.0)) * .025;
    outline += max(0.0, hash(vec2(floor(distantX / 1.8), 7.0)) - .74) * .12;
    sky = mix(sky, vec3(.25, .39, .41), (1.0 - step(outline, uv.y)) * .56);

    vec2 p = ground.xz;
    float chop = noise(vec2(p.x * .70 - time * .22, p.y * 1.80 + time * .41));
    float swell = noise(vec2(p.x * .21 + time * .15, p.y * .45 + time * .32));
    float streak = noise(vec2(p.x * .24 + swell, p.y * 2.45 + time * .42));
    vec3 sea = mix(vec3(.055, .17, .23), vec3(.19, .38, .42), smoothstep(.05, .74, uv.y));
    sea += floor((chop + swell * .65) * 5.0 - 3.0) * vec3(.016, .028, .030);
    float foam = smoothstep(.71, .80, streak) * smoothstep(.37, .66, chop);
    float wake = (1.0 - smoothstep(2.4, 5.0, abs(p.y))) * (1.0 - smoothstep(10.5, 14.0, abs(p.x)));
    sea += step(.53 - wake * .28, foam) * vec3(.13, .23, .22);
    sea += step(.79, streak) * vec3(.03, .06, .06);
    float horizon = .708 + noise(vec2(uv.x * 10.0, 1.5)) * .006;
    vec3 color = mix(sea, sky, smoothstep(horizon - .012, horizon + .007, uv.y));
    color *= 1.0 - .16 * smoothstep(.46, .73, length((uv - .5) * vec2(1.0, .71)));
    gl_FragColor = vec4(color, 1.0);
  }
`

function buildPlayer(scene: THREE.Scene) {
  const sprite = new THREE.Group()
  const geometry = new THREE.BoxGeometry()
  function part(parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: new THREE.Color(color).convertSRGBToLinear() }))
    mesh.position.set(x, y, z)
    mesh.scale.set(w, h, d)
    parent.add(mesh)
  }

  part(sprite, 0, 0.53, 0, 0.32, 0.31, 0.22, '#d5934e')
  part(sprite, 0, 0.45, 0.12, 0.33, 0.085, 0.06, '#ece0a9')
  part(sprite, 0, 0.81, 0.024, 0.25, 0.25, 0.23, '#cca079')
  part(sprite, 0, 0.94, 0.005, 0.32, 0.11, 0.27, '#f3c16a')
  part(sprite, 0, 0.895, 0.048, 0.35, 0.05, 0.30, '#df9b49')
  part(sprite, 0, 0.55, -0.14, 0.24, 0.31, 0.14, '#416366')
  part(sprite, 0.054, 0.82, 0.145, 0.05, 0.038, 0.026, '#3f342c')
  const legs: THREE.Group[] = []
  const arms: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const leg = new THREE.Group()
    leg.position.set(side * 0.083, 0.38, 0)
    part(leg, 0, -0.115, 0, 0.125, 0.24, 0.15, '#395056')
    part(leg, 0, -0.272, 0.034, 0.144, 0.14, 0.21, '#242e31')
    sprite.add(leg)
    legs.push(leg)
    const arm = new THREE.Group()
    arm.position.set(side * 0.212, 0.63, 0)
    part(arm, 0, -0.13, 0.025, 0.105, 0.26, 0.13, '#b47748')
    sprite.add(arm)
    arms.push(arm)
  }
  scene.add(sprite)
  return { sprite, legs, arms }
}

export function createDriftWorld(output: THREE.Scene, renderer: THREE.WebGLRenderer, game: DriftGame) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#233c45')
  const view = new THREE.OrthographicCamera(-17, 17, 8, -8, 0.1, 240)
  view.position.set(12, 15.2, 37)
  view.lookAt(0, 4.26, 0)
  scene.add(new THREE.HemisphereLight(new THREE.Color('#c8ded6').convertSRGBToLinear(), new THREE.Color('#72755a').convertSRGBToLinear(), 2.11))
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffe5bd').convertSRGBToLinear(), 2.0)
  sun.position.set(-10, 22, 13)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -19
  sun.shadow.camera.right = 19
  sun.shadow.camera.top = 14
  sun.shadow.camera.bottom = -14
  sun.shadow.camera.far = 62
  sun.shadow.normalBias = 0.045
  sun.shadow.bias = -0.00015
  scene.add(sun)

  const uniforms = { size: { value: new THREE.Vector2() }, time: { value: 0 } }
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 ground;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        ground = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: seaFragment,
  }))
  ocean.rotation.x = -Math.PI / 2
  scene.add(ocean)

  const beacon = buildShelter(scene)
  const { sprite, legs, arms } = buildPlayer(scene)
  sprite.rotation.y = 0.35
  const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(.22, 12), new THREE.MeshBasicMaterial({ color: 0x10181a, transparent: true, opacity: .4 }));
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.scale.y = .68;
  scene.add(contactShadow);
  const projected = new THREE.Vector3()
  const camera = new THREE.PerspectiveCamera();

  // Three.js 先把场景画进低分辨率纹理。框架的上屏帧只放大该纹理，Pixi HUD 仍按设备分辨率绘制。
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
    stencilBuffer: false, encoding: THREE.sRGBEncoding
  });
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quadMaterial = new THREE.ShaderMaterial({
    uniforms: { frame: { value: target.texture }, bounds: { value: new THREE.Vector4() } },
    vertexShader: `
      uniform vec4 bounds;
      varying vec2 pixelUv;
      void main() {
        pixelUv = uv;
        gl_Position = vec4(bounds.xy + position.xy * bounds.zw, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D frame;
      varying vec2 pixelUv;
      void main() { gl_FragColor = texture2D(frame, pixelUv); }
    `,
    depthTest: false,
    depthWrite: false
  });
  const quad = new THREE.Mesh(quadGeometry, quadMaterial);
  quad.frustumCulled = false;
  quad.visible = false;
  output.background = new THREE.Color('#0b191e');
  output.add(quad);

  let layout: DriftLayout;
  let time = 0;
  function fit(next: DriftLayout) {
    layout = next;
    const { world, scale, left, top, width, height } = next;
    const worldWidth = world.width * scale;
    const worldHeight = world.height * scale;
    const aspect = worldWidth / worldHeight;
    const cameraHeight = Math.max(15.4, 32.6 / aspect);
    view.left = -cameraHeight * aspect / 2;
    view.right = cameraHeight * aspect / 2;
    view.top = cameraHeight / 2;
    view.bottom = -cameraHeight / 2;
    view.updateProjectionMatrix();
    view.updateMatrixWorld();
    target.setSize(Math.max(1, Math.round(worldWidth / 2)), Math.max(1, Math.round(worldHeight / 2)));
    uniforms.size.value.set(target.width, target.height);
    quadMaterial.uniforms.bounds.value.set(
      (left + world.x * scale + worldWidth / 2) * 2 / width - 1,
      1 - (top + world.y * scale + worldHeight / 2) * 2 / height,
      worldWidth / width,
      worldHeight / height
    );
  }

  function marker(id: ZoneId) {
    const [x, y, z] = routes[id].position;
    const { world } = layout;
    projected.set(x, y + 1.25, z).project(view);
    return { x: world.x + (projected.x + 1) * world.width / 2, y: world.y + (1 - projected.y) * world.height / 2 };
  }

  function update(delta: number) {
    time += delta;
    game.update(delta);
    const { position, direction } = game;
    const radio = game.completed.has('lookout');
    const gait = direction === undefined ? 0 : Math.sin(time * 19);
    sprite.position.set(position[0], position[1] + Math.abs(gait) * .055, position[2]);
    contactShadow.position.set(position[0], position[1] + .018, position[2]);
    if (direction !== undefined) sprite.rotation.y = direction;
    for (let i = 0; i < 2; i++) {
      legs[i].rotation.x = gait * (i ? -.64 : .64);
      arms[i].rotation.x = -legs[i].rotation.x * .63;
    }
    beacon.visible = radio ? Math.sin(time * 7) > -.3 : Math.sin(time * 2) > .65;
    beacon.material.color.set(radio ? '#ffeea0' : '#db6b40').convertSRGBToLinear();
    uniforms.time.value = time;

    // 上一帧结束于 Pixi，离屏渲染前重置共享上下文状态；框架随后负责合成上屏。
    renderer.resetState();
    renderer.setRenderTarget(target);
    renderer.render(scene, view);
    renderer.setRenderTarget(null);
    quad.visible = true;
  }

  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    (sun.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
    target.dispose();
    quadGeometry.dispose();
    quadMaterial.dispose();
    output.remove(quad);
  }

  return {
    camera, fit, marker, update, dispose,
    renderSettings: { outputEncoding: THREE.sRGBEncoding, physicallyCorrectLights: true },
    // 庇护所的阴影只生成一次，随角色移动的脚下阴影使用轻量网格。
    shadowSettings: { enabled: true, type: THREE.PCFShadowMap, autoUpdate: false, needsUpdate: true }
  };
}
