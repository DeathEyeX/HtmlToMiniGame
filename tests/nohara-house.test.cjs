const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { Container } = require('pixi.js');
const { Scene } = require('three-platformize');

const app = 'src/game/apps/nohara-house';
const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: "export { createHouseHud } from './hud/houseHud'; export { createHouseScene } from './three/houseScene';",
    resolveDir: app
  },
  bundle: true,
  format: 'cjs',
  external: ['pixi.js', 'three-platformize'],
  write: false
});
const png = fs.readFileSync('media/nohara-house/packaged/ui/labels.png');
const page = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };

const width = 390;
const height = 820;

function loadHouse() {
  const output = { exports: {} };
  vm.runInNewContext(bundle.text, {
    module: output,
    require,
    wx: { getSystemInfoSync: () => ({ screenHeight: height, safeArea: { top: 22, bottom: height - 13 } }) }
  });
  return output.exports;
}

test('house HUD switches to each room on release and keeps the active room on cancellation', () => {
  const { createHouseHud, createHouseScene } = loadHouse();
  const stage = new Container();
  const visited = [];
  let current;
  function open(room) {
    current?.dispose();
    const scene = new Scene();
    current = createHouseScene(scene, room);
    current.resize(width, height);
    current.update(.05);
    const model = scene.children.find(child => child.isGroup);
    assert.ok(model?.children.length > 0);
    const shin = model.getObjectByName('Shinnosuke');
    assert.ok(shin?.children.some(child => child.isMesh));
    assert.ok(current.camera.projectionMatrix.elements.every(Number.isFinite));
    const dispose = current.dispose;
    current.dispose = () => {
      let released = false;
      let characterReleased = false;
      model.children[0].geometry.addEventListener('dispose', () => { released = true; });
      shin.children[0].geometry.addEventListener('dispose', () => { characterReleased = true; });
      dispose();
      assert.ok(released && characterReleased);
      assert.equal(model.parent, null);
    };
    visited.push(room);
  }
  open('exterior');
  const hud = createHouseHud(stage, width, height, page, open);
  const [header, panel] = stage.children;
  assert.ok(header.children.length > 2);
  const point = index => ({
    x: panel.x + (14 + index % 3 * 113 + 53) * panel.scale.x,
    y: panel.y + (54 + Math.floor(index / 3) * 53 + 23) * panel.scale.y
  });
  const living = point(1);
  const cancelled = hud.beginGesture(living);
  cancelled.cancel();
  cancelled.release(living);
  const dragged = hud.beginGesture(living);
  dragged.move({ x: living.x, y: panel.y - 5 });
  dragged.release(living);
  assert.deepEqual(visited, ['exterior']);

  for (const index of [1, 2, 3, 4, 5, 0, 0]) {
    const center = point(index);
    hud.beginGesture(center).release(center);
  }
  assert.deepEqual(visited, ['exterior', 'living', 'kitchen', 'tatami', 'kids', 'bath', 'exterior']);
  current.dispose();
  stage.destroy({ children: true });
});

test('house orbit tracks a single drag, stops on cancellation and clamps the interior view', () => {
  const { createHouseScene } = loadHouse();
  const exterior = createHouseScene(new Scene(), 'exterior');
  const living = createHouseScene(new Scene(), 'living');
  for (const scene of [exterior, living]) scene.resize(width, height);

  function touch(scene, type, x, y, identifier = 1) {
    scene.touch({ type, touches: [{ identifier, clientX: x, clientY: y }] });
  }

  const initial = exterior.camera.position.clone();
  touch(exterior, 'touchstart', 120, 210);
  touch(exterior, 'touchmove', 340, 250, 2);
  assert.ok(initial.equals(exterior.camera.position));
  touch(exterior, 'touchmove', 340, 250);
  const rotated = exterior.camera.position.clone();
  assert.ok(rotated.z < 0, 'the exterior orbit can reach the back of the house');
  assert.notEqual(rotated.y, initial.y);
  touch(exterior, 'touchcancel', 340, 250);
  touch(exterior, 'touchmove', 80, 40);
  assert.ok(rotated.equals(exterior.camera.position));
  exterior.resize(width, height);
  assert.ok(rotated.equals(exterior.camera.position));

  touch(living, 'touchstart', 20, 210);
  touch(living, 'touchmove', 340, 210);
  const limit = living.camera.position.clone();
  assert.ok(limit.z > 0, 'the interior stays on the open side');
  touch(living, 'touchmove', 360, 210);
  assert.ok(limit.equals(living.camera.position));
  touch(living, 'touchmove', 260, 210);
  assert.ok(!limit.equals(living.camera.position));
  exterior.dispose();
  living.dispose();
});
