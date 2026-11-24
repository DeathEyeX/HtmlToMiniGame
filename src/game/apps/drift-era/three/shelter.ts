import * as THREE from 'three-platformize'
import { routes, type Position } from '../routes'

const wood = ['#95714d', '#ae8558', '#b39064', '#765d45', '#a47b59', '#8c684d']
const steel = '#344444'
const dark = '#293738'
const rim = '#57584c'
const rust = '#ac6442'
const teal = '#3f7677'
const ink = '#21313a'
const amber = '#eeb05f'
const linen = '#c1b695'

export function buildShelter(scene: THREE.Scene) {
  const batches = new Map<string, THREE.Matrix4[]>()
  const transform = new THREE.Object3D()
  const boxGeo = new THREE.BoxGeometry()
  let seed = 1977
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  function pick(colors: string[]) { return colors[Math.floor(random() * colors.length)] }

  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, rz = 0, ry = 0, rx = 0) {
    transform.position.set(x, y, z)
    transform.scale.set(w, h, d)
    transform.rotation.set(rx, ry, rz)
    transform.updateMatrix()
    if (!batches.has(color)) batches.set(color, [])
    batches.get(color)!.push(transform.matrix.clone())
  }

  function beam(a: Position, b: Position, width: number, color: string) {
    const start = new THREE.Vector3(...a)
    const end = new THREE.Vector3(...b)
    const direction = end.clone().sub(start)
    transform.position.copy(start.lerp(end, 0.5))
    transform.scale.set(width, direction.length(), width)
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    transform.updateMatrix()
    if (!batches.has(color)) batches.set(color, [])
    batches.get(color)!.push(transform.matrix.clone())
  }

  function deck(x0: number, x1: number, z0: number, z1: number, height: number) {
    const count = Math.ceil((x1 - x0) / 0.42)
    const step = (x1 - x0) / count
    for (let i = 0; i < count; i++) {
      const x = x0 + (i + 0.5) * step
      box(x, height - 0.075, (z0 + z1) / 2, step - 0.022, 0.15, z1 - z0 + (random() - 0.5) * 0.12, pick(wood))
      if (i % 2 === 0) box(x, height + 0.006, z1 - 0.14, 0.055, 0.013, 0.055, rim)
    }
    for (const z of [z0 + 0.16, z1 - 0.12]) {
      box((x0 + x1) / 2, height - 0.27, z, x1 - x0 + 0.12, 0.29, 0.29, steel)
      box((x0 + x1) / 2, height - 0.17, z + 0.13, x1 - x0 + 0.12, 0.08, 0.10, rim)
    }
  }

  function rail(x0: number, x1: number, z: number, height: number) {
    const count = Math.max(1, Math.ceil((x1 - x0) / 1.55))
    for (let i = 0; i <= count; i++) {
      const x = x0 + i * (x1 - x0) / count
      box(x, height + 0.31, z, 0.10, 0.67, 0.10, steel)
      box(x, height + 0.66, z, 0.16, 0.10, 0.16, pick(wood))
    }
    for (const y of [0.29, 0.59]) box((x0 + x1) / 2, height + y, z, x1 - x0, 0.046, 0.049, '#77745b')
  }

  function stairs(start: Position, end: Position, width: number) {
    const a = new THREE.Vector3(...start)
    const b = new THREE.Vector3(...end)
    const alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z)
    const count = 14
    for (let i = 0; i <= count; i++) {
      const v = a.clone().lerp(b, i / count)
      box(v.x, v.y - 0.068, v.z, alongX ? 0.28 : width, 0.135, alongX ? width : 0.33, pick(wood))
    }
    const edge = alongX ? [0, 0, -width / 2] : [width / 2, 0, 0]
    const offset = (v: Position, y: number): Position => [v[0] + edge[0], v[1] + y, v[2] + edge[2]]
    beam(offset(start, -0.22), offset(end, -0.22), 0.19, steel)
    beam(offset(start, 0.63), offset(end, 0.63), 0.07, rim)
    for (let i = 0; i <= 3; i++) {
      const v = a.clone().lerp(b, i / 3)
      box(v.x + edge[0], v.y + 0.30, v.z + edge[2], 0.075, 0.65, 0.075, steel)
    }
  }

  function crate(x: number, y: number, z: number, size: number, color = rust) {
    box(x, y + size * 0.43, z, size, size * 0.86, size * 0.91, color)
    for (const side of [-1, 1]) {
      box(x + size * side * 0.36, y + size * 0.43, z + size * 0.47, size * 0.12, size * 0.85, size * 0.042, wood[0])
      box(x + size * side * 0.36, y + size * 0.87, z, size * 0.12, size * 0.045, size * 0.94, wood[2])
    }
    box(x, y + size * 0.60, z + size * 0.48, size * 0.36, size * 0.13, 0.025, dark)
  }

  function barrel(x: number, y: number, z: number, color: string, size = 1) {
    box(x, y + 0.36 * size, z, 0.48 * size, 0.72 * size, 0.48 * size, color)
    for (const h of [0.18, 0.57]) box(x, y + h * size, z, 0.54 * size, 0.09 * size, 0.54 * size, rim)
    box(x + 0.05 * size, y + 0.73 * size, z - 0.09 * size, 0.10 * size, 0.035, 0.10 * size, dark)
  }

  function lamp(x: number, y: number, z: number) {
    box(x, y, z, 0.26, 0.30, 0.22, dark)
    box(x, y - 0.027, z + 0.045, 0.22, 0.14, 0.15, '#ffe29b')
    box(x, y + 0.16, z, 0.36, 0.07, 0.34, wood[0])
    const light = new THREE.PointLight(new THREE.Color('#ffc275').convertSRGBToLinear(), 7, 4.2, 1.7)
    light.position.set(x, y - 0.24, z + 0.27)
    scene.add(light)
  }

  deck(-12.6, 11.65, -3.8, 2.32, 3.2)
  deck(-9.5, -3.95, -3.0, 2.34, 6.3)
  deck(4.05, 13.7, 5.12, 7.6, 1.1)
  stairs(routes.stairFoot.position, routes.upper.position, 1.09)
  stairs(routes.dockLip.position, routes.bottom.position, 1.15)
  rail(-12.5, -10.1, 2.22, 3.2)
  rail(-6.0, -4.65, 2.22, 3.2)
  rail(-0.45, 8.9, 2.24, 3.2)
  rail(10.89, 11.58, 2.24, 3.2)
  rail(-9.46, -5.1, 2.24, 6.3)
  rail(-9.45, -4.03, -2.97, 6.3)
  rail(4.12, 7.05, 7.48, 1.1)
  rail(11.35, 13.63, 7.48, 1.1)

  // Salvaged flotation tanks, trusses, braces, and hanging rubber fenders.
  for (let x = -11.6; x < 12; x += 2.75) {
    box(x, 1.18, 0, 2.27, 1.74, 4.65, x < 0 ? dark : steel)
    box(x, 0.86, 2.2, 2.16, 0.78, 0.57, x < 0 ? teal : rust)
    for (const z of [-2.6, 1.95]) {
      beam([x - 1.13, 1.04, z], [x + 1.19, 2.88, z], 0.17, steel)
      beam([x + 1.13, 1.04, z], [x - 1.19, 2.88, z], 0.17, rim)
      box(x - 1.14, 1.86, z, 0.24, 2.25, 0.25, steel)
    }
    box(x - 0.8, 1.52, 2.26, 0.54, 0.56, 0.19, ink)
    box(x - 0.8, 1.52, 2.37, 0.25, 0.27, 0.035, teal)
    beam([x - 0.8, 2.94, 2.28], [x - 0.8, 1.68, 2.28], 0.058, dark)
    for (const side of [-1, 1]) {
      box(x + side * 0.72, 0.91, 2.51, 0.13, 0.83, 0.094, rim)
      box(x + side * 0.72, 1.26, 2.57, 0.07, 0.074, 0.03, linen)
    }
    for (let i = 0; i < 5; i++) {
      box(x - 0.65 + random() * 1.28, 0.60 + random() * 0.55, 2.49, 0.06 + random() * 0.18, 0.022 + random() * 0.07, 0.020, pick([rust, dark, rim]))
    }
  }
  for (const x of [4.3, 6.7, 9.4, 11.8, 13.2]) {
    box(x, 0.39, 7.05, 0.29, 1.46, 0.29, wood[3])
    box(x, 0.26, 6.25, 1.28, 0.53, 1.73, teal)
    box(x, 0.45, 7.5, 0.47, 0.38, 0.16, ink)
  }

  // The open command cabin is built from a cut-down container.
  box(-7.38, 4.49, -2.58, 6.24, 2.58, 0.18, teal)
  box(-10.44, 4.49, -1.35, 0.18, 2.58, 2.65, rust)
  for (let x = -10.3; x < -4.25; x += 0.33) box(x, 4.45, -2.46, 0.079, 2.46, 0.082, '#4e8581')
  for (const x of [-10.37, -7.44, -4.35]) {
    box(x, 4.66, 0.18, 0.15, 2.94, 0.20, '#6d6252')
    box(x, 4.63, -2.47, 0.16, 2.88, 0.23, '#6d6252')
  }
  for (let x = -10.57; x <= -4.13; x += 0.32) box(x, 5.83, -1.26, 0.28, 0.13 + random() * 0.065, 3.33, pick(['#696b55', '#81785c', '#a1694c', '#4f6560']))
  box(-7.35, 5.67, 0.46, 6.48, 0.23, 0.21, rust)
  box(-8.46, 4.74, -2.37, 1.55, 1.09, 0.10, linen)
  box(-8.46, 4.74, -2.30, 1.39, 0.92, 0.035, '#54766e')
  for (let i = 0; i < 9; i++) box(-9 + random() * 1.1, 4.43 + random() * 0.61, -2.275, 0.08 + random() * 0.32, 0.07 + random() * 0.13, 0.025, pick([linen, teal, wood[2]]))
  for (const x of [-8.95, -7.77]) box(x, 3.56, -0.93, 0.15, 0.71, 0.64, dark)
  box(-8.36, 3.96, -0.93, 1.62, 0.15, 0.85, wood[1])
  box(-8.65, 4.22, -1.10, 0.49, 0.42, 0.27, dark)
  box(-8.65, 4.26, -0.955, 0.33, 0.23, 0.019, '#97c394')
  box(-7.94, 4.06, -0.89, 0.47, 0.06, 0.23, linen)
  box(-6.08, 4.12, -2.24, 1.72, 1.75, 0.36, steel)
  for (let y = 3.55; y < 4.98; y += 0.36) {
    box(-6.08, y, -2.02, 1.65, 0.30, 0.09, '#586961')
    box(-6.08, y, -1.96, 0.29, 0.05, 0.045, linen)
  }
  crate(-10.90, 3.2, 0.57, 0.92, teal)
  crate(-11.97, 3.2, -0.24, 0.92)
  crate(-11.97, 4.0, -0.24, 0.61, wood[3])
  barrel(-5.05, 3.2, -1.47, rust)
  lamp(-9.94, 5.36, 0.46)

  // Narrow radio tower, aerials, and an improvised solar array.
  for (const x of [-8.9, -7.9]) {
    for (const z of [-2.33, -1.34]) beam([x, 6.25, z], [-8.4 + (x + 8.4) * 0.42, 10.22, -1.835 + (z + 1.835) * 0.42], 0.11, rust)
  }
  for (let i = 0; i < 5; i++) {
    const height = 6.45 + i * 0.69
    const w = 0.95 - i * 0.13
    beam([-8.4 - w / 2, height, -1.31 - i * 0.06], [-8.4 + w / 2, height + 0.68, -1.36 - i * 0.06], 0.075, i % 2 ? wood[1] : steel)
    box(-8.4, height, -1.835, w, 0.10, w, steel)
  }
  beam([-8.4, 9.9, -1.84], [-8.4, 11.85, -1.84], 0.077, dark)
  box(-8.4, 10.76, -1.84, 1.67, 0.065, 0.065, linen)
  box(-8.4, 11.30, -1.84, 1.13, 0.055, 0.060, linen)
  for (let i = 0; i < 4; i++) box(-9.13 + i * 0.47, 10.76, -1.84, 0.045, 0.049, 0.41 + i * 0.055, linen)
  beam([-8.35, 9.72, -1.85], [-4.12, 6.35, -2.72], 0.033, steel)
  box(-7.55, 6.63, -0.40, 0.82, 0.66, 0.48, dark)
  box(-7.55, 6.73, -0.145, 0.63, 0.24, 0.04, '#a2a66f')
  box(-7.77, 6.73, -0.107, 0.11, 0.10, 0.04, '#dd9a5c')
  lamp(-9.1, 7.01, 1.05)
  for (const x of [-9.19, -6.66]) {
    box(x, 7.06, -0.23, 0.10, 1.55, 0.11, rim)
    box(x, 7.06, -1.31, 0.10, 1.55, 0.11, rim)
  }
  box(-7.93, 6.96, -1.31, 2.60, 1.31, 0.092, '#726746')
  box(-8.35, 7.15, -1.25, 0.56, 0.48, 0.043, '#9f9b70')
  for (let x = -9.25; x <= -6.53; x += 0.22) {
    box(x, 7.86, -0.75, 0.205, 0.075, 1.34, pick(['#82765d', '#9f8660', '#9d7057', '#6b7b71']), 0, 0, -0.15)
  }
  lamp(-6.66, 7.61, -0.13)
  crate(-9.07, 6.3, 0.24, 0.38, teal)
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5
    box(-8.40 + Math.cos(angle) * 0.19, 6.64 + Math.sin(angle) * 0.19, 2.32, 0.13, 0.12, 0.073, i % 5 < 2 ? '#c7b897' : '#ba5745', angle)
  }
  for (const z of [-2.4, -1.57]) {
    box(-5.48, 6.59, z + 0.12, 0.13, 0.61, 0.12, steel)
    box(-5.48, 6.88, z, 1.60, 0.10, 0.75, steel, 0, 0, 0.28)
    for (let i = 0; i < 5; i++) box(-6.08 + i * 0.3, 6.94, z, 0.27, 0.031, 0.69, pick(['#496a80', '#3b596e', '#5a7887']), 0, 0, 0.28)
  }

  // A covered greenhouse with open planters and a condensation tank.
  for (const x of [3.35, 5.2, 7.08, 8.95, 10.7]) {
    for (const z of [-3.3, 0.16]) box(x, 4.36, z, 0.12, 2.32, 0.13, '#71836a')
    beam([x, 5.5, -3.3], [x, 6.28, -1.59], 0.13, steel)
    beam([x, 6.28, -1.59], [x, 5.5, 0.16], 0.13, steel)
  }
  for (const [y, z] of [[5.50, -3.3], [6.26, -1.6], [5.50, 0.16]]) box(7.025, y, z, 7.60, 0.13, 0.15, '#6c7964')
  for (let x = 3.46; x < 10.77; x += 0.32) {
    box(x, 5.89, -2.445, 0.30, 0.06, 1.89, pick(['#638680', '#799c8e', '#648878', '#90aa90']), 0, 0, 0.43)
    if (x < 5.13 || x > 8.93) box(x, 5.887, -0.72, 0.30, 0.06, 1.86, pick(['#8d9a7c', '#acaf82', '#788d76']), 0, 0, -0.42)
  }
  for (const z of [-2.85, -1.26]) {
    box(6.5, 3.48, z, 5.35, 0.26, 0.96, wood[0])
    box(6.5, 3.62, z, 5.16, 0.06, 0.77, '#414b32')
    for (let i = 0; i < 31; i++) {
      const x = 4.02 + random() * 4.94
      const depth = z + (random() - 0.5) * 0.70
      const h = 0.27 + random() * 0.69
      box(x, 3.6 + h / 2, depth, 0.07, h, 0.08, '#627a3c')
      for (const side of [-1, 1]) {
        box(x + side * 0.135, 3.64 + h * (0.55 + random() * 0.34), depth, 0.30, 0.14 + random() * 0.12, 0.20, pick(['#6b9249', '#87a558', '#a9b968', '#527e48', '#749a55']), side * 0.36)
      }
      if (i % 5 === 0) box(x, 3.65 + h, depth, 0.13, 0.13, 0.13, pick(['#d49258', '#b3684f', '#cabb78']))
    }
  }
  barrel(9.81, 3.2, -0.80, '#5c9c9e', 1.83)
  box(9.81, 4.71, -0.70, 0.16, 0.43, 0.16, steel)
  box(9.81, 4.93, -0.35, 0.16, 0.14, 0.80, steel)
  crate(3.61, 3.2, -0.04, 0.64)
  lamp(3.35, 5.17, 0.22)

  // The middle gangway and the low salvage dock.
  for (const x of [0.14, 0.46, 0.79, 1.12, 1.45]) box(x, 3.25, 2.10, 0.15, 0.07, 0.13, amber)
  for (const x of [3.90, 4.22, 4.55]) box(x, 1.125, 5.65, 0.13, 0.05, 0.21, amber)
  const crates = [[5.15, 6.28, 0.83], [6, 6.95, 0.49], [12.79, 6.17, 0.89], [12.76, 7.0, 0.5]]
  for (const [x, z, size] of crates) crate(x, 1.1, z, size)
  for (const x of [5.1, 5.56, 6.03]) {
    beam([x, 2.87, 2.37], [x + 0.95, 2.20, 2.48], 0.035, '#9b8c68')
    beam([x + 0.95, 2.87, 2.37], [x, 2.20, 2.48], 0.035, '#9b8c68')
  }
  for (const x of [4.96, 7.13]) box(x, 2.86, 2.37, 0.16, 0.11, 0.11, wood[2])
  barrel(4.56, 1.1, 7.1, teal)
  barrel(11.5, 1.1, 6.93, rust)
  box(12.03, 2.3, 5.36, 0.18, 2.55, 0.19, steel)
  beam([12.03, 3.50, 5.36], [12.75, 3.50, 7.46], 0.15, rust)
  beam([12.03, 2.77, 5.36], [12.59, 3.50, 6.91], 0.085, steel)
  beam([12.75, 3.50, 7.46], [12.75, 1.26, 7.46], 0.037, rim)
  lamp(12.03, 2.82, 5.47)
  box(10.32, 0.32, 8.84, 3.76, 0.43, 1.34, '#923f34')
  box(10.35, 0.53, 8.83, 2.81, 0.07, 1.04, wood[0])
  for (const z of [8.19, 9.48]) box(10.25, 0.58, z, 3.72, 0.32, 0.30, '#c5794f')
  box(12.12, 0.52, 8.42, 1.09, 0.32, 0.31, '#c5794f', 0, -0.62)
  box(12.12, 0.52, 9.24, 1.09, 0.32, 0.31, '#c5794f', 0, 0.62)
  box(8.41, 0.52, 8.83, 0.23, 0.30, 1.36, '#c5794f')
  box(9.42, 0.70, 8.82, 0.19, 0.14, 1.20, linen)
  beam([11.35, 1.67, 7.48], [12.31, 0.60, 8.38], 0.054, linen)

  for (const [color, matrices] of batches) {
    // three-platformize 的 Color 接收线性值，沿用原型的 sRGB 色板时先转换。
    const linear = new THREE.Color(color).convertSRGBToLinear()
    const material = color === '#ffe29b'
      ? new THREE.MeshBasicMaterial({ color: linear })
      : new THREE.MeshLambertMaterial({ color: linear })
    const mesh = new THREE.InstancedMesh(boxGeo, material, matrices.length)
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  const beacon = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: '#f79758' }))
  beacon.position.set(-8.4, 11.82, -1.84)
  beacon.scale.setScalar(0.23)
  scene.add(beacon)
  return beacon
}
