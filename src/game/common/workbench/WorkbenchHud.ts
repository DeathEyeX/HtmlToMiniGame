import { Container, Graphics, Sprite } from 'pixi.js';
import type { HudGesture } from '../../../framework/platform/WechatPlatform';
import { loadPackagedUIAtlas } from '../ui/packagedUIAtlas';
import type { createWorkbenchScene } from './Workbench';
import { finishes } from './finishes';

type Point = Parameters<HudGesture['move']>[0];

export function createWorkbenchHud(
  stage: Container,
  width: number,
  height: number,
  workbench: ReturnType<typeof createWorkbenchScene>,
  back?: () => void
) {
  const step = 44;
  const padding = 8;
  const size = 40;
  const panelWidth = step * 5 + padding * 2;
  const panelHeight = size + padding * 2;
  const panel = new Container();
  const backdrop = new Graphics().roundRect(0, 0, panelWidth, panelHeight, 12).fill(0x102746);
  const buttons = new Graphics();
  const palette = new Container();
  panel.addChild(backdrop, buttons, palette);
  stage.addChild(panel);

  function draw() {
    const state = workbench.selection();
    buttons.clear();
    if (back) {
      buttons.roundRect(padding, padding, size, size, 8).fill(0x304764)
        .moveTo(20, 28).lineTo(36, 28).moveTo(26, 22).lineTo(20, 28).lineTo(26, 34)
        .stroke({ color: 0xffffff, width: 2 });
    }
    finishes.forEach((color, index) => {
      const x = padding + (index + 1) * step;
      if (state.selected === index) buttons.roundRect(x, padding, size, size, 8).fill(0xffffff);
      if (!palette.children.length) buttons.roundRect(x + 3, padding + 3, size - 6, size - 6, 6).fill(color);
    });
    const confirmX = padding + 4 * step;
    buttons.roundRect(confirmX, padding, size, size, 8).fill(state.confirmed ? 0x147b6e : 0x245cc7)
      .moveTo(confirmX + 11, 28).lineTo(confirmX + 17, 34).lineTo(confirmX + 29, 22)
      .stroke({ color: 0xffffff, width: 2 });
  }

  function resize(width: number, height: number) {
    const scale = Math.min(1, width / panelWidth, height / panelHeight);
    panel.scale.set(scale);
    panel.position.set((width - panelWidth * scale) / 2, Math.max(0, height - panelHeight * scale - 24));
  }

  function hit(point: Point) {
    if (panel.destroyed) return;
    const x = (point.x - panel.x) / panel.scale.x - padding;
    const y = (point.y - panel.y) / panel.scale.y - padding;
    const index = Math.floor(x / step);
    if (y < 0 || y >= size || index < 0 || index > 4 || x % step >= size) return;
    if (index !== 0 || back) return index;
  }

  resize(width, height);
  draw();
  void loadPackagedUIAtlas().then((atlas) => {
    if (panel.destroyed) return;
    const tiles = finishes.flatMap((color, index) => {
      const x = padding + (index + 1) * step;
      const swatch = new Sprite(atlas.swatch);
      swatch.position.set(x + 3, padding + 3);
      swatch.setSize(size - 6, size - 6);
      swatch.tint = color;
      const label = atlas.createNumber(String(index + 1).padStart(2, '0'), 14);
      label.position.set(x + 9, padding + 12);
      label.tint = 0x102746;
      return [swatch, label];
    });
    palette.addChild(...tiles);
    console.log('[App] Workbench palette ready');
    draw();
  }).catch((error: unknown) => console.warn('[App] Workbench uses Graphics swatches', error));

  return {
    resize,
    dispose() { panel.destroy({ children: true }); },
    beginGesture(point: Point): HudGesture | undefined {
      const pressed = hit(point);
      if (pressed === undefined) return;
      let valid = true;
      return {
        move(next) { valid &&= hit(next) === pressed; },
        release(next) {
          if (!valid || hit(next) !== pressed) return;
          if (pressed === 0) {
            back?.();
            return;
          }
          if (pressed === 4) workbench.confirm();
          else workbench.choose(pressed - 1);
          draw();
        },
        cancel() {}
      };
    }
  };
}
