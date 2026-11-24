import { Container, Graphics } from 'pixi.js';
import type { HudGesture } from '../../../framework/platform/WechatPlatform';
import { crewOnWatch, roomSpecs } from './content';
import { oceanHudCopy as copy } from './hudCopy';
import type { createOceanHudArt } from './OceanHudArt';
import type { createOceanShelterScene } from './OceanShelter';

type Point = Parameters<HudGesture['move']>[0];
type Art = ReturnType<typeof createOceanHudArt>;
type Scene = ReturnType<typeof createOceanShelterScene>;
type Person = ReturnType<typeof crewOnWatch>[number];
type IconName = Parameters<Art['icon']>[0];
type Manifest = 'rooms' | 'crew';

interface HitArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action?: () => void;
}

const hudWidth = 360;
const dockHeight = 59;
const ink = 0xf4e3c5, gold = 0xd6bc91, rule = 0x88745b;
const stores = [{ icon: 'wood', count: '1280' }, { icon: 'steel', count: '860' }, { icon: 'food', count: '452' }] as const;
const dock = ['rooms', 'crew', 'roof', 'motion', 'overview'] as const;

export function createOceanShelterHud(
  stage: Container, width: number, height: number, scene: Scene, art: Art
) {
  const root = new Container();
  stage.addChild(root);
  const people = crewOnWatch(0);
  let areas: HitArea[] = [];
  let manifest: Manifest | undefined;
  let person: Person | undefined;
  let top = 0, bottom = 0, localHeight = 0;

  function label(x: number, y: number, text: string, size: number, tint = ink) {
    const sprite = art.text(text, size, tint);
    sprite.position.set(x, y);
    root.addChild(sprite);
  }

  function centerLabel(x: number, y: number, width: number, text: string, size: number, tint = ink) {
    label(x + (width - art.measure(text, size)) / 2, y, text, size, tint);
  }

  function icon(name: IconName, x: number, y: number, width: number, height: number, alpha = 1) {
    const sprite = art.icon(name);
    sprite.position.set(x, y);
    sprite.setSize(width, height);
    sprite.alpha = alpha;
    root.addChild(sprite);
  }

  function box(x: number, y: number, width: number, height: number, radius: number, fill: number, alpha = 1, border = rule) {
    root.addChild(new Graphics().roundRect(x, y, width, height, radius)
      .fill({ color: fill, alpha }).stroke({ color: border, alpha: .75, width: 1 }));
  }

  function panel(id: string, x: number, y: number, width: number, height: number) {
    box(x, y, width, height, 7, 0x202728, .96);
    icon('panel', x + 5, y + 5, width - 10, height - 10, .22);
    areas.push({ id, x, y, width, height });
  }

  function selectRoom(roomId: string) {
    person = undefined;
    scene.setView({ kind: 'room', roomId });
  }

  function drawManifest(y: number, selectedRoom?: string) {
    const showCrew = manifest === 'crew';
    const entries = showCrew ? people : roomSpecs;
    const rows = Math.ceil(entries.length / 2);
    const height = 44 + rows * 36;
    const x = 8;
    y -= height + 10;
    panel('manifest', x, y, hudWidth - 16, height);
    label(x + 12, y + 12, showCrew ? copy.onWatch : copy.ship, 17);
    const closeX = hudWidth - 41;
    centerLabel(closeX, y + 9, 28, '×', 21, gold);
    areas.push({ id: 'dismiss', x: closeX, y: y + 4, width: 28, height: 34, action() {
      manifest = undefined;
      draw();
    } });
    entries.forEach((entry, index) => {
      const left = x + 10 + index % 2 * 164;
      const row = y + 37 + Math.floor(index / 2) * 36;
      const cabin = 'id' in entry ? entry : undefined;
      const crew = 'job' in entry ? entry : undefined;
      const id = cabin?.id ?? crew?.room ?? copy.deck;
      box(left, row, 159, 32, 3, cabin?.id === selectedRoom && cabin ? 0x4e483d : 0x202829);
      const badge = art.measure(id, 11);
      label(left + 7, row + 10, id, 11, gold);
      if (cabin) root.addChild(new Graphics().circle(left + 13 + badge, row + 16, 2).fill(cabin.color));
      label(left + 20 + badge, row + 8, entry.name, 14);
      areas.push({ id: 'entry-' + index, x: left, y: row, width: 159, height: 32, action() {
        if (cabin) selectRoom(cabin.id);
        if (crew) {
          scene.setView(crew.room ? { kind: 'room', roomId: crew.room } : { kind: 'roof' });
          person = crew;
          draw();
        }
      } });
    });
  }

  function drawDetail(y: number) {
    const view = scene.view();
    const room = roomSpecs.find(room => 'roomId' in view && room.id === view.roomId);
    if (!room && view.kind !== 'roof') return;
    const canVisitWorkbench = room?.id === '04A' && !person;
    const height = canVisitWorkbench ? 97 : 61;
    y -= height + 10;
    panel('detail', 8, y, hudWidth - 16, height);
    label(20, y + 9, person?.name ?? (room ? room.id + ' · ' + room.name : copy.roofTitle), 16);
    label(20, y + 32, person?.job ?? room?.note ?? copy.roofNote, 13, gold);
    if (canVisitWorkbench) {
      box(19, y + 55, hudWidth - 38, 32, 4, 0x322e29);
      centerLabel(19, y + 64, hudWidth - 38, view.kind === 'workbench' ? copy.greenhouse : copy.workbench, 14);
      areas.push({ id: 'workbench', x: 19, y: y + 55, width: hudWidth - 38, height: 32, action() {
        scene.setView({ kind: view.kind === 'workbench' ? 'room' : 'workbench', roomId: room.id });
      } });
    }
  }

  function draw() {
    for (const child of root.removeChildren()) child.destroy({ children: true });
    areas = [];
    const view = scene.view();
    panel('title', 0, top, 132, 34);
    icon('title', 5, top + 4, 29, 26);
    label(35, top + 8, copy.title, 18);
    for (const [index, { icon: name, count }] of stores.entries()) {
      const x = hudWidth - (stores.length - index) * 58 + 3;
      box(x, top + 4, 55, 26, 10, 0x171d1d, .94);
      icon(name, x + 3, top + 10, 17, 14);
      label(x + 22, top + 10, count, 14);
    }
    const y = bottom - dockHeight;
    panel('dock', 0, y, hudWidth, dockHeight);
    const step = hudWidth / dock.length;
    const active = (key: typeof dock[number]) => key === manifest || (key === 'roof' && view.kind === 'roof');
    for (const [index, key] of dock.entries()) {
      const x = index * step;
      if (active(key)) box(x + 3, y + 4, step - 6, dockHeight - 8, 5, 0x5e503a, .8, gold);
      else if (index) root.addChild(new Graphics().rect(x, y + 8, 1, dockHeight - 16).fill({ color: rule, alpha: .5 }));
      const alpha = key === 'motion' && !scene.moving() ? .45 : 1;
      icon(key, x + (step - 37) / 2, y + 4, 37, 31, alpha);
      centerLabel(x, y + 37, step, copy[key], 15, alpha === 1 ? ink : rule);
      areas.push({ id: key, x, y, width: step, height: dockHeight, action() {
        if (key === 'rooms' || key === 'crew') {
          manifest = manifest === key ? undefined : key;
          draw();
        } else if (key === 'motion') {
          scene.toggleMotion();
        } else {
          person = undefined;
          scene.setView({ kind: key === 'roof' && view.kind !== 'roof' ? 'roof' : 'overview' });
        }
      } });
    }
    if (manifest) drawManifest(y, 'roomId' in view ? view.roomId : undefined);
    else drawDetail(y);

    const state = scene.assetState();
    if (state !== 'ready') {
      const text = state === 'loading' ? copy.loading : copy.partial;
      const y = state === 'loading' ? localHeight * .46 : top + 42;
      const width = art.measure(text, 13) + 24;
      box((hudWidth - width) / 2, y, width, 28, 4, 0x182224);
      centerLabel(0, y + 7, hudWidth, text, 13, gold);
    }
  }

  function resize(width: number, height: number) {
    const scale = Math.min(1.35, Math.max(1, width - 12) / hudWidth, Math.max(1, height) / 400);
    const { safeArea, screenHeight } = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const topInset = Math.max(safeArea?.top ?? 0, menu?.height ? menu.bottom + 6 : 0);
    const bottomInset = safeArea ? Math.max(0, screenHeight - safeArea.bottom) : 0;
    localHeight = height / scale;
    top = Math.max(8, topInset / scale);
    bottom = localHeight - Math.max(8, bottomInset / scale);
    root.scale.set(scale);
    root.x = (width - hudWidth * scale) / 2;
    draw();
  }

  function hit(point: Point) {
    const x = (point.x - root.x) / root.scale.x;
    const y = point.y / root.scale.y;
    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i];
      if (x >= area.x && y >= area.y && x < area.x + area.width && y < area.y + area.height) return area;
    }
  }

  let priorView = scene.view();
  resize(width, height);
  return {
    resize,
    refresh() {
      const view = scene.view();
      if (view !== priorView) {
        priorView = view;
        person = undefined;
        manifest = undefined;
      }
      draw();
    },
    beginGesture(point: Point): HudGesture | undefined {
      const pressed = hit(point);
      if (!pressed) return;
      let valid = true;
      return {
        move(next) { valid &&= hit(next)?.id === pressed.id; },
        release(next) { if (valid && hit(next)?.id === pressed.id) pressed.action?.(); },
        cancel() {}
      };
    },
    dispose() {
      root.destroy({ children: true });
      art.dispose();
    }
  };
}
