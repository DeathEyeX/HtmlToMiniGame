import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { random } from './palette';

export interface Waterline {
  position: Point3;
  size: [number, number];
  turn: number;
  roundness?: number;
}

// 四组方向、速度和振幅都不同的波叠加，避免规则正弦条纹。
// 同一组参数在 CPU 端复用，船、浮标和漂浮木箱的升沉与水面完全一致。
const waves = [
  [.43, .35, .64, .12], [-.27, .71, .91, .067], [.58, -.34, -.51, .055], [.13, .24, -.40, .089]
];
const waveCode = waves.map(([x, z, speed, amplitude]) => `wave(p, vec2(${x},${z}), ${speed}, ${amplitude}, total);`).join('\n');
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

// 覆盖主浮台、辅助浮台和观察塔的范围。
const deckBounds = [22, 20] as const;
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

/** 静态浮台的水线距离场启动时烘焙一次，逐帧只重算会移动的漂浮物。 */
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
  const deckDistance = deckField(decks);
  const noiseField = fieldTexture(64, random(6719), true);
  const footprints = floating.map(({ position, size }) => new THREE.Vector4(position[0], position[2], size[0] / 2, size[1] / 2));
  const axes = floating.map(item => new THREE.Vector3(Math.cos(item.turn), Math.sin(item.turn), edgeRoundness(item)));
  const geometry = new THREE.PlaneGeometry(2, 2, 108, 108);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  // 中心密、外圈疏：近处泡沫有足够顶点，远处仍能延伸到地平线。
  const spread = (v: number) => 36 * v + 210 * v ** 5;
  for (let i = 0; i < positions.count; i++) positions.setXYZ(i, spread(positions.getX(i)), 0, spread(positions.getZ(i)));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, reveal: { value: 0 }, footprints: { value: footprints }, axes: { value: axes },
      deckDistance: { value: deckDistance }, noiseField: { value: noiseField }, deckBounds: { value: new THREE.Vector2(...deckBounds) }
    },
    defines: { FOOTPRINTS: floating.length },
    transparent: true,
    depthWrite: false,
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
      uniform float reveal;

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
        float distanceFade = 1.0 - smoothstep(44.0, 122.0, length(cameraPosition - vWorld));
        vec3 large = swell(p);
        float current = noise(p * .20 + vec2(.053, -.061) * time);
        float swirls = noise(p * .54 - vec2(.08, .045) * time + current * 2.7);
        float crossFlow = noise(p * .82 + vec2(-.13, .16) * time);
        vec2 ripples = vec2(0.0);
        ripples += vec2(.024, -.066) * cos(dot(p, vec2(1.2, -2.3)) + 7.8 * current + time * 1.14);
        ripples += vec2(.056, .019) * sin(dot(p, vec2(3.1, 1.1)) + swirls * 7.3 - time * 1.41);
        ripples += vec2(-.022, .036) * sin(dot(p, vec2(-6.4, 8.0)) + 6.0 * crossFlow - time * 2.42);
        vec3 n = normalize(vec3(-large.x - ripples.x, 1.0, -large.y - ripples.y));
        float basin = exp(-dot(p * vec2(.042, .047), p * vec2(.042, .047))) * .84;
        float layer = clamp(.16 + basin + .24 * (current - .5) + large.z * .37, 0.0, 1.0);
        // 蓝绿色主调：浅水亮青，深水深蓝，贴近广告里通透的热带海面。
        vec3 water = mix(vec3(.025, .19, .56), vec3(.05, .66, .79), layer);

        float fresnel = pow(1.0 - max(dot(n, viewer), 0.0), 3.5);
        vec3 sun = normalize(vec3(-.54, .75, -.40));
        float shiny = max(dot(n, normalize(sun + viewer)), 0.0);
        float glitter = step(.978, pow(shiny, 90.0) * smoothstep(.34, .82, crossFlow)) * .62
                      + pow(shiny, 42.0) * .05;
        water *= .88 + .22 * dot(n, sun);
        // 大尺度色块与波峰提亮，打破整片海面的平均亮度。
        float broad = noise(p * .085 + vec2(.013, -.009) * time);
        water = mix(water, water * vec3(.92, 1.02, 1.04), broad * .24);
        water += vec3(.04, .09, .085) * smoothstep(.03, .12, large.z);
        water = mix(water, vec3(.52, .88, .98), min(.88, fresnel * .86));
        water += vec3(1.0, .95, .80) * glitter * distanceFade;

        // 插画式细波纹线，分布在流动较快的水面。
        float rippleLine = sin(dot(p, vec2(.62, 1.80)) * 3.2 + current * 8.0 - time * 1.1) * .5 + .5;
        float rippleLine2 = sin(dot(p, vec2(-1.40, .75)) * 2.8 + swirls * 6.0 - time * .85) * .5 + .5;
        // 波纹线只留很窄的亮带，并用两处流动噪声截断，避免远处出现规则网格。
        float lines = smoothstep(.93, .995, rippleLine) * smoothstep(.46, .74, crossFlow) * .16
                    + smoothstep(.94, .998, rippleLine2) * smoothstep(.40, .68, current) * .10;
        water += vec3(.9, .97, 1.0) * lines * distanceFade;

        float filaments = sin(dot(p, vec2(.52, 1.61)) + current * 7.2 + swirls * 2.6 - time * .73);
        float glints = smoothstep(.93, .998, filaments) * smoothstep(.52, .84, swirls) * smoothstep(.24, .76, crossFlow);
        water += vec3(.051, .18, .16) * glints * (.22 + layer * .4) * distanceFade;

        if (abs(p.x) < 21.0 && abs(p.y) < 19.0) {
          float edge = distanceToWaterline(p);
          float shade = 1.0 - smoothstep(-.34, 1.38, edge);
          water *= 1.0 - shade * .48;
          float churn = noise(p * 2.5 + vec2(time * .21, -time * .14));
          float spread = max(edge, 0.0) + (swirls - .55) * .55;
          float crest = .5 + .5 * cos(spread * 13.8 - time * 2.0 + churn * 1.9);
          // 平台周围的白浪花：更宽、更白的硬边泡沫。
          float lip = (1.0 - smoothstep(.06, .52, spread)) * smoothstep(.25, .62, churn);
          float wake = smoothstep(.65, .96, crest) * smoothstep(.32, .76, churn) * (1.0 - smoothstep(.14, 1.60, spread));
          float foam = max(lip * .92, wake * .95) * smoothstep(-.45, .05, edge);
          // 外圈再压一层更宽的薄浪，平台群边缘从远处也能读出来。
          float outer = (1.0 - smoothstep(.2, 2.6, max(edge, 0.0))) * smoothstep(.34, .62, churn) * .34;
          water = mix(water, vec3(.92, .98, 1.0), max(foam, outer) * smoothstep(-.45, .05, edge));
        }
        water = mix(vec3(.10, .40, .70), water, 1.0 - smoothstep(112.0, 250.0, length(p)));
        float proximity = 1.0 - smoothstep(0.0, 30.0, length(p));
        // 默认半透明让水下桩柱隐隐可见；聚焦水下城时进一步压低透明度，读到避难舱轮廓。
        float alpha = mix(0.90, 0.62, proximity);
        alpha = mix(alpha, alpha * .42, reveal * (1.0 - smoothstep(0.0, 16.0, length(p))));
        gl_FragColor = vec4(water, alpha);
        #include <encodings_fragment>
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Ocean';
  return {
    mesh,
    update(time: number, reveal = 0) {
      material.uniforms.time.value = time;
      material.uniforms.reveal.value = reveal;
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
