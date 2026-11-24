import { Container, Graphics, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { HudGesture } from '../../../../framework/platform/WechatPlatform';
import { stopIds, stops, viewIds, views, type Stop, type View } from '../content';
import { glyphs, cell, columns } from './glyphs';

const ink = 0xf1f5e6;
const faded = 0xa9d1cc;
const gold = 0xffd392;
const deep = 0x0e323c;
const edge = 0x4a7b80;

interface Area { x: number; y: number; width: number; height: number }
type Point = Parameters<HudGesture['move']>[0];
type Button = { id: string; area: Area; run: () => void };

function createLabels(page: WechatMinigame.Image) {
  const source = new ImageSource({ resource: page as unknown as HTMLImageElement, width: page.width, height: page.height });
  const textures = new Map(Array.from(glyphs, (glyph, index) => [glyph, new Texture({
    source,
    frame: new Rectangle(index % columns * cell, Math.floor(index / columns) * cell, cell, cell)
  })]));

  return (value: string, size: number, color: number, center: boolean) => {
    const label = new Container();
    let offset = 0;
    for (const char of value) {
      const step = size * (char === ' ' ? .35 : char.charCodeAt(0) < 128 ? .61 : 1.02);
      const texture = textures.get(char);
      if (texture) {
        const image = new Sprite(texture);
        image.tint = color;
        image.anchor.set(.5);
        image.position.set(offset + step / 2, 0);
        image.setSize(size * 1.42);
        label.addChild(image);
      }
      offset += step;
    }
    if (center) label.pivot.x = offset / 2;
    return label;
  };
}

export function createHarborHud(
  stage: Container, width: number, height: number, page: WechatMinigame.Image,
  selectView: (view: View) => void, selectStop: (stop: Stop) => void
) {
  const art = new Graphics();
  const captions = new Container();
  const labels = createLabels(page);
  const buttons: Button[] = [];
  stage.addChild(art, captions);
  let view: View = 'harbor';
  let activeStop: Stop | undefined;
  let pressed: string | undefined;

  function text(copy: string, x: number, y: number, size: number, color = ink, center = false) {
    const label = labels(copy, size, color, center);
    label.position.set(x, y);
    captions.addChild(label);
  }

  function panel({ x, y, width: w, height: h }: Area, fill = deep, outline = edge, opacity = .92) {
    art.roundRect(x, y, w, h, 10).fill({ color: fill, alpha: opacity }).stroke({ width: 1, color: outline, alpha: .86 });
  }

  function button(id: string, area: Area, value: string, run: () => void, active = false, tint = gold, size = 13) {
    const hot = active || pressed === id;
    panel(area, hot ? 0x335959 : 0x1b4148, hot ? tint : edge, hot ? 1 : .86);
    text(value, area.x + area.width / 2, area.y + area.height / 2, size, hot ? tint : ink, true);
    buttons.push({ id, area, run });
  }

  function draw() {
    art.clear();
    for (const child of captions.removeChildren()) child.destroy({ children: true });
    buttons.length = 0;
    const current = views[view];
    const compact = width < 540;
    const margin = compact ? 12 : 22;
    const info = wx.getSystemInfoSync();
    const top = Math.max(info.safeArea?.top ?? 0, wx.getMenuButtonBoundingClientRect?.()?.bottom ?? 0) + margin;
    const safeBottom = info.safeArea ? Math.max(0, info.screenHeight - info.safeArea.bottom) : 0;
    const introWidth = Math.min(width - margin * 2 - 66, compact ? 254 : 305);
    const introTop = top;
    panel({ x: margin, y: introTop, width: introWidth, height: compact ? 61 : 75 });
    const scale = compact ? 16 : 20;
    art.roundRect(margin + 11, introTop + 12, compact ? 33 : 42, compact ? 34 : 42, 6).fill(0x285761).stroke({ width: 1, color: 0x679f9a });
    const iconX = margin + (compact ? 27.5 : 32);
    const iconY = introTop + (compact ? 29 : 33);
    if (view === 'depths') {
      art.moveTo(iconX - 9, iconY).lineTo(iconX - 3, iconY - 5).lineTo(iconX + 5, iconY - 5).lineTo(iconX + 10, iconY).lineTo(iconX + 4, iconY + 5)
        .lineTo(iconX - 3, iconY + 5).lineTo(iconX - 9, iconY).fill(0x87d1bc);
      art.rect(iconX + 4, iconY - 2, 2, 2).fill(deep);
    } else {
      art.rect(iconX - 10, iconY + 4, 20, 4).rect(iconX - 7, iconY - 1, 14, 5).rect(iconX - 3, iconY - 7, 6, 6).fill(gold);
      art.rect(iconX - 9, iconY + 10, 18, 2).fill(0x87d1bc);
    }
    const labelX = margin + (compact ? 54 : 62);
    text(current.title, labelX, introTop + (compact ? 21 : 26), scale);
    text(current.status, labelX, introTop + (compact ? 42 : 51), compact ? 10.5 : 12, faded);
    button('reset', { x: width - margin - 59, y: introTop, width: 59, height: 38 }, '复位', () => {
      activeStop = undefined;
      selectView(view);
    });

    const w = Math.min(width - margin * 2, 542);
    const x = (width - w) / 2;
    const panelHeight = 136;
    const bottom = height - safeBottom - margin - panelHeight;
    panel({ x, y: bottom, width: w, height: panelHeight });
    const tabWidth = (w - 38) / 3;
    viewIds.forEach((id, i) => {
      button(id, { x: x + 11 + i * (tabWidth + 8), y: bottom + 11, width: tabWidth, height: 37 }, views[id].tab, () => {
        view = id;
        activeStop = undefined;
        selectView(view);
      }, view === id);
    });

    if (view === 'harbor') {
      const cell = (w - 38 - 5) / 4;
      stopIds.forEach((stop, i) => {
        const stopInfo = stops[stop];
        const sx = x + 11 + i * (cell + 7);
        button(stop, { x: sx, y: bottom + 59, width: cell, height: 40 }, stopInfo.label, () => {
          activeStop = stop;
          selectStop(stop);
        }, activeStop === stop, stopInfo.color, compact ? 10.5 : 12);
        art.rect(sx + 7, bottom + 92, cell - 14, 1).fill({ color: stopInfo.color, alpha: .58 });
      });
    } else {
      text(current.detail, x + w / 2, bottom + 78, compact ? 11 : 12.5, ink, true);
    }
    text(activeStop ? `${stops[activeStop].level} · ${stops[activeStop].label}　单指旋转 · 双指缩放` : '单指旋转 · 双指缩放', x + w / 2, bottom + 119, 10.5, faded, true);
  }

  function hit(point: Point) {
    return buttons.find(({ area }) => point.x >= area.x && point.x < area.x + area.width
      && point.y >= area.y && point.y < area.y + area.height);
  }

  function cancel() {
    pressed = undefined;
    draw();
  }

  draw();
  return {
    resize(nextWidth: number, nextHeight: number) {
      width = nextWidth;
      height = nextHeight;
      draw();
    },
    beginGesture(point: Point): HudGesture | undefined {
      const control = hit(point);
      if (!control) return;
      pressed = control.id;
      draw();
      return {
        move(next) { if (pressed && hit(next)?.id !== pressed) cancel(); },
        release(next) {
          if (pressed === control.id && hit(next)?.id === control.id) control.run();
          cancel();
        },
        cancel
      };
    }
  };
}
