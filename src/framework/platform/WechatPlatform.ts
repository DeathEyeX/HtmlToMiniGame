import { WechatGamePlatform } from 'three-platformize/src/WechatGamePlatform';

type TouchEvent = Parameters<Parameters<typeof wx.onTouchStart>[0]>[0];
type RoutedTouchEvent = TouchEvent & { type: string };
type Touch = TouchEvent['touches'][number] & { x?: number; y?: number };

interface Point {
  x: number;
  y: number;
}

export interface HudGesture {
  move(point: Point): void;
  release(point: Point): void;
  cancel(): void;
}

function touchPoint(touch: Touch): Point | undefined {
  const x = touch.clientX ?? touch.pageX ?? touch.x;
  const y = touch.clientY ?? touch.pageY ?? touch.y;
  if (x !== undefined && y !== undefined) return { x, y };
}

export class WechatPlatform extends WechatGamePlatform {
  hud?: { beginGesture(point: Point): HudGesture | undefined };
  private owner?: 'hud' | 'scene';
  private pressedId?: number;
  private gesture?: HudGesture;

  constructor(canvas: ReturnType<typeof wx.createCanvas>) {
    super(canvas);
    wx.onTouchCancel?.((event) => this.dispatchTouchEvent({ ...event, type: 'touchcancel' }));
  }

  override dispatchTouchEvent(event: RoutedTouchEvent) {
    const changedTouches = event.changedTouches;
    const firstTouch = changedTouches[0];
    if (!this.owner && event.type === 'touchstart' && firstTouch) {
      const point = touchPoint(firstTouch);
      this.gesture = point && event.touches.length === 1 ? this.hud?.beginGesture(point) : undefined;
      this.owner = this.gesture ? 'hud' : 'scene';
      if (this.owner === 'hud') {
        this.pressedId = firstTouch.identifier;
      }
    }

    if (this.owner === 'hud') {
      const pressed = changedTouches.find((touch) => touch.identifier === this.pressedId);
      const point = pressed && touchPoint(pressed);
      if (event.touches.length > 1 || event.type === 'touchcancel') {
        this.gesture?.cancel();
        this.gesture = undefined;
      } else if (event.type === 'touchend' && pressed) {
        if (point) this.gesture?.release(point);
        else this.gesture?.cancel();
        this.gesture = undefined;
      } else if (event.type === 'touchmove' && point) {
        this.gesture?.move(point);
      }
    } else if (event.type === 'touchcancel') {
      for (const touch of changedTouches) {
        super.dispatchTouchEvent({ ...event, type: 'touchend', changedTouches: [touch] });
      }
    } else {
      // Keep the native event and the same upstream bridge used before the HUD.
      super.dispatchTouchEvent(event);
    }

    if (event.touches.length === 0) {
      this.gesture?.cancel();
      this.gesture = undefined;
      this.owner = undefined;
    }
  }
}
