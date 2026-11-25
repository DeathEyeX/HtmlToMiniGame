import * as THREE from 'three-platformize';
import type { Point3 } from '../content';
import { child, rotated, type Kit, type Tools } from './kit';
import { blue, cream, iron, random, swatch, timber, wood } from './palette';
import { waterHeight, type Waterline } from './ocean';
import { crate, drum, type Motion } from './props';

/** 作业人员：四个任务各自有手脚循环，身体原点在脚底，方便贴到任意甲板点。 */
export function buildSurvivor(kit: Kit, parent: THREE.Group, position: Point3, turn: number,
  task: 'saw' | 'sort' | 'water' | 'sweep', shirt: number): Motion {
  const body = rotated(parent, `${task} survivor`, position, turn);
  const lower = kit.at(body);
  const chest = child(body, 'Torso', [0, .66, 0]);
  const torso = kit.at(chest);
  const skin = task === 'saw' ? 0xb97e55 : 0xe9ac7d;
  const legs = task === 'sort' ? 0x536e78 : 0x475c5c;
  for (const side of [-1, 1]) {
    const x = side * .125;
    lower.box(legs, [x, .36, side * .034], [.204, .58, .25], 'fabric', [0, 0, side * .088]);
    lower.box(0x504539, [x * 1.16, .083, .10 + side * .034], [.23, .16, .37], 'paint', [0, side * .13, 0]);
    lower.box(0x7b7965, [x * 1.12, .16, side * .034], [.204, .14, .238], 'fabric');
  }
  torso.box(0x644b3a, [0, .031, .008], [.42, .095, .28], 'fabric');
  torso.cone(shirt, [0, .28, 0], [.43, .52, .37], 'fabric', [0, 0, Math.PI]);
  torso.box(shirt, [0, .36, .004], [.45, .40, .30], 'fabric');
  torso.round(skin, [0, .58, .035], [.15, .19, .16], 'matte');
  torso.orb(skin, [0, .76, .048], [.34, .39, .34]);
  torso.orb(skin, [0, .755, .214], [.087, .075, .063]);
  for (const x of [-.080, .080]) torso.orb(0x403b35, [x, .797, .199], [.040, .040, .026]);
  torso.orb(task === 'saw' ? 0x4b4235 : 0x6f4e39, [0, .88, .006], [.368, .223, .34]);
  if (task === 'saw' || task === 'water') {
    torso.round(task === 'water' ? 0xd7af65 : 0xb35f4d, [0, .889, .050], [task === 'water' ? .57 : .45, .066, task === 'water' ? .55 : .47], 'fabric');
    torso.cone(task === 'water' ? 0xe2c086 : 0xc37256, [0, .952, .018], [.405, .163, .39], 'fabric');
  } else {
    torso.box(task === 'sort' ? cream : 0xc48e67, [0, .707, .203], [.265, .077, .055], 'fabric');
  }
  torso.box(0x9a8c6e, [-.112, .315, .173], [.105, .129, .027], 'fabric');

  const arms = [-1, 1].map(side => {
    const shoulder = child(chest, 'Shoulder', [side * .265, .43, .021]);
    const upper = kit.at(shoulder);
    upper.orb(shirt, [0, -.095, 0], [.198, .31, .22], 'fabric');
    const elbow = child(shoulder, 'Elbow', [0, -.26, .031]);
    const forearm = kit.at(elbow);
    forearm.orb(skin, [0, -.105, .016], [.116, .29, .118]);
    return { shoulder, elbow };
  });
  const hand = kit.at(arms[1].elbow);
  if (task === 'saw') {
    hand.box(iron, [0, -.15, .26], [.035, .109, .48], 'metal');
    hand.box(wood[0], [0, -.19, .105], [.11, .12, .15]);
  } else if (task === 'water') {
    hand.barrel(0x669b9b, [0, -.19, .10], [.28, .24, .26]);
    hand.beam(0x669b9b, [0, -.22, .15], [0, -.08, .4], .054, 'metal', true);
    hand.round(cream, [0, -.075, .405], [.092, .056, .092], 'paint', [.69, 0, 0]);
  } else if (task === 'sweep') {
    hand.beam(wood[3], [.02, -.15, -.32], [.02, -.18, .7], .052, 'wood', true);
    hand.box(0xbf9b57, [.02, -.22, .72], [.24, .136, .19], 'fabric');
  }
  const phase = turn * 3.6 + position[2] * 1.3;
  return {
    update(time) {
      const pulse = Math.sin(time * (task === 'saw' ? 3.3 : 1.68) + phase);
      chest.rotation.x = (task === 'sort' ? .26 : .12) + .055 * pulse;
      chest.rotation.y = (task === 'sweep' ? .23 : .083) * pulse;
      arms[0].shoulder.rotation.set(-.38 - .12 * pulse, 0, -.23);
      arms[0].elbow.rotation.x = task === 'sort' ? -.86 : -.43;
      arms[1].shoulder.rotation.set(-.47 - .35 * pulse, .045 * pulse, .18);
      arms[1].elbow.rotation.x = task === 'saw' ? -1.11 + .24 * pulse : -.75 + .24 * pulse;
    }
  };
}

