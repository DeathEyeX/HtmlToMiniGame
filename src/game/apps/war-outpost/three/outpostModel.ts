import * as T from 'three-platformize';

type Point3 = [number, number, number];
type FootprintPoint = [number, number];

function textureCanvas(width: number, height: number) {
  const canvas = wx.createCanvas() as unknown as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('前哨站贴图需要 2D Canvas');
  return { canvas, context };
}

export function createOutpostModel() {
  const root = new T.Group();
  const materials: T.MeshStandardMaterial[] = [];
  const wireframeMaterials: T.MeshStandardMaterial[] = [];
  const textures: T.CanvasTexture[] = [];
  const geometries = new Map<string, T.BufferGeometry>();
  const meshGeometries = new Set<T.BufferGeometry>();

  // 固定随机序列，让网页和微信得到同一组磨损纹理和地面碎石。
  let seed = 3103;
  function rand() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function range(min: number, max: number) {
    return min + (max - min) * rand();
  }
  function colorTexture(canvas: HTMLCanvasElement) {
    const texture = new T.CanvasTexture(canvas);
    // three-platformize r133 用 encoding 保存颜色贴图的 sRGB 标记。
    texture.encoding = T.sRGBEncoding;
    textures.push(texture);
    return texture;
  }
  function surface(base: string, metal = false) {
    const { canvas, context } = textureCanvas(256, 256);
    context.fillStyle = base;
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 17000; i++) {
      context.fillStyle = rand() > .5 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.075)';
      context.fillRect(rand() * 256, rand() * 256, range(1, 4), range(1, 4));
    }
    context.fillStyle = metal ? 'rgba(50,33,20,.13)' : 'rgba(30,25,20,.08)';
    for (let i = 0; i < 140; i++) {
      context.fillRect(rand() * 256, rand() * 256, range(1, 6), range(4, 45));
    }
    context.strokeStyle = 'rgba(16,19,16,.16)';
    for (let i = 0; i < 100; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + range(-8, 8), y + range(2, 20));
      context.stroke();
    }
    const texture = colorTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  }
  function mat(color: number, roughness = .8, metalness = 0, map: T.Texture | null = null) {
    const material = new T.MeshStandardMaterial({ color, roughness, metalness, map });
    materials.push(material);
    wireframeMaterials.push(material);
    return material;
  }
  const concrete = mat(0xffffff, .96, 0, surface('#92958a'));
  const darkcon = mat(0xffffff, .95, 0, surface('#666a61'));
  const olive = mat(0xffffff, .79, .28, surface('#626c50', true));
  const metal = mat(0xffffff, .65, .5, surface('#525a59', true));
  const steel = mat(0x343a3b, .66, .65);
  const black = mat(0x1e2524, .91);
  const trim = mat(0x777e71, .65, .5);
  const sand = mat(0xffffff, 1, 0, surface('#a59776'));
  const earth = mat(0xffffff, 1, 0, surface('#777064'));
  const yellow = mat(0xb59645, .72, .25);
  const glass = mat(0x263d42, .3, .62);
  const glow = mat(0xffdc8f, .5);
  glow.emissive.setHex(0xffba59);
  glow.emissiveIntensity = 1.8;

  // 栏杆、台阶与沙袋会复用许多同尺寸零件，几何只上传一次。
  function geometry(key: string, create: () => T.BufferGeometry) {
    const existing = geometries.get(key);
    if (existing) return existing;
    const next = create();
    geometries.set(key, next);
    return next;
  }
  function mesh(shape: T.BufferGeometry, material: T.MeshStandardMaterial, x: number, y: number, z: number, parent = root) {
    const object = new T.Mesh(shape, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    meshGeometries.add(shape);
    return object;
  }
  function box(x: number, y: number, z: number, width: number, height: number, depth: number, m: T.MeshStandardMaterial, g = root) {
    const shape = geometry(['box', width, height, depth].join(','), () => new T.BoxGeometry(width, height, depth));
    return mesh(shape, m, x, y, z, g);
  }
  function cyl(x: number, y: number, z: number, r: number, height: number, m: T.MeshStandardMaterial, g = root) {
    const shape = geometry(['cyl', r, height].join(','), () => new T.CylinderGeometry(r, r, height, 12));
    return mesh(shape, m, x, y, z, g);
  }
  function ball(x: number, y: number, z: number, a: number, b: number, c: number, m: T.MeshStandardMaterial, g = root) {
    const shape = geometry('sphere', () => new T.SphereGeometry(1, 12, 7));
    const object = mesh(shape, m, x, y, z, g);
    object.scale.set(a, b, c);
    return object;
  }
  function connect(object: T.Mesh, a: T.Vector3, b: T.Vector3) {
    object.position.copy(a).lerp(b, .5);
    object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
    return object;
  }
  function beam(a: Point3, b: Point3, width: number, m: T.MeshStandardMaterial, g = root) {
    const start = new T.Vector3(...a);
    const end = new T.Vector3(...b);
    return connect(box(0, 0, 0, width, start.distanceTo(end), width, m, g), start, end);
  }
  function pipe(a: Point3, b: Point3, radius: number, m = steel, g = root) {
    const start = new T.Vector3(...a);
    const end = new T.Vector3(...b);
    return connect(cyl(0, 0, 0, radius, start.distanceTo(end), m, g), start, end);
  }
  function sign(text: string, x: number, y: number, z: number, width: number, height: number) {
    const { canvas, context } = textureCanvas(512, 256);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#e1dfca';
    context.font = 'bold 166px monospace';
    context.fillText(text, 256, 128, 496);
    const map = colorTexture(canvas);
    const material = new T.MeshStandardMaterial({
      map, transparent: true, roughness: .85, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1
    });
    materials.push(material);
    mesh(new T.PlaneGeometry(width, height), material, x, y, z).castShadow = false;
  }

  // 可重复的围栏、沙袋、物资箱、通风口和灯具。
  function rail([x, z]: FootprintPoint, [endX, endZ]: FootprintPoint, y: number) {
    const spans = Math.max(1, Math.ceil(Math.hypot(endX - x, endZ - z) / 1.05));
    for (let i = 0; i <= spans; i++) {
      const t = i / spans;
      box(x + (endX - x) * t, y + .46, z + (endZ - z) * t, .075, .92, .075, trim);
    }
    for (const h of [.43, .9]) pipe([x, y + h, z], [endX, y + h, endZ], .038, trim);
  }
  function bags([x, z]: FootprintPoint, [endX, endZ]: FootprintPoint, y: number, layers = 2) {
    const count = Math.max(1, Math.floor(Math.hypot(endX - x, endZ - z) / .72));
    const rotation = -Math.atan2(endZ - z, endX - x);
    for (let layer = 0; layer < layers; layer++) {
      for (let i = 0; i < count; i++) {
        const t = (i + .5 + (layer % 2 ? .15 : -.15)) / count;
        const bag = ball(x + (endX - x) * t, y + .13 + layer * .22, z + (endZ - z) * t, .43, .14, .25, sand);
        bag.rotation.y = rotation + range(-.09, .09);
      }
    }
  }
  function crate(x: number, y: number, z: number, scale = 1) {
    box(x, y + .37 * scale, z, 1.05 * scale, .74 * scale, .76 * scale, olive);
    for (const dz of [-.392, .392]) {
      for (const dx of [-.43, .43]) {
        box(x + dx * scale, y + .37 * scale, z + dz * scale, .07 * scale, .74 * scale, .04 * scale, steel);
      }
      box(x, y + .6 * scale, z + dz * scale, 1.1 * scale, .055 * scale, .04 * scale, trim);
      box(x, y + .39 * scale, z + dz * scale, .23 * scale, .12 * scale, .045 * scale, black);
    }
    box(x, y + .76 * scale, z, 1.1 * scale, .06 * scale, .81 * scale, trim);
  }
  function vent(x: number, y: number, z: number, width: number, height: number, rotation = 0) {
    const group = new T.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    root.add(group);
    box(0, 0, 0, width, height, .14, steel, group);
    for (let i = 0; i < 6; i++) {
      box(0, -height * .37 + i * height * .15, .1, width * .87, .045, .07, trim, group);
    }
  }
  function lamp(x: number, y: number, z: number) {
    box(x, y, z, .48, .22, .23, steel);
    box(x, y - .025, z + .126, .37, .12, .015, glow);
  }

  // 地台、混凝土接缝和地面碎石。
  box(0, -0.48, 0, 22, 0.75, 18, black);
  box(0, -0.1, 0, 21.6, 0.2, 17.6, earth);
  box(0, 0.02, 0.3, 13.7, 0.12, 10.7, darkcon);
  for (let x = -6; x < 7; x += 2.15)
    for (let z = -4; z < 5; z += 2.1) {
      box(x, 0.088, z, 2.1, 0.025, 2.05, concrete);
    }
  for (let i = 0; i < 130; i++) {
    let x = range(-10.4, 10.4), z = range(-8.4, 8.4);
    if (Math.abs(x) < 7 && Math.abs(z) < 5.5)
      continue;
    let r = range(0.035, 0.19);
    let o = mesh(new T.DodecahedronGeometry(r, 0), i % 4 === 0 ? darkcon : earth, x, r * 0.4, z);
    o.scale.y = range(0.35, 0.9);
    o.rotation.set(rand(), rand(), rand());
  }

  // 主体墙面、门窗和右侧服务舱。
  box(0, 0.32, 0, 10.9, 0.55, 7.5, darkcon);
  box(-0.7, 1.94, -0.15, 8.8, 2.8, 6.55, concrete);
  box(-0.7, 3.38, -0.15, 9.1, 0.24, 6.85, darkcon);
  box(-0.7, 3.57, -0.15, 8.95, 0.14, 6.7, trim);
  for (let x of [-4.95, -2.85, -0.75, 1.35, 3.55]) {
    box(x, 1.97, 3.19, 0.2, 2.67, 0.3, darkcon);
    box(x, 1.97, -3.49, 0.2, 2.67, 0.3, darkcon);
  }
  for (let z of [-2.8, -0.9, 1, 2.9]) {
    box(-5.15, 1.97, z, 0.27, 2.62, 0.19, darkcon);
    box(3.75, 1.97, z, 0.27, 2.62, 0.19, darkcon);
  }
  box(1.25, 1.64, 3.3, 2.42, 2.3, 0.16, steel);
  box(1.25, 1.64, 3.41, 2.14, 2.03, 0.09, black);
  for (let x of [0.7, 1.8]) {
    box(x, 1.65, 3.48, 1.04, 1.99, 0.1, olive);
    for (let yy of [0.93, 2.2])
      box(x, yy, 3.56, 0.92, 0.12, 0.05, trim);
  }
  box(1.25, 2.91, 3.55, 2.84, 0.23, 0.85, metal);
  lamp(1.25, 2.79, 3.92);
  box(1.25, 0.29, 3.9, 2.6, 0.2, 1.3, darkcon);
  sign('A-03', -2.15, 2.35, 3.36, 2.45, 0.72);
  sign('FIELD COMMAND', -2.15, 1.83, 3.36, 2.4, 0.31);
  for (let x of [-3.5, -1.8]) {
    box(x, 2.86, 3.28, 1.25, 0.35, 0.18, steel);
    box(x, 2.86, 3.39, 1.05, 0.22, 0.04, glass);
  }
  box(4.63, 1.58, -0.25, 2, 2.12, 5.8, olive);
  box(4.63, 2.76, -0.25, 2.16, 0.22, 6.02, metal);
  for (let z of [-2.6, -1.05, 0.5, 2.05]) {
    box(5.69, 1.57, z, 0.1, 1.92, 0.09, trim);
    vent(5.71, 1.91, z - 0.25, 0.67, 0.55, Math.PI / 2);
  }
  box(4.6, 1.47, 2.72, 1.22, 1.82, 0.17, steel);
  box(4.6, 1.47, 2.83, 1.02, 1.62, 0.08, olive);
  lamp(4.6, 2.5, 2.92);
  sign('03', 4.6, 1.82, 2.89, 0.62, 0.35);
  for (let x of [-4.1, -2.1, 0, 2.25]) {
    vent(x, 1.85, -3.55, 1, 0.65, Math.PI);
  }
  for (let z of [-1.95, 0.55]) {
    box(-5.25, 2.35, z, 0.14, 0.86, 1.4, steel);
    box(-5.34, 2.35, z, 0.05, 0.62, 1.15, glass);
    for (let dz of [-0.39, 0, 0.39])
      box(-5.39, 2.35, z + dz, 0.035, 0.65, 0.05, trim);
  }

  // 屋顶围挡、观察塔和支撑柱。
  for (let x of [-4.98, 3.65])
    box(x, 3.82, -0.15, 0.18, 0.48, 6.65, darkcon);
  box(-0.68, 3.82, -3.42, 8.6, 0.48, 0.18, darkcon);
  box(-2.25, 3.82, 3.19, 5.45, 0.48, 0.18, darkcon);
  bags([-4.75, 2.91], [0.15, 2.91], 3.66, 2);
  bags([-4.75, -3.1], [-4.75, 2.8], 3.66, 2);
  rail([0.6, 3.13], [3.55, 3.13], 3.64);
  rail([3.55, -3.1], [3.55, 3.13], 3.64);
  box(-1.15, 4.29, -0.75, 4.45, 1.34, 3.3, metal);
  box(-1.15, 4.98, -0.75, 4.62, 0.17, 3.49, trim);
  box(-1.15, 5.69, -0.75, 4.92, 1.1, 3.78, olive);
  box(-1.15, 6.36, -0.75, 5.23, 0.24, 4.06, steel);
  box(-1.15, 6.52, -0.75, 4.99, 0.1, 3.83, trim);
  for (let z of [1.18, -2.68]) {
    for (let x of [-3.15, -2.15, -1.15, -0.15, 0.85]) {
      box(x, 5.73, z, 0.86, 0.66, 0.14, steel);
      box(x, 5.73, z + (z > 0 ? 0.08 : -0.08), 0.7, 0.51, 0.045, glass);
    }
    for (let x of [-3.64, 1.33])
      box(x, 5.72, z, 0.15, 1.05, 0.17, trim);
  }
  for (let x of [-3.65, 1.35])
    for (let z of [-2.07, -0.75, 0.57]) {
      box(x, 5.73, z, 0.14, 0.66, 0.98, steel);
      box(x + (x < 0 ? -0.08 : 0.08), 5.73, z, 0.04, 0.51, 0.8, glass);
    }
  box(-1.15, 5.13, -0.75, 5.3, 0.15, 4.05, steel);
  rail([-3.78, 1.19], [1.48, 1.19], 5.14);
  sign('A-03', -0.9, 4.46, 1, 1.5, 0.42);
  for (let x of [-3.6, 1.4])
    for (let z of [-2.64, 1.15])
      beam([x, 3.64, z], [x, 5.07, z], 0.16, steel);

  // 左侧楼梯从地台通到屋顶平台。
  for (let i = 0; i < 15; i++) {
    let y = 0.24 + i * 0.23, z = 3.6 - i * 0.4;
    box(-6, y, z, 1.22, 0.12, 0.38, metal);
    for (let x of [-6.62, -5.38])
      box(x, y + 0.06, z, 0.055, 0.14, 0.38, trim);
    if (i % 3 === 0)
      for (let x of [-6.63, -5.37])
        box(x, y + 0.47, z, 0.06, 0.9, 0.06, trim);
  }
  for (let x of [-6.63, -5.37]) {
    beam([x, 0.2, 3.76], [x, 3.54, -2.12], 0.18, steel);
    pipe([x, 1.12, 3.6], [x, 4.34, -2], 0.045, trim);
  }
  box(-5.78, 3.55, -2.6, 1.55, 0.16, 1.15, metal);
  rail([-6.5, -3.15], [-5, -3.15], 3.6);
  rail([-6.5, -3.15], [-6.5, -2.05], 3.6);

  // 背面的管道与设备。
  for (let x of [-3.3, -2.75]) {
    pipe([x, 0.55, -3.62], [x, 3.2, -3.62], 0.085, steel);
    pipe([x, 3.2, -3.62], [x, 3.84, -3.05], 0.085, steel);
    for (let y of [1, 1.8, 2.6])
      box(x, y, -3.67, 0.27, 0.095, 0.1, trim);
  }
  for (let x of [1.3, 2.45]) {
    box(x, 0.55, -4.04, 0.9, 0.78, 0.72, olive);
    vent(x, 0.61, -4.45, 0.68, 0.48, Math.PI);
  }
  for (let z of [-1.9, -0.9]) {
    cyl(4.95, 3.41, z, 0.36, 1.02, trim);
    ball(4.95, 3.91, z, 0.36, 0.17, 0.36, trim);
    pipe([4.95, 4.05, z], [4.95, 4.17, z], 0.075, steel);
    box(4.95, 2.91, z, 0.76, 0.1, 0.76, steel);
  }

  // 屋顶天线、碟形设备及机柜。
  box(-2.55, 6.7, -1.65, 0.8, 0.25, 0.8, metal);
  cyl(-2.55, 7.63, -1.65, 0.055, 1.74, steel);
  for (let y of [7.08, 7.55, 7.96])
    pipe([-2.98, y, -1.65], [-2.12, y, -1.65], 0.025, trim);
  ball(-2.55, 8.53, -1.65, 0.07, 0.07, 0.07, glow);
  for (let x of [2.15, 2.65])
    for (let z of [-2.75, -2.25])
      beam([x, 3.68, z], [2.4, 6.3, -2.5], 0.06, trim);
  for (let y = 4; y < 6.25; y += 0.42) {
    let f = (6.3 - y) / 2.65 * 0.25;
    beam([2.4 - f, y, -2.5 - f], [2.4 + f, y, -2.5 - f], 0.05, steel);
    beam([2.4 - f, y, -2.5 + f], [2.4 + f, y, -2.5 + f], 0.05, steel);
  }
  const dish = new T.Group();
  root.add(dish);
  dish.position.set(2.4, 6.28, -2.5);
  dish.rotation.set(-0.65, 0.28, 0.35);
  const dishMaterial = mat(0x969c90, .78, .4);
  dishMaterial.side = T.DoubleSide;
  const profile = [];
  for (let i = 0; i <= 16; i++) {
    let r = i / 16 * 0.75;
    profile.push(new T.Vector2(r, r * r * 0.65));
  }
  mesh(new T.LatheGeometry(profile, 32), dishMaterial, 0, 0, 0, dish);
  pipe([0, 0.02, 0], [0, 0.57, 0], 0.045, steel, dish);
  ball(0, 0.59, 0, 0.1, 0.12, 0.1, steel, dish);
  for (let a = 0; a < 6; a++) {
    let q = a * Math.PI / 3;
    pipe([Math.cos(q) * 0.72, 0.33, Math.sin(q) * 0.72], [0, 0.57, 0], 0.014, trim, dish);
  }
  for (let x of [-3.6, -2.4]) {
    box(x, 4.03, -2.35, 1, 0.65, 0.95, olive);
    vent(x, 4.1, -2.85, 0.75, 0.43, Math.PI);
  }

  // 地面物资、沙袋与标线。
  for (let p of [[-3.7, 3.9, 1], [-2.6, 3.95, 0.9], [-3.7, 3.9, 0.72], [3.25, 4.1, 0.84], [6.1, -2.4, 0.85], [6.1, -3.35, 0.85], [-2.1, -4.45, 0.88]]) {
    let [x, z, s] = p;
    crate(x, (s === 0.72 ? 0.83 : 0.13), z, s);
  }
  bags([-6.8, 5.45], [-3.7, 5.45], 0.14, 2);
  bags([-6.8, 5.45], [-6.8, 4.2], 0.14, 2);
  bags([4.2, 5.45], [7.1, 5.45], 0.14, 2);
  bags([7.1, 5.45], [7.1, 3.9], 0.14, 2);
  for (let x of [-2.9, 3.5]) {
    box(x, 0.36, 6.4, 1.65, 0.46, 0.58, darkcon);
    box(x, 0.72, 6.4, 1.48, 0.28, 0.32, concrete);
    for (let i = 0; i < 4; i++) {
      let o = box(x - 0.53 + i * 0.36, 0.57, 6.7, 0.12, 0.3, 0.018, yellow);
      o.rotation.z = -0.42;
    }
  }
  for (let x of [-0.1, 0.4, 0.9, 1.4, 1.9, 2.4])
    box(x, 0.11, 4.65, 0.28, 0.02, 0.12, yellow);

  // 两侧照明。
  for (let x of [-7.5, 7.5]) {
    cyl(x, 0.23, -4.65, 0.18, 0.25, steel);
    cyl(x, 1.96, -4.65, 0.05, 3.55, steel);
    box(x, 3.7, -4.65, 0.53, 0.25, 0.23, steel);
    box(x, 3.68, -4.49, 0.42, 0.15, 0.03, glow);
  }

  const floor = mesh(new T.PlaneGeometry(220, 220), mat(0x424b4b, 1), 0, -.88, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;

  return {
    root,
    setWireframe(enabled: boolean) {
      for (const material of wireframeMaterials) material.wireframe = enabled;
    },
    dispose() {
      root.parent?.remove(root);
      for (const shape of meshGeometries) shape.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    }
  };
}
