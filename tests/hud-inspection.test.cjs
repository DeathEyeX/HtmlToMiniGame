const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectHud } = require('../scripts/inspect-hud.cjs');
const { compileTarget } = require('../scripts/build.cjs');

test('HUD inspection reports a small hit area, overlaps, offscreen controls and duplicate IDs', () => {
  const viewport = { width: 320, height: 568 };
  const capsule = { x: 221, y: 18, width: 89, height: 32 };
  function rect(id, x, y, width = 48, height = 42, overlapGroup) {
    return { id, x, y, width, height, overlapGroup };
  }
  assert.deepEqual(inspectHud([
    rect('one', 16, 200), rect('two', 28, 200, 48, 42, 'menu')
  ], viewport, capsule).map(issue => issue.code), ['target-overlap']);
  assert.deepEqual(inspectHud([
    rect('one', 16, 200, 48, 42, 'menu'), rect('two', 28, 200, 48, 42, 'menu'),
    rect('three', 76, 200)
  ], viewport, capsule), []);
  const issues = inspectHud([
    rect('bad', 310, 0, 18, 30), rect('bad', 230, 25), rect('invalid', 10, 0, 0)
  ], viewport, capsule);
  assert.deepEqual(issues.map(issue => [issue.id, issue.code]), [
    ['bad', 'outside-viewport'], ['bad', 'small-target'], ['bad', 'duplicate-id'],
    ['bad', 'capsule-overlap'], ['invalid', 'invalid-bounds']
  ]);
});

test('WeChat output excludes browser readiness and HUD inspection hooks', () => {
  const { outputFiles: [bundle] } = compileTarget('nohara-house');
  assert.doesNotMatch(bundle.text, /__miniGameBrowserCheck|inspectControls/u);
});
