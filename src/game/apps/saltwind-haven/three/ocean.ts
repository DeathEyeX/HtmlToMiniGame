import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { rng } from './model';

export interface Waterline {
  position: Point3;
  size: [number, number];
  turn: number;
  roundness?: number;
}

// 与 CPU 共用相位参数，让泡沫、独立漂流物和船体的升沉对得上。
const waves = [
  [.43, .35, .64, .12], [-.27, .71, .91, .067], [.58, -.34, -.51, .055], [.13, .24, -.40, .089]
];
const waveCode = waves.map(([x, z, speed, amplitude]) =>
  `wave(p, vec2(${x},${z}), ${speed}, ${amplitude}, total);`
).join('\n');
const waveField = `
  uniform float time;
  void wave(vec2 p, vec2 direction, float speed, float height, inout vec3 total) {
    float phase = dot(p, direction) + time * speed;
    total += vec3(direction * cos(phase), sin(phase)) * height;
  }
  vec3 swell(vec2 p) {
    vec3 total = vec3(0.0);
    ${waveCode}
    return total;
  }
`;

export function waterHeight(x: number, z: number, time: number) {
  return waves.reduce((height, [dx, dz, speed, amplitude]) => height + Math.sin(x * dx + z * dz + time * speed) * amplitude, 0);
}

const deckBounds = [20, 18] as const;
const edgeRoundness = ({ size, roundness }: Waterline) => Math.min(roundness ?? .25, Math.min(...size) * .48);

