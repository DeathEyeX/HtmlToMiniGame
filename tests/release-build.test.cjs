const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { listTargetAssets } = require('../scripts/build.cjs');
const { publishFiles } = require('../scripts/release-output.cjs');

function temporaryDirectory(t) {
  fs.mkdirSync('.build', { recursive: true });
  const temp = fs.mkdtempSync(path.resolve('.build', 'release-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  return temp;
}

test('release commands reuse the target files and keep static, local and remote outputs independent', t => {
  const temp = temporaryDirectory(t);
  const project = path.join(temp, 'project');
  for (const item of ['scripts', 'src/framework', 'src/game/common', 'src/game/apps/ocean-shelter',
    'media/ocean-shelter', 'game.js', 'tsconfig.json']) {
    fs.mkdirSync(path.dirname(path.join(project, item)), { recursive: true });
    fs.cpSync(item, path.join(project, item), { recursive: true });
  }
  const gameConfig = { deviceOrientation: 'portrait', subpackages: [{ name: 'shared', root: 'shared' }] };
  const privateConfig = '{"setting":{"urlCheck":true}}';
  fs.writeFileSync(path.join(project, 'game.json'), JSON.stringify(gameConfig));
  fs.writeFileSync(path.join(project, 'project.config.json'), '{"compileType":"game","appid":"touristappid"}');
  fs.writeFileSync(path.join(project, 'project.private.config.json'), privateConfig);
  fs.mkdirSync(path.join(project, 'shared'));
  fs.writeFileSync(path.join(project, 'shared', 'game.js'), '// developer-owned subpackage');
  fs.mkdirSync(path.join(project, 'dist'));
  fs.writeFileSync(path.join(project, 'dist', 'game.bundle.js'), 'previous-target');
  const options = { cwd: project, encoding: 'utf8' };
  const run = (...args) => execFileSync(process.execPath, args, options);
  const name = 'ocean-shelter';
  const base = path.join(project, '.build', 'releases', name);
  const web = path.join(base, 'web');
  const local = path.join(base, 'wechat');
  const remote = path.join(base, 'wechat-remote');

  run('scripts/build-web.cjs', name);
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  assert.match(html, /src="\.\/platform\.js"[^]*src="\.\/game\.js"/u);
  assert.doesNotMatch(html, /EventSource|web live reload/u);
  assert.deepEqual(fs.readdirSync(web).sort(), ['dist', 'game.js', 'index.html', 'platform.js']);
  assert.doesNotMatch(fs.readFileSync(path.join(web, 'game.js'), 'utf8'), /__miniGameBrowserCheck/u);
  for (const { file, source } of listTargetAssets(name)) {
    assert.deepEqual(fs.readFileSync(path.join(web, 'dist', 'resources', file)), fs.readFileSync(source));
  }
  const missingModel = spawnSync(process.execPath, ['scripts/build-web.cjs', 'model-viewer'], options);
  assert.notEqual(missingModel.status, 0);
  assert.match(missingModel.stderr, /WechatAssetServer\/model\.glb/u);

  run('scripts/build.cjs', name, '--isolated');
  const loadConfig = dir => JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
  assert.deepEqual(loadConfig(local).subpackages, [
    ...gameConfig.subpackages, { name, root: `dist/resources/${name}` }
  ]);
  const model = path.join('dist', 'resources', name, 'models/galley/range.glb');
  const hud = path.join('dist', 'resources', 'packaged', name, 'ui/ui-glyphs.png');
  assert(fs.existsSync(path.join(local, model)));
  assert(fs.existsSync(path.join(local, hud)));
  assert(fs.existsSync(path.join(local, 'shared', 'game.js')));
  assert(!fs.existsSync(path.join(local, 'project.private.config.json')));

  run('scripts/build.cjs', name, '--runtime-url', 'https://example.invalid/ocean/', '--isolated');
  assert.deepEqual(loadConfig(remote), gameConfig);
  assert(!fs.existsSync(path.join(remote, model)));
  assert(fs.existsSync(path.join(remote, hud)));
  assert(fs.existsSync(path.join(local, model)));
  assert(fs.existsSync(path.join(web, model)));
  assert.deepEqual(loadConfig(project), gameConfig);
  assert.equal(fs.readFileSync(path.join(project, 'project.private.config.json'), 'utf8'), privateConfig);
  assert.equal(fs.readFileSync(path.join(project, 'dist', 'game.bundle.js'), 'utf8'), 'previous-target');

  const stale = path.join(web, 'old-source-map.js.map');
  fs.writeFileSync(stale, 'old');
  run('scripts/build-web.cjs', name);
  assert(!fs.existsSync(stale));
  assert(fs.existsSync(path.join(local, model)));
  assert(fs.existsSync(path.join(remote, hud)));
});

test('file publication restores the previous release when a later output fails', t => {
  const temp = temporaryDirectory(t);
  const destination = path.join(temp, 'web');
  fs.mkdirSync(destination);
  const index = path.join(destination, 'index.html');
  const conflict = path.join(destination, 'models');
  fs.writeFileSync(index, 'previous');
  fs.writeFileSync(conflict, 'existing file');

  const outputs = new Map([
    ['index.html', Buffer.from('updated')],
    [path.join('models', 'model.glb'), Buffer.from('new model')]
  ]);
  assert.throws(() => publishFiles(destination, temp, outputs, new Set(['index.html', 'models'])));
  assert.equal(fs.readFileSync(index, 'utf8'), 'previous');
  assert.equal(fs.readFileSync(conflict, 'utf8'), 'existing file');
  assert.deepEqual(fs.readdirSync(temp), ['web']);
});
