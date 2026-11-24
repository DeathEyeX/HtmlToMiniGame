import {
  BackSide, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshToonMaterial, Vector3
} from 'three-platformize';

const tau = Math.PI * 2;
const skin = 0xffc098, ink = 0x281e26, hair = 0x251e26;
const shirt = 0xe83e42, shorts = 0xf5c83a, sock = 0xfff6db;
type Point = [number, number, number];

// Body colours share a draw call. Face ink follows the skin in a second, unlit layer.
class SurfaceBatch {
  private positions: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  add(columns: number, rows: number, tint: number, sample: (u: number, v: number) => Point, wrap = true) {
    const first = this.positions.length / 3;
    const stride = wrap ? columns : columns + 1;
    const color = new Color(tint);
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col < stride; col++) {
        this.positions.push(...sample(col / columns, row / rows));
        this.colors.push(color.r, color.g, color.b);
        if (row === rows || col === columns) continue;
        const a = first + row * stride + col;
        const b = first + row * stride + (col + 1) % stride;
        this.indices.push(a, a + stride, b, b, a + stride, b + stride);
      }
    }
  }

  geometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

// phi runs from the nose around the head. The lower-front rings swell into one
// cheek, so the three-quarter silhouette has no seam between cheek and jaw.
function head(phi: number, v: number, lift = 0): Point {
  const angle = Math.PI * v;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const sx = Math.sin(phi), sz = Math.cos(phi);
  const cheek = Math.exp(-(((v - .68) / .143) ** 2)) * (.37 + .63 * Math.max(0, sz));
  const x = sin * sx * (.625 + .115 * cheek + lift) - .155 * cheek;
  const y = (.475 + lift) * cos;
  const z = sin * sz * (.445 + .147 * cheek + lift) + .04 * cheek;
  // A slight upward tilt keeps the face legible from the house's elevated camera.
  return [x + .055 * y, 1.49 + y + .15 * z - .055 * x, z - .15 * y];
}

function hairline(phi: number) {
  const side = (1 - Math.cos(phi)) / 2;
  const aroundEar = Math.min(1, Math.max(0, (side - .15) / .44));
  const fringe = .063 * (1 - Math.abs(Math.cos(4 * phi + .55))) * (1 - aroundEar);
  return .272 + .50 * aroundEar * aroundEar * (3 - 2 * aroundEar) + fringe;
}

// Place the drawing in front-view coordinates, then find its depth on the cheek.
// Drawing circles directly in latitude/longitude shears the eyes towards the chin.
function onFace(x: number, y: number, lift: number): Point {
  let phi = Math.asin(x / .625);
  let v = Math.acos((y - 1.49) / .475) / Math.PI;
  for (let i = 0; i < 4; i++) {
    const p = head(phi, v);
    const right = head(phi + .001, v);
    const down = head(phi, v + .001);
    const rx = right[0] - p[0], ry = right[1] - p[1];
    const dx = down[0] - p[0], dy = down[1] - p[1];
    const determinant = rx * dy - ry * dx;
    phi += .001 * ((x - p[0]) * dy - (y - p[1]) * dx) / determinant;
    v += .001 * ((y - p[1]) * rx - (x - p[0]) * ry) / determinant;
  }
  return head(phi, v, lift);
}

function sculptHead(body: SurfaceBatch, marks: SurfaceBatch) {
  body.add(64, 38, skin, (u, v) => head(tau * u, v));
  body.add(96, 20, hair, (u, v) => head(tau * u, hairline(tau * u) * v, .012));
  marks.add(96, 2, ink, (u, v) => head(tau * u, hairline(tau * u) + .007 * (v - .5), .014));

  function oval(color: number, x: number, y: number, rx: number, ry: number, lift = .004) {
    marks.add(24, 4, color, (u, r) => onFace(x + rx * r * Math.cos(tau * u), y + ry * r * Math.sin(tau * u), lift));
  }
  for (const side of [-1, 1]) {
    const x = -.04 + side * .213;
    const eyeY = 1.552 - side * .013;
    marks.add(24, 5, ink, (u, v) => {
      const peak = 1 - Math.abs(2 * u - 1) ** 1.4;
      return onFace(x + side * (u - .5) * .385,
        eyeY + .091 + .084 * peak + (v - .5) * (.012 + .069 * peak) + .018 * u, .006);
    }, false);
    oval(ink, x, eyeY, .084, .096);
    oval(0xfff8e8, x - .019, eyeY + .031, .026, .028, .008);
  }
  marks.add(24, 5, 0x853a35, (u, v) => {
    const width = Math.sin(Math.PI * u);
    return onFace(-.245 + .174 * u, 1.284 - .025 * u - width * (.007 + .055 * v), .005);
  }, false);
  oval(0xe98473, -.154, 1.222, .035, .009, .009);
}

// Profiles run from top to bottom. Separate radii at the hem, ankle and toe
// give clothing and shoes their own silhouettes even at phone scale.
type Profile = [height: number, radiusX: number, radiusZ: number, shiftZ?: number];
function garment(body: SurfaceBatch, color: number, x: number, z: number, profile: Profile[], lean = 0) {
  body.add(24, profile.length - 1, color, (u, v) => {
    const [y, rx, rz, shiftZ = 0] = profile[Math.round(v * (profile.length - 1))];
    return [x + rx * Math.sin(tau * u) + lean * (y - profile[0][0]), y, z + shiftZ + rz * Math.cos(tau * u)];
  });
}

