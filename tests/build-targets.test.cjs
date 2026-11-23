const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { compileTarget, readAssets } = require('../scripts/build.cjs');
const targets = require('../scripts/targets.json');

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
  for (const [name, { entry, assets = [] }] of Object.entries(targets)) {
    const { metafile } = compileTarget(name);
    const { entryPoint, inputs } = metafile.outputs['dist/game.bundle.js'];
    assert.equal(entryPoint, entry, name);
    const app = entry.match(/^src\/game\/apps\/[^/]+\//)?.[0];
    assert(app, `${name} must point to an application entry`);
    for (const file of Object.keys(inputs).filter((file) => file.startsWith('src/game/apps/'))) {
      assert(file.startsWith(app), `${name} unexpectedly includes ${file}`);
    }
    assert.deepEqual(readAssets(name).map(({ file }) => file), assets, name);

    if (!shippedTargets.has(name)) continue;
    const has = (file) => Object.hasOwn(inputs, file);
    assert.equal(has('src/framework/assets/model/draco/draco_decoder.js'), modelTargets.has(name), name);
    assert.equal(has('src/game/apps/showcase/ModelHud.ts'), name === 'showcase-model', name);
    assert.equal(has('src/game/apps/webgl2/webGL2.ts'), name.startsWith('webgl2'), name);
    assert.equal(has('src/game/common/ui/packagedUIAtlas.ts'), atlasTargets.has(name), name);
    assert.equal(has('src/game/common/workbench/Workbench.ts'), name === 'workbench' || name.startsWith('showcase'), name);
    assert.equal(has('src/game/common/color-match/ColorMatch.ts'), name === 'color-match' || name.startsWith('showcase'), name);
    assert.deepEqual(assets, atlasTargets.has(name) ? ['pixi-ui-probe.png'] : [], name);
  }
});
