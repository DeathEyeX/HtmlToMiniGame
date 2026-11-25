import { Graphics, ImageSource, Rectangle, Sprite, Texture, type Container } from 'pixi.js';
import type { HudGesture } from '../../../../framework/platform/WechatPlatform';
import type { HudView } from '../../../../framework/ui/PixiHud';
import type { createScene, ViewPreset } from '../three/outpostScene';
import { labelFrames } from './labelFrames';

type Label = keyof typeof labelFrames;
type ButtonId = ViewPreset | 'spin' | 'wire' | 'zoomIn' | 'zoomOut';
type Point = Parameters<HudGesture['move']>[0];
type Outpost = ReturnType<typeof createScene>;

export function createOutpostHud(
  stage: Container, width: number, height: number, image: WechatMinigame.Image, outpost: Outpost
): HudView {
  // 主包图集让中文按钮在网页和微信使用相同的字形尺寸。
  const source = new ImageSource({ resource: image as unknown as HTMLImageElement, width: image.width, height: image.height });
  const textures = new Map<Label, Texture>();
  function texture(key: Label) {
    const cached = textures.get(key);
    if (cached) return cached;
    const [x, y, w, h] = labelFrames[key];
    const result = new Texture({ source, frame: new Rectangle(x, y, w, h) });
    textures.set(key, result);
    return result;
  }
  function label(key: Label) {
    const sprite = new Sprite(texture(key));
    sprite.scale.set(.5);
    return sprite;
  }
  const panel = new Graphics();
  const heading = new Graphics();
  const title = label('title');
  const hint = label('hint');
  title.tint = 0xedece5;
  hint.tint = 0xb5bcb4;
  stage.addChild(panel, heading, title, hint);

  const views: ViewPreset[] = ['iso', 'front', 'side', 'back', 'top'];
  const actions: [ButtonId, () => void][] = [
    ...views.map((view): [ViewPreset, () => void] => [view, () => outpost.selectView(view)]),
    ['spin', outpost.toggleSpin], ['wire', outpost.toggleWireframe],
    ['zoomIn', () => outpost.zoom(.84)], ['zoomOut', () => outpost.zoom(1 / .84)]
  ];
  const buttons = actions.map(([id, activate]) => {
    const sprite = label(id);
    sprite.anchor.set(.5);
    stage.addChild(sprite);
    return { id, activate, sprite, bounds: new Rectangle(), label: id as Label };
  });
  let pressed: ButtonId | undefined;
  let panelBounds = new Rectangle();

  function redraw() {
    const { preset, spinning, wireframe } = outpost.state();
    const { x, y, width: w, height: h } = panelBounds;
    panel.clear()
      .roundRect(x, y, w, h, 9)
      .fill({ color: 0x202626, alpha: .94 })
      .stroke({ color: 0x687169, width: 1 });
    for (const button of buttons) {
      const { id, bounds } = button;
      const active = id === preset || (id === 'spin' && spinning) || (id === 'wire' && wireframe);
      button.label = id === 'spin' && spinning ? 'stop' : id === 'wire' && wireframe ? 'solid' : id;
      button.sprite.texture = texture(button.label);
      button.sprite.scale.set(Math.min(.5, (bounds.width - 8) / button.sprite.texture.width));
      const fill = pressed === id ? 0x848f6d : active ? 0x515d41 : 0x353e3b;
      panel.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 5)
        .fill(fill)
        .stroke({ color: active || pressed === id ? 0xadb98d : 0x636e67, width: 1 });
    }
  }

  function resize(w: number, h: number) {
    const info = wx.getSystemInfoSync();
    const safe = info.safeArea;
    const left = Math.max(12, (safe?.left ?? 0) + 8);
    const right = w - Math.max(12, safe ? info.screenWidth - safe.right + 8 : 0);
    const top = Math.max(safe?.top ?? 0, wx.getMenuButtonBoundingClientRect?.()?.bottom ?? 0);
    const bottom = h - Math.max(14, safe ? info.screenHeight - safe.bottom + 8 : 0);
    const headingTop = top + 10;
    title.position.set(left + 12, headingTop + 8);
    hint.position.set(left + 12, headingTop + 36);
    heading.clear()
      .roundRect(left, headingTop, Math.max(title.width, hint.width) + 24, 57, 8)
      .fill({ color: 0x202626, alpha: .88 });

    const panelWidth = Math.min(680, right - left);
    const panelLeft = left + (right - left - panelWidth) / 2;
    const columns = panelWidth >= 650 ? buttons.length : 5;
    const gap = 5;
    const inset = 7;
    const buttonWidth = (panelWidth - inset * 2 - gap * (columns - 1)) / columns;
    const buttonHeight = 38;
    const rows = Math.ceil(buttons.length / columns);
    const panelHeight = rows * buttonHeight + (rows - 1) * gap + inset * 2;
    panelBounds = new Rectangle(panelLeft, bottom - panelHeight, panelWidth, panelHeight);
    for (const [index, button] of buttons.entries()) {
      const row = Math.floor(index / columns);
      const rowCount = Math.min(columns, buttons.length - row * columns);
      const rowWidth = rowCount * buttonWidth + (rowCount - 1) * gap;
      const x = panelLeft + (panelWidth - rowWidth) / 2 + (index % columns) * (buttonWidth + gap);
      const y = panelBounds.y + inset + row * (buttonHeight + gap);
      button.bounds = new Rectangle(x, y, buttonWidth, buttonHeight);
      button.sprite.position.set(x + buttonWidth / 2, y + buttonHeight / 2);
    }
    redraw();
  }

  resize(width, height);
  outpost.onControlsChanged(redraw);
  return {
    resize,
    beginGesture(point: Point) {
      const button = buttons.find(({ bounds }) => bounds.contains(point.x, point.y));
      if (!button) return;
      pressed = button.id;
      redraw();
      return {
        move(next) {
          const nextPressed = button.bounds.contains(next.x, next.y) ? button.id : undefined;
          if (nextPressed === pressed) return;
          pressed = nextPressed;
          redraw();
        },
        release(next) {
          pressed = undefined;
          if (button.bounds.contains(next.x, next.y)) button.activate();
          redraw();
        },
        cancel() {
          pressed = undefined;
          redraw();
        }
      };
    },
    inspectControls: () => buttons.map(({ id, label: key, bounds: { x, y, width: w, height: h } }) =>
      ({ id, label: labelFrames[key][4], x, y, width: w, height: h }))
  };
}
