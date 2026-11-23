const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { scripts } = require('../package.json');
const define = Object.fromEntries(Array.from(
  scripts.bundle.matchAll(/--define:([^= ]+)=([^ ]+)/g),
  ([, name, value]) => [name, value]
));

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: `
      export { loadHud } from "./src/framework/ui/loadHud";
      export async function loadPixiUIDiagnostics() {
        return (await import("./src/examples/pixi-ui/pixiUI")).createPixiUIDiagnostics;
      }
      export async function schedule() {
        const { SchedulerSystem } = await import("pixi.js");
        return new SchedulerSystem().repeat(() => {}, 1000);
      }
    `,
    resolveDir: process.cwd()
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'hudStartup',
  target: 'es2019',
  define,
  write: false
});

for (const navigator of [undefined, { userAgent: 'Existing native navigator' }]) {
  test(`Pixi reaches Canvas initialization ${navigator ? 'with' : 'without'} a native navigator`, async () => {
    const canvasInitialized = new Error('Reached wx.createCanvas');
    const sandbox = vm.createContext({
      console,
      wx: {
        createCanvas() {
          throw canvasInitialized;
        }
      }
    });
    if (navigator) sandbox.navigator = navigator;
    let microseconds = 1000;
    sandbox.wx.getPerformance = () => ({ now: () => microseconds });

    const { loadHud } = vm.runInContext(`${bundle.text}\nhudStartup`, sandbox);
    assert.equal(sandbox.navigator, navigator);
    await assert.rejects(loadHud({}, {}, 10, 10, 1), (error) => error === canvasInitialized);
    assert.equal(vm.runInContext('performance.now()', sandbox), 0);
    microseconds = 4500;
    assert.equal(vm.runInContext('performance.now()', sandbox), 3.5);
    microseconds = 3000;
    assert.equal(vm.runInContext('performance.now()', sandbox), 3.5);
    if (navigator) assert.equal(sandbox.navigator, navigator);
    else assert.equal(sandbox.navigator.userAgent, 'WeChat Mini Game');
  });
}

test('Pixi scheduler can read the clock when the host has no free performance binding', async () => {
  const nativeGlobals = { performance: { now: () => 20 }, navigator: { userAgent: 'WeChat' } };
  const sandbox = vm.createContext({ console, globalThis: nativeGlobals, navigator: nativeGlobals.navigator });
  assert.equal(vm.runInContext('typeof performance', sandbox), 'undefined');
  const { schedule } = vm.runInContext(`${bundle.text}\nhudStartup`, sandbox);
  assert.equal(typeof await schedule(), 'number');
});

test('custom HUD extensions load after the shims and before Pixi creates its renderer', async () => {
  const calls = [];
  const stop = new Error('Reached renderer initialization');
  const sandbox = vm.createContext({
    console,
    wx: { createCanvas() { calls.push('renderer'); throw stop; } }
  });
  const { loadHud } = vm.runInContext(`${bundle.text}\nhudStartup`, sandbox);
  await assert.rejects(loadHud({}, {}, 10, 10, 1, async () => {
    assert.equal(sandbox.navigator.userAgent, 'WeChat Mini Game');
    assert.equal(vm.runInContext('typeof performance.now', sandbox), 'function');
    calls.push('extension');
    return () => assert.fail('View should be created after renderer initialization');
  }), (error) => error === stop);
  assert.deepEqual(calls, ['extension', 'renderer']);
});

for (const hasNativeIntl of [false, true]) {
  test(`the real BitmapText HUD loads ${hasNativeIntl ? 'with' : 'without'} the Intl global`, async () => {
    const canvasInitialized = new Error('Reached wx.createCanvas');
    const sandbox = vm.createContext({
      console,
      wx: { createCanvas() { throw canvasInitialized; } }
    });
    let segmenters = 0;
    if (hasNativeIntl) {
      sandbox.Intl = { Segmenter: class { constructor() { segmenters++; } } };
    } else {
      vm.runInContext('delete globalThis.Intl', sandbox);
      assert.throws(() => vm.runInContext('Intl', sandbox), /Intl is not defined/);
    }

    const { loadHud, loadPixiUIDiagnostics } = vm.runInContext(`${bundle.text}\nhudStartup`, sandbox);
    await assert.rejects(
      loadHud({}, {}, 10, 10, 1, loadPixiUIDiagnostics),
      (error) => error === canvasInitialized
    );
    assert.equal(segmenters, hasNativeIntl ? 1 : 0);
  });
}