function softTexture() {
  const size = 48;
  const alpha = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1;
    const r = Math.hypot(u, v) + .080 * Math.sin(7 * u + 4.5 * v) + .061 * Math.cos(8 * v - 3.3 * u);
    const opacity = Math.max(1 - r * r, 0) ** 2.5;
    alpha.set([255, 255, 255, Math.round(255 * opacity)], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(alpha, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** 熔炉火焰、火星和烟柱挂在加工区的烟囱位置，坐标与 workshop.ts 对应。 */
export function buildFireAndSmoke(kit: Kit, root: THREE.Group): Motion {
  const texture = softTexture();
  const smoke = Array.from({ length: 10 }, (_, i) => {
    const material = new THREE.SpriteMaterial({ map: texture, color: swatch(i % 2 ? 0xb6bdb8 : 0xd0c8b6), depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    root.add(sprite);
    return sprite;
  });
  const flame = child(root, 'Forge flame', [1.32, .64, -.39]);
  flame.userData.castShadow = false;
  const f = kit.at(flame);
  f.orb(0xfa8148, [-.135, .119, 0], [.17, .26, .06], 'glow', [0, 0, .44]);
  f.orb(0xffaa52, [.045, .14, .012], [.18, .33, .061], 'glow', [0, 0, -.33]);
  f.orb(0xffe195, [.056, .076, .032], [.091, .144, .059], 'glow');
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const spark = child(root, 'Ember');
    spark.userData.castShadow = false;
    kit.at(spark).orb(i % 2 ? 0xffc77b : 0xf68448, [0, 0, 0], [1, 1, 1], 'glow');
    return spark;
  });
  return {
    update(time) {
      flame.scale.y = .82 + .19 * Math.sin(time * 10) + .09 * Math.sin(time * 17.3);
      flame.rotation.z = .095 * Math.sin(time * 7.3);
      for (const [i, puff] of smoke.entries()) {
        const life = (time * .215 + i / smoke.length) % 1;
        const width = .37 + life * 1.3;
        const phase = i * 1.37 + time * .56;
        puff.material.opacity = .59 * Math.sin(life * Math.PI) * (1.08 - life) + .19 * Math.max(1 - life * 6, 0);
        puff.material.rotation = .31 * Math.sin(phase);
        puff.scale.set(width * 1.15, width, 1);
        puff.position.set(1.74 - life * 2.1 + life * .28 * Math.sin(phase), 4.12 + life * 2.8,
          -1.58 + life * .78 + .28 * life * Math.cos(phase));
      }
      for (const [i, spark] of sparks.entries()) {
        const life = (time * (.75 + (i % 3) * .10) + i * .146) % 1;
        spark.position.set(1.32 + Math.sin(i * 1.9) * (.12 + life * .37), .73 + life * .73, -.39 + life * .41);
        spark.scale.setScalar((.044 + .01 * (i % 3)) * (1 - life) * (life < .92 ? 1 : 0));
      }
    },
    dispose() { smoke.forEach(sprite => sprite.material.dispose()); texture.dispose(); }
  };
}

function birdWing(t: Tools, side: number, color: number, outer: boolean) {
  // 内翼与翼尖共享接缝，扇动时不会出现叠面闪烁。
  const front = [.376, .106], back = [.473, -.273];
  const outline = outer
    ? [front, [.82, -.13], [1.03, -.40], [.61, -.33], back]
    : [[.04, .12], [.35, .13], front, back, [.39, -.30], [.06, -.20]];
  const path = new THREE.Shape();
  path.moveTo(side * outline[0][0], outline[0][1]);
  for (const [x, y] of outline.slice(1)) path.lineTo(side * x, y);
  path.closePath();
  const geometry = new THREE.ExtrudeGeometry(path, { depth: .038, bevelEnabled: false });
  t.surface(geometry, color, 'matte', [0, .018, 0], [Math.PI / 2, 0, 0]);
}

export function flyGulls(kit: Kit, world: THREE.Group): Motion {
  const birds = [.7, 2.7, 4.9, 5.65].map((phase, i) => {
    const bird = child(world, 'Gull');
    bird.scale.setScalar(.8 + i * .084);
    bird.userData.castShadow = false;
    const t = kit.at(bird);
    t.orb(0xf1e8cb, [0, 0, 0], [.27, .23, .64]);
    t.orb(cream, [0, .064, .24], [.21, .21, .21]);
    t.cone(0xd1a35a, [0, .038, .382], [.11, .17, .1], 'paint', [Math.PI / 2, 0, 0]);
    t.orb(0xb2b9ac, [0, -.014, -.275], [.31, .1, .37]);
    const wings = [-1, 1].map(side => {
      const wing = child(bird, 'Wing', [side * .08, .012, .028]);
      wing.userData.castShadow = false;
      const w = kit.at(wing);
      birdWing(w, side, 0x526d77, true);
      birdWing(w, side, 0xeae5d2, false);
      return wing;
    });
    return { bird, wings, phase };
  });
  return {
    update(time) {
      birds.forEach(({ bird, wings, phase }, i) => {
        const angle = phase + time * (.134 + .007 * i);
        const rx = 17.5 + i * 1.2, rz = 13.4 + i * 1.25;
        bird.position.set(Math.cos(angle) * rx, 7.2 + i * .63 + .85 * Math.sin(angle * 2.4 + phase), Math.sin(angle) * rz - .15);
        bird.rotation.y = Math.atan2(-Math.sin(angle) * rx, Math.cos(angle) * rz);
        bird.rotation.z = -.19 + .08 * Math.sin(angle + phase);
        const effort = .24 + .21 * Math.sin(time * 1.44 + phase);
        const flap = .13 + effort * Math.sin(time * 7.15 + phase);
        wings[0].rotation.z = -flap;
        wings[1].rotation.z = flap;
      });
    }
  };
}

const driftLayout: { position: Point3; size: [number, number]; turn: number; kind: 'buoy' | 'crate' | 'board' | 'drum' }[] = [
  { position: [-1.4, 0, 11.4], size: [.32, .32], turn: 0, kind: 'buoy' },
  { position: [8.3, 0, 11.9], size: [.42, .42], turn: .05, kind: 'buoy' },
  { position: [-12.6, 0, 9.1], size: [.84, .78], turn: -.42, kind: 'crate' },
  { position: [13.6, 0, 4.9], size: [.85, .39], turn: -.67, kind: 'board' },
  { position: [11.8, 0, -12.0], size: [.63, .93], turn: .55, kind: 'drum' },
  { position: [-15.2, 0, -2.9], size: [1.02, .37], turn: -.43, kind: 'board' },
  { position: [-8.2, 0, -10.2], size: [.7, .4], turn: .31, kind: 'board' }
];

export function buildDebris(kit: Kit, world: THREE.Group): { waterlines: Waterline[]; motion: Motion } {
  const roll = random(82);
  const floating = driftLayout.map(spec => {
    const waterline = { ...spec, position: [...spec.position] as Point3 };
    const group = rotated(world, spec.kind, waterline.position, spec.turn);
    group.userData.castShadow = false;
    const t = kit.at(group);
    if (spec.kind === 'buoy') {
      t.orb(0xec9761, [0, .12, 0], [.37, .38, .33], 'paint');
      t.round(cream, [0, .15, 0], [.34, .071, .32], 'paint');
      t.ring(iron, [0, .32, 0], [.106, .11, 1]);
    } else if (spec.kind === 'crate') {
      crate(t, 0, -.44, 0, .83);
    } else if (spec.kind === 'drum') {
      drum(t, [0, -.10, 0], .64, .96, blue[2], true);
    } else {
      t.box(wood[1], [0, -.016, 0], [spec.size[0], .18, spec.size[1]]);
      t.box(timber, [-.18, .066, 0], [.098, .029, spec.size[1] + .023]);
    }
    return { spec, waterline, group, phase: roll() * 6.28 };
  });
  return {
    waterlines: floating.map(item => item.waterline),
    motion: {
      update(time) {
        for (const { spec, waterline, group, phase } of floating) {
          const x = spec.position[0] + .24 * Math.sin(time * .34 + phase);
          const z = spec.position[2] + .18 * Math.sin(time * .47 + phase);
          const turn = spec.turn + .13 * Math.sin(time * .43 + phase);
          group.position.set(x, waterHeight(x, z, time) - .017, z);
          group.rotation.set(.1 * Math.sin(phase + time * .75), turn, .13 * Math.sin(phase - time * .65));
          waterline.position[0] = x;
          waterline.position[2] = z;
          waterline.turn = turn;
        }
      }
    }
  };
}
