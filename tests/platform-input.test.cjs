const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: `
      export { WechatPlatform } from './src/platform/WechatPlatform';
      export { PerspectiveCamera } from 'three-platformize';
      export { OrbitControls } from 'three-platformize/examples/jsm/controls/OrbitControls';
    `,
    resolveDir: process.cwd()
  },
  bundle: true,
  format: 'iife',
  globalName: 'platformInput',
  write: false
});

function createInput() {
  const listeners = new Map();
  const wx = { getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 320, windowHeight: 568 }) };
  for (const name of ['Start', 'Move', 'End', 'Cancel']) {
    listeners.set(name, []);
    wx[`onTouch${name}`] = (listener) => listeners.get(name).push(listener);
  }
  const { WechatPlatform, OrbitControls, PerspectiveCamera } = vm.runInNewContext(
    `${bundle.text}\nplatformInput`,
    { wx, requestAnimationFrame() {}, cancelAnimationFrame() {} }
  );
  const canvas = { width: 320, height: 568 };
  const platform = new WechatPlatform(canvas);
  const camera = new PerspectiveCamera(45, 320 / 568, 0.1, 50);
  camera.position.set(0, 2, 5);
  new OrbitControls(camera, canvas);
  const send = (name, x, y) => {
    const changedTouches = [{ pageX: x, pageY: y, identifier: 0 }];
    const touches = name === 'End' || name === 'Cancel' ? [] : changedTouches;
    for (const listener of listeners.get(name)) {
      listener({ type: `touch${name.toLowerCase()}`, touches, changedTouches, timeStamp: 0 });
    }
  };
  return { listeners, platform, camera, send };
}

test('native scene drag turns OrbitControls before and after registering a HUD', () => {
  const { listeners, platform, camera, send } = createInput();
  for (const registered of listeners.values()) assert.equal(registered.length, 1);
  const drag = () => {
    const before = camera.position.clone();
    send('Start', 230, 260);
    send('Move', 90, 90);
    send('End', 90, 90);
    assert.ok(camera.position.distanceTo(before) > 0.01);
  };
  drag();
  let attempts = 0;
  platform.hud = { beginGesture: ({ x }) => {
    assert.equal(x, 230);
    attempts++;
    return undefined;
  } };
  drag();
  assert.equal(attempts, 1);
});

test('HUD activation happens on release, and leaving or cancelling keeps the camera still', () => {
  const { platform, camera, send } = createInput();
  const before = camera.position.clone();
  let clicks = 0;
  platform.hud = {
    beginGesture() {
      let canClick = true;
      return {
        move({ x }) { canClick &&= x < 150; },
        release() { if (canClick) clicks++; },
        cancel() {}
      };
    }
  };
  send('Start', 40, 90);
  assert.equal(clicks, 0);
  send('End', 42, 91);
  assert.equal(clicks, 1);
  send('Start', 40, 90);
  send('Move', 220, 260);
  send('End', 40, 90);
  send('Start', 40, 90);
  send('Cancel', 40, 90);
  assert.equal(clicks, 1);
  assert.equal(camera.position.distanceTo(before), 0);
});

test('a HUD control keeps receiving drag positions outside its bounds until release', () => {
  const { platform, camera, send } = createInput();
  const before = camera.position.clone();
  const received = [];
  platform.hud = {
    beginGesture: () => ({
      move({ x, y }) { received.push(['move', x, y]); },
      release({ x, y }) { received.push(['release', x, y]); },
      cancel() { received.push(['cancel']); }
    })
  };
  send('Start', 40, 100);
  send('Move', 255, 255);
  send('End', 290, 290);
  assert.deepEqual(received, [['move', 255, 255], ['release', 290, 290]]);
  assert.equal(camera.position.distanceTo(before), 0);
});
