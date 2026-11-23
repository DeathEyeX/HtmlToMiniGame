const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSync } = require('esbuild');

const bundle = buildSync({
  entryPoints: ['src/game/scenes/color-match/round.ts'],
  bundle: true,
  format: 'cjs',
  write: false
}).outputFiles[0].text;
const roundModule = { exports: {} };
new Function('module', 'exports', bundle)(roundModule, roundModule.exports);
const { createMatchRound, roundSeconds } = roundModule.exports;

test('color match only scores a correct answer during a round and changes the target', () => {
  const round = createMatchRound(() => 0);
  assert.equal(round.choose(0), false);
  round.start();
  assert.equal(round.choose(1), false);
  assert.equal(round.choose(0), true);
  assert.deepEqual(round.state(), { phase: 'playing', target: 1, score: 1, seconds: roundSeconds });
  round.start();
  assert.equal(round.state().score, 1);
});

test('color match expires after 20 active seconds and restarts with a clean score', () => {
  const round = createMatchRound(() => 0);
  round.advance(roundSeconds);
  assert.equal(round.state().seconds, roundSeconds);
  round.start();
  round.choose(0);
  for (let frame = 0; frame < 1200; frame++) round.advance(1 / 60);
  assert.deepEqual(round.state(), { phase: 'finished', target: 1, score: 1, seconds: 0 });
  assert.equal(round.choose(1), false);
  round.start();
  assert.deepEqual(round.state(), { phase: 'playing', target: 0, score: 0, seconds: roundSeconds });
});
