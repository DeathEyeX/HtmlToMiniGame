import {
  BackSide, BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial,
  MeshToonMaterial, Shape, SphereGeometry, type BufferGeometry
} from 'three-platformize';
import { createShinnosuke } from './shinnosuke';
import type { RoomId } from '../rooms';

const cream = 0xf7e7be;
const wood = 0xbb724b;
const brown = 0x714839;
const white = 0xfff8e6;
const glass = 0x9ad6e5;
const tile = 0xf1bc9b;

function createModel() {
  const group = new Group();
  const cube = new BoxGeometry();
  const ball = new SphereGeometry(0.5, 12, 8);
  const tube = new CylinderGeometry(.5, .5, 1, 12);
  const geoms: BufferGeometry[] = [cube, ball, tube];
  const paints = new Map<number, MeshToonMaterial>();
  const ink = new MeshBasicMaterial({ color: 0x493c3b, side: BackSide });

  function solid(
    geometry: BufferGeometry, color: number, w: number, h: number, d: number,
    x: number, y: number, z: number, turn = 0, edge = .021, tilt = 0
  ) {
    let paint = paints.get(color);
    if (!paint) {
      paint = new MeshToonMaterial({ color });
      paints.set(color, paint);
    }
    const surface = new Mesh(geometry, paint);
    surface.position.set(x, y, z);
    surface.scale.set(w, h, d);
    surface.rotation.set(0, turn, tilt);
    group.add(surface);
    if (edge > 0) {
      const outline = new Mesh(geometry, ink);
      outline.position.copy(surface.position);
      outline.rotation.copy(surface.rotation);
      outline.scale.set(w + edge, h + edge, d + edge);
      group.add(outline);
    }
  }

  return {
    group,
    box(color: number, w: number, h: number, d: number, x: number, y: number, z: number, turn = 0, edge = .021) {
      solid(cube, color, w, h, d, x, y, z, turn, edge);
    },
    round(color: number, w: number, h: number, d: number, x: number, y: number, z: number, tilt = 0, edge = .021) {
      solid(ball, color, w, h, d, x, y, z, 0, edge, tilt);
    },
    cylinder(color: number, diameter: number, height: number, x: number, y: number, z: number) {
      solid(tube, color, diameter, height, diameter, x, y, z);
    },
    gable(color: number, w: number, h: number, d: number, x: number, y: number, z: number) {
      const triangle = new Shape();
      triangle.moveTo(-w / 2, 0);
      triangle.lineTo(0, h);
      triangle.lineTo(w / 2, 0);
      triangle.closePath();
      const geometry = new ExtrudeGeometry(triangle, { depth: d, bevelEnabled: false });
      geometry.translate(0, 0, -d / 2);
      geoms.push(geometry);
      solid(geometry, color, 1, 1, 1, x, y, z, 0, 0);
    },
    roof(x: number, y: number, z: number, w: number, rise: number, d: number) {
      const slope = Math.hypot(w / 2, rise);
      const angle = Math.atan2(rise, w / 2);
      for (const side of [-1, 1]) {
        const start = group.children.length;
        solid(cube, side < 0 ? 0xc9453d : 0xe75a47, slope + .12, .18, d, x + side * w / 4, y + rise / 2, z);
        for (let index = 0; index < 7; index++) {
          solid(cube, 0xcd4a3c, slope, .05, .035, x + side * w / 4, y + rise / 2 + .1, z - d / 2 + .35 + index * (d - .7) / 6, 0, 0);
        }
        for (const roofPart of group.children.slice(start)) roofPart.rotation.z = -side * angle;
      }
      solid(cube, 0xb84337, .21, .15, d + .12, x, y + rise + .08, z);
    },
    dispose() {
      for (const geometry of geoms) geometry.dispose();
      for (const paint of paints.values()) paint.dispose();
      ink.dispose();
    }
  };
}

type Model = ReturnType<typeof createModel>;

