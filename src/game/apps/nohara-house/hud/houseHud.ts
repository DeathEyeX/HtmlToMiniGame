import { Container, Graphics, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { HudGesture } from '../../../../framework/platform/WechatPlatform';
import { labelCell, labelColumns, labelGlyphs } from './labelGlyphs';
import { houseLocation, houseOrbitHint, houseTitle, rooms, type RoomId } from '../rooms';

type Point = Parameters<HudGesture['move']>[0];

const ink = 0x382e28;
const muted = 0x765f4d;
const paper = 0xfff9e9;
const brick = 0xb85541;
const panelWidth = 360;
const panelHeight = 164;
declare const GAME_BROWSER_CHECK: boolean;

const buttonWidth = 106;
const buttonHeight = 46;
const buttons = rooms.map((room, index) => ({
  room,
  x: 14 + index % 3 * (buttonWidth + 7),
  y: 54 + Math.floor(index / 3) * (buttonHeight + 7)
}));

function drawIcon(graphics: Graphics, room: RoomId, color: number) {
  graphics.clear();
  switch (room) {
    case 'exterior':
      graphics.moveTo(1, 10).lineTo(11, 2).lineTo(21, 10)
        .moveTo(4, 8).lineTo(4, 20).lineTo(18, 20).lineTo(18, 8)
        .moveTo(9, 20).lineTo(9, 13).lineTo(13, 13).lineTo(13, 20);
      break;
    case 'living':
      graphics.roundRect(2, 6, 18, 12, 2).roundRect(5, 9, 8, 6, 1)
        .moveTo(8, 6).lineTo(5, 2).moveTo(11, 6).lineTo(14, 2)
        .moveTo(16.5, 10).lineTo(17, 10).moveTo(16.5, 14).lineTo(17, 14);
      break;
    case 'kitchen':
      graphics.moveTo(2, 10).lineTo(20, 10).lineTo(18, 17).lineTo(16, 19).lineTo(6, 19).lineTo(4, 17).closePath()
        .moveTo(1, 8).lineTo(21, 8).moveTo(8, 7).lineTo(8, 4).lineTo(14, 4).lineTo(14, 7);
      break;
    case 'tatami':
      graphics.roundRect(2, 3, 18, 17, 1).moveTo(11, 3).lineTo(11, 20)
        .moveTo(2, 11).lineTo(11, 11).moveTo(15, 7).lineTo(15, 16);
      break;
    case 'kids':
      graphics.poly([11, 2, 20, 7, 20, 16, 11, 21, 2, 16, 2, 7])
        .moveTo(2, 7).lineTo(11, 12).lineTo(20, 7)
        .moveTo(11, 12).lineTo(11, 21);
      break;
    case 'bath':
      graphics.moveTo(2, 12).lineTo(20, 12).lineTo(18, 18).lineTo(15, 20).lineTo(7, 20).lineTo(4, 18).closePath()
        .moveTo(5, 12).lineTo(5, 5).quadraticCurveTo(5, 2, 8, 2).lineTo(10, 2).lineTo(10, 5)
        .moveTo(1, 12).lineTo(21, 12);
      break;
  }
  graphics.stroke({ color, width: 1.7, cap: 'round', join: 'round' });
}

function createLabels(page: WechatMinigame.Image) {
  const source = new ImageSource({
    resource: page as unknown as HTMLImageElement,
    width: page.width,
    height: page.height
  });
  const textures = new Map(Array.from(labelGlyphs, (glyph, index) => [glyph, new Texture({
    source,
    frame: new Rectangle(index % labelColumns * labelCell, Math.floor(index / labelColumns) * labelCell, labelCell, labelCell)
  })]));

  return function label(text: string, size: number, color: number, centered = false) {
    const row = new Container();
    let advance = 0;
    for (const glyph of text) {
      const step = size * (glyph === ' ' || glyph === '·' ? .42 : 1.02);
      const texture = textures.get(glyph);
      if (texture) {
        const sprite = new Sprite(texture);
        const dimension = size * (glyph === '·' ? .77 : 1.33);
        sprite.anchor.set(.5);
        sprite.position.set(advance + step / 2, 0);
        sprite.setSize(dimension);
        sprite.tint = color;
        row.addChild(sprite);
      }
      advance += step;
    }
    if (centered) row.pivot.x = advance / 2;
    return row;
  };
}

export function createHouseHud(
  stage: Container, width: number, height: number, page: WechatMinigame.Image, selectRoom: (room: RoomId) => void
) {
  const label = createLabels(page);
  const header = new Container();
  const panel = new Container();
  const surfaces = new Graphics();
  stage.addChild(header, panel);
  panel.addChild(surfaces);

  const headerBackground = new Graphics().roundRect(0, 0, 41, 43, 13).fill(brick);
  const house = new Graphics();
  drawIcon(house, 'exterior', paper);
  house.position.set(9.5, 9.5);
  const title = label(houseTitle, 24, ink);
  title.position.set(53, 14);
  const location = label(houseLocation, 11, muted);
  location.position.set(54, 35);
  header.addChild(headerBackground, house, title, location);

  const orbitHint = new Container();
  orbitHint.position.set((panelWidth - 96) / 2, -39);
  const orbitBadge = new Graphics()
    .roundRect(0, 0, 96, 26, 13).fill({ color: paper, alpha: .88 })
    .stroke({ color: 0xd6c5a7, width: 1 })
    .moveTo(28, 12).quadraticCurveTo(23, 5, 17, 12)
    .moveTo(18, 7).lineTo(17, 12).lineTo(22, 12)
    .moveTo(17, 14).quadraticCurveTo(22, 21, 28, 14)
    .moveTo(23, 14).lineTo(28, 14).lineTo(27, 19)
    .stroke({ color: muted, width: 1.25, cap: 'round', join: 'round' });
  const orbitLabel = label(houseOrbitHint, 11, muted);
  orbitLabel.position.set(36, 13);
  orbitHint.addChild(orbitBadge, orbitLabel);
  panel.addChild(orbitHint);

  const controls = buttons.map(({ room, x, y }) => {
    const icon = new Graphics();
    icon.position.set(x + 10, y + 12);
    const name = label(room.label, 13, ink, true);
    name.position.set(x + 66, y + 23);
    const currentTitle = label(room.title, 19, ink);
    currentTitle.position.set(16, 27);
    const floor = label(room.floor, 11, room.color, true);
    floor.position.set(317, 27);
    panel.addChild(icon, name, currentTitle, floor);
    return { room, x, y, icon, currentTitle, floor };
  });

  let selected: RoomId = 'exterior';
  let pressed: RoomId | undefined;

  function draw() {
    const activeRoom = rooms.find(room => room.id === selected)!;
    surfaces.clear()
      .roundRect(0, 4, panelWidth, panelHeight, 21).fill({ color: 0x5c4333, alpha: .16 })
      .roundRect(0, 0, panelWidth, panelHeight, 21).fill(paper)
      .roundRect(291, 15, 52, 24, 12).fill({ color: activeRoom.color, alpha: .14 })
      .rect(15, 45, 330, 1).fill(0xe4d7bf);

    for (const { room, x, y, icon, currentTitle, floor } of controls) {
      const active = room.id === selected;
      const down = room.id === pressed;
      currentTitle.visible = floor.visible = active;
      surfaces.roundRect(x, y, buttonWidth, buttonHeight, 11)
        .fill(active || down ? { color: room.color, alpha: down ? .28 : .18 } : 0xf6eedc)
        .stroke({ width: 1, color: active || down ? room.color : 0xe4d6bd });
      drawIcon(icon, room.id, active ? room.color : muted);
    }
  }

  function resize(viewWidth: number, viewHeight: number) {
    const { safeArea, screenHeight } = wx.getSystemInfoSync();
    const bottomInset = safeArea ? Math.max(0, screenHeight - safeArea.bottom) : 0;
    const scale = Math.min(1.15, (viewWidth - 24) / panelWidth, viewHeight / 560);
    const left = (viewWidth - panelWidth * scale) / 2;
    header.scale.set(scale);
    panel.scale.set(scale);
    header.position.set(left + 2, Math.max(18, (safeArea?.top ?? 0) + 12));
    panel.position.set(left, viewHeight - panelHeight * scale - Math.max(16, bottomInset + 7));
  }

  function hit(point: Point) {
    const x = (point.x - panel.x) / panel.scale.x;
    const y = (point.y - panel.y) / panel.scale.y;
    return buttons.find(button => x >= button.x && x < button.x + buttonWidth
      && y >= button.y && y < button.y + buttonHeight)?.room.id;
  }

  resize(width, height);
  draw();

  return {
    resize,
    ...(typeof GAME_BROWSER_CHECK !== 'undefined' && GAME_BROWSER_CHECK && {
      inspectControls: () => buttons.map(({ room, x, y }) => ({
        id: room.id, label: room.label,
        x: panel.x + x * panel.scale.x, y: panel.y + y * panel.scale.y,
        width: buttonWidth * panel.scale.x, height: buttonHeight * panel.scale.y
      }))
    }),
    beginGesture(point: Point): HudGesture | undefined {
      const room = hit(point);
      if (!room) return;
      pressed = room;
      draw();
      return {
        move(next) {
          if (pressed && hit(next) !== room) {
            pressed = undefined;
            draw();
          }
        },
        release(next) {
          const activate = pressed === room && hit(next) === room && room !== selected;
          pressed = undefined;
          if (activate) {
            selectRoom(room);
            selected = room;
          }
          draw();
        },
        cancel() {
          pressed = undefined;
          draw();
        }
      };
    }
  };
}
