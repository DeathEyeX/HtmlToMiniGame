const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { readAssets } = require('../scripts/build.cjs');
const { createBuildReport, inspectModelAssets, inspectLoaderCalls } = require('../scripts/build-report.cjs');

test('report keeps ocean HUD in the main package and accounts for local and remote runtime files', () => {
  const gameConfig = fs.readFileSync('game.json');
  const originalBundle = fs.readFileSync('dist/game.bundle.js');
  const local = createBuildReport('ocean-shelter');
  const remote = createBuildReport('ocean-shelter', 'https://example.invalid/ocean');
  assert.equal(local.passed, true, JSON.stringify(local.errors));
  assert.equal(remote.passed, true, JSON.stringify(remote.errors));
  assert.equal(local.resourceMode, 'subpackage');
  assert.equal(remote.resourceMode, 'remote');
  assert.equal(remote.subpackages.length, 0);
  assert.equal(local.remote, null);
  assert.equal(local.subpackages[0].root, 'dist/resources/ocean-shelter');
  assert.equal(local.subpackages[0].bytes, remote.remote.bytes + Buffer.byteLength('// Resource subpackage.\n'));
  assert(remote.remote.largest.some(file => file.file === 'environment/overcast-hdr.bin'));
  assert(local.main.largest.some(file => file.file === 'dist/resources/packaged/ocean-shelter/ui/ui-glyphs.png'));
  assert(remote.main.largest.some(file => file.file === 'dist/resources/packaged/ocean-shelter/ui/ui-glyphs.png'));
  assert(local.bundle.groups.some(group => group.group === 'node_modules/three-platformize'));
  assert.deepEqual(local.references, remote.references);
  assert.deepEqual(fs.readFileSync('game.json'), gameConfig);
  assert.deepEqual(fs.readFileSync('dist/game.bundle.js'), originalBundle);
});

test('report detects open GLB headers, missing glTF dependencies and static HUD or HDR load paths', () => {
  const all = readAssets('ocean-shelter');
  const tex = 'ocean-shelter/models/galley/range-0.png';
  const hdr = 'ocean-shelter/environment/overcast-hdr.bin';
  const glyphs = 'packaged/ocean-shelter/ui/ui-glyphs.png';
  const removed = [tex, hdr, glyphs];
  const assets = all.filter(({ file }) => !removed.includes(file));
  const model = inspectModelAssets(assets);
  assert(model.errors.some(error => error.code === 'MISSING_MODEL_ASSET' && error.expected === tex));
  const invalid = inspectModelAssets([{ file: 'bad.glb', bytes: Buffer.from('bad') }]);
  assert.equal(invalid.errors[0].code, 'INVALID_MODEL');
  const refs = inspectLoaderCalls('ocean-shelter', [
    'src/game/apps/ocean-shelter/hud/assets.ts',
    'src/game/apps/ocean-shelter/three/assets.ts',
    'src/game/apps/ocean-shelter/three/OceanShelter.ts'
  ], assets);
  assert.deepEqual(new Set(refs.errors.flatMap(error => error.expected)), new Set([hdr, glyphs]));
  assert(refs.dynamic.length > 0);
});