function windowFrame(model: Model, x: number, y: number, z: number, width: number, height: number, turn = 0) {
  const dx = Math.cos(turn), dz = -Math.sin(turn);
  model.box(brown, width + .12, height + .12, .12, x, y, z, turn);
  model.box(glass, width, height, .15, x, y, z, turn);
  model.box(0xcceff2, width * .38, height - .14, .18, x - dx * width * .22, y, z - dz * width * .22, turn, 0);
  model.box(white, .06, height, .2, x, y, z, turn, 0);
  model.box(white, width, .06, .2, x, y, z, turn, 0);
  model.box(0xc6a082, width + .2, .09, .23, x, y - height / 2, z, turn);
}

function plant(model: Model, x: number, y: number, z: number, size = 1) {
  model.cylinder(0xbb6045, .5 * size, .42 * size, x, y + .21 * size, z);
  model.round(0x68a35a, .65 * size, .52 * size, .59 * size, x, y + .61 * size, z);
  model.round(0x90bf67, .5 * size, .42 * size, .48 * size, x - .14 * size, y + .79 * size, z - .12 * size);
}

function table(model: Model, x: number, y: number, z: number, w: number, d: number, height: number, color = wood) {
  model.box(color, w, .13, d, x, y + height, z);
  for (const tx of [-1, 1]) {
    for (const tz of [-1, 1]) {
      model.box(brown, .12, height, .12, x + tx * (w / 2 - .16), y + height / 2, z + tz * (d / 2 - .16));
    }
  }
}

function exterior(model: Model) {
  const { box, round, gable, roof } = model;
  box(0xd1bb9e, 12.6, .43, 9.1, 0, -.29, 0);
  box(0xf0dbab, 12.56, .07, 9.06, 0, -.06, 0);
  box(0xc4c2ba, 12.55, .065, 1.18, 0, -.009, 3.94);
  box(0xa8c779, 3.9, .06, 3.65, -3.87, .02, 2.13);
  box(0x9cbf70, 2.68, .06, 2.65, 4.63, .023, -2.73);
  box(tile, 1.42, .06, 2.7, .63, .04, 2.3);
  for (let index = 0; index < 5; index++) {
    box(0xf4c5a0, 1.41, .02, .47, .63, .076, 1.24 + .51 * index, 0, 0);
  }
  box(0xc6c9ba, 3.1, .06, 5.7, 4.1, .04, .38);

  box(0xc4a186, 6.56, .25, 4.87, -1.62, .15, -1.51);
  box(cream, 6.46, 2.49, 4.74, -1.62, 1.51, -1.51);
  box(white, 5.62, 1.87, 4.15, -1.98, 3.68, -1.68);
  gable(white, 5.62, 1.31, 4.15, -1.98, 4.60, -1.68);
  roof(-1.98, 4.65, -1.68, 6.42, 1.45, 4.94);
  box(0xdc6e57, 6.95, .16, .9, -1.62, 2.73, .96);
  box(brown, .94, 1.98, .13, .57, 1.23, .89);
  box(0xc87d51, .76, 1.82, .17, .57, 1.22, .93);
  box(0xe9b477, .3, .63, .04, .56, 1.64, 1.02);
  round(0xefd070, .12, .12, .09, .82, 1.12, 1.04);
  box(0xb6a18e, 1.38, .13, .54, .57, .14, 1.06);
  windowFrame(model, -2.6, 1.5, .90, 2.46, 1.49);
  windowFrame(model, -1.98, 3.69, .43, 1.56, .98);
  windowFrame(model, .89, 3.66, -1.44, 1.24, .98, Math.PI / 2);
  box(0xc39875, .37, .23, .32, -.24, 1.18, .95);
  box(0xeed578, .29, .064, .04, -.24, 1.24, 1.14);

  for (const x of [2.57, 5.6]) {
    for (const z of [-1.88, 2.17]) box(0x6e8586, .115, 1.97, .115, x, 1.01, z);
  }
  box(0x7bb2c0, 3.42, .16, 4.57, 4.08, 2.08, .12);
  for (let index = 0; index < 5; index++) {
    box(0x5c8893, .04, .03, 4.56, 2.58 + index * .75, 2.17, .12, 0, 0);
  }
  box(0x9ca69c, .27, .91, 6.56, -5.69, .49, -.12);
  box(0x8b9d83, 4.26, .57, .26, -3.58, .31, 3.24);
  for (let index = 0; index < 8; index++) {
    round(index % 2 ? 0x8abe5f : 0x6da753, .81, .84, .76, -5.35 + index * .5, .71, 3.05);
  }
  box(0xbb754a, 1.12, .95, 1.12, -3.96, .51, 1.98);
  gable(0xe7b15c, 1.12, .34, 1.12, -3.96, .97, 1.98);
  roof(-3.96, 1.0, 1.98, 1.36, .38, 1.38);
  box(0x513d35, .46, .52, .055, -3.96, .34, 2.56);
  plant(model, -.85, .08, 1.48);
  plant(model, 5.04, .06, -2.92, 1.3);
  plant(model, -5.09, .06, 1.11, 1.45);
  box(0xb78462, .78, .21, .64, -2.98, .15, 2.44);
  for (const x of [-3.28, -2.93, -2.68]) {
    box(0x4b8c47, .046, .31, .045, x, .39, 2.45);
    round(x < -3 ? 0xed7265 : 0xf4bf63, .21, .19, .21, x, .57, 2.45);
  }
}

