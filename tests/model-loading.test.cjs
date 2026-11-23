const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: `
      export { loadModelGLB } from './src/framework/assets/model/loadModelGLB';
      export { ModelLoadAttempt } from './src/framework/assets/model/ModelLoadAttempt';
    `,
    resolveDir: process.cwd()
  },
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  external: ['fs', 'path'],
  write: false
});

function glb(json, binary) {
  const raw = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonSize = Math.ceil(raw.length / 4) * 4;
  const binSize = binary ? 8 + binary.length : 0;
  const buffer = new ArrayBuffer(20 + jsonSize + binSize);
  const view = Buffer.from(buffer);
  view.write('glTF');
  view.writeUInt32LE(2, 4);
  view.writeUInt32LE(view.length, 8);
  view.writeUInt32LE(jsonSize, 12);
  view.write('JSON', 16);
  view.fill(' ', 20, 20 + jsonSize);
  raw.copy(view, 20);
  if (binary) {
    view.writeUInt32LE(binary.length, 20 + jsonSize);
    view.writeUInt32LE(0x004e4942, 24 + jsonSize);
    binary.copy(view, 28 + jsonSize);
  }
  return buffer;
}

const valid = glb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] });
const dracoExtension = 'KHR_draco_mesh_compression';
const brokenDraco = glb({
  asset: { version: '2.0' },
  extensionsUsed: [dracoExtension],
  extensionsRequired: [dracoExtension],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{
    attributes: { POSITION: 0 },
    extensions: { [dracoExtension]: { bufferView: 0, attributes: { POSITION: 0 } } }
  }] }],
  accessors: [{ componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] }],
  buffers: [{ byteLength: 16 }],
  bufferViews: [{ buffer: 0, byteLength: 16 }]
}, Buffer.alloc(16));

function fixture({ cached, downloadBytes = valid, statusCode = 200, offline = false, delayed = false, unlinkFails = false } = {}) {
  const folder = '/wx-user/three-model-cache';
  const cachePath = folder + '/littlest-tokyo-network-test-v3.glb';
  const files = new Map([['/tmp/model.glb', downloadBytes]]);
  if (cached) files.set(cachePath, cached);
  let download;
  let requests = 0;
  let aborts = 0;
  let removals = 0;
  let saves = 0;
  const wx = {
    env: { USER_DATA_PATH: '/wx-user' },
    getFileSystemManager: () => ({
      access({ path, success, fail }) { return path === folder || files.has(path) ? success() : fail(); },
      readFile({ filePath, success }) { success({ data: files.get(filePath) }); },
      copyFile({ srcPath, destPath, success }) {
        saves++;
        files.set(destPath, files.get(srcPath));
        success();
      },
      unlink({ filePath, success, fail }) {
        removals++;
        if (unlinkFails) return fail();
        files.delete(filePath);
        success();
      }
    }),
    downloadFile(options) {
      download = options;
      requests++;
      if (offline) options.fail({ errMsg: 'network offline' });
      else if (!delayed) options.success({ statusCode, tempFilePath: '/tmp/model.glb' });
      return { abort() { aborts++; } };
    }
  };
  const entry = { exports: {} };
  vm.runInNewContext(bundle.text, {
    wx, module: entry, require, ArrayBuffer, TextDecoder, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} }
  });
  const { loadModelGLB, ModelLoadAttempt } = entry.exports;
  return {
    newAttempt: () => new ModelLoadAttempt(),
    load(attempt = new ModelLoadAttempt()) {
      return loadModelGLB({ url: 'https://assets.invalid/model.glb', cacheKey: 'littlest-tokyo', version: 'network-test-v3' }, attempt, () => {});
    },
    counters: () => ({ requests, aborts, removals, saves }),
    lateDownload() { download.success({ statusCode: 200, tempFilePath: '/tmp/model.glb' }); }
  };
}

test('corrupt Draco settles the real GLTF loader and retry skips the failed cache', { timeout: 3000 }, async () => {
  const api = fixture({ cached: brokenDraco, unlinkFails: true });
  await assert.rejects(api.load(), /Draco/);
  assert.deepEqual(api.counters(), { requests: 0, aborts: 0, removals: 1, saves: 0 });

  const recovered = await api.load();
  assert.ok(recovered.gltf.scene);
  assert.equal(api.counters().saves, 0);
  await recovered.save();
  const warm = await api.load();
  assert.ok(warm.gltf.scene);
  assert.equal(warm.save, undefined);
  assert.deepEqual(api.counters(), { requests: 1, aborts: 0, removals: 1, saves: 1 });
});

test('invalid headers, corrupt downloads and network failures never enter the cache', { timeout: 3000 }, async () => {
  for (const [options, message] of [
    [{ downloadBytes: new ArrayBuffer(20) }, /Invalid GLB magic/],
    [{ downloadBytes: brokenDraco }, /Draco/],
    [{ statusCode: 404 }, /Download HTTP 404/],
    [{ offline: true }, /network offline/]
  ]) {
    const api = fixture(options);
    await assert.rejects(api.load(), message);
    assert.equal(api.counters().saves, 0);
  }
});

test('leaving during download aborts once and ignores a late success', { timeout: 3000 }, async () => {
  const api = fixture({ delayed: true });
  const attempt = api.newAttempt();
  const pending = api.load(attempt);
  await new Promise((resolve) => setImmediate(resolve));
  const failure = assert.rejects(pending, /cancelled/);
  attempt.cancel();
  attempt.cancel();
  api.lateDownload();
  await failure;
  assert.deepEqual(api.counters(), { requests: 1, aborts: 1, removals: 0, saves: 0 });
});