function ovalPart(body: SurfaceBatch, color: number, center: Point, radii: Point, lean = 0) {
  body.add(20, 12, color, (u, v) => {
    const latitude = Math.PI * v;
    const x = radii[0] * Math.sin(latitude) * Math.sin(tau * u);
    const y = radii[1] * Math.cos(latitude);
    return [
      center[0] + x * Math.cos(lean) - y * Math.sin(lean),
      center[1] + x * Math.sin(lean) + y * Math.cos(lean),
      center[2] + radii[2] * Math.sin(latitude) * Math.cos(tau * u)
    ];
  });
}

// A tapered tube around a quadratic curve keeps the waving elbow continuous.
function arm(body: SurfaceBatch, start: Point, elbow: Point, wrist: Point) {
  body.add(16, 12, skin, (u, v) => {
    const s = 1 - v;
    const dx = s * (elbow[0] - start[0]) + v * (wrist[0] - elbow[0]);
    const dy = s * (elbow[1] - start[1]) + v * (wrist[1] - elbow[1]);
    const radius = .074 - .015 * v;
    const offset = radius * Math.sin(tau * u) / Math.hypot(dx, dy);
    return [
      s * s * start[0] + 2 * s * v * elbow[0] + v * v * wrist[0] - dy * offset,
      s * s * start[1] + 2 * s * v * elbow[1] + v * v * wrist[1] + dx * offset,
      s * s * start[2] + 2 * s * v * elbow[2] + v * v * wrist[2] + radius * Math.cos(tau * u)
    ];
  });
}

function sculptBody(body: SurfaceBatch) {
  for (const side of [-1, 1]) {
    const x = .164 * side;
    garment(body, 0xf2ad37, x, .015, [
      [.155, .019, .032], [.133, .088, .104], [.097, .111, .176, .027],
      [.059, .115, .19, .041], [.036, .113, .184, .044], [.034, .003, .004]
    ]);
    garment(body, 0xe7ca83, x, .059, [[.042, .113, .184], [.017, .111, .182], [.009, .09, .16], [.009, .001, .001]]);
    garment(body, skin, x, -.009, [[.53, .072, .075], [.368, .078, .079], [.281, .066, .065], [.17, .056, .057]]);
    garment(body, sock, x, -.015, [[.25, .069, .069], [.229, .076, .075], [.209, .07, .071], [.12, .068, .069]]);
    garment(body, shorts, x * .81, 0, [[.63, .132, .14], [.55, .149, .157], [.399, .148, .152], [.385, .137, .144], [.385, .01, .01]]);
  }
  garment(body, shirt, 0, -.01, [
    [1.17, .096, .09], [1.126, .17, .118], [1.06, .245, .156], [.97, .235, .165],
    [.83, .241, .183], [.684, .305, .201, .007], [.624, .314, .205, .015],
    [.6, .288, .187, .015], [.604, .012, .01]
  ], .06);
  // One hand rests at his side, the other is lifted in greeting.
  ovalPart(body, shirt, [-.235, 1.003, 0], [.113, .15, .133], -.4);
  arm(body, [-.275, .931, .005], [-.302, .841, .01], [-.324, .744, .037]);
  ovalPart(body, skin, [-.324, .734, .037], [.086, .095, .081], -.16);
  ovalPart(body, shirt, [.248, 1.005, 0], [.15, .114, .132], -.2);
  arm(body, [.326, 1.012, .028], [.608, .855, .07], [.694, 1.194, .154]);
  ovalPart(body, skin, [.697, 1.214, .154], [.082, .08, .064], -.14);
  ovalPart(body, skin, [.65, 1.291, .16], [.031, .083, .035], .29);
  ovalPart(body, skin, [.733, 1.292, .15], [.032, .091, .033], -.24);
  ovalPart(body, skin, [.759, 1.201, .177], [.041, .047, .043], -.38);
  for (const side of [-1, 1]) {
    ovalPart(body, skin, [side * .60, 1.422, -.005], [.114, .137, .084], side * -.19);
    ovalPart(body, 0xe8a582, [side * .643, 1.427, .055], [.046, .064, .029], side * -.24);
  }
}

export function createShinnosuke() {
  const body = new SurfaceBatch();
  const faceInk = new SurfaceBatch();
  sculptBody(body);
  sculptHead(body, faceInk);
  const surface = body.geometry();
  const artwork = faceInk.geometry();
  const outline = surface.clone();
  const positions = outline.getAttribute('position');
  const normals = outline.getAttribute('normal');
  const normal = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    normal.fromBufferAttribute(normals, i).multiplyScalar(.009);
    positions.setXYZ(i, positions.getX(i) + normal.x, positions.getY(i) + normal.y, positions.getZ(i) + normal.z);
  }
  const paint = new MeshToonMaterial({ vertexColors: true });
  // Preserve the cel palette under the warm house lights while retaining the shadow band.
  paint.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>',
      'outgoingLight = mix(diffuseColor.rgb, outgoingLight, 0.38);\n#include <output_fragment>');
  };
  const contour = new MeshBasicMaterial({ color: 0x493239, side: BackSide });
  const drawing = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const group = new Group();
  group.name = 'Shinnosuke';
  group.add(new Mesh(surface, paint), new Mesh(outline, contour), new Mesh(artwork, drawing));
  return {
    group,
    dispose() {
      for (const resource of [surface, outline, artwork, paint, contour, drawing]) resource.dispose();
    }
  };
}
