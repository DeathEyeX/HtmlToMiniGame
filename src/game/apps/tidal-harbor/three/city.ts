import * as THREE from 'three-platformize';
import { createRandom, type ModelBuilder } from './model';

const concrete = [0x6b9292, 0x7a9b9b, 0x809d93, 0x91a99d];
const concreteDark = 0x537d81;
const pane = 0x325e6a;
const weed = [0x408e69, 0x56a478, 0x6bad82];
const coral = [0xd79481, 0xdcad84, 0x9e91b4, 0x749684];

export function buildCity(model: ModelBuilder) {
  const group = new THREE.Group();
  const skyline = new THREE.Group();
  const nearby = model.groupTools(group);
  const distant = model.groupTools(skyline);
  const { box, beam, pebble } = nearby;
  group.add(skyline);
  const random = createRandom(65251);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const floor = -17.65;

  function ruin(x: number, z: number, top: number, w: number, d: number, detail: boolean) {
    const { box, beam } = detail ? nearby : distant;
    const height = top - floor;
    const stone = pick(concrete);
    const wing = w * (.22 + random() * .14);
    box(concreteDark, x, floor + .28, z, w + .62, .57, d + .82, 'paint');
    box(stone, x - wing / 2, floor + height / 2, z, w - wing, height, d, 'paint');
    const broken = 1.2 + random() * 2.2;
    box(stone, x + (w - wing) / 2, floor + (height - broken) / 2, z, wing, height - broken, d, 'paint');
    box(concreteDark, x - wing / 2, top - .11, z, w - wing + .08, .23, d + .09, 'paint');
    for (let i = 0; i < (detail ? 7 : 3); i++) {
      const px = x - w / 2 + .38 + random() * (w - wing - .65);
      const pz = z - d / 2 + .35 + random() * (d - .65);
      const raise = .16 + random() * .80;
      box(pick(concrete), px, top + raise / 2, pz, .18 + random() * .61, raise, .25 + random() * .54, 'paint');
      if (detail && i < 3) beam(pane, [px, top + .1, pz], [px + .24, top + .69, pz + .14], .061);
    }
    if (!detail) {
      for (const y of [top - .66, top - 1.72]) {
        box(pane, x - wing / 2, y, z + d / 2 + .023, w - wing - .48, .44, .052);
        box(stone, x - wing / 2, y, z + d / 2 + .056, .083, .46, .05);
      }
      return;
    }
    for (let y = floor + 1.48; y < top - .59; y += Math.min(1.43, height / 3.4)) {
      for (const side of [-1, 1]) {
        const extend = y > top - broken ? 0 : wing;
        const width = w - wing + extend;
        const center = x + (extend - wing) / 2;
        box(pane, center, y, z + side * (d / 2 + .023), width - .43, .66, .061);
        box(concreteDark, center, y - .39, z + side * (d / 2 + .035), width, .116, .12);
        for (let wx = center - width / 2 + .72; wx < center + width / 2 - .22; wx += .77) {
          box(stone, wx, y, z + side * (d / 2 + .061), .093, .69, .058);
          if (random() < .28) box(0x578b91, wx - .30, y, z + side * (d / 2 + .064), .33, .44, .04);
        }
        if (side === 1 && extend === 0) continue;
        box(pane, x + side * (w / 2 + .02), y, z, .058, .66, d - .48);
        for (let wz = z - d / 2 + .68; wz < z + d / 2 - .20; wz += .77) {
          box(stone, x + side * (w / 2 + .053), y, wz, .054, .69, .092);
        }
      }
    }
    for (let i = 0; i < 8; i++) {
      const y = Math.min(-.1, floor + .9 + random() * height);
      box(pick(weed), x + (random() - .5) * (w - .5), y, z + d / 2 + .11, .11 + random() * .35, .37 + random() * 1.8, .20, 'paint');
    }
  }

  // 水线旁的楼群也延伸到海床。同一组建筑在三个镜头中保持相同位置。
  for (const [x, z, top, w, d] of [[17, -9, 3.4, 4.6, 3.75], [21.7, -13, 6.7, 3.37, 3.45], [16.4, -15.0, 1.35, 3.3, 3.0], [24.9, -8.2, .48, 5.0, 3.8], [-18.8, -8.7, 4.6, 3.65, 3.1], [-22.0, -13.2, 1.15, 4.3, 4.0]]) {
    ruin(x, z, top, w, d, true);
  }
  for (const [x, z, top, w, d] of [[-4.75, 17.8, -5.7, 4.0, 3.7], [1.06, 19.1, -3.4, 3.55, 4.1], [7.76, 17.2, -7.2, 4.3, 4.0], [11.5, 22.1, -4.2, 3.7, 3.5], [-6.3, 24.1, -9.1, 4.5, 3.3], [3.35, 13.9, -9.0, 3.5, 2.9]]) {
    ruin(x, z, top, w, d, true);
  }
  for (let i = 0; i < 28; i++) {
    const angle = i * Math.PI * 2 / 28 + (random() - .5) * .15;
    const radius = 39 + random() * 24;
    ruin(Math.sin(angle) * radius, Math.cos(angle) * radius, -.2 + random() * 4.8, 2.4 + random() * 4.6, 2.0 + random() * 3.8, false);
  }

  // 露出水面的断桥与海底道路给两个镜头提供方向参照。
  for (const x of [11, 14.5, 18.0, 26.5, 30.0]) {
    box(concreteDark, x, -6.55, -6.05, .76, 15.75, .81, 'paint');
    box(0x88a9a0, x, 1.12, -6.05, 1.22, .48, 2.05, 'paint');
  }
  for (const [x, w, slope] of [[14.0, 8.35, -.08], [27.85, 5.4, .075]]) {
    box(concreteDark, x, 1.61, -6.03, w, .38, 2.32, 'paint', [0, 0, slope]);
    box(0x73918d, x, 1.80, -6.03, w - .08, .063, 2.13, 'paint', [0, 0, slope]);
    for (let dx = -w / 2 + .26; dx < w / 2 - .26; dx += .65) {
      box(0xe1b883, x + dx, 1.85 + dx * slope, -6.02, .34, .03, .056);
    }
  }

  box(0x466e74, 1.94, floor + .04, 20.83, 22, .08, 2.70, 'paint');
  box(0x466e74, 4.38, floor + .05, 17.31, 2.78, .10, 13.53, 'paint');
  for (let x = -8; x < 12; x += 1.04) box(0x9db3a0, x, floor + .10, 20.83, .56, .02, .085);
  for (let z = 11; z < 25; z += .90) box(0x9db3a0, 4.38, floor + .11, z, .084, .02, .48);
  for (const x of [-6.14, -1.05, 8.26, 11.32]) {
    beam(concreteDark, [x, floor, 22.72], [x - .31, floor + 1.77, 22.75], .11);
    box(0x9ab3aa, x - .40, floor + 1.77, 22.75, .43, .12, .20);
  }

  // 路口的废弃接驳车保留暖色涂装，在低饱和的海底楼群中仍能找到街道入口。
  const wreck = new THREE.Group();
  const tram = model.groupTools(wreck);
  tram.box(0xb18162, 0, .58, 0, 2.61, .79, 1.10, 'paint');
  tram.box(0x97a699, -.025, 1.03, 0, 2.45, .21, 1.04, 'paint');
  for (const side of [-1, 1]) {
    tram.box(pane, 0, .75, side * .552, 2.23, .38, .038);
    for (const x of [-.69, -.21, .27, .75]) tram.box(0x8a9e8d, x, .75, side * .575, .072, .40, .036);
    for (const x of [-.81, .77]) tram.round(0x3f6066, x, .27, side * .49, .49, .12, [Math.PI / 2, 0, 0]);
  }
  wreck.position.set(8.32, floor, 21.49);
  wreck.rotation.set(-.16, -.25, .12);
  group.add(wreck);

  for (let i = 0; i < 52; i++) {
    const x = -12 + random() * 27;
    const z = 10.2 + random() * 17.4;
    if (Math.abs(x - 4.38) < 1.4 || Math.abs(z - 20.83) < 1.35) continue;
    const size = .45 + random() * .92;
    pebble(pick(concrete), x, floor + size * .23, z, size * 1.83, size * .76, size * 1.15);
    const height = .36 + random() * 1.08;
    for (const side of [-1, 1]) {
      const paint = i % 3 === 0 ? pick(coral) : pick(weed);
      const root: [number, number, number] = [x, floor + size * .2, z];
      const tip: [number, number, number] = [x + side * (.16 + random() * .23), root[1] + height, z + (random() - .5) * .43];
      beam(paint, root, tip, .08 + random() * .11);
      pebble(paint, tip[0], tip[1], tip[2], .22, .42, .15, [0, 0, side * -.6]);
    }
  }

  const schools: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const school = new THREE.Group();
    const fish = model.groupTools(school);
    for (let j = 0; j < 13; j++) {
      const x = (random() - .5) * 4.36;
      const y = (random() - .5) * 1.75;
      const z = (random() - .5) * 1.11;
      const length = .19 + random() * .32;
      const color = i === 1 ? 0xf7be6d : 0xa5e7cf;
      fish.pebble(color, x, y, z, length, length * .42, length * .26);
      fish.box(color, x - length * .46, y, z, length * .28, length * .24, .045, 'plain', [0, 0, .55]);
    }
    group.add(school);
    schools.push(school);
  }

  const bubbles = new THREE.Group();
  const foam = model.groupTools(bubbles);
  for (let i = 0; i < 17; i++) {
    const x = (random() - .5) * 1.2;
    const z = (random() - .5) * .86;
    const s = .075 + random() * .17;
    foam.pebble(0xb7e7df, x, i * .18, z, s, s, s);
  }
  group.add(bubbles);

  return {
    group,
    update(time: number, under: number) {
      // 远处的水面剪影超出海底能见度，也给竖屏的远景相机让出视线。
      skyline.visible = under < .24;
      for (const [index, school] of schools.entries()) {
        const angle = time * (.25 + index * .04) + index * 2.17;
        school.position.set(1.8 + Math.sin(angle) * (4.6 + index), -8.35 - index * 1.73 + Math.sin(angle * 1.5), 19.4 + Math.cos(angle) * (3.05 + index));
        school.rotation.y = angle;
      }
      bubbles.position.set(6.7 + Math.sin(time) * .21, -15.6 + (time * .67) % 7.8, 19.31);
    }
  };
}
