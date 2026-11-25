import * as THREE from 'three-platformize';
import { createMeshKit, type Position } from './meshKit';
import { createLeg, stepLeg } from './walkRig';

type Ring = [y: number, halfWidth: number, halfDepth: number, x?: number, z?: number];
type Section = [center: Position, halfWidth: number];

export function createWraith() {
  const root = new THREE.Group();
  // The reference places the armored side on the viewer's left when the specimen faces forward.
  root.scale.x = -1;
  const torso = new THREE.Group();
  const head = new THREE.Group();
  const hair = new THREE.Group();
  const coat = new THREE.Group();
  root.add(torso);
  torso.add(head, coat);
  head.add(hair);
  head.position.set(0, 1.7, .067);

  const { add, box, link, cable } = createMeshKit();
  const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
  const pivotGeometry = new THREE.IcosahedronGeometry(.5, 0);
  const pbr = (color: number, metalness = .17, side = THREE.FrontSide) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).convertSRGBToLinear(), flatShading: true, metalness, roughness: .55, side
    });
  const light = (color: number) => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).convertSRGBToLinear(), toneMapped: false
  });
  const skin = pbr(0xaa7d8c);
  const tendon = pbr(0x765467);
  const jaw = pbr(0xce9caa);
  const graphite = pbr(0x222536, .51);
  const gunmetal = pbr(0x55566e, .6);
  const chrome = pbr(0xa392a5, .57);
  const copper = pbr(0xad625c, .47);
  const gold = pbr(0xe0a04d, .29);
  const teeth = pbr(0xf4dcb1, .08);
  const denim = pbr(0x3a354b);
  const folds = pbr(0x292639);
  const leather = pbr(0x664656);
  const cloth = pbr(0x55334f, .06, THREE.DoubleSide);
  const hem = pbr(0x8a416d, .1, THREE.DoubleSide);
  const silver = pbr(0xc6bfd9, .13, THREE.DoubleSide);
  const lavender = pbr(0x8d72a8, .13, THREE.DoubleSide);
  const pink = light(0xff3f9c);
  const glow = light(0xff98d3);
  const cyan = light(0x4cffe9);

  const block = (parent: THREE.Object3D, material: THREE.Material, at: Position, size: Position, rotation?: Position) =>
    add(parent, blockGeometry, material, at, size, rotation);
  const joint = (parent: THREE.Object3D, material: THREE.Material, at: Position, size: Position) =>
    add(parent, pivotGeometry, material, at, size);

  function mesh(parent: THREE.Object3D, material: THREE.Material, vertices: number[], faces: number[]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    const part = new THREE.Mesh(geometry, material);
    parent.add(part);
    return part;
  }

  function loft(parent: THREE.Object3D, material: THREE.Material, rings: Ring[], sides = 8) {
    const vertices: number[] = [];
    const faces: number[] = [];
    for (const [y, width, depth, x = 0, z = 0] of rings) {
      for (let side = 0; side < sides; side++) {
        const angle = (side + .5) * 2 * Math.PI / sides;
        vertices.push(x + Math.sin(angle) * width, y, z + Math.cos(angle) * depth);
      }
    }
    for (let ring = 1; ring < rings.length; ring++) {
      for (let side = 0; side < sides; side++) {
        const a = (ring - 1) * sides + side;
        const b = (ring - 1) * sides + (side + 1) % sides;
        faces.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
    const top = (rings.length - 1) * sides;
    for (let side = 1; side < sides - 1; side++) faces.push(0, side + 1, side, top, top + side, top + side + 1);
    return mesh(parent, material, vertices, faces);
  }

  function strip(parent: THREE.Object3D, material: THREE.Material, sections: Section[],
    direction: Position = [1, 0, 0], ridge = .07) {
    const vertices: number[] = [];
    const faces: number[] = [];
    for (const [[x, y, z], width] of sections) {
      const [dx, dy, dz] = direction.map(value => value * width);
      vertices.push(x - dx, y - dy, z - dz, x, y, z + Math.min(width, ridge), x + dx, y + dy, z + dz);
    }
    for (let section = 1; section < sections.length; section++) {
      const a = (section - 1) * 3;
      faces.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
    return mesh(parent, material, vertices, faces);
  }

  // Closed polygon rings give the organic surfaces a single faceted silhouette. The implants sit on the outside.
  loft(torso, folds, [[-.25, .39, .27], [.02, .52, .38], [.27, .45, .33]]);
  loft(torso, skin, [[.12, .39, .29], [.46, .42, .30, 0, -.025], [.85, .53, .35], [1.24, .69, .39],
    [1.48, .58, .28, -.02], [1.57, .27, .21, 0, -.02]]);
  loft(torso, tendon, [[1.46, .26, .22], [1.65, .205, .18, 0, .045], [1.82, .245, .19, 0, .06]], 7);
  joint(torso, skin, [-.33, 1.13, .252], [.55, .49, .33]);
  joint(torso, graphite, [.32, 1.12, .265], [.67, .67, .41]);
  joint(torso, gunmetal, [.29, 1.22, .387], [.47, .37, .22]);
  for (let rib = 0; rib < 3; rib++) {
    const y = .52 + rib * .18;
    link(torso, tendon, [-.36, y + .11, .249], [-.108, y, .298], .102, 'armor');
    link(torso, graphite, [.09, y, .335], [.431, y + .14, .288], .136, 'armor');
    link(torso, pink, [.117, y + .022, .376], [.403, y + .139, .337], .036);
  }
  cable(torso, graphite, [[.5, 1.33, -.21], [.7, 1.03, -.51], [.5, .68, -.38], [.36, .35, -.16]], .072);
  cable(torso, pink, [[.545, .93, .227], [.568, .6, .363], [.391, .438, .411], [.236, .76, .352]], .035);
  link(torso, gunmetal, [-.06, 1.35, .366], [.35, 1.54, .246], .144, 'armor');
  link(torso, pink, [.013, 1.4, .411], [.315, 1.55, .281], .043);
  box(torso, leather, [0, .17, .18], [1.02, .18, .42], [0, 0, -.088]);
  box(torso, chrome, [-.135, .18, .402], [.234, .206, .067], [0, 0, -.088]);
  block(torso, graphite, [-.135, .18, .443], [.15, .102, .02], [0, 0, -.088]);
  box(torso, leather, [.27, -.045, .278], [.51, .108, .22], [0, -.25, .33]);
  box(torso, gunmetal, [.30, -.22, .398], [.205, .32, .065], [.13, -.25, .14]);
  block(torso, pink, [.30, -.195, .436], [.085, .12, .02], [.13, -.25, .14]);

  // Separate irregular hems let the coat move over the legs without stretching the rigid armor.
  strip(coat, cloth, [[[.64, 1.41, -.16], .29], [[.7, .19, -.36], .21],
    [[.49, -.52, -.58], .27], [[.51, -1.24, -.96], .16], [[.23, -1.92, -1.2], .012]], [.72, .02, .65]);
  strip(coat, cloth, [[[-.46, 1.27, -.21], .29], [[-.47, .2, -.46], .26],
    [[-.69, -.6, -.61], .28], [[-.79, -1.49, -.83], .25], [[-1.03, -1.99, -1.09], .011]], [.84, 0, -.48]);
  strip(coat, hem, [[[-.45, .14, .27], .17], [[-.59, -.5, .37], .21],
    [[-.82, -1.12, .10], .13], [[-.82, -1.77, -.36], .012]], [.65, 0, .76]);
  strip(coat, cloth, [[[-.5, .15, .27], .16], [[-.67, -.67, .30], .17],
    [[-.78, -1.18, .05], .20], [[-1.1, -1.61, -.29], .025]], [.65, 0, .76]);
  strip(coat, hem, [[[.14, .17, -.45], .31], [[.17, -.72, -.69], .24],
    [[.29, -1.19, -.88], .15], [[.08, -2.02, -1.14], .009]]);
  strip(coat, cloth, [[[.06, -.01, .37], .105], [[.045, -.55, .42], .122],
    [[.17, -1.3, .20], .12], [[.13, -1.64, -.11], .006]]);

  loft(head, jaw, [[-.26, .17, .13, 0, .083], [-.12, .25, .21, 0, .035], [.08, .341, .27],
    [.29, .37, .32, 0, .02], [.51, .33, .295], [.64, .19, .238]], 9);
  box(head, graphite, [0, -.115, .237], [.36, .326, .25], [-.13, 0, 0]);
  joint(head, jaw, [0, -.315, .219], [.393, .152, .32]);
  joint(head, tendon, [0, .095, .306], [.16, .178, .172]);
  for (const side of [-1, 1]) {
    box(head, graphite, [side * .192, .205, .304], [.224, .148, .097], [-.13, side * .25, side * .24]);
    box(head, pink, [side * .179, .192, .355], [.134, .066, .03], [-.13, side * .23, side * .24]);
    block(head, glow, [side * .177, .201, .372], [.041, .024, .012], [0, 0, side * .24]);
    link(head, side === 1 ? gunmetal : jaw, [side * .341, .092, .183], [side * .164, -.23, .303], .138, 'armor');
    link(head, skin, [side * .299, .253, -.033], [side * .454, .38, -.101], .171, 'spike', .116);
    for (let tooth = 0; tooth < 3; tooth++) {
      const x = side * (.058 + tooth * .069);
      const z = .371 - tooth * .016;
      link(head, teeth, [x, .012, z], [x * .95, -.081 - tooth * .022, z + .01], .068, 'spike');
      link(head, teeth, [x, -.264, z - .028], [x, -.205, z], .053, 'spike');
    }
  }
  const tongue = strip(head, hem, [[[.032, -.13, .345], .069], [[.09, -.27, .465], .074],
    [[.084, -.465, .507], .049], [[.032, -.588, .57], .004]], [1, 0, 0], .038);
  const lens = new THREE.Group();
  head.add(lens);
  lens.position.set(.185, .444, .29);
  lens.rotation.set(-.22, .22, -.23);
  link(lens, graphite, [0, 0, -.055], [0, 0, .116], .379);
  link(lens, chrome, [0, 0, .044], [0, 0, .126], .335);
  add(lens, new THREE.TorusGeometry(.129, .018, 4, 12), cyan, [0, 0, .137], [1, 1, 1]);
  link(lens, graphite, [0, 0, .122], [0, 0, .153], .211);
  link(lens, cyan, [0, 0, .153], [0, 0, .17], .088);

  joint(hair, lavender, [0, .5, -.069], [.772, .526, .68]);
  for (let lock = 0; lock < 9; lock++) {
    const angle = (lock / 8 - .5) * Math.PI * 1.18;
    const x = Math.sin(angle);
    const y = Math.cos(angle);
    strip(hair, lock % 3 === 0 ? lavender : silver, [
      [[x * .23 - .09, .43 + y * .173, .121], .15],
      [[x * .41 - .11, .59 + y * .23, -.183], .184],
      [[x * .61 - .18, .507 + y * .41 - lock * .035, -.635], .12],
      [[x * .87 - .35, .68 - lock * .12 + (lock % 2) * .15, -1.02 - lock % 3 * .12], .003]
    ], [.84, -x * .66, .26]);
  }
  for (const side of [-1, 1]) {
    strip(hair, silver, [[[side * .32, .47, .029], .125], [[side * .45, .27, -.084], .127],
      [[side * .44, -.075, -.228], .1], [[side * .57, -.45, -.422], .005]], [.87, 0, .52]);
    strip(hair, lavender, [[[side * .31, .37, -.26], .134], [[side * .59, .17, -.562], .15],
      [[side * .74, -.09, -.845], .091], [[side * .88, -.34, -1.11], .006]], [.73, 0, .58]);
  }
  strip(hair, silver, [[[.08, .626, .087], .129], [[.375, .796, -.2], .166],
    [[.718, .708, -.564], .123], [[1.131, .719, -.968], .009]], [.35, .79, .26]);
  strip(hair, silver, [[[.252, .499, .006], .133], [[.53, .571, -.243], .179],
    [[.859, .42, -.659], .108], [[1.255, .44, -.938], .007]], [.37, .63, .46]);
  strip(hair, lavender, [[[.276, .335, -.11], .130], [[.56, .328, -.261], .141],
    [[.874, .199, -.626], .103], [[1.171, .087, -.982], .007]], [.34, .76, .39]);
  strip(hair, silver, [[[.255, .237, -.203], .084], [[.53, .136, -.465], .125],
    [[.795, -.043, -.728], .091], [[.989, -.285, -.917], .006]], [.38, .74, .29]);

  const legs: ReturnType<typeof createLeg>[] = [];
  const arms: { shoulder: THREE.Group; elbow: THREE.Group; side: number }[] = [];
  const hipHeight = 2.43;
  for (const side of [-1, 1]) {
    const mechanical = side === 1;
    const x = side * .38;
    const hip: Position = [x, hipHeight, -.075];
    const knee: Position = [x + side * .055, 1.34, .331];
    const ankle: Position = [x + side * .095, .215, .012];
    const leg = createLeg(root, hip, knee, ankle);
    legs.push(leg);
    loft(leg.upper, denim, [[1.285, .205, .228, knee[0], .274], [1.62, .29, .293, x, .087],
      [2.10, .305, .318, x, -.02], [hipHeight + .11, .275, .299, x, -.066]]);
    box(leg.upper, leather, [x, 1.71, .368], [.54, .119, .086], [0, 0, side * .33]);
    box(leg.upper, chrome, [x + side * .133, 1.753, .417], [.146, .147, .047], [0, 0, side * .33]);
    link(leg.lower, mechanical ? graphite : tendon, knee, ankle, .465, 'armor', .53);
    joint(leg.lower, mechanical ? gunmetal : skin, knee, [.50, .44, .446]);
    if (mechanical) {
      box(leg.lower, chrome, [x + .103, .869, .331], [.36, .727, .215], [-.26, -.08, -.05]);
      box(leg.lower, graphite, [x + .14, .865, .464], [.155, .59, .098], [-.25, -.06, -.055]);
      block(leg.lower, pink, [x + .138, .889, .523], [.040, .349, .02], [-.25, -.06, -.055]);
      box(leg.lower, gunmetal, [x + .087, 1.213, .473], [.441, .293, .119], [-.2, .07, .03]);
    } else {
      box(leg.lower, leather, [x - .073, .773, .248], [.431, .188, .198], [-.22, .16, -.3]);
      box(leg.lower, chrome, [x - .148, .798, .368], [.127, .17, .056], [-.22, .16, -.3]);
      link(leg.lower, skin, [x - .158, 1.2, .302], [x - .188, .369, .16], .183, 'armor');
      link(leg.lower, pink, [x - .24, .669, .224], [x - .23, .39, .178], .043);
    }
    joint(leg.foot, mechanical ? gunmetal : tendon, [ankle[0], .178, .105], [.522, .356, .59]);
    for (const offset of [-.16, 0, .16]) {
      link(leg.foot, mechanical ? chrome : skin, [ankle[0] + offset * .77, .132, .202],
        [ankle[0] + offset, .102, .389], .159, 'armor');
      link(leg.foot, mechanical ? copper : teeth, [ankle[0] + offset, .13, .339],
        [ankle[0] + offset * 1.18, .027, .551 - Math.abs(offset) * .51], .139, 'spike');
    }

    const shoulder = new THREE.Group();
    const elbow = new THREE.Group();
    torso.add(shoulder);
    shoulder.add(elbow);
    shoulder.position.set(side * .615, 1.378, -.02);
    elbow.position.set(side * .231, -.78, .005);
    arms.push({ shoulder, elbow, side });
    link(shoulder, mechanical ? graphite : skin, [0, .04, 0], [side * .229, -.801, .013], .474, 'armor', .51);
    link(elbow, mechanical ? gunmetal : tendon, [0, .032, 0], [side * .07, -.76, .055], .351, 'armor', .42);
    joint(elbow, mechanical ? chrome : skin, [0, .014, .013], [.342, .311, .378]);
    if (mechanical) {
      box(shoulder, gunmetal, [.141, -.037, .043], [.659, .552, .658], [.08, -.13, .242]);
      box(shoulder, chrome, [.186, .087, .23], [.513, .312, .361], [.12, .13, .272]);
      box(shoulder, graphite, [.212, -.095, .362], [.407, .189, .106], [.05, .18, .27]);
      for (let stripe = 0; stripe < 3; stripe++) {
        block(shoulder, gold, [.118 + stripe * .104, -.085 + stripe * .026, .419],
          [.035, .141, .027], [0, .19, -.45]);
      }
      link(shoulder, pink, [.32, .131, .366], [.427, .019, .289], .075);
      cable(shoulder, graphite, [[.063, .15, -.21], [.419, -.041, -.401], [.476, -.559, -.283], [.207, -.72, -.1]], .071);
      cable(shoulder, pink, [[.091, .137, -.258], [.437, -.061, -.444], [.487, -.562, -.302], [.241, -.739, -.108]], .027);
      box(elbow, chrome, [.053, -.354, .14], [.372, .585, .263], [0, .14, .092]);
      box(elbow, graphite, [.08, -.363, .291], [.218, .429, .091], [0, .17, .09]);
      block(elbow, pink, [.087, -.367, .345], [.061, .298, .019], [0, .17, .09]);
      link(elbow, pink, [.201, .009, .012], [.216, .009, .012], .134);
    } else {
      joint(shoulder, skin, [-.045, -.119, .062], [.418, .653, .476]);
      link(elbow, skin, [-.15, -.077, .118], [-.13, -.678, .117], .223, 'armor');
      box(elbow, gunmetal, [-.102, -.678, .076], [.302, .19, .335], [0, -.13, .13]);
      link(elbow, pink, [-.091, -.235, .22], [-.208, -.35, .189], .041);
      link(elbow, pink, [-.208, -.35, .189], [-.145, -.48, .176], .041);
    }
    joint(elbow, mechanical ? graphite : skin, [side * .105, -.857, .091], [.338, .332, .24]);
    for (let digit = 0; digit < 4; digit++) {
      const x = side * (-.035 + digit * .087);
      const amount = digit === 0 || digit === 3 ? .80 : 1;
      const knuckle: Position = [x * 1.33, -.935 - amount * .18, .178];
      link(elbow, mechanical ? chrome : skin, [x, -.9, .111], knuckle, .091, 'armor');
      const tip: Position = [x * 1.73 - side * .04, -1.104 - amount * .29, .114 + digit * .029];
      loft(elbow, mechanical ? copper : teeth, [
        [tip[1], .004, .005, tip[0], tip[2] + .043],
        [tip[1] * .48 + knuckle[1] * .52, .029, .04, (tip[0] + knuckle[0]) * .5, tip[2] - .035],
        [knuckle[1] + .021, .052, .047, knuckle[0], knuckle[2]]
      ], 5);
      if (mechanical) link(elbow, pink, [knuckle[0] + .02, knuckle[1] - .027, knuckle[2] + .035],
        [tip[0] + .011, tip[1] + .058, tip[2] + .028], .026, 'spike');
    }
    link(elbow, mechanical ? copper : jaw, [-side * .059, -.771, .163],
      [-side * .231, -1.004, .257], .134, 'spike');
  }

  return {
    root,
    contacts: legs.map(leg => leg.contact),
    update(time: number, walkTime: number, activity: number) {
      const cycle = walkTime * .9;
      const stride = Math.sin(cycle * Math.PI * 2) * activity;
      const bob = -.057 * (.65 + .35 * Math.cos(cycle * Math.PI * 4)) * activity;
      torso.position.y = hipHeight + bob;
      torso.rotation.y = -.073 * stride;
      torso.rotation.x = .085 + Math.cos(cycle * Math.PI * 4) * .021 * activity;
      head.rotation.set(Math.sin(time * 1.7) * .045 - .08, stride * .077, .032);
      hair.rotation.x = Math.sin(time * 2.6) * .062;
      coat.rotation.x = Math.sin(time * 3.4) * .037 + Math.abs(stride) * .12;
      coat.rotation.z = stride * .05;
      tongue.rotation.z = Math.sin(time * 3.1) * .073;
      for (const { shoulder, elbow, side } of arms) {
        shoulder.rotation.set(stride * side * .24, side * -.07, side * .184 + stride * .051);
        elbow.rotation.x = -.31 + stride * side * .16;
      }
      legs.forEach((leg, index) => {
        stepLeg(leg, cycle + index * .5, activity, bob, 1.08, .38);
        leg.contact.x *= root.scale.x;
      });
    }
  };
}
