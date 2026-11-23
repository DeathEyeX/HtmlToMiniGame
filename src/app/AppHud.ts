import { Container, Graphics, Sprite } from 'pixi.js';
import type { HudGesture } from '../platform/WechatPlatform';
import type { ModelStatus } from '../scenes/LittlestTokyo';
import { loadPackagedUIAtlas } from '../ui/packagedUIAtlas';
import { finishes } from './finishes';

type Point = Parameters<HudGesture['move']>[0];

interface Actions {
  open(): Promise<void>;
  openModel?(): Promise<void>;
  back(): void;
  state():
    | { screen: 'home' }
    | { screen: 'workbench'; selected: number; confirmed: boolean }
    | { screen: 'model'; load: ModelStatus };
  choose(index: number): void;
  confirm(): void;
  retry(): void;
}

export function createAppHud(stage: Container, width: number, height: number, actions: Actions) {
  const panel = new Container();
  const backdrop = new Graphics();
  const buttons = new Graphics();
  const palette = new Container();
  panel.addChild(backdrop, buttons, palette);
  stage.addChild(panel);

  const step = 44;
  const padding = 8;
  const size = 40;
  const panelWidth = step * 5 + padding * 2;
  const panelHeight = size + padding * 2;
  backdrop.roundRect(0, 0, panelWidth, panelHeight, 12).fill(0x102746);
  let requestedPalette = false;

  async function loadPalette() {
    try {
      const atlas = await loadPackagedUIAtlas();
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
    } catch (error) {
      console.warn('[App] Workbench uses Graphics swatches', error);
    }
  }

  function draw() {
    const state = actions.state();
    palette.visible = state.screen === 'workbench';
    buttons.clear();
    if (state.screen === 'home') {
      const x = padding + 2 * step;
      buttons.roundRect(x, padding, size, size, 8).fill(0x245cc7)
        .moveTo(x + 12, 28).lineTo(x + 28, 28)
        .moveTo(x + 22, 22).lineTo(x + 28, 28).lineTo(x + 22, 34)
        .stroke({ color: 0xffffff, width: 2 });
      if (actions.openModel) {
        const modelX = padding + 4 * step;
        buttons.roundRect(modelX, padding, size, size, 8).fill(0x147b6e)
          .rect(modelX + 9, 26, 6, 11).rect(modelX + 16, 17, 8, 20)
          .rect(modelX + 25, 21, 6, 16).fill(0xffffff);
      }
      return;
    }
    buttons.roundRect(padding, padding, size, size, 8).fill(0x304764)
      .moveTo(20, 28).lineTo(36, 28).moveTo(26, 22).lineTo(20, 28).lineTo(26, 34)
      .stroke({ color: 0xffffff, width: 2 });
    if (state.screen === 'model') {
      buttons.roundRect(63, 25, 101, 6, 3).fill(0x304764);
      const { load } = state;
      if (load.stage === 'error') {
        const retryX = padding + 4 * step;
        buttons.roundRect(retryX, padding, size, size, 8).fill(0xa44742)
          .arc(retryX + 20, 28, 8, -Math.PI / 2, Math.PI).stroke({ color: 0xffffff, width: 2 })
          .moveTo(retryX + 15, 23).lineTo(retryX + 20, 20).lineTo(retryX + 15, 17)
          .stroke({ color: 0xffffff, width: 2 });
      } else {
        const length = load.stage === 'ready' ? 101 : Math.max(6, Math.min(101, load.progress * 1.01));
        buttons.roundRect(63, 25, length, 6, 3).fill(load.stage === 'ready' ? 0x58dcc1 : 0x68c8fc);
      }
      return;
    }
    if (!requestedPalette) {
      requestedPalette = true;
      void loadPalette();
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
  function buttonAt(point: Point) {
    const x = (point.x - panel.x) / panel.scale.x - padding;
    const y = (point.y - panel.y) / panel.scale.y - padding;
    const index = Math.floor(x / step);
    if (y < 0 || y >= size || index < 0 || index > 4 || x % step >= size) return;
    const state = actions.state();
    if (state.screen === 'workbench') return index;
    if (state.screen === 'home' && (index === 2 || (index === 4 && actions.openModel))) return index;
    if (state.screen === 'model' && (index === 0 || (index === 4 && state.load.stage === 'error'))) return index;
  }
  resize(width, height);
  draw();
  return {
    resize,
    refresh: draw,
    beginGesture(point: Point): HudGesture | undefined {
      const pressed = buttonAt(point);
      if (pressed === undefined) return;
      const pressedScreen = actions.state().screen;
      let valid = true;
      return {
        move(next) { valid &&= buttonAt(next) === pressed; },
        release(next) {
          const state = actions.state();
          if (!valid || state.screen !== pressedScreen || buttonAt(next) !== pressed) return;
          if (state.screen === 'home') {
            const open = pressed === 2 ? actions.open : actions.openModel;
            void open?.().then(draw);
            return;
          }
          if (pressed === 0) actions.back();
          else if (state.screen === 'model') actions.retry();
          else if (pressed === 4) actions.confirm();
          else actions.choose(pressed - 1);
          draw();
        },
        cancel() {}
      };
    }
  };
}
