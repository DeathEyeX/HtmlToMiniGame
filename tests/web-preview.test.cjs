const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { build } = require('esbuild');
const { listTargetAssets } = require('../scripts/build.cjs');
const { webBuildOptions } = require('../scripts/dev-web.cjs');

test('web previews serve only the selected app and assets from an isolated in-memory build', async () => {
  const names = ['nohara-house', 'ocean-shelter'];
  await Promise.all(names.map(async name => {
    const options = webBuildOptions(name);
    assert.equal(options.write, false);
    const outputRoot = path.join(options.absWorkingDir, '.build', 'web', name);
    const result = await build(options);
    const files = new Map(result.outputFiles.map(file => [
      path.relative(outputRoot, file.path).split(path.sep).join('/'), file
    ]));
    const { entryPoint, inputs } = result.metafile.outputs[`.build/web/${name}/game.js`];
    assert.equal(entryPoint, `src/game/apps/${name}/main.ts`);
    assert(!Object.keys(inputs).some(file => file.startsWith('src/framework/platform/browser/')));
    assert.match(files.get('index.html').text, /\/platform\.js[^]*\/game\.js/);
    assert(files.has('platform.js'));
    assert(files.has('game.js.map'));
    assert.deepEqual(
      [...files.keys()].filter(file => file.startsWith('dist/')).sort(),
      listTargetAssets(name).map(({ file }) => `dist/resources/${file}`).sort()
    );
  }));
  assert.throws(() => webBuildOptions('missing-app'), /未知构建目标/);
});
