const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: `
      export { loadHud } from "./src/ui/loadHud";
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
  define: { performance: 'globalThis.performance' },
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
