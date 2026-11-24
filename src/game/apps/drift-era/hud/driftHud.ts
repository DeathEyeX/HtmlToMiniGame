import { Container, Graphics } from 'pixi.js';
import type { HudGesture } from '../../../../framework/platform/WechatPlatform';
import { taskSteps, type DriftGame } from '../game';
import type { DriftLayout, Rect } from '../layout';
import { zoneIds, zones, type ZoneId } from '../routes';
import { createLabels } from './labels';

type Point = Parameters<HudGesture['move']>[0];
type Dialog = 'map' | 'log';
type Control = { id: string; bounds: Rect; run: () => void; enabled: boolean };

interface HudOptions {
  layout(): DriftLayout;
  project(id: ZoneId): Point;
  toggleView(): void;
  toggleSound?: () => boolean;
}

const palette = {
  ink: 0xebebe0, muted: 0x9aafac, accent: 0xefbb72, mint: 0x83c3ad,
  frame: 0x315057, line: 0x294248, panel: 0x102126, deep: 0x0b191e
};

export function createDriftHud(stage: Container, page: WechatMinigame.Image, game: DriftGame, options: HudOptions) {
  const root = new Container();
  const art = new Graphics();
  const letters = new Container();
  const overlayArt = new Graphics();
  const overlayLetters = new Container();
  const label = createLabels(page);
  const controls: Control[] = [];
  root.addChild(art, letters, overlayArt, overlayLetters);
  stage.addChild(root);

  let dialog: Dialog | undefined;
  let pressed: string | undefined;
  let sound = false;
  let graphics = art;
  let textLayer = letters;
  const { ink, muted, accent, mint, frame, line, panel, deep } = palette;
  const bounds = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

  function text(copy: string, x: number, y: number, size: number, color = ink, align: 'left' | 'center' | 'right' = 'left') {
    const row = label(copy, size, color, align);
    row.position.set(x, y);
    textLayer.addChild(row);
  }

  function surface(area: Rect, fill = panel, border = frame) {
    graphics.rect(area.x, area.y, area.width, area.height).fill(fill).stroke({ color: border, width: 1 });
  }

  function rule(x: number, y: number, width: number) {
    graphics.rect(x, y, width, 1).fill(line);
  }

  function button(id: string, area: Rect, copy: string, run: () => void, settings: { active?: boolean; enabled?: boolean; primary?: boolean; size?: number } = {}) {
    const { active, enabled = true, primary, size = 12 } = settings;
    const hot = enabled && (pressed === id || active);
    surface(area, primary && enabled ? (hot ? 0xf3c582 : 0xd9a969) : hot ? 0x392e22 : 0x152a30, hot ? accent : frame);
    text(copy, area.x + area.width / 2, area.y + area.height / 2, size, primary && enabled ? 0x282017 : hot ? accent : enabled ? ink : muted, 'center');
    controls.push({ id, bounds: area, run, enabled });
  }

  function go(id: ZoneId) {
    dialog = undefined;
    game.travelTo(id);
  }

  function resources(area: Rect) {
    surface(area);
    text('资源储备', area.x + 11, area.y + 15, 12, mint);
    rule(area.x, area.y + 29, area.width);
    const { water, food, scrap, power } = game.resources;
    const entries = [
      ['淡水', `${water} L`, 0x74aec9], ['食物', `${food} 份`, 0xa7b981],
      ['废料', `${scrap} 件`, 0xc28a68], ['电力', `${power}%`, 0xe5b772]
    ] as const;
    const row = (area.height - 30) / 2;
    rule(area.x, area.y + 29 + row, area.width);
    graphics.rect(area.x + area.width / 2, area.y + 30, 1, area.height - 30).fill(line);
    entries.forEach(([name, value, tint], i) => {
      const x = area.x + (i % 2) * area.width / 2 + 9;
      const y = area.y + 30 + Math.floor(i / 2) * row;
      graphics.rect(x, y + 10, 5, 5).fill(tint);
      text(name, x + 10, y + 13, 10, muted);
      text(value, x + 10, y + 30, 16);
    });
  }

  function objectives(area: Rect, compact: boolean) {
    surface(area);
    text('当前任务', area.x + 11, area.y + 15, 12, mint);
    text(`${game.completed.size} / 3`, area.x + area.width - 10, area.y + 15, 11, accent, 'right');
    rule(area.x, area.y + 29, area.width);
    text('恢复海上联络', area.x + 11, area.y + 46, 13);
    if (!compact) text('补给庇护所，修好电台。', area.x + 11, area.y + 69, 11, muted);
    taskSteps.forEach(({ id, text: copy }, i) => {
      const checked = game.completed.has(id);
      const y = area.y + (compact ? 69 : 96) + i * (compact ? 19 : 21);
      graphics.rect(area.x + 11, y - 4, 8, 8).stroke({ width: 1, color: checked ? mint : muted });
      if (checked) graphics.rect(area.x + 13, y - 2, 4, 4).fill(mint);
      text(copy, area.x + 24, y, compact ? 10.4 : 11, checked ? mint : muted);
    });
  }

  function interaction(area: Rect) {
    surface(area);
    text(game.location, area.x + 11, area.y + 13, 11, accent);
    const zone = zones[game.at as ZoneId];
    if (!game.moving && zone) text(zone.level, area.x + area.width - 10, area.y + 13, 10, muted, 'right');
    button('interact', bounds(area.x + 9, area.y + 26, area.width - 18, 32), game.action, () => {
      if (game.interact() === 'log') dialog = 'log';
    }, { primary: true, enabled: game.canInteract });
    if (game.feedback) text(game.feedback, area.x + 11, area.y + 70, 10.5, mint);
  }

  function drawDialog(layout: DriftLayout, kind: Dialog) {
    controls.length = 0;
    const w = Math.min(layout.designWidth - 34, 460);
    const h = kind === 'map' ? 270 : 105 + game.log.length * 47;
    const x = (layout.designWidth - w) / 2;
    const y = (layout.designHeight - h) / 2;
    const close = () => { dialog = undefined; };
    graphics = overlayArt;
    textLayer = overlayLetters;
    // 遮罩需要覆盖安全区外的留白，触摸时只有弹层和关闭动作可命中。
    graphics.rect(-layout.left / layout.scale, -layout.top / layout.scale, layout.width / layout.scale, layout.height / layout.scale)
      .fill({ color: 0x061014, alpha: .82 });
    controls.push({ id: 'backdrop', bounds: bounds(0, 0, layout.designWidth, layout.designHeight), run: close, enabled: true });
    controls.push({ id: 'dialog', bounds: bounds(x, y, w, h), run: () => {}, enabled: false });
    surface(bounds(x, y, w, h), 0x14292e, 0x5b7d77);
    text(kind === 'map' ? '区域地图' : '航行日志', x + 15, y + 23, 15, accent);
    button('close', bounds(x + w - 57, y + 8, 47, 29), '关闭', close);
    rule(x, y + 44, w);

    if (kind === 'map') {
      text('点选区域，沿楼梯和栈桥前往。', x + 15, y + 66, 12, muted);
      const cardWidth = (w - 55) / 2;
      const left = x + 15;
      const right = left + cardWidth + 25;
      const rowY = y + 83;
      graphics.rect(left + cardWidth / 2, rowY + 37, 1, 29).fill(mint);
      graphics.rect(left + cardWidth, rowY + 77, 25, 1).fill(mint);
      graphics.rect(right + cardWidth / 2, rowY + 93, 1, 29).fill(mint);
      const areas = { lookout: [left, rowY], command: [left, rowY + 55], greenhouse: [right, rowY + 55], dock: [right, rowY + 110] };
      for (const id of zoneIds) {
        const [cx, cy] = areas[id];
        button(`map-${id}`, bounds(cx, cy, cardWidth, 43), `${zones[id].floor} · ${zones[id].name}`, () => go(id), { active: game.at === id });
      }
    } else {
      game.log.forEach((entry, i) => {
        const ey = y + 57 + i * 47;
        graphics.rect(x + 15, ey, w - 30, 41).fill(0x1a3338);
        text(`第 17 天 · ${entry.area}`, x + 23, ey + 11, 10.5, mint);
        text(entry.message, x + 23, ey + 28, 11, ink);
      });
    }
  }

  function refresh() {
    const layout = options.layout();
    const { compact, designWidth, world, immersive } = layout;
    root.position.set(layout.left, layout.top);
    root.scale.set(layout.scale);
    art.clear();
    overlayArt.clear();
    for (const layer of [letters, overlayLetters]) {
      for (const child of layer.removeChildren()) child.destroy({ children: true });
    }
    controls.length = 0;
    graphics = art;
    textLayer = letters;

    if (immersive) {
      text('潮汐庇护所', 14, 27, 20);
      button('immersive', bounds(designWidth - 101, 11, 89, 33), '退出全景', options.toggleView);
      text(game.location, 14, world.y + world.height + 20, 12, accent);
    } else {
      surface(bounds(0, 0, designWidth, 46), 0x0e1d22, line);
      surface(bounds(13, 9, 27, 27), 0x2c2920, 0x826541);
      graphics.rect(19, 24, 15, 2).rect(21, 20, 11, 4).rect(24, 16, 5, 4).fill(accent);
      text('漂流纪元', 47, 18, 15);
      text('DRIFT ERA', 48, 34, 8, accent);
      text('第 17 天  ·  08:42', designWidth - 14, 23, 11, muted, 'right');

      const navX = compact ? 12 : (designWidth - 260) / 2;
      const navY = compact ? 52 : 8;
      button('home', bounds(navX, navY, 79, 30), '庇护所', () => { dialog = undefined; }, { active: true });
      button('map', bounds(navX + 86, navY, 79, 30), '区域地图', () => { dialog = 'map'; });
      button('log', bounds(navX + 172, navY, 79, 30), '航行日志', () => { dialog = 'log'; });

      text('北洋海域  ·  SECTOR 07', 14, compact ? 97 : 67, 10.5, mint);
      text('潮汐庇护所', 13, compact ? 119 : 98, compact ? 25 : 33);
      text('旧世界沉入海底，我们在漂浮的残骸上安了家。', 14, compact ? 141 : 127, compact ? 10.8 : 13, muted);
      if (!compact) {
        surface(bounds(designWidth - 135, 83, 120, 45));
        text('多云  18°', designWidth - 75, 96, 13, ink, 'center');
        text('海况平稳', designWidth - 75, 115, 10, muted, 'center');
      }

      surface(bounds(world.x - 1, world.y - 27, world.width + 2, 27));
      text('庇护所全景', world.x + 9, world.y - 13, 11.5, mint);
      button('immersive', bounds(world.x + world.width - 58, world.y - 24, 55, 21), '全景', options.toggleView, { size: 10 });
      if (options.toggleSound) {
        button('audio', bounds(world.x + world.width - 117, world.y - 24, 55, 21), sound ? '音效开' : '音效关', () => { sound = options.toggleSound!(); }, { active: sound, size: 10 });
      }
      surface(bounds(world.x - 1, world.y + world.height, world.width + 2, 26));
      text('点按区域标记移动', world.x + 9, world.y + world.height + 13, 10.5, muted);
      text(game.location, world.x + world.width - 9, world.y + world.height + 13, 11, accent, 'right');

      const stats = compact ? bounds(12, 410, 177, 128) : bounds(899, 146, 266, 133);
      const tasks = compact ? bounds(198, 410, 180, 128) : bounds(899, 291, 266, 170);
      const action = compact ? bounds(12, 546, 366, 81) : bounds(899, 473, 266, 99);
      resources(stats);
      objectives(tasks, compact);
      interaction(action);

      const zoneY = compact ? 642 : 597;
      text('庇护所区域', 13, zoneY, 13);
      button('region-map', bounds(designWidth - 100, zoneY - 11, 87, 23), '查看地图', () => { dialog = 'map'; }, { size: 10.5 });
      const cardWidth = compact ? 178 : 281;
      const columns = compact ? 2 : 4;
      zoneIds.forEach((id, i) => {
        const x = 12 + i % columns * (cardWidth + 10);
        const y = zoneY + 17 + Math.floor(i / columns) * 33;
        button(`zone-${id}`, bounds(x, y, cardWidth, compact ? 29 : 52), `${zones[id].floor}  ${zones[id].name}`, () => go(id),
          { active: game.moving ? game.destination === id : game.at === id, size: compact ? 12 : 15 });
      });
    }

    text('24° 18′ N  ·  130° 42′ E', world.x + 9, world.y + 14, 9.5, 0xc4dbd1);
    for (const id of zoneIds) {
      const { x, y } = options.project(id);
      const w = zones[id].name.length * 11 + 25;
      const active = game.moving ? game.destination === id : game.at === id;
      const a = bounds(x - w / 2, y - 25, w, 23);
      button(`marker-${id}`, a, zones[id].name, () => go(id), { active, size: 11.5 });
      graphics.poly([x - 3, y - 2, x + 3, y - 2, x, y + 2]).fill(active ? accent : zones[id].color);
    }
    if (dialog) drawDialog(layout, dialog);
  }

  function hit(point: Point) {
    const x = (point.x - root.x) / root.scale.x;
    const y = (point.y - root.y) / root.scale.y;
    for (let i = controls.length - 1; i >= 0; i--) {
      const control = controls[i];
      const a = control.bounds;
      if (x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height) return control;
    }
  }

  function cancel() {
    pressed = undefined;
    refresh();
  }

  refresh();
  return {
    refresh,
    resize: refresh,
    openLog() { dialog = 'log'; refresh(); },
    get hasDialog() { return dialog !== undefined; },
    closeDialog() { dialog = undefined; refresh(); },
    beginGesture(point: Point): HudGesture | undefined {
      const control = hit(point);
      if (!control?.enabled) return;
      pressed = control.id;
      refresh();
      return {
        move(next) { if (pressed && hit(next)?.id !== control.id) cancel(); },
        release(next) {
          if (pressed === control.id && hit(next)?.id === control.id) control.run();
          cancel();
        },
        cancel
      };
    }
  };
}
