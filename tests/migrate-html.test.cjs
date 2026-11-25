const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { scanPrototype } = require('../scripts/migrate-html.cjs');

function temporaryDirectory(t) {
  fs.mkdirSync('.build', { recursive: true });
  const directory = fs.mkdtempSync(path.resolve('.build', 'migrate-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('HTML migration diagnoses markup, remote scripts and browser code at source locations', async t => {
  const dir = temporaryDirectory(t);
  const file = path.join(dir, 'legacy.html');
  fs.writeFileSync(file, `<!doctype html>
<button onclick="play()">Play</button>
<script src="https://example.invalid/three.js"></script>
<script type="module">
  const renderer = new THREE.WebGLRenderer();
  document.querySelector('button');
</script>`);
  const plan = await scanPrototype(file);
  for (const code of ['HTML_HUD', 'HTML_BEHAVIOR', 'SCRIPT_ENTRY', 'SCRIPT_PATH', 'RENDERER_OWNER', 'SCENE_FACTORY']) {
    assert(plan.issues.some(issue => issue.code === code), code);
  }
  assert(plan.issues.some(issue => issue.code === 'PLATFORM_API' && issue.file === 'legacy.html' && issue.line === 6));
  fs.writeFileSync(file, '<script type="module">export function createScene() {}</script>');
  const inline = await scanPrototype(file);
  assert.deepEqual(inline.issues, []);
  assert.match(inline.modules.get(inline.entry).text, /^export function createScene/u);
});

test('HTML migration registers a real dual-platform target and rejects an existing ID or incompatible scene', t => {
  const dir = temporaryDirectory(t);
  const prototype = path.join(dir, 'prototype');
  const project = path.join(dir, 'project');
  fs.mkdirSync(path.join(prototype, 'data', 'models'), { recursive: true });
  fs.mkdirSync(path.join(project, 'media'), { recursive: true });
  fs.mkdirSync(path.join(project, 'src', 'game', 'apps'), { recursive: true });
  fs.mkdirSync(path.join(project, 'src', 'game', 'common', 'ui'), { recursive: true });
  for (const source of ['scripts', 'src/framework', 'src/game/common/ui/reportStartupError.ts', 'tsconfig.json', 'game.json']) {
    fs.cpSync(source, path.join(project, source), { recursive: true });
  }
  const html = path.join(prototype, 'index.html');
  const config = path.join(prototype, 'migration.json');
  fs.writeFileSync(html, '<!doctype html><canvas></canvas><script type="module" src="./scene.ts"></script>');
  fs.writeFileSync(config, JSON.stringify({ id: 'migration-test', runtimeResources: 'data' }));
  fs.writeFileSync(path.join(prototype, 'data', 'models', 'data.bin'), 'sample');
  fs.writeFileSync(path.join(prototype, 'camera.ts'), `import { PerspectiveCamera } from 'three';
export const camera = new PerspectiveCamera(45, 1, 0.1, 100);`);
  fs.writeFileSync(path.join(prototype, 'scene.ts'), `import { camera } from './camera';
export function createScene() {
  return { camera, update() {} };
}`);
  const migrate = path.join(project, 'scripts', 'migrate-html.cjs');
  const options = { cwd: project, encoding: 'utf8' };
  const args = [migrate, html, '--config', config];
  const targets = path.join(project, 'scripts', 'targets.json');
  const original = fs.readFileSync(targets, 'utf8');
  assert.equal(JSON.parse(execFileSync(process.execPath, args, options)).canApply, true);
  assert.equal(fs.readFileSync(targets, 'utf8'), original);
  const result = JSON.parse(execFileSync(process.execPath, [...args, '--apply'], options));
  assert.equal(result.target.entry, 'src/game/apps/migration-test/main.ts');
  assert.equal(JSON.parse(fs.readFileSync(targets, 'utf8'))['migration-test'].runtimeResources, 'migration-test/runtime');
  const app = path.join(project, 'src', 'game', 'apps', 'migration-test');
  assert.match(fs.readFileSync(path.join(app, 'three', 'camera.ts'), 'utf8'), /from "three-platformize"/u);
  assert.equal(fs.readFileSync(path.join(project, 'media', 'migration-test', 'runtime', 'models', 'data.bin'), 'utf8'), 'sample');
  const build = execFileSync(process.execPath, ['scripts/build.cjs', 'migration-test'], options);
  assert.match(build, /dist\/resources\/migration-test\/models\/data.bin/u);
  const web = require(path.join(project, 'scripts', 'dev-web.cjs')).webBuildOptions('migration-test');
  assert.equal(web.entryPoints[0].in, result.target.entry);

  assert.equal(spawnSync(process.execPath, [...args, '--apply'], options).status, 1);
  fs.writeFileSync(config, JSON.stringify({ id: 'bad-migration-test', runtimeResources: 'data' }));
  fs.writeFileSync(path.join(prototype, 'scene.ts'), 'export function createScene() { return {}; }');
  const failed = spawnSync(process.execPath, [...args, '--apply'], options);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /SceneSetup/u);
  assert.equal(fs.existsSync(path.join(project, 'src', 'game', 'apps', 'bad-migration-test')), false);
  assert.equal(fs.existsSync(path.join(project, 'media', 'bad-migration-test')), false);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(targets, 'utf8')), 'bad-migration-test'), false);

  fs.writeFileSync(path.join(prototype, 'scene.ts'), `import { camera } from './camera';
await Promise.resolve();
export function createScene() { return { camera, update() {} }; }`);
  const unbundleable = spawnSync(process.execPath, [...args, '--apply'], options);
  assert.equal(unbundleable.status, 1);
  assert.match(unbundleable.stderr, /Top-level await/u);
  assert.equal(fs.existsSync(path.join(project, 'src', 'game', 'apps', 'bad-migration-test')), false);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(targets, 'utf8')), 'bad-migration-test'), false);
});
