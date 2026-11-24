const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: "export { createHarborCamera } from './three/camera'; export { deckRoute, landings, stops } from './content';",
    resolveDir: 'src/game/apps/tidal-harbor'
  },
  bundle: true,
  format: 'cjs',
  external: ['three-platformize'],
  write: false
});
const output = { exports: {} };
vm.runInNewContext(bundle.text, { module: output, require });
const { createHarborCamera, deckRoute, landings, stops } = output.exports;

const finger = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
const send = (camera, type, ...touches) => camera.touch({ type, touches, changedTouches: touches });
const settle = camera => { for (let i = 0; i < 96; i++) camera.update(.05); };

test('scene drag orbits in portrait and cancellation clears the drag anchor', () => {
  const orbit = createHarborCamera();
  orbit.resize(390, 820);
  const initial = orbit.camera.position.clone();
  send(orbit, 'touchstart', finger(1, 70, 250));
  send(orbit, 'touchmove', finger(1, 300, 270));
  settle(orbit);
  const rotated = orbit.camera.position.clone();
  assert.ok(initial.distanceTo(rotated) > 18);
  assert.ok(rotated.x < 0);
  send(orbit, 'touchcancel');
  send(orbit, 'touchmove', finger(1, 150, 350));
  settle(orbit);
  assert.ok(orbit.camera.position.distanceTo(rotated) < .001);
});

test('pinching changes the viewing distance and the depths camera keeps below water', () => {
  const orbit = createHarborCamera();
  orbit.resize(390, 820);
  const target = orbit.camera.position.clone().set(0, 3.7, .7);
  const initial = orbit.camera.position.distanceTo(target);
  send(orbit, 'touchstart', finger(1, 140, 250), finger(2, 220, 250));
  send(orbit, 'touchmove', finger(1, 110, 250), finger(2, 250, 250));
  settle(orbit);
  const zoomed = orbit.camera.position.clone();
  assert.ok(zoomed.distanceTo(target) < initial * .8);
  send(orbit, 'touchend', finger(2, 250, 250));
  settle(orbit);
  assert.ok(orbit.camera.position.distanceTo(zoomed) < .001);
  orbit.setView('depths');
  settle(orbit);
  assert.ok(orbit.camera.position.y < -1 && orbit.camera.position.y > -16);
  orbit.setView('coast');
  settle(orbit);
  assert.ok(orbit.camera.position.y > 0);
});

test('the connected decks route between the dock, workshop, roof and beacon', () => {
  for (const from of Object.values(stops)) {
    for (const to of Object.values(stops)) {
      const path = deckRoute(from.node, to.node);
      if (from === to) assert.equal(path.length, 0);
      else assert.equal(path[path.length - 1], to.node);
    }
  }
  const heights = [stops.dock.node, ...deckRoute(stops.dock.node, stops.beacon.node)].map(node => landings[node][1]);
  assert.deepEqual([...new Set(heights)], [1.35, 4.08, 6.78]);
});
