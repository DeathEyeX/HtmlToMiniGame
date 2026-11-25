import * as THREE from 'three-platformize';
import { createMeshKit, type Position } from './meshKit';
import { createLeg, stepLeg } from './walkRig';

const metals = {
  frame: 0x30374b,
  armor: 0x536e82,
  edge: 0x9eb4c8,
  violet: 0x77538a,
  rubber: 0x141827,
  brass: 0xba8262
};

export function createBeast() {
  const root = new THREE.Group();
  const beast = new THREE.Group();
  root.add(beast);
  const legs: { leg: ReturnType<typeof createLeg>; phase: number }[] = [];
  const { add, box, joint, link, cable } = createMeshKit();
  const painted = (color: number) => new THREE.Color(color).convertSRGBToLinear();
  const metal = (color: number, metalness = .5, roughness = .39) =>
    new THREE.MeshStandardMaterial({ color: painted(color), metalness, roughness });
  const frame = metal(metals.frame);
  const armor = metal(metals.armor);
  const edge = metal(metals.edge, .55, .28);
  const violet = metal(metals.violet);
  const rubber = metal(metals.rubber, .18, .56);
  const brass = metal(metals.brass);
  const cyan = new THREE.MeshBasicMaterial({ color: painted(0x53ffdf), toneMapped: false });
  const hot = new THREE.MeshBasicMaterial({ color: painted(0xff437e), toneMapped: false });
  const core = new THREE.MeshStandardMaterial({
    color: painted(0x137c79), emissive: painted(0x28bcae), emissiveIntensity: .78, roughness: .26
  });

  // The body faces +Z. Each leg attaches directly to the root so its feet can follow the deck independently.
  joint(beast, frame, [0, 1.69, -.14], [1.6, 1.02, 3.05]);
  box(beast, rubber, [0, 1.4, -.14], [1.1, .67, 2.37]);
  joint(beast, armor, [0, 1.93, .67], [1.77, 1.35, 1.83]);
  joint(beast, frame, [0, 1.68, -1.09], [1.45, .98, 1.46]);
  box(beast, armor, [0, 1.87, -1.05], [1.27, .7, 1.29], [-.12, 0, 0]);
  box(beast, edge, [0, 2.37, .48], [.88, .23, 1.51], [.15, 0, 0]);
  box(beast, frame, [0, 2.49, .55], [.36, .12, 1.17], [.15, 0, 0]);

  for (const side of [-1, 1]) {
    const accent = side === 1 ? hot : cyan;
    const shell = side === 1 ? violet : armor;
    const frontHip: Position = [side * .72, 1.94, .65];
    const frontKnee: Position = [side * 1.04, .91, .99];
    const frontPaw: Position = [side * 1.08, .23, 1.11];
    const rearHip: Position = [side * .65, 1.55, -1.08];
    const rearKnee: Position = [side * .94, 1.02, -.8];
    const hock: Position = [side * 1.07, .46, -1.67];
    const rearPaw: Position = [side * .98, .22, -1.31];
    const front = createLeg(root, frontHip, frontKnee, frontPaw);
    const rear = createLeg(root, rearHip, rearKnee, rearPaw);
    legs.push({ leg: front, phase: side === 1 ? 0 : .5 }, { leg: rear, phase: side === 1 ? .5 : 0 });

    joint(beast, shell, [side * .79, 2.03, .73], [.76, .83, 1.16]);
    box(beast, edge, [side * 1, 2.16, .72], [.42, .3, .91], [.28, -side * .15, side * -.35]);
    box(beast, accent, [side * 1.208, 2.13, .78], [.028, .055, .51], [.23, 0, 0]);
    link(front.upper, shell, frontHip, frontKnee, .65, 'armor', .74);
    link(front.lower, frame, frontKnee, frontPaw, .32, 'armor', .37);
    link(front.lower, edge, [side * 1.22, 1.05, 1.06], [side * 1.23, .31, 1.27], .16, 'armor', .22);
    link(front.lower, rubber, [side * 1.29, .96, .99], [side * .84, .96, .99], .41);
    link(front.lower, accent, [side * 1.315, .96, .99], [side * 1.275, .96, .99], .23);
    cable(front.upper, brass, [[side * 1.04, 1.7, .42], [side * 1.22, 1.33, .59], [side * 1.16, .84, .83]], .041);

    joint(beast, shell, [side * .65, 1.61, -1.16], [.77, .81, .89]);
    link(rear.upper, armor, rearHip, rearKnee, .67, 'armor', .76);
    link(rear.lower, frame, rearKnee, hock, .43, 'armor', .52);
    link(rear.lower, edge, [side * 1.19, .95, -.9], [side * 1.2, .54, -1.59], .15, 'armor', .22);
    link(rear.lower, rubber, hock, rearPaw, .26);
    joint(rear.lower, edge, hock, [.42, .35, .43]);
    box(beast, accent, [side * 1.063, 1.61, -1.15], [.028, .11, .4], [-.18, 0, 0]);

    for (const [[x, , z], foot] of [[frontPaw, front.foot], [rearPaw, rear.foot]] as const) {
      box(foot, shell, [x, .2, z], [.52, .36, .6]);
      box(foot, frame, [x, .09, z + .12], [.57, .18, .68]);
      for (const offset of [-.18, 0, .18]) {
        link(foot, edge, [x + offset, .19, z + .28], [x + offset, .05, z + .57], .16, 'spike', .21);
      }
    }

    for (let rib = 0; rib < 4; rib++) {
      const z = -.59 + rib * .23;
      box(beast, armor, [side * .615, 1.77, z], [.32, .59, .145], [-.31, 0, side * -.2]);
      box(beast, cyan, [side * .773, 1.86, z], [.021, .24, .04], [-.31, 0, side * -.2]);
    }
    cable(beast, accent, [[side * .73, 2.02, 1.29], [side * .9, 1.56, .58],
      [side * .81, 1.47, -.37], [side * .87, 1.72, -1.14]], .031);
    cable(beast, rubber, [[side * .68, 2.01, 1.2], [side * .85, 1.48, .58],
      [side * .8, 1.39, -.37], [side * .88, 1.65, -1.16]], .058);
  }

  for (let index = 0; index < 6; index++) {
    const z = .98 - index * .47;
    const y = 2.46 - index * .08;
    box(beast, frame, [0, y, z], [.55, .13, .31], [.11, 0, 0]);
    link(beast, index % 2 ? armor : edge, [0, y + .02, z + .14],
      [0, y + .45 - index * .031, z - .24], .35, 'spike', .49);
    box(beast, cyan, [0, y + .09, z + .12], [.24, .045, .07]);
  }

  link(beast, rubber, [0, 1.82, 1.01], [0, 2.53, 1.67], 1.04, 'armor', .96);
  link(beast, armor, [0, 1.96, 1.19], [0, 2.68, 1.69], .76, 'armor', .79);
  joint(beast, frame, [0, 1.76, 1.38], [.83, .66, .64]);
  joint(beast, core, [0, 1.76, 1.64], [.48, .46, .26]);
  add(beast, new THREE.TorusGeometry(.245, .041, 5, 12), frame, [0, 1.76, 1.754], [1, .97, .76]);
  add(beast, new THREE.TorusGeometry(.246, .011, 4, 12, Math.PI * 1.53), cyan,
    [0, 1.76, 1.785], [1, .97, 1], [0, 0, -.81]);
  for (const side of [-1, 1]) {
    link(beast, edge, [side * .51, 1.5, 1.2], [side * .36, 2.24, 1.63], .24, 'armor');
  }

  const head = new THREE.Group();
  head.position.set(0, 2.53, 1.51);
  beast.add(head);
  joint(head, frame, [0, .08, .34], [1.23, .91, 1.32]);
  box(head, armor, [0, .35, .31], [1.02, .32, 1.02], [.2, 0, 0]);
  box(head, edge, [0, .42, .49], [.43, .18, .72], [.27, 0, 0]);
  box(head, frame, [0, .07, .85], [.84, .39, .97], [.19, 0, 0]);
  box(head, armor, [0, .22, .88], [.65, .2, .83], [.22, 0, 0]);
  box(head, rubber, [0, -.018, 1.3], [.6, .22, .2], [.2, 0, 0]);
  box(head, cyan, [0, -.006, 1.406], [.33, .026, .02]);
  box(head, frame, [0, -.276, .81], [.75, .18, 1.04], [-.06, 0, 0]);
  box(head, edge, [0, -.311, 1.1], [.56, .095, .46], [-.08, 0, 0]);

  for (const side of [-1, 1]) {
    const accent = side === 1 ? hot : cyan;
    const tilt: Position = [.06, side * .3, side * -.22];
    box(head, edge, [side * .465, .233, .65], [.25, .21, .67], tilt);
    box(head, rubber, [side * .542, .145, .649], [.16, .152, .56], tilt);
    box(head, accent, [side * .624, .145, .691], [.052, .062, .42], tilt);
    box(head, cyan, [side * .325, .176, 1.055], [.065, .085, .32], [.19, side * -.09, 0]);
    link(head, armor, [side * .41, .17, .19], [side * .495, -.302, .665], .3, 'armor', .38);
    link(head, edge, [side * .535, .37, .15], [side * .72, .98, -.26], .35, 'spike', .51);
    link(head, accent, [side * .584, .42, .14], [side * .682, .75, -.09], .059, 'armor');
    link(head, violet, [side * .49, .288, .06], [side * .83, .52, -.41], .27, 'spike', .36);
    link(head, brass, [side * .565, -.09, .28], [side * .595, -.09, .28], .28);
    for (let tooth = 0; tooth < 4; tooth++) {
      const z = .64 + tooth * .15;
      link(head, edge, [side * .278, -.072, z], [side * .27, -.218 + tooth * .014, z + .03],
        tooth === 3 ? .14 : .084, 'spike');
    }
  }

  const tail = new THREE.Group();
  tail.position.set(0, 1.72, -1.52);
  beast.add(tail);
  const segments: Position[] = [
    [0, 0, 0], [-.06, .01, -.42], [-.19, .16, -.82], [-.36, .36, -1.22],
    [-.5, .64, -1.59], [-.44, .95, -1.88], [-.25, 1.16, -2.14], [.06, 1.19, -2.36]
  ];
  cable(tail, hot, segments.map(([x, y, z]) => [x, y + .1, z]), .046);
  for (let index = 1; index < segments.length; index++) {
    const point = segments[index];
    const [x, y, z] = point;
    const size = .53 - index * .045;
    link(tail, frame, segments[index - 1], point, size, 'armor');
    box(tail, index % 2 ? armor : violet, [x, y, z], [size, size * .76, .25], [-.4, .24, 0]);
    link(tail, edge, [x, y, z], [x, y + size * .84, z - .21], size * .63, 'spike');
  }
  link(tail, edge, segments[segments.length - 1], [.49, 1.28, -2.46], .43, 'spike', .26);

  return {
    root,
    contacts: legs.map(({ leg }) => leg.contact),
    update(time: number, walkTime: number, activity: number) {
      const cycle = walkTime * .96;
      beast.position.y = -.07 * (.65 + .35 * Math.cos(cycle * Math.PI * 4)) * activity;
      for (const { leg, phase } of legs) stepLeg(leg, cycle + phase, activity, beast.position.y, .71, .33);
      head.rotation.x = Math.sin(time * 1.4) * .037;
      head.rotation.y = Math.sin(time * .83) * .083;
      tail.rotation.y = Math.sin(time * 1.02) * .105;
      core.emissiveIntensity = .78 + Math.sin(time * 2.7) * .22;
    }
  };
}
