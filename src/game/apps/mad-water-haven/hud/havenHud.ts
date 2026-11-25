import { Container, Graphics, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { HudGesture } from '../../../../framework/platform/WechatPlatform';
import { havenControls, havenTitle, zoneIds, zones, type ZoneId } from '../content';
import { cell, columns, glyphs } from './glyphs';

type Point = Parameters<HudGesture['move']>[0];
type Button = { x: number; y: number; w: number; h: number; run: () => void };
const ink = 0xfff7df, clearBlue = 0xc9ebe7, panel = 0x103c46, edge = 0x82c8c3;

export function createHavenHud(
  stage: Container, width: number, height: number, image: WechatMinigame.Image,
  view: (zone?: ZoneId) => void, zoom: (factor: number) => void
) {
  const art = new Graphics();
  const labels = new Container();
  stage.addChild(art, labels);
  const source = new ImageSource({ resource: image as unknown as HTMLImageElement, width: image.width, height: image.height });
  const textures = new Map(Array.from(glyphs, (char, i) => [char, new Texture({
    source, frame: new Rectangle(i % columns * cell, Math.floor(i / columns) * cell, cell, cell)
  })]));
  const [overview, hide, show, orbitHint] = havenControls;
  const buttons: Button[] = [];
  let selection: ZoneId | undefined;
  let clean = false;
  let restoreHint = false;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  function text(copy: string, x: number, y: number, size: number, tint: number, center = false) {
    const advances = Array.from(copy, char => /[ ·]/.test(char) ? .47 : 1.06);
    let cursor = center ? x - advances.reduce((a, b) => a + b, 0) * size / 2 : x;
    Array.from(copy).forEach((char, i) => {
      const texture = textures.get(char);
      const advance = advances[i] * size;
      if (texture) {
        const glyph = new Sprite(texture);
        glyph.tint = tint;
        glyph.anchor.set(.5);
        glyph.position.set(cursor + advance / 2, y);
        glyph.setSize(size * 1.4);
        labels.addChild(glyph);
      }
      cursor += advance;
    });
  }

  function drawButton(button: Button, label: string, active = false, tint = ink) {
    const { x, y, w, h } = button;
    art.roundRect(x, y, w, h, 9).fill({ color: active ? 0x386165 : panel, alpha: active ? .97 : .88 })
      .stroke({ color: active ? tint : edge, width: 1, alpha: active ? .92 : .55 });
    text(label, x + w / 2, y + h / 2, 12, tint, true);
    buttons.push(button);
  }

  function toggleHud() {
    clean = !clean;
    if (hintTimer !== undefined) clearTimeout(hintTimer);
    restoreHint = clean;
    if (clean) hintTimer = setTimeout(() => {
      restoreHint = false;
      hintTimer = undefined;
      draw();
    }, 1800);
    draw();
  }

  function draw() {
    art.clear();
    labels.removeChildren().forEach(glyph => glyph.destroy());
    buttons.length = 0;
    const compact = width < 660;
    const margin = compact ? 12 : 23;
    const { safeArea, screenHeight } = wx.getSystemInfoSync();
    const top = Math.max(safeArea?.top ?? 0, wx.getMenuButtonBoundingClientRect?.()?.bottom ?? 0) + margin;
    const bottom = height - (safeArea ? Math.max(0, screenHeight - safeArea.bottom) : 0) - margin;
    const toggle = { x: width - margin - 58, y: top, w: 58, h: 34, run: toggleHud };
    if (clean) {
      // 提示消失后保留同一点击范围，取景画面可以直接截图。
      if (restoreHint) drawButton(toggle, show);
      else buttons.push(toggle);
      return;
    }
    drawButton(toggle, hide);

    art.roundRect(margin, top, compact ? 178 : 232, compact ? 47 : 58, 11)
      .fill({ color: panel, alpha: .86 }).stroke({ color: edge, width: 1, alpha: .55 });
    const iconX = margin + 24, iconY = top + (compact ? 24 : 29);
    // 图标是一段甲板加波浪，比通用圆形按钮更贴合场景。
    art.poly([iconX - 11, iconY + 3, iconX + 11, iconY + 3, iconX + 8, iconY + 8, iconX - 8, iconY + 8])
      .fill(0xf1bf7b).poly([iconX - 7, iconY + 1, iconX - 7, iconY - 6, iconX, iconY - 11, iconX + 7, iconY - 6, iconX + 7, iconY + 1]).fill(ink);
    art.moveTo(iconX - 10, iconY + 12).lineTo(iconX + 10, iconY + 12).stroke({ color: edge, width: 1.2 });
    text(havenTitle, margin + 46, iconY, compact ? 18 : 23, ink);

    const ids = [undefined, ...zoneIds];
    // 竖屏/小屏用五列两行，比三列三行少占一行高度，基地不会被按钮盖住太多。
    const cols = compact ? 5 : ids.length;
    const bar = Math.min(width - margin * 2, compact ? 430 : 730);
    const gap = 6, w = (bar - gap * (cols - 1)) / cols, h = compact ? 30 : 38;
    const rows = Math.ceil(ids.length / cols);
    const first = bottom - rows * (h + gap) + gap;
    for (const [i, id] of ids.entries()) {
      drawButton({
        x: (width - bar) / 2 + i % cols * (w + gap), y: first + Math.floor(i / cols) * (h + gap), w, h,
        run: () => { selection = id; view(id); draw(); }
      }, id ? zones[id].title : overview, id === selection, id ? zones[id].color : clearBlue);
    }
    if (!compact) text(orbitHint, width / 2, first - 13, 10, clearBlue, true);

    for (let i = 0; i < 2; i++) {
      const x = width - margin - 38, y = (compact ? first - 5 : bottom - 48) - (2 - i) * 41;
      art.roundRect(x, y, 38, 36, 9).fill({ color: panel, alpha: .86 }).stroke({ color: edge, width: 1, alpha: .55 });
      art.moveTo(x + 12, y + 18).lineTo(x + 26, y + 18);
      if (i === 0) art.moveTo(x + 19, y + 11).lineTo(x + 19, y + 25);
      art.stroke({ color: ink, width: 1.7, cap: 'round' });
      buttons.push({ x, y, w: 38, h: 36, run: () => zoom(i === 0 ? .81 : 1.24) });
    }
  }

  const inside = ({ x, y, w, h }: Button, p: Point) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
  draw();
  return {
    resize(w: number, h: number) { width = w; height = h; draw(); },
    beginGesture(point: Point): HudGesture | undefined {
      const button = buttons.find(candidate => inside(candidate, point));
      if (!button) return;
      let cancelled = false;
      return {
        move(next) { if (!inside(button, next)) cancelled = true; },
        release(next) { if (!cancelled && inside(button, next)) button.run(); },
        cancel() { cancelled = true; }
      };
    }
  };
}
