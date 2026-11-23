import { Container, Graphics } from 'pixi.js';
import type { HudGesture } from '../framework/platform/WechatPlatform';
import type { HudView } from '../framework/ui/PixiHud';
import type { ModelStatus } from './scenes/littlest-tokyo/LittlestTokyo';
import { toolbar } from './ui/toolbarLayout';
import { drawHomeHud } from './scenes/home/HomeHud';
import { drawModelHud } from './scenes/littlest-tokyo/ModelHud';
import { createWorkbenchHud } from './scenes/workbench/WorkbenchHud';

type Point = Parameters<HudGesture['move']>[0];
type ActivityView = HudView & { dispose(): void };

interface Actions {
  open(): Promise<void>;
  openColorMatch(): Promise<void>;
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
  panel.addChild(backdrop, buttons);
  stage.addChild(panel);

  const { step, padding, size } = toolbar;
  const panelWidth = step * 5 + padding * 2;
  const panelHeight = size + padding * 2;
  backdrop.roundRect(0, 0, panelWidth, panelHeight, 12).fill(0x102746);
  const workbench = createWorkbenchHud(panel, buttons, draw);
  let activity: ActivityView | undefined;
  let viewport = { width, height };

  function draw() {
    const state = actions.state();
    workbench.setVisible(state.screen === 'workbench');
    buttons.clear();
    if (state.screen === 'home') {
      drawHomeHud(buttons, Boolean(actions.openModel));
      return;
    }
    buttons.roundRect(padding, padding, size, size, 8).fill(0x304764)
      .moveTo(20, 28).lineTo(36, 28).moveTo(26, 22).lineTo(20, 28).lineTo(26, 34)
      .stroke({ color: 0xffffff, width: 2 });
    if (state.screen === 'model') {
      drawModelHud(buttons, state.load);
      return;
    }
    workbench.draw(state);
  }

  function resize(width: number, height: number) {
    viewport = { width, height };
    activity?.resize(width, height);
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
    if (state.screen === 'home' && (index === 1 || index === 2 || (index === 4 && actions.openModel))) return index;
    if (state.screen === 'model' && (index === 0 || (index === 4 && state.load.stage === 'error'))) return index;
  }
  resize(width, height);
  draw();
  return {
    resize,
    refresh: draw,
    mountActivity(create: (stage: Container, width: number, height: number) => ActivityView) {
      activity = create(stage, viewport.width, viewport.height);
      panel.visible = false;
    },
    closeActivity() {
      activity?.dispose();
      activity = undefined;
      panel.visible = true;
    },
    beginGesture(point: Point): HudGesture | undefined {
      if (activity) return activity.beginGesture(point);
      const pressed = buttonAt(point);
      if (pressed === undefined) return;
      const pressedScreen = actions.state().screen;
      let valid = true;
      return {
        move(next) { valid &&= buttonAt(next) === pressed; },
        release(next) {
          const state = actions.state();
          if (activity || !valid || state.screen !== pressedScreen || buttonAt(next) !== pressed) return;
          if (state.screen === 'home') {
            const open = pressed === 1 ? actions.openColorMatch : pressed === 2 ? actions.open : actions.openModel;
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