function roomShell(model: Model, floor: number, wall: number, windowWidth = 2.25) {
  const { box } = model;
  box(0xb68c6f, 8.5, .35, 6.75, 0, -.23, 0);
  box(floor, 8.34, .12, 6.59, 0, -.02, 0);
  box(wall, 8.35, 2.83, .15, 0, 1.46, -3.2);
  box(wall, .15, 2.83, 6.47, -4.12, 1.46, .055);
  box(0xa78366, 8.45, .1, .22, 0, 2.89, -3.2);
  box(0xa78366, .22, .1, 6.56, -4.12, 2.89, .02);
  box(wood, 8.22, .15, .08, 0, .13, -3.09);
  box(wood, .08, .15, 6.38, -4.01, .13, .06);
  windowFrame(model, .65, 1.82, -3.07, windowWidth, 1.29);
}

function living(model: Model) {
  roomShell(model, 0xeec38f, 0xffefca);
  const { box, round } = model;
  box(0xb6c981, 5.26, .07, 3.47, .31, .082, .62);
  box(0xe0d69a, 4.95, .035, 3.18, .31, .126, .62, 0, 0);
  box(wood, 2.15, .69, .84, -2.72, .43, -2.53);
  box(0x624c41, 1.37, .91, .49, -2.72, 1.22, -2.52);
  box(0x879ba6, 1.15, .683, .075, -2.72, 1.25, -2.23);
  box(0xbddee0, .64, .045, .11, -2.83, 1.51, -2.188, 0, 0);
  table(model, .36, .14, .44, 2.5, 1.49, .49);
  round(0xf8d475, .75, .11, .46, .1, .747, .43);
  for (const x of [-.08, .12, .31]) round(0xed8743, .23, .23, .21, x, .83, .43);
  for (const [x, z, color, turn] of [[-.6, 1.72, 0xd77f61, -.13], [1.13, 1.67, 0x83aa6d, .13], [1.95, .06, 0xeabb6d, -.12]]) {
    box(color, .91, .17, .72, x, .223, z, turn);
  }
  box(0xc87b59, 1.42, .56, .74, 2.78, .34, -1.79);
  box(0xd79571, 1.42, .56, .18, 2.78, .76, -2.08);
  box(0xe8aa72, 1.33, .14, .62, 2.78, .673, -1.72);
  plant(model, 3.2, .06, -2.76);
}

