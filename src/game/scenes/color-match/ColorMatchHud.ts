import { Container, Graphics, type BitmapText } from 'pixi.js';
import type { HudGesture } from '../../../framework/platform/WechatPlatform';
import { loadPackagedUIAtlas } from '../../ui/packagedUIAtlas';
import type { createColorMatchScene } from './ColorMatch';
import { matchColors, roundSeconds } from './round';

type Point = Parameters<HudGesture['move']>[0];

export function createColorMatchHud(
  stage: Container,
  width: number,
  height: number,
  match: ReturnType<typeof createColorMatchScene>,
  back: () => void
) {
  const size = { width: 236, height: 104 };
  const panel = new Container();
  const graphics = new Graphics();
  panel.addChild(graphics);
  stage.addChild(panel);
  let timer: BitmapText | undefined;
  let score: BitmapText | undefined;

  function draw() {
    const state = match.state();
    graphics.clear().roundRect(0, 0, size.width, size.height, 12).fill(0x102746)
      .circle(22, 20, 7).stroke({ color: 0x68c8fc, width: 2 })
      .moveTo(22, 16).lineTo(22, 20).lineTo(25, 22).stroke({ color: 0x68c8fc, width: 2 })
      .star(137, 20, 5, 8).fill(0xffcf67)
      .roundRect(15, 39, 206, 4, 2).fill(0x304764);
    if (state.seconds > 0) graphics.roundRect(15, 39, 206 * state.seconds / roundSeconds, 4, 2).fill(0x68c8fc);
    if (timer && score) {
      timer.text = String(state.seconds).padStart(2, '0');
      score.text = String(state.score).padStart(2, '0');
    } else {
      for (let index = 0; index < Math.min(state.score, 10); index++) {
        graphics.rect(153 + index * 6, 18, 4, 5).fill(0xffcf67);
      }
    }

    graphics.roundRect(8, 54, 40, 40, 8).fill(0x304764)
      .moveTo(20, 74).lineTo(36, 74).moveTo(26, 68).lineTo(20, 74).lineTo(26, 80)
      .stroke({ color: 0xffffff, width: 2 });
    if (state.phase === 'playing') {
      matchColors.forEach((color, index) => {
        graphics.roundRect(56 + 58 * index, 54, 56, 40, 8).fill(color);
      });
    } else {
      graphics.roundRect(56, 54, 172, 40, 8).fill(0x245cc7);
      if (state.phase === 'ready') {
        graphics.poly([136, 64, 136, 84, 152, 74]).fill(0xffffff);
      } else {
        graphics.arc(142, 74, 8, -Math.PI / 2, Math.PI).stroke({ color: 0xffffff, width: 2 })
          .moveTo(137, 68).lineTo(142, 66).lineTo(137, 63).stroke({ color: 0xffffff, width: 2 });
      }
    }
  }

  function resize(viewWidth: number, viewHeight: number) {
    const scale = Math.min(1, viewWidth / size.width, viewHeight / size.height);
    panel.scale.set(scale);
    panel.position.set((viewWidth - size.width * scale) / 2, Math.max(0, viewHeight - size.height * scale - 24));
  }

  function hit(point: Point) {
    if (panel.destroyed) return;
    const x = (point.x - panel.x) / panel.scale.x;
    const y = (point.y - panel.y) / panel.scale.y;
    if (y < 54 || y >= 94) return;
    if (x >= 8 && x < 48) return 'back';
    if (x < 56 || x >= 228) return;
    if (match.state().phase !== 'playing') return 'start';
    if ((x - 56) % 58 < 56) return Math.floor((x - 56) / 58);
  }

  resize(width, height);
  draw();
  void loadPackagedUIAtlas().then((atlas) => {
    if (panel.destroyed) return;
    timer = atlas.createNumber('00', 20);
    timer.position.set(36, 10);
    score = atlas.createNumber('00', 20);
    score.position.set(152, 10);
    panel.addChild(timer, score);
    draw();
  }).catch((error: unknown) => console.warn('[App] Color match uses Graphics meters', error));

  return {
    resize,
    refresh: draw,
    dispose() { panel.destroy({ children: true }); },
    beginGesture(point: Point): HudGesture | undefined {
      const pressed = hit(point);
      if (pressed === undefined) return;
      let valid = true;
      return {
        move(next) { valid &&= hit(next) === pressed; },
        release(next) {
          if (!valid || hit(next) !== pressed) return;
          if (pressed === 'back') back();
          else if (pressed === 'start') match.start();
          else match.choose(pressed);
        },
        cancel() {}
      };
    }
  };
}
