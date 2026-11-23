const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  entryPoints: ['src/assets/loadPackagedImage.ts'],
  bundle: true, format: 'cjs', write: false
});
const imagePath = 'media/pixi-ui-probe.png';

function fixture() {
  const image = { width: 116, height: 32 };
  const entry = { exports: {} };
  let timeout;
  let clears = 0;
  vm.runInNewContext(bundle.text, {
    module: entry,
    wx: { createImage: () => image },
    setTimeout(callback) { timeout = callback; return 1; },
    clearTimeout(id) { assert.equal(id, 1); clears++; }
  });
  return { image, load: entry.exports.loadPackagedImage, expire: () => timeout(), clears: () => clears };
}

test('the package atlas matches its expected dimensions and resolves only after native decode', async () => {
  const png = fs.readFileSync(imagePath);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 116);
  assert.equal(png.readUInt32BE(20), 32);
  const { image, load, clears } = fixture();
  const ready = load(imagePath);
  assert.equal(image.src, imagePath);
  assert.equal(clears(), 0);
  image.onload();
  assert.equal(await ready, image);
  assert.equal(clears(), 1);
});

test('native image errors and timeouts reject and clear the timer', async () => {
  const failure = fixture();
  const rejected = assert.rejects(failure.load(imagePath), /Cannot load package image/);
  failure.image.onerror();
  await rejected;
  assert.equal(failure.clears(), 1);

  const timeout = fixture();
  const expired = assert.rejects(timeout.load(imagePath), /Image load timed out/);
  timeout.expire();
  timeout.image.onload();
  await expired;
  assert.equal(timeout.clears(), 1);
});
