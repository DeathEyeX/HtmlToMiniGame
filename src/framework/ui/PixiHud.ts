import {
  Container, DOMAdapter, WebGLRenderer, type ICanvas
} from 'pixi.js';
import 'pixi.js/graphics';
// Pixi's CSP adapter substitutes static uniform and UBO synchronization.
import 'pixi.js/unsafe-eval';
import type { HudGesture } from '../platform/WechatPlatform';

type Point = Parameters<HudGesture['move']>[0];
declare const GAME_BROWSER_CHECK: boolean;

// 使用逻辑视口坐标，与 WechatPlatform 传给 beginGesture 的坐标一致。
export interface HudControlBounds {
  id: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  overlapGroup?: string;
}

export interface HudView {
  beginGesture(point: Point): HudGesture | undefined;
  resize(width: number, height: number): void;
  inspectControls?(): readonly HudControlBounds[];
}

export type CreateHudView = (stage: Container, width: number, height: number) => HudView | Promise<HudView>;

export async function createHud(
  canvas: ReturnType<typeof wx.createCanvas>,
  context: WebGLRenderingContext | WebGL2RenderingContext,
  width: number,
  height: number,
  resolution: number,
  createView?: CreateHudView,
  webGLVersion: 1 | 2 = 1
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
      [Symbol.hasInstance]: (value: unknown) => webGLVersion === 1 && value === context
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
  if (webGLVersion === 2) {
    if (renderer.context.webGLVersion !== 2 || renderer.gl !== context) {
      throw new Error('Pixi did not adopt the shared WebGL2 context');
    }
    console.log('[WebGL2] Pixi WebGL version', renderer.context.webGLVersion);
  }

  const stage = new Container();
  const view = await createView?.(stage, width, height);
  return {
    ...(typeof GAME_BROWSER_CHECK !== 'undefined' && GAME_BROWSER_CHECK && {
      inspectControls: () => view?.inspectControls?.()
    }),
    beginGesture(point: Point) {
      return view?.beginGesture(point);
    },
    resize(width: number, height: number, resolution: number) {
      renderer.resize(width, height, resolution);
      view?.resize(width, height);
    },
    render() {
      renderer.resetState();
      renderer.render({ container: stage, clear: false });
    }
  };
}