function fieldTexture(size: number, sample: (x: number, y: number) => number, repeat = false) {
  const buffer = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    buffer[i] = Math.round(sample((x + .5) / size, (y + .5) / size) * 255);
    buffer[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(buffer, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function deckField(decks: Waterline[]) {
  const shapes = decks.map(deck => ({ deck, cos: Math.cos(deck.turn), sin: Math.sin(deck.turn), corner: edgeRoundness(deck) }));
  return fieldTexture(256, (u, v) => {
    const x = (u * 2 - 1) * deckBounds[0], z = (v * 2 - 1) * deckBounds[1];
    let closest = 3.5;
    for (const { deck, cos, sin, corner } of shapes) {
      const dx = x - deck.position[0], dz = z - deck.position[2];
      const a = Math.abs(dx * cos - dz * sin) - deck.size[0] / 2 + corner;
      const b = Math.abs(dx * sin + dz * cos) - deck.size[1] / 2 + corner;
      const edge = Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0) - corner;
      closest = Math.min(closest, edge);
    }
    return THREE.MathUtils.clamp((closest + 1) / 4.5, 0, 1);
  });
}

export function createOcean(decks: Waterline[], floating: Waterline[]) {
  // 静态浮台水线一次烘焙，逐像素只精确计算会移动的船和漂浮物。
  const deckDistance = deckField(decks);
  const noiseField = fieldTexture(64, rng(6719), true);
  const footprints = floating.map(({ position, size }) => new THREE.Vector4(position[0], position[2], size[0] / 2, size[1] / 2));
  const axes = floating.map(item => new THREE.Vector3(Math.cos(item.turn), Math.sin(item.turn), edgeRoundness(item)));
  const geometry = new THREE.PlaneGeometry(2, 2, 100, 100);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const spread = (v: number) => 35 * v + 205 * v ** 5;
  for (let i = 0; i < positions.count; i++) positions.setXYZ(i, spread(positions.getX(i)), 0, spread(positions.getZ(i)));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, footprints: { value: footprints }, axes: { value: axes },
      deckDistance: { value: deckDistance }, noiseField: { value: noiseField }, deckBounds: { value: new THREE.Vector2(...deckBounds) }
    },
    defines: { FOOTPRINTS: floating.length },
    vertexShader: `
      ${waveField}
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        p.y = swell(p.xz).z;
        vWorld = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      ${waveField}
      varying vec3 vWorld;
      uniform vec4 footprints[FOOTPRINTS];
      uniform vec3 axes[FOOTPRINTS];
      uniform sampler2D deckDistance;
      uniform sampler2D noiseField;
      uniform vec2 deckBounds;

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return texture2D(noiseField, (i + f + .5) / 64.0).r;
      }
      float distanceToWaterline(vec2 p) {
        float result = texture2D(deckDistance, p / (2.0 * deckBounds) + .5).r * 4.5 - 1.0;
        for (int i = 0; i < FOOTPRINTS; i++) {
          vec4 b = footprints[i];
          vec3 a = axes[i];
          vec2 d = p - b.xy;
          if (max(abs(d.x), abs(d.y)) > b.z + b.w + 1.6) continue;
          vec2 q = abs(vec2(dot(d, vec2(a.x, -a.y)), dot(d, a.yx))) - b.zw + a.z;
          float edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - a.z;
          edge *= mix(3.3, 1.0, smoothstep(.15, .75, min(b.z, b.w)));
          result = min(result, edge);
        }
        return result;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec3 viewer = normalize(cameraPosition - vWorld);
        float distanceFade = 1.0 - smoothstep(40.0, 116.0, length(cameraPosition - vWorld));
        vec3 large = swell(p);
        float current = noise(p * .20 + vec2(.053, -.061) * time);
        float swirls = noise(p * .54 - vec2(.08, .045) * time + current * 2.7);
        float crossFlow = noise(p * .82 + vec2(-.13, .16) * time);
        vec2 ripples = vec2(0.0);
        ripples += vec2(.024, -.066) * cos(dot(p, vec2(1.2, -2.3)) + 7.8 * current + time * 1.14);
        ripples += vec2(.056, .019) * sin(dot(p, vec2(3.1, 1.1)) + swirls * 7.3 - time * 1.41);
        ripples += vec2(-.022, .036) * sin(dot(p, vec2(-6.4, 8.0)) + 6.0 * crossFlow - time * 2.42);
        vec3 n = normalize(vec3(-large.x - ripples.x, 1.0, -large.y - ripples.y));
        float basin = exp(-dot(p * vec2(.045, .049), p * vec2(.045, .049))) * .83;
        float layer = clamp(.16 + basin + .24 * (current - .5) + large.z * .37, 0.0, 1.0);
        vec3 water = mix(vec3(.009, .115, .240), vec3(.012, .49, .50), layer);

        float fresnel = pow(1.0 - max(dot(n, viewer), 0.0), 4.0);
        vec3 sun = normalize(vec3(-.54, .75, -.40));
        float shiny = max(dot(n, normalize(sun + viewer)), 0.0);
        float glitter = pow(shiny, 212.0) * smoothstep(.39, .87, crossFlow) * .31 + pow(shiny, 49.0) * .047;
        water *= .88 + .22 * dot(n, sun);
        water = mix(water, vec3(.27, .64, .74), min(.86, fresnel * .82));
        water += vec3(1.0, .89, .63) * glitter * distanceFade;

        float filaments = sin(dot(p, vec2(.52, 1.61)) + current * 7.2 + swirls * 2.6 - time * .73);
        float glints = smoothstep(.88, .995, filaments) * smoothstep(.46, .79, swirls) * smoothstep(.17, .72, crossFlow);
        water += vec3(.051, .18, .16) * glints * (.28 + layer * .48) * distanceFade;

        if (abs(p.x) < 19.0 && abs(p.y) < 17.0) {
          float edge = distanceToWaterline(p);
          float shade = 1.0 - smoothstep(-.34, 1.38, edge);
          water *= 1.0 - shade * .43;
          float churn = noise(p * 2.5 + vec2(time * .21, -time * .14));
          float spread = max(edge, 0.0) + (swirls - .55) * .55;
          float crest = .5 + .5 * cos(spread * 13.8 - time * 2.0 + churn * 1.9);
          float lip = (1.0 - smoothstep(.10, .55, spread)) * smoothstep(.32, .72, churn);
          float wake = smoothstep(.73, .98, crest) * smoothstep(.39, .83, churn) * (1.0 - smoothstep(.18, 1.55, spread));
          float foam = max(lip * .69, wake * .77) * smoothstep(-.38, .03, edge);
          water = mix(water, vec3(.72, .94, .90), foam);
        }
        water = mix(vec3(.27, .60, .70), water, 1.0 - smoothstep(105.0, 233.0, length(p)));
        gl_FragColor = vec4(water, 1.0);
        #include <encodings_fragment>
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Wind-driven ocean';
  return {
    mesh,
    update(time: number) {
      material.uniforms.time.value = time;
      floating.forEach(({ position, turn }, i) => {
        footprints[i].x = position[0];
        footprints[i].y = position[2];
        axes[i].x = Math.cos(turn);
        axes[i].y = Math.sin(turn);
      });
    },
    dispose() { geometry.dispose(); material.dispose(); deckDistance.dispose(); noiseField.dispose(); }
  };
}
