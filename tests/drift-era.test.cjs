const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: "export { createDriftGame } from './game'; export { routes } from './routes';",
    resolveDir: 'src/game/apps/drift-era'
  },
  bundle: true,
  format: 'cjs',
  write: false
});
const output = { exports: {} };
vm.runInNewContext(bundle.text, { module: output });
const { createDriftGame, routes } = output.exports;

function advance(game, until = () => !game.moving) {
  for (let frame = 0; frame < 300 && !until(); frame++) game.update(.05);
  assert.ok(until(), 'the player reached the requested point');
}

test('the radio requires both supplies and each area rewards the player once', () => {
  let chimes = 0;
  const game = createDriftGame(() => {}, () => { chimes++; });
  assert.equal(game.interact(), 'log');

  game.travelTo('lookout');
  game.interact();
  assert.equal(game.completed.size, 0);
  advance(game);
  assert.equal(game.position[1], routes.lookout.position[1]);
  game.interact();
  assert.equal(game.completed.size, 0);
  assert.match(game.feedback, /补给/);

  game.travelTo('dock');
  advance(game);
  assert.equal(game.position[1], routes.dock.position[1]);
  game.interact();
  game.interact();
  assert.equal(game.resources.scrap, 40);

  game.travelTo('greenhouse');
  advance(game);
  game.interact();
  assert.equal(game.resources.water, 30);

  game.travelTo('lookout');
  advance(game);
  game.interact();
  assert.equal(game.completed.size, 3);
  assert.equal(game.log.length, 4);
  assert.equal(game.resources.scrap, 36);
  assert.equal(game.resources.power, 72);
  assert.equal(chimes, 3);
});

test('rerouting on the stairs finishes the current leg before changing direction', () => {
  const game = createDriftGame(() => {}, () => {});
  game.travelTo('lookout');
  advance(game, () => game.at === 'stairFoot' && game.position[1] > 3.4);
  const before = [...game.position];
  game.travelTo('dock');
  assert.deepEqual([...game.position], before);
  advance(game, () => game.at === 'upper');
  assert.deepEqual([...game.position], [...routes.upper.position]);
  advance(game);
  assert.equal(game.at, 'dock');
  assert.deepEqual([...game.position], [...routes.dock.position]);
});
