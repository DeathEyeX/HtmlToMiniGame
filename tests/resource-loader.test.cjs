const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  entryPoints: ['src/framework/assets/createResourceLoader.ts'],
  bundle: true,
  format: 'cjs',
  write: false
});

function fixture() {
  const mounts = [], downloads = [], reads = [], imagePaths = [];
  const buffer = new ArrayBuffer(3);
  const output = { exports: {} };
  vm.runInNewContext(bundle.text, {
    module: output,
    setTimeout,
    clearTimeout,
    wx: {
      loadSubpackage: options => mounts.push(options),
      downloadFile: options => downloads.push(options),
      getFileSystemManager: () => ({
        readFile(options) { reads.push(options); }
      }),
      createImage: () => ({
        width: 2,
        height: 2,
        set src(path) {
          imagePaths.push(path);
          this.onload();
        }
      })
    }
  });
  return { ...output.exports, mounts, downloads, reads, imagePaths, buffer };
}

const dispatch = () => new Promise(resolve => setImmediate(resolve));

test('main package resources read directly and subpackage reads share a mount with retry', async () => {
  const { createResourceLoader, mounts, reads, imagePaths, buffer } = fixture();
  const main = createResourceLoader({ kind: 'package', root: 'dist/resources/packaged/demo/' });
  await main.loadImage('ui/start.png');
  assert.deepEqual(imagePaths, ['dist/resources/packaged/demo/ui/start.png']);
  assert.equal(mounts.length, 0);
  await assert.rejects(main.readBinary('../other.bin'), /Invalid resource path/);

  const source = { kind: 'subpackage', name: 'demo', root: 'dist/resources/demo' };
  const first = createResourceLoader(source);
  const second = createResourceLoader(source);
  const pending = Promise.allSettled([first.readBinary('models/boat.glb'), second.readBinary('models/wall.glb')]);
  assert.equal(mounts.length, 1);
  assert.equal(reads.length, 0);
  mounts[0].fail({ errMsg: 'temporarily unavailable' });
  const failures = await pending;
  assert.ok(failures.every(result => result.status === 'rejected' && /temporarily unavailable/.test(result.reason.message)));

  const retry = second.readBinary('models/boat.glb');
  assert.equal(mounts.length, 2);
  mounts[1].success();
  await dispatch();
  assert.equal(reads[0].filePath, 'dist/resources/demo/models/boat.glb');
  reads[0].success({ data: buffer });
  assert.equal(await retry, buffer);
  await first.loadImage('textures/boat.png');
  assert.equal(mounts.length, 2);
});

test('remote resources share downloads and can retry HTTP and temporary-file failures', async () => {
  const { createResourceLoader, downloads, reads, imagePaths, buffer } = fixture();
  const remote = createResourceLoader({ kind: 'remote', baseUrl: 'https://assets.example.com/v1/' });
  const first = Promise.allSettled([remote.loadImage('textures/a b.png'), remote.readBinary('textures/a b.png')]);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].url, 'https://assets.example.com/v1/textures/a%20b.png');
  downloads[0].success({ statusCode: 404, tempFilePath: 'error' });
  assert.ok((await first).every(result => result.status === 'rejected' && /HTTP 404/.test(result.reason.message)));

  const retry = Promise.all([remote.loadImage('textures/a b.png'), remote.readBinary('textures/a b.png')]);
  assert.equal(downloads.length, 2);
  downloads[1].success({ statusCode: 200, tempFilePath: 'wxfile://tmp-a' });
  await dispatch();
  assert.deepEqual(imagePaths, ['wxfile://tmp-a']);
  assert.equal(reads[0].filePath, 'wxfile://tmp-a');
  reads[0].success({ data: buffer });
  assert.equal((await retry)[1], buffer);

  const stale = remote.readBinary('textures/a b.png');
  await dispatch();
  reads[1].fail({ errMsg: 'temporary file expired' });
  await assert.rejects(stale, /temporary file expired/);
  const recovered = remote.loadImage('textures/a b.png');
  downloads[2].success({ statusCode: 200, tempFilePath: 'wxfile://tmp-b' });
  await recovered;
  assert.equal(imagePaths[1], 'wxfile://tmp-b');
});
