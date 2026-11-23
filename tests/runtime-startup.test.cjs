const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  entryPoints: ['src/runtime/startGame.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2019',
  external: ['three-platformize', '../platform/WechatPlatform', '../ui/loadHud'],
  write: false
});

test('the shared runtime renders while HUD loads and resumes a single frame loop', async () => {
  const frames = new Map();
  const listeners = {};
  const draws = [];
  const deltas = [];
  const rendererSizes = [];
  const hudSizes = [];
  const canvas = {};
  const gl = { getParameter: () => 'WebGL 1.0' };
  const renderer = {
    setPixelRatio(ratio) { assert.equal(ratio, 2); },
    setSize(...size) { rendererSizes.push(size); },
    resetState() { draws.push('reset'); },
    render() { draws.push('three'); },
    getContext: () => gl
  };
  let finishHud;
  const hudStarted = new Promise((resolve) => { finishHud = resolve; });
  const hud = {
    resize(...size) { hudSizes.push(size); },
    render() { draws.push('pixi'); }
  };
  const modules = {
    'three-platformize': {
      Color: class {},
      Scene: class {},
      PLATFORM: { set() {} },
      WebGL1Renderer: class { constructor(options) { assert.equal(options.canvas, canvas); return renderer; } }
    },
    '../platform/WechatPlatform': { WechatPlatform: class {} },
    '../ui/loadHud': { loadHud: () => hudStarted }
  };
  const output = { exports: {} };
  let nextFrame = 0;
  vm.runInNewContext(bundle.text, {
    module: output,
    require: (id) => modules[id],
    console: { log() {}, error: (message, error) => assert.fail(`${message} ${error}`) },
    wx: {
      createCanvas: () => canvas,
      getSystemInfoSync: () => ({ windowWidth: 320, windowHeight: 568, pixelRatio: 3 }),
      onWindowResize(listener) { listeners.resize = listener; },
      onHide(listener) { listeners.hide = listener; },
      onShow(listener) { listeners.show = listener; }
    },
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); }
  });
  function draw(time) {
    assert.equal(frames.size, 1);
    const [[id, callback]] = frames;
    frames.delete(id);
    callback(time);
  }

  const started = output.exports.startGame(() => ({
    camera: { updateProjectionMatrix() {} },
    controls: { update() {} },
    update: (delta) => deltas.push(delta)
  }), { tag: '[Test]', hudReadyMessage: 'Ready', showHudErrorModal: false });
  await Promise.resolve();
  draw(0);
  assert.deepEqual(draws, ['reset', 'three']);

  finishHud(hud);
  await started;
  listeners.resize({ windowWidth: 568, windowHeight: 320 });
  assert.deepEqual(rendererSizes, [[320, 568], [568, 320]]);
  assert.deepEqual(hudSizes, [[320, 568, 2], [568, 320, 2]]);
  draw(100);
  assert.deepEqual(draws.slice(-3), ['reset', 'three', 'pixi']);
  assert.deepEqual(deltas, [0.05]);

  listeners.hide();
  assert.equal(frames.size, 0);
  listeners.show();
  listeners.show();
  draw(10_000);
  assert.deepEqual(deltas, [0.05]);
  draw(10_016);
  assert.deepEqual(deltas, [0.05, 0.016]);
  listeners.hide();
  assert.equal(frames.size, 0);
});