function kitchen(model: Model) {
  roomShell(model, 0xe8bd93, 0xffe6bd);
  const { box, cylinder, round } = model;
  for (const x of [-.17, .88, 1.93, 2.98]) {
    box(0x8ab39b, 1.02, .95, .81, x, .54, -2.49);
    box(0xc6d8ad, .88, .73, .057, x, .57, -2.055);
    box(brown, .38, .046, .05, x, .81, -2.01);
  }
  box(white, 4.24, .14, .94, 1.41, 1.06, -2.49);
  box(0x8ba4a5, .77, .043, .52, .84, 1.155, -2.47);
  box(0xa7babc, .067, .28, .073, .84, 1.27, -2.8);
  box(0xa7babc, .067, .066, .22, .84, 1.43, -2.73);
  box(0x484b4a, 1.06, .054, .63, 2.51, 1.156, -2.48);
  for (const x of [2.23, 2.79]) cylinder(0x9e7471, .33, .063, x, 1.197, -2.5);
  cylinder(0xd5654b, .45, .23, 2.24, 1.33, -2.5);
  cylinder(0xffe8bc, .48, .05, 2.24, 1.47, -2.5);
  box(0xebecd9, 1.3, 2.25, .95, -2.92, 1.21, -2.41);
  box(0xc8d4c0, 1.18, .56, .09, -2.92, 1.94, -1.89);
  box(0xf4f4e1, 1.18, 1.49, .09, -2.92, .86, -1.89);
  for (const y of [1.27, 1.87]) box(0x818e82, .081, .27, .09, -2.51, y, -1.8);
  table(model, .75, .065, .83, 2.59, 1.7, .9, 0xe1a46e);
  box(0xf4c16f, 1.01, .02, 1.66, .75, 1.044, .83, 0, 0);
  for (const z of [-.82, 2.46]) {
    table(model, .73, .065, z, .94, .82, .47);
    box(wood, .91, .57, .115, .73, .839, z + Math.sign(z) * .36);
  }
  cylinder(0x94c2b6, .49, .13, .75, 1.117, .83);
  round(0xf09f54, .26, .24, .26, .7, 1.235, .81);
  round(0xd97153, .23, .21, .23, .92, 1.235, .83);
}

function tatami(model: Model) {
  roomShell(model, 0xd4ce94, 0xf1e4bd, 2.55);
  const { box, round } = model;
  for (const x of [-2.76, 0, 2.76]) {
    for (const z of [-1.58, 1.59]) {
      box(0x678554, 2.74, .053, 3.14, x, .065, z);
      box(0xc8cf8d, 2.62, .025, 3.03, x, .103, z, 0, 0);
    }
  }
  for (const x of [-2.85, -1.64]) {
    box(wood, 1.19, 2.42, .125, x, 1.32, -3.03);
    box(0xf5edcc, 1.04, 2.18, .145, x, 1.32, -2.996);
    for (const y of [.68, 1.36, 2.04]) box(wood, 1.03, .055, .17, x, y, -2.983, 0, 0);
    box(wood, .062, 2.17, .17, x, 1.32, -2.983, 0, 0);
  }
  table(model, .22, .12, .19, 2.27, 1.35, .46, 0xac7051);
  model.cylinder(0x7b9d70, .37, .22, .26, .757, .18);
  model.cylinder(0x7b9d70, .42, .055, .26, .881, .18);
  model.cylinder(0xe7dba7, .22, .13, -.45, .714, .26);
  box(0xdd8a64, .98, .15, .76, .24, .191, 1.53, -.07);
  box(0xe0a867, .98, .15, .76, 1.99, .191, .22, .14);
  round(0x99a368, .77, .26, .77, -2.92, .22, 1.59);
  plant(model, 3.35, .12, -2.49, 1.15);
}

