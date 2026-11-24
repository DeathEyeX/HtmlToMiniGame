export {};

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const status = document.querySelector<HTMLElement>('#status')!;
const capturePointer = canvas.setPointerCapture.bind(canvas);

type TouchType = 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel';
type TouchPoint = { identifier: number; clientX: number; clientY: number; pageX: number; pageY: number };
type TouchHandler = (event: {
  type: TouchType; touches: TouchPoint[]; changedTouches: TouchPoint[]; timeStamp: number;
}) => void;

const touches = new Map<number, TouchPoint>();
const handlers: Partial<Record<TouchType, TouchHandler>> = {};

function dispatch(type: TouchType, changedTouches: TouchPoint[], timeStamp: number) {
  handlers[type]?.({ type, changedTouches, timeStamp, touches: [...touches.values()] });
}

function routePointer(type: TouchType, event: PointerEvent) {
  const identifier = event.pointerId;
  if (type === 'touchstart') {
    if (event.button !== 0) return;
    capturePointer(identifier);
  } else if (!touches.has(identifier)) return;

  const clientX = event.clientX;
  const clientY = event.clientY;
  const point = { identifier, clientX, clientY, pageX: clientX, pageY: clientY };
  if (type === 'touchend' || type === 'touchcancel') touches.delete(identifier);
  else touches.set(identifier, point);
  dispatch(type, [point], event.timeStamp);
}

// Register DOM listeners before three-platformize installs its own event bridge on the canvas.
canvas.addEventListener('pointerdown', event => routePointer('touchstart', event));
canvas.addEventListener('pointermove', event => routePointer('touchmove', event));
canvas.addEventListener('pointerup', event => routePointer('touchend', event));
canvas.addEventListener('pointercancel', event => routePointer('touchcancel', event));
canvas.addEventListener('lostpointercapture', event => routePointer('touchcancel', event));
window.addEventListener('blur', () => {
  if (!touches.size) return;
  const changed = [...touches.values()];
  touches.clear();
  dispatch('touchcancel', changed, performance.now());
});

function getSystemInfoSync() {
  return {
    windowWidth: innerWidth, windowHeight: innerHeight,
    screenWidth: innerWidth, screenHeight: innerHeight, pixelRatio: devicePixelRatio,
    platform: 'browser', system: navigator.userAgent,
    safeArea: { top: 0, bottom: innerHeight, left: 0, right: innerWidth }
  };
}

function showStatus(message: string) {
  status.textContent = message;
  status.hidden = !message;
}

let screenCanvasCreated = false;
Object.assign(globalThis, {
  wx: {
    createCanvas() {
      if (screenCanvasCreated) return document.createElement('canvas');
      screenCanvasCreated = true;
      return canvas;
    },
    createImage: () => new Image(),
    getSystemInfoSync,
    onTouchStart: (handler: TouchHandler) => { handlers.touchstart = handler; },
    onTouchMove: (handler: TouchHandler) => { handlers.touchmove = handler; },
    onTouchEnd: (handler: TouchHandler) => { handlers.touchend = handler; },
    onTouchCancel: (handler: TouchHandler) => { handlers.touchcancel = handler; },
    onWindowResize: (handler: (size: ReturnType<typeof getSystemInfoSync>) => void) =>
      window.addEventListener('resize', () => handler(getSystemInfoSync())),
    onHide: (handler: () => void) => document.addEventListener('visibilitychange', () => {
      if (document.hidden) handler();
    }),
    onShow: (handler: () => void) => document.addEventListener('visibilitychange', () => {
      if (!document.hidden) handler();
    }),
    showLoading: ({ title }: { title: string }) => showStatus(title),
    hideLoading: () => showStatus(''),
    showModal: ({ title, content }: { title: string; content: string }) => showStatus(`${title}\n${content}`),
    // Browsers fetch the selected target's resource files directly over HTTP.
    loadSubpackage: ({ success }: { success: () => void }) => queueMicrotask(success),
    getFileSystemManager: () => ({
      readFile({ filePath, success, fail }: {
        filePath: string; success: (result: { data: ArrayBuffer }) => void; fail: (error: { errMsg: string }) => void;
      }) {
        void fetch(filePath).then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        }).then(data => success({ data }), error => fail({ errMsg: String(error) }));
      }
    })
  }
});
