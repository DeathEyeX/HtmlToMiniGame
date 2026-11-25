import { Container, Graphics, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { HudGesture } from '../../../../framework/platform/WechatPlatform';
import type { createExhibitScene, Specimen } from '../three/exhibitScene';
import { labelFrames } from './labelFrames';

type Point = Parameters<HudGesture['move']>[0];
type Action = 'walk' | 'turntable' | 'reset' | 'switch';
type ExhibitActions = Pick<ReturnType<typeof createExhibitScene>, 'toggleWalk' | 'toggleTurntable' | 'resetView' | 'switchSpecimen'>;

const cyan = 0x83f9e6;
const ice = 0xe8f3ff;
const muted = 0xa4bad1;
const buttonWidth = 83;
const buttonHeight = 44;
const buttonGap = 5;

export function createExhibitHud(stage: Container, width: number, height: number,
  page: WechatMinigame.Image, actions: ExhibitActions
) {
  // Prebaked glyphs keep the same type and metrics on WeChat's offscreen canvas.
  const source = new ImageSource({ resource: page as unknown as HTMLImageElement, width: page.width, height: page.height });
  function label(key: keyof typeof labelFrames, color: number, x: number, y: number) {
    const frame = new Rectangle(...labelFrames[key]);
    const sprite = new Sprite(new Texture({ source, frame }));
    sprite.tint = color;
    sprite.scale.set(.5);
    sprite.anchor.set(0, .5);
    sprite.position.set(x, y);
    return sprite;
  }

  const header = new Container();
  const headerLine = new Graphics()
    .poly([0, 2, 10, 2, 14, 6, 10, 10, 0, 10, 4, 6]).fill(cyan)
    .rect(0, 105, 32, 2).fill(cyan)
    .rect(32, 105, 78, 2).fill({ color: cyan, alpha: .2 });
  const houndTitle = label('title', ice, 0, 48);
  const houndName = label('specimen', muted, 1, 83);
  const wraithTitle = label('wraithTitle', ice, 0, 48);
  const wraithName = label('wraithSpecimen', muted, 1, 83);
  header.addChild(headerLine, label('gallery', cyan, 24, 7), houndTitle, houndName, wraithTitle, wraithName);

  const rails = new Graphics();
  const hint = new Container();
  const hintMark = new Graphics()
    .moveTo(7, 16).lineTo(2, 11).lineTo(7, 6)
    .moveTo(19, 6).lineTo(24, 11).lineTo(19, 16)
    .moveTo(3, 11).lineTo(23, 11)
    .stroke({ color: cyan, width: 1.3, cap: 'round', join: 'round' });
  hint.addChild(hintMark, label('orbit', muted, 34, 11));

  const dock = new Container();
  const turntableIcon = new Graphics();
  const walkIcon = new Graphics();
  const pause = label('pause', ice, 23, 22);
  const play = label('play', ice, 23, 22);
  const stop = label('stop', ice, 23, 22);
  const walk = label('walk', ice, 23, 22);
  const resetIcon = new Graphics()
    .arc(12, 22, 5.5, -.75, Math.PI * 1.36)
    .moveTo(7, 15).lineTo(9, 18).lineTo(5, 18)
    .stroke({ color: muted, width: 1.45, cap: 'round', join: 'round' });
  const switchIcon = new Graphics()
    .moveTo(6, 20).lineTo(18, 20).lineTo(15, 17)
    .moveTo(18, 24).lineTo(6, 24).lineTo(9, 27)
    .stroke({ color: muted, width: 1.45, cap: 'round', join: 'round' });
  const buttons = ([
    { action: 'walk', items: [walkIcon, walk, stop] },
    { action: 'turntable', items: [turntableIcon, pause, play] },
    { action: 'reset', items: [resetIcon, label('reset', ice, 23, 22)] },
    { action: 'switch', items: [switchIcon, label('switch', ice, 23, 22)] }
  ] as const).map(({ action, items }) => {
    const button = new Container();
    const surface = new Graphics();
    button.addChild(surface, ...items);
    dock.addChild(button);
    return { action, button, surface };
  });
  stage.addChild(rails, header, hint, dock);

  let spinning = true;
  let walking = true;
  let specimen: Specimen = 'wraith';
  let pressed: Action | undefined;

  function draw() {
    wraithTitle.visible = wraithName.visible = specimen === 'wraith';
    houndTitle.visible = houndName.visible = specimen === 'hound';
    pause.visible = spinning;
    play.visible = !spinning;
    stop.visible = walking;
    walk.visible = !walking;
    turntableIcon.clear();
    if (spinning) {
      turntableIcon.roundRect(8, 16.5, 2.5, 11, 1).roundRect(13.5, 16.5, 2.5, 11, 1);
    } else {
      turntableIcon.poly([8, 16, 17, 22, 8, 28]);
    }
    turntableIcon.fill(cyan);
    walkIcon.clear();
    if (walking) walkIcon.roundRect(8, 18, 8, 8, 1).fill(0xff75af);
    else walkIcon.poly([8, 16, 17, 22, 8, 28]).fill(0xff75af);
    for (const { action, surface } of buttons) {
      const primary = action === 'walk';
      const fill = primary ? 0x382137 : 0x172538;
      surface.clear().roundRect(0, 0, buttonWidth, buttonHeight, 6)
        .fill(pressed === action ? (primary ? 0x552e49 : 0x244053) : fill)
        .stroke({ color: primary ? 0x855271 : 0x3d566e, width: 1 });
    }
  }

  function resize(viewWidth: number, viewHeight: number) {
    const { safeArea, screenHeight, screenWidth } = wx.getSystemInfoSync();
    const wide = viewWidth >= 700;
    const margin = wide ? Math.min(48, viewWidth * .046) : 20;
    const left = Math.max(margin, (safeArea?.left ?? 0) + 10);
    const right = viewWidth - Math.max(margin, safeArea ? screenWidth - safeArea.right + 10 : 0);
    const top = Math.max(wide ? 48 : 30, (safeArea?.top ?? 0) + 12);
    const bottom = viewHeight - Math.max(wide ? 34 : 23, safeArea ? screenHeight - safeArea.bottom + 10 : 0);
    const columns = right - left >= 4 * buttonWidth + 3 * buttonGap ? 4 : 2;
    const dockWidth = columns * (buttonWidth + buttonGap) - buttonGap;
    const dockHeight = (buttons.length / columns) * (buttonHeight + buttonGap) - buttonGap;
    header.position.set(left, top);
    header.scale.set(wide && viewHeight >= 530 ? 1 : .77);
    dock.position.set(wide ? right - dockWidth : (left + right - dockWidth) / 2, bottom - dockHeight);
    buttons.forEach(({ button }, index) =>
      button.position.set(index % columns * (buttonWidth + buttonGap), Math.floor(index / columns) * (buttonHeight + buttonGap)));
    hint.position.set(wide ? left : (left + right - 89) / 2, bottom - (wide ? 33 : dockHeight + 34));
    const railY = bottom - (wide ? 61 : dockHeight + 44);
    rails.clear().moveTo(left, railY).lineTo(right, railY)
      .stroke({ color: 0x56708b, alpha: .43, width: 1 });
  }

  function hit(point: Point): Action | undefined {
    return buttons.find(({ button }) => {
      const x = point.x - dock.x - button.x;
      const y = point.y - dock.y - button.y;
      return x >= 0 && x < buttonWidth && y >= 0 && y < buttonHeight;
    })?.action;
  }

  resize(width, height);
  draw();
  return {
    resize,
    beginGesture(point: Point): HudGesture | undefined {
      const action = hit(point);
      if (!action) return;
      pressed = action;
      draw();
      return {
        move(next) {
          pressed = hit(next) === action ? action : undefined;
          draw();
        },
        release(next) {
          pressed = undefined;
          if (hit(next) === action) {
            if (action === 'turntable') spinning = actions.toggleTurntable();
            else if (action === 'walk') walking = actions.toggleWalk();
            else if (action === 'reset') actions.resetView();
            else specimen = actions.switchSpecimen();
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