function kids(model: Model) {
  roomShell(model, 0xf1c788, 0xffe3ac);
  const { box, round } = model;
  box(0xf9d078, 3.8, .055, 2.72, .89, .073, .93);
  box(0xaed2c0, 3.53, .029, 2.46, .89, .115, .93, 0, 0);
  box(0xc18758, 1.98, .43, 3.37, -2.66, .32, .16);
  box(0xc18758, 2, 1.15, .2, -2.66, .66, -1.55);
  box(white, 1.93, .24, 3.16, -2.66, .65, .16);
  box(0x6fadd1, 1.94, .103, 2.28, -2.66, .82, .61);
  box(0xffe4a4, 1.95, .05, .27, -2.66, .897, -.34);
  box(0xfff0be, 1.46, .18, .55, -2.66, .864, -1.02, -.06);
  box(0xd2995e, 1.96, 1.14, .67, 2.68, .65, -2.57);
  box(0xa87751, 1.77, .4, .08, 2.68, .8, -2.21);
  for (const [x, color, lean] of [[2.09, 0xda6b53, -.04], [2.31, 0x6aa1b4, .06], [2.55, 0x94ad62, .05], [2.8, 0xf5ce75, .07]]) {
    box(color, .19, .44, .34, x, .77, -2.10, lean);
  }
  box(0xe09961, 1.19, .51, .93, 2.7, .32, 1.75, -.07);
  box(0xb57558, 1.25, .14, .98, 2.7, .64, 1.75, -.07);
  for (const [x, z, color] of [[.4, .72, 0xe76959], [1.04, .59, 0xf9bc57], [.77, 1.31, 0x79aabd]]) {
    box(color, .43, .42, .43, x, .34, z, z * 1.7);
  }
  round(0xe48158, .58, .58, .58, -.22, .346, 2.05);
  round(0xfbd477, .56, .18, .56, -.22, .348, 2.05);
}

function bath(model: Model) {
  roomShell(model, 0xa9cbd1, 0xe0ede3);
  const { box, cylinder } = model;
  for (let index = -3; index <= 3; index++) {
    box(0x8baeb9, .03, .014, 6.51, index * 1.05, .049, 0, 0, 0);
  }
  for (let index = -3; index <= 3; index++) {
    box(0x8baeb9, 8.25, .014, .03, 0, .051, index * .84, 0, 0);
  }
  box(0xcce1de, 3.22, .77, 2.19, -1.98, .46, -1.55);
  box(0x7ab7c5, 2.94, .055, 1.89, -1.98, .862, -1.55);
  for (const x of [-3.56, -.4]) box(white, .13, .13, 2.27, x, .93, -1.55);
  for (const z of [-2.63, -.48]) box(white, 3.1, .13, .13, -1.98, .93, z);
  box(0xe7f2e9, 1.23, .84, .81, 2.78, .5, -2.46);
  box(white, 1.42, .16, .95, 2.78, 1.0, -2.46);
  box(0x96adb4, .67, .035, .49, 2.78, 1.097, -2.37);
  box(0x809d9e, .082, .28, .07, 2.78, 1.16, -2.76);
  box(0x809d9e, .082, .07, .24, 2.78, 1.31, -2.67);
  box(0x82b4ba, .79, .87, .065, 2.78, 1.96, -3.08);
  box(0xb9e2e5, .63, .72, .08, 2.78, 1.96, -3.04);
  cylinder(0xe9b564, .78, .39, -.06, .251, 1.15);
  cylinder(0xf3cd79, .67, .04, -.06, .465, 1.15);
  box(0xd09170, 1.62, .064, .84, 1.91, .082, 1.41);
  box(0xa68d73, .89, .08, .085, 2.72, 1.53, 2.87);
  box(0xa3c7b5, .76, .56, .12, 2.72, 1.23, 2.87);
}

const buildRoom = { exterior, living, kitchen, tatami, kids, bath } satisfies Record<RoomId, (model: Model) => void>;

// Each set places the figure on a clear patch of floor, away from the furniture.
const shinPosition: Record<RoomId, [number, number, number]> = {
  exterior: [.66, .087, 2.47],
  living: [-1.66, .04, 2.46],
  kitchen: [-1.5, .04, 1.83],
  tatami: [-1.35, .117, 2.3],
  kids: [.6, .04, 2.61],
  bath: [.67, .04, 2.37]
};

export function createHouseModel(room: RoomId, character: WechatMinigame.Image) {
  const model = createModel();
  buildRoom[room](model);
  const shin = createShinnosuke(character, room === 'exterior' ? 1.96 : 1.86);
  shin.sprite.position.set(...shinPosition[room]);
  model.group.add(shin.sprite);
  return {
    group: model.group,
    dispose() {
      shin.dispose();
      model.dispose();
    }
  };
}
