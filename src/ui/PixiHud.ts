import {
  Container, DOMAdapter, Graphics, WebGLRenderer, type ICanvas
} from 'pixi.js';
import 'pixi.js/graphics';
// Pixi's CSP adapter substitutes static uniform and UBO synchronization.
import 'pixi.js/unsafe-eval';
import type { HudGesture } from '../platform/WechatPlatform';

type Point = Parameters<HudGesture['move']>[0];
type Rect = Point & { width: number; height: number };
const panelSize = { width: 218, height: 174 };
const handle = { x: 0, y: 0, width: 218, height: 31 };
const button = { x: 12, y: 35, width: 105, height: 42 };
const toggle = { x: 143, y: 38, width: 63, height: 36 };
const slider = { x: 12, y: 88, width: 194, height: 36 };
const trackWidth = 136;
const preview = { x: 12, y: 136, width: 194, height: 25 };
const segments = [
  [2, 0, 8, 2], [10, 2, 2, 7], [10, 11, 2, 7], [2, 18, 8, 2],
  [0, 11, 2, 7], [0, 2, 2, 7], [2, 9, 8, 2]
] as const;
const digits = ['012345', '12', '01643', '01236', '5612', '05623', '056432', '012', '0123456', '012356'];

function inside(rect: Rect, point: Point) {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function drawDigits(graphic: Graphics, value: string, left: number, top: number) {
  graphic.clear();
  for (const [index, digit] of [...value].entries()) {
    for (const segment of digits[Number(digit)]) {
      const [x, y, width, height] = segments[Number(segment)];
      graphic.rect(left + index * 16 + x, top + y, width, height);
    }
  }
  graphic.fill(0xffffff);
}

export async function createHud(
  canvas: ReturnType<typeof wx.createCanvas>,
  context: WebGLRenderingContext,
  width: number,
  height: number,
  resolution: number
) {
  DOMAdapter.set({
    ...DOMAdapter.get(),
    createCanvas(width, height) {
      const offscreen = wx.createCanvas();
      if (width !== undefined) offscreen.width = width;
      if (height !== undefined) offscreen.height = height;
      return offscreen as unknown as ICanvas;
    },
    createImage: () => wx.createImage() as unknown as HTMLImageElement,
    getNavigator: () => ({ userAgent: 'WeChat Mini Game', gpu: null }),
    getBaseUrl: () => 'https://minigame.invalid/',
    getFontFaceSet: () => null,
    getWebGLRenderingContext: () => ({
      // The native context may not expose a browser WebGL constructor.
      [Symbol.hasInstance]: (value: unknown) => value === context
    }) as unknown as typeof WebGLRenderingContext
  });

  const renderer = new WebGLRenderer();
  await renderer.init({
    canvas: canvas as unknown as ICanvas,
    context: context as WebGL2RenderingContext,
    width,
    height,
    resolution,
    clearBeforeRender: false,
    // Load only the graphics extension, with input owned by wx.
    skipExtensionImports: true
  });

  const stage = new Container();
  const panel = new Container();
  const surface = new Graphics()
    .roundRect(0, 0, panelSize.width, panelSize.height, 12).fill({ color: 0x102746, alpha: 0.96 })
    .roundRect(86, 10, 46, 3, 1).fill(0xa8bfd7)
    .roundRect(86, 17, 46, 3, 1).fill(0x6d8baa);
  const background = new Graphics()
    .roundRect(button.x, button.y, button.width, button.height, 8)
    .fill(0x245cc7);
  const plus = new Graphics().rect(27, 55, 13, 2).rect(32, 50, 2, 12).fill(0xffffff);
  const counter = new Graphics();
  const switchView = new Graphics();
  const track = new Graphics();
  const value = new Graphics();
  value.scale.set(0.82);
  value.position.set(163, 98);
  const previewTrack = new Graphics()
    .roundRect(preview.x, preview.y, preview.width, preview.height, 5).fill(0x304764);
  const sample = new Graphics();
  for (let x = -18; x < preview.width + 18; x += 36) {
    sample.rect(preview.x + x, preview.y - 8, 23, preview.height + 16).fill(0x58dcc1);
    sample.rect(preview.x + x + 23, preview.y - 8, 13, preview.height + 16).fill(0x5389f4);
  }
  const mask = new Graphics().rect(preview.x, preview.y, preview.width, preview.height).fill(0xffffff);
  sample.mask = mask;
  panel.addChild(surface, background, plus, counter, switchView, track, value, previewTrack, sample, mask);
  stage.addChild(panel);

  let count = 0;
  let visible = true;
  let ratio = 0.75;
  let screenWidth = width;
  let screenHeight = height;

  function place(x: number, y: number) {
    const scale = Math.min(1, screenWidth / panelSize.width, screenHeight / panelSize.height);
    panel.scale.set(scale);
    panel.position.set(
      Math.max(0, Math.min(screenWidth - panelSize.width * scale, x)),
      Math.max(0, Math.min(screenHeight - panelSize.height * scale, y))
    );
  }
  function local(point: Point) {
    return { x: (point.x - panel.x) / panel.scale.x, y: (point.y - panel.y) / panel.scale.y };
  }
  function drawSwitch() {
    sample.visible = visible;
    switchView.clear().roundRect(toggle.x, toggle.y + 3, toggle.width, 30, 15)
      .fill(visible ? 0x147b6e : 0x405270)
      .circle(toggle.x + (visible ? 47 : 16), toggle.y + 18, 10).fill(0xffffff);
  }
  function drawSlider() {
    const length = trackWidth * ratio;
    track.clear().roundRect(slider.x, 103, trackWidth, 6, 3).fill(0x405270)
      .roundRect(slider.x, 103, length, 6, 3).fill(0x68c8fc)
      .circle(slider.x + length, 106, 8).fill(0xffffff);
    sample.alpha = ratio;
    drawDigits(value, String(Math.round(ratio * 100)), 0, 0);
  }

  function tap(rect: Rect, view: Graphics, activate: () => void): HudGesture {
    let insideUntilRelease = true;
    view.alpha = 0.7;
    return {
      move(point) {
        insideUntilRelease &&= inside(rect, local(point));
        if (!insideUntilRelease) view.alpha = 1;
      },
      release(point) {
        view.alpha = 1;
        if (insideUntilRelease && inside(rect, local(point))) activate();
      },
      cancel() {
        view.alpha = 1;
      }
    };
  }

  function beginGesture(point: Point): HudGesture | undefined {
    const hit = local(point);
    if (inside(handle, hit)) {
      const offset = { x: point.x - panel.x, y: point.y - panel.y };
      const move = (next: Point) => place(next.x - offset.x, next.y - offset.y);
      return { move, release: move, cancel() {} };
    }
    if (inside(button, hit)) {
      return tap(button, background, () => {
        count = (count + 1) % 1000;
        drawDigits(counter, String(count), 61, 46);
      });
    }
    if (inside(toggle, hit)) {
      return tap(toggle, switchView, () => {
        visible = !visible;
        drawSwitch();
      });
    }
    if (inside(slider, hit)) {
      const move = (next: Point) => {
        ratio = Math.max(0, Math.min(1, (local(next).x - slider.x) / trackWidth));
        drawSlider();
      };
      move(point);
      return { move, release: move, cancel() {} };
    }
  }

  place(14, 66);
  drawDigits(counter, '0', 61, 46);
  drawSwitch();
  drawSlider();

  return {
    beginGesture,
    resize(width: number, height: number, resolution: number) {
      screenWidth = width;
      screenHeight = height;
      renderer.resize(width, height, resolution);
      place(panel.x, panel.y);
    },
    render() {
      renderer.resetState();
      renderer.render({ container: stage, clear: false });
    }
  };
}
