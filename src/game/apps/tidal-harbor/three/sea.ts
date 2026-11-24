import * as THREE from 'three-platformize';

const noise = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
`;

const seaVertex = `
  varying vec3 world;
  void main() {
    vec4 p = modelMatrix * vec4(position, 1.0);
    world = p.xyz;
    gl_Position = projectionMatrix * viewMatrix * p;
  }
`;

export function createSea() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(154, 26, 13), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { under: { value: 0 } },
    vertexShader: `
      varying vec3 axis;
      void main() {
        axis = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float under;
      varying vec3 axis;
      ${noise}
      void main() {
        vec3 dir = normalize(axis);
        vec3 horizon = vec3(.73, .87, .83);
        vec3 zenith = vec3(.32, .65, .78);
        vec3 light = mix(horizon, zenith, smoothstep(-.13, .64, dir.y));
        vec2 p = vec2(atan(dir.z, dir.x) * 2.0, dir.y * 13.0);
        float broad = noise(p * vec2(1.3, 1.2));
        float wisps = noise(p * vec2(2.5, 5.0)) * .25;
        float spread = smoothstep(.02, .18, dir.y) * (1.0 - smoothstep(.39, .75, dir.y));
        float clouds = floor(smoothstep(.63, .89, broad + wisps) * 5.0) / 5.0;
        light = mix(light, vec3(.97, .94, .81), clouds * spread * .76);
        float glow = pow(max(dot(dir, normalize(vec3(-.22, .53, -.82))), 0.0), 18.0);
        light += glow * vec3(.24, .17, .093);
        vec3 deep = mix(vec3(.035, .16, .22), vec3(.10, .43, .47), smoothstep(-.42, .30, dir.y));
        gl_FragColor = vec4(mix(light, deep, under), 1.0);
      }
    `
  }));
  sky.renderOrder = -20;
  sky.frustumCulled = false;

  const surface = new THREE.Mesh(new THREE.PlaneGeometry(270, 270), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, under: { value: 0 } },
    vertexShader: seaVertex,
    fragmentShader: `
      uniform float time;
      uniform float under;
      varying vec3 world;
      ${noise}

      void main() {
        vec2 p = world.xz;
        vec2 cell = floor(p * 9.0) / 9.0;
        float swell = noise(vec2(p.x * .25 - time * .23, p.y * .56 + time * .35));
        float chop = noise(vec2(cell.x * .62 + swell * .65, cell.y * 1.46 - time * .71));
        float stripe = noise(vec2(cell.x * .30 - time * .29, cell.y * 2.41 + swell * .85));
        float depth = length(p - vec2(1.9, 2.0));
        float eddies = floor((swell * .65 + chop * .35) * 7.0) / 7.0;
        vec3 sea = mix(vec3(.09, .45, .53), vec3(.23, .67, .66), eddies);
        sea = mix(sea, vec3(.41, .72, .71), smoothstep(23.0, 120.0, depth) * .53);
        vec2 hull = abs(p - vec2(0.33, -.04)) - vec2(7.82, 5.17);
        float rim = length(max(hull, 0.0)) + min(max(hull.x, hull.y), 0.0);
        vec2 pier = abs(p - vec2(-4.8, 7.04)) - vec2(2.9, 1.31);
        float dockRim = length(max(pier, 0.0)) + min(max(pier.x, pier.y), 0.0);
        float wake = 1.0 - smoothstep(.08, .96, min(abs(rim - .42), abs(dockRim - .27)));
        float darkContact = 1.0 - smoothstep(-.30, .75, rim);
        float foam = step(.735 - wake * .22, stripe) * smoothstep(.23, .6, chop);
        sea = mix(sea, vec3(.81, .94, .82), step(.49, foam) * (.43 + wake * .26));
        sea *= 1.0 - darkContact * .36;
        float alpha = min(.94, .59 + eddies * .16 + foam * .29 + smoothstep(37.0, 105.0, depth) * .2);
        if (under > .001) {
          vec3 ceiling = mix(vec3(.22, .62, .64), vec3(.70, .91, .81), eddies + foam * .25);
          sea = mix(sea, ceiling, under);
          alpha = mix(alpha, .78, under);
        }
        gl_FragColor = vec4(sea, alpha);
      }
    `
  }));
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 4;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(188, 188), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: seaVertex,
    fragmentShader: `
      uniform float time;
      varying vec3 world;
      ${noise}
      void main() {
        vec2 p = world.xz;
        float sand = floor(noise(floor(p * 8.0) * .24) * 5.0) / 5.0;
        float haze = smoothstep(12.0, 80.0, length(cameraPosition - world));
        vec3 color = mix(vec3(.30, .50, .48), vec3(.56, .68, .55), sand);
        float waves = noise(p * .92 + vec2(time * .19, -time * .16));
        float streak = 1.0 - smoothstep(.018, .09, abs(waves - .49));
        color += streak * vec3(.064, .09, .061);
        gl_FragColor = vec4(mix(color, vec3(.095, .30, .35), haze * .87), 1.0);
      }
    `
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -17.68;

  const lightSheet = new THREE.PlaneGeometry(1, 1);
  const scattering = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { amount: { value: 0 } },
    vertexShader: `
      varying vec2 pixel;
      void main() {
        pixel = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 pixel;
      uniform float amount;
      void main() {
        float ridge = 1.0 - smoothstep(0.0, .46, abs(pixel.x - .50 + (pixel.y - .50) * .29));
        float fade = smoothstep(0.0, .65, pixel.y) * (1.0 - smoothstep(.85, 1.0, pixel.y));
        gl_FragColor = vec4(.43, .84, .81, ridge * fade * amount);
      }
    `
  });
  const shafts = [[-.33, 16.5, 3.5], [5.4, 18.6, 4], [10.3, 24.7, 3.1]].map(([x, z, w]) => {
    const ray = new THREE.Mesh(lightSheet, scattering);
    ray.position.set(x, -8.52, z);
    ray.scale.set(w, 16.6, 1);
    ray.renderOrder = 3;
    ray.visible = false;
    return ray;
  });

  return {
    meshes: [sky, surface, floor, ...shafts],
    update(camera: THREE.Camera, time: number) {
      const under = THREE.MathUtils.clamp(-camera.position.y * .75, 0, 1);
      sky.position.copy(camera.position);
      sky.material.uniforms.under.value = under;
      surface.material.uniforms.under.value = under;
      surface.material.uniforms.time.value = floor.material.uniforms.time.value = time;
      scattering.uniforms.amount.value = under * (.10 + Math.sin(time * .71) * .017);
      for (const ray of shafts) {
        ray.visible = under > .02;
        ray.rotation.y = Math.atan2(camera.position.x - ray.position.x, camera.position.z - ray.position.z);
      }
      return under;
    },
    dispose() {
      for (const mesh of [sky, surface, floor]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      lightSheet.dispose();
      scattering.dispose();
    }
  };
}
