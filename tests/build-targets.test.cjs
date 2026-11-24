const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { compileTarget, readAssets } = require('../scripts/build.cjs');
const targets = require('../scripts/targets.json');
const webgl2Renderer = 'src/framework/rendering/createWebGL2Renderer.ts';

test('application, common and framework imports follow the ownership boundaries', () => {
  for (const file of fs.readdirSync('src', { recursive: true }).filter((file) => /\.[jt]s$/.test(file))) {
    const source = path.posix.join('src', file.replaceAll('\\', '/'));
    const owner = source.match(/^src\/game\/apps\/([^/]+)\//)?.[1];
    const { importedFiles } = ts.preProcessFile(fs.readFileSync(source, 'utf8'), true, true);
    for (const { fileName } of importedFiles.filter((entry) => entry.fileName.startsWith('.'))) {
      const dependency = path.posix.join(path.posix.dirname(source), fileName);
      const dependencyOwner = dependency.match(/^src\/game\/apps\/([^/]+)\//)?.[1];
      assert(!dependencyOwner || owner === dependencyOwner, `${source} imports application code from ${dependency}`);
      if (source.startsWith('src/framework/')) {
        assert(!dependency.startsWith('src/game/'), `${source} imports business code from ${dependency}`);
      }
    }
  }
});

test('each target bundles one application and only its selected modules and packaged assets', () => {
  const shippedTargets = new Set([
    'controls', 'model-viewer', 'showcase', 'showcase-model', 'webgl2', 'webgl2-model', 'pixi-ui', 'workbench', 'color-match'
  ]);
  const modelTargets = new Set(['model-viewer', 'showcase-model', 'webgl2-model']);
  const atlasTargets = new Set(['showcase', 'showcase-model', 'pixi-ui', 'workbench', 'color-match']);
  for (const [name, { entry, renderer = 'webgl1', assets = [] }] of Object.entries(targets)) {
    const { metafile } = compileTarget(name);
    const { entryPoint, inputs } = metafile.outputs['dist/game.bundle.js'];
    assert.equal(entryPoint, entry, name);
    const app = entry.match(/^src\/game\/apps\/[^/]+\//)?.[0];
    assert(app, `${name} must point to an application entry`);
    for (const file of Object.keys(inputs).filter((file) => file.startsWith('src/game/apps/'))) {
      assert(file.startsWith(app), `${name} unexpectedly includes ${file}`);
    }
    const packaged = readAssets(name).map(({ file }) => file);
    assert.deepEqual(packaged.slice(0, assets.length), assets, name);
    const ocean = name === 'ocean-shelter';
    assert.equal(Object.hasOwn(inputs, 'src/game/apps/ocean-shelter/OceanShelter.ts'), ocean, name);
    assert.equal(Object.hasOwn(inputs, 'src/game/apps/ocean-shelter/OceanShelterHud.ts'), ocean, name);
    assert.equal(packaged.includes('ocean-shelter/models/galley/range.glb'), ocean, name);
    assert.equal(packaged.includes('ocean-shelter/models/galley/range-0.png'), ocean, name);
    assert.equal(packaged.includes('packaged/ocean-shelter/ui/ui-glyphs.png'), ocean, name);
    assert.equal(packaged.includes('ocean-shelter/environment/overcast-hdr.bin'), ocean, name);
    assert.equal(Object.hasOwn(inputs, webgl2Renderer), renderer === 'webgl2', name);

    if (!shippedTargets.has(name)) continue;
    assert.deepEqual(packaged, assets, name);
    const has = (file) => Object.hasOwn(inputs, file);
    assert.equal(has('src/framework/assets/model/draco/draco_decoder.js'), modelTargets.has(name), name);
    assert.equal(has('src/game/apps/showcase/ModelHud.ts'), name === 'showcase-model', name);
    assert.equal(has('src/game/common/ui/packagedUIAtlas.ts'), atlasTargets.has(name), name);
    assert.equal(has('src/game/common/workbench/Workbench.ts'), name === 'workbench' || name.startsWith('showcase'), name);
    assert.equal(has('src/game/common/color-match/ColorMatch.ts'), name === 'color-match' || name.startsWith('showcase'), name);
    assert.deepEqual(assets, atlasTargets.has(name) ? ['pixi-ui-probe.png'] : [], name);
  }
});

test('a remote runtime source keeps only the app bootstrap resources in the package', () => {
  const url = 'https://assets.example.com/ocean-shelter/v1';
  const { outputFiles: [bundle] } = compileTarget('ocean-shelter', url);
  assert.ok(bundle.text.includes(url + '/'));
  const local = readAssets('ocean-shelter').map(({ file }) => file);
  const remote = readAssets('ocean-shelter', url).map(({ file }) => file);
  assert.ok(remote.includes('packaged/ocean-shelter/ui/ui-glyphs.png'));
  assert.deepEqual(remote, local.filter(file => file.startsWith('packaged/ocean-shelter/')));
  assert.ok(local.some(file => file.startsWith('ocean-shelter/models/')));
  assert.throws(() => compileTarget('ocean-shelter', 'file:///resources'), /HTTP/);
  assert.throws(() => compileTarget('controls', url), /未声明运行时资源/);
});

test('an application opts into WebGL2 from its target settings alone', () => {
  const original = targets.showcase;
  try {
    targets.showcase = { ...original, renderer: 'webgl2' };
    const { metafile } = compileTarget('showcase');
    const { entryPoint, inputs } = metafile.outputs['dist/game.bundle.js'];
    assert.equal(entryPoint, original.entry);
    assert(Object.hasOwn(inputs, webgl2Renderer));
    assert(!Object.hasOwn(inputs, 'src/framework/assets/model/draco/draco_decoder.js'));

    targets.showcase = { ...original, renderer: 'typo' };
    assert.throws(() => compileTarget('showcase'), /renderer 必须为/);
    targets.showcase = { ...original, webgl2: true };
    assert.throws(() => compileTarget('showcase'), /请使用 renderer/);
  } finally {
    targets.showcase = original;
  }
});
