export async function loadHud(...args: Parameters<typeof import('./PixiHud').createHud>) {
  // Pixi inspects the browser adapter during module evaluation, before it
  // is possible to install our DOMAdapter override.
  if (typeof globalThis.navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { userAgent: 'WeChat Mini Game', gpu: null }
    });
  }

  if (typeof globalThis.performance?.now !== 'function') {
    const nativeClock = wx.getPerformance?.();
    // WeChat's native clock is in microseconds. Pixi expects milliseconds.
    const readMilliseconds = nativeClock ? () => nativeClock.now() / 1000 : Date.now;
    const start = readMilliseconds();
    let elapsed = 0;
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: {
        now() {
          elapsed = Math.max(elapsed, readMilliseconds() - start);
          return elapsed;
        }
      }
    });
  }

  console.log('[PixiHUD] clock-bridge-v2', typeof globalThis.performance.now);
  const { createHud } = await import('./PixiHud');
  return createHud(...args);
}
